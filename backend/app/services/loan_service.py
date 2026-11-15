"""
Module: backend.app.services.loan_service
Mục đích: Xử lý toàn bộ logic nghiệp vụ vòng đời mượn trả thiết bị học tập, tích hợp MySQL và Blockchain EVM.
Áp dụng: Quy định viết code và docstring tại QUY_DINH_CODE.md.
"""
from datetime import datetime
from typing import Any, Dict, List, Optional
from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from backend.app.models.audit_log import AuditLog
from backend.app.models.blockchain_tx import BlockchainTransaction, TxActionType, TxStatus
from backend.app.models.equipment import Equipment, EquipmentStatus
from backend.app.models.lending_request import DepositStatus, LendingRequest, LoanStatus, ReturnCondition
from backend.app.models.user import User, UserRole
from backend.app.schemas.loan import (
    LoanApproveRequest,
    LoanCancelRequest,
    LoanCreateRequest,
    LoanHandoverRequest,
    LoanRejectRequest,
    LoanReturnRequest,
)
from backend.app.services.blockchain_service import (
    blockchain_service,
    normalize_hex_bytes32,
)
from backend.app.services.equipment_service import get_equipment_by_id, get_equipment_for_update


def normalize_naive_dt(dt: datetime) -> datetime:
    """
    Mục đích: Chuẩn hóa datetime (có múi giờ hoặc naive) về naive local time nhất quán với MySQL DATETIME.
    """
    if dt.tzinfo is not None and dt.utcoffset() is not None:
        return dt.astimezone().replace(tzinfo=None)
    return dt


def _upsert_tx_record(
    db: Session,
    request_id: Optional[int],
    tx_hash: str,
    action_type: TxActionType,
    from_address: str,
    to_address: str,
    tx_status: TxStatus,
    block_number: Optional[int] = None,
    gas_used: Optional[int] = None,
    error_message: Optional[str] = None,
) -> BlockchainTransaction:
    """
    Mục đích: Lưu hoặc cập nhật bản ghi giao dịch Blockchain theo lifecycle PENDING -> CONFIRMED/FAILED.
    """
    normalized_hash = normalize_hex_bytes32(tx_hash, 32)
    existing = db.query(BlockchainTransaction).filter(
        BlockchainTransaction.tx_hash == normalized_hash
    ).first()
    if existing is not None:
        existing.block_number = block_number if block_number is not None else existing.block_number
        existing.gas_used = gas_used if gas_used is not None else existing.gas_used
        existing.status = tx_status
        existing.error_message = error_message
        return existing

    tx_row = BlockchainTransaction(
        request_id=request_id,
        tx_hash=normalized_hash,
        action_type=action_type,
        from_address=from_address,
        to_address=to_address or (blockchain_service.contract_address or "contract"),
        block_number=block_number,
        gas_used=gas_used,
        status=tx_status,
        error_message=error_message,
    )
    db.add(tx_row)
    return tx_row


def _ensure_chain_ready_or_http() -> None:
    """
    Mục đích: Kiểm tra kết nối node RPC, đúng Chain ID và Contract bytecode; ném HTTP 503 nếu offline.
    """
    try:
        blockchain_service.ensure_ready()
    except ConnectionError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Mạng Blockchain tạm thời không khả dụng: {exc}"
        ) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Lỗi cấu hình Blockchain Smart Contract: {exc}"
        ) from exc


def _require_verified_wallet(user: User) -> str:
    """
    Mục đích: Đảm bảo người thực hiện đã liên kết và xác minh quyền sở hữu ví MetaMask (EIP-191).
    """
    if not user.wallet_address or not user.wallet_verified:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Tài khoản chưa liên kết và xác minh quyền sở hữu ví MetaMask (EIP-191). Vui lòng xác minh ví trước."
        )
    return user.wallet_address


def _normalize_hash_or_400(raw_value: Optional[str], field_name: str = "tx_hash") -> str:
    """
    Mục đích: Chuẩn hóa chuỗi hash 32 bytes (tx_hash hoặc loanId) và ném HTTP 400 nếu thiếu hoặc sai định dạng.
    """
    if not raw_value or not raw_value.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Thiếu mã `{field_name}` từ giao dịch MetaMask."
        )
    try:
        return normalize_hex_bytes32(raw_value, 32)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Định dạng `{field_name}` không hợp lệ: {exc}"
        ) from exc


def _check_tx_idempotency_or_replay(
    db: Session,
    loan_id: int,
    action_type: TxActionType,
    norm_tx_hash: str,
) -> bool:
    """
    Mục đích: Kiểm tra chống replay tx_hash hoặc phát hiện retry idempotent cho cùng đơn và hành động.
    Trả về:
        - True nếu giao dịch này đã CONFIRMED cho đúng `(loan_id, action_type)`.
        - False nếu tx_hash chưa từng được ghi nhận.
    Lỗi:
        - HTTPException(409 Conflict): Nếu tx_hash đã được dùng cho đơn hoặc bước xử lý khác.
    """
    existing = db.query(BlockchainTransaction).filter(
        BlockchainTransaction.tx_hash == norm_tx_hash
    ).first()
    if existing is None:
        return False

    if (
        existing.request_id == loan_id
        and existing.action_type == action_type
        and existing.status == TxStatus.CONFIRMED
    ):
        return True

    raise HTTPException(
        status_code=status.HTTP_409_CONFLICT,
        detail="Transaction hash đã được sử dụng cho một thao tác hoặc đơn mượn khác (chống replay)."
    )


def _verify_and_record_lifecycle_tx(
    db: Session,
    loan: LendingRequest,
    actor: User,
    raw_tx_hash: Optional[str],
    action_type: TxActionType,
    expected_event: str,
    expected_args: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    Mục đích: Xác thực biên lai MetaMask cho các bước vòng đời đơn mượn và lưu bản ghi `CONFIRMED`.
    """
    if not loan.on_chain_loan_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Đơn mượn chưa có mã định danh `on_chain_loan_id` trên Smart Contract."
        )

    norm_tx_hash = _normalize_hash_or_400(raw_tx_hash, "tx_hash")
    _check_tx_idempotency_or_replay(db, loan.id, action_type, norm_tx_hash)
    _ensure_chain_ready_or_http()

    expected_sender: Optional[str] = None
    if actor.role == UserRole.ADMIN:
        if actor.wallet_verified and actor.wallet_address:
            expected_sender = actor.wallet_address
    else:
        expected_sender = _require_verified_wallet(actor)

    try:
        verified = blockchain_service.verify_transaction_receipt(
            tx_hash=norm_tx_hash,
            expected_event=expected_event,
            expected_loan_id=loan.on_chain_loan_id,
            expected_sender=expected_sender,
            expected_args=expected_args,
        )
    except ConnectionError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Mất kết nối node Blockchain khi xác thực {action_type.value}: {exc}"
        ) from exc
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Biên lai giao dịch {action_type.value} không hợp lệ: {exc}"
        ) from exc

    if actor.role == UserRole.ADMIN:
        tx_sender = verified.get("from_address")
        if tx_sender and (not actor.wallet_verified or actor.wallet_address != tx_sender):
            existing_holder = db.query(User).filter(User.wallet_address == tx_sender, User.id != actor.id).first()
            if existing_holder is None:
                actor.wallet_address = tx_sender
                actor.wallet_verified = True
                db.flush()

    _upsert_tx_record(
        db=db,
        request_id=loan.id,
        tx_hash=verified["tx_hash"],
        action_type=action_type,
        from_address=verified["from_address"],
        to_address=verified["to_address"],
        tx_status=TxStatus.CONFIRMED,
        block_number=verified.get("block_number"),
        gas_used=verified.get("gas_used"),
    )
    return verified


def _get_onchain_loan_or_503(on_chain_loan_id: str) -> Dict[str, Any]:
    try:
        return blockchain_service.get_loan(normalize_hex_bytes32(on_chain_loan_id, 32))
    except ConnectionError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Mất kết nối node Blockchain khi đọc trạng thái đơn: {exc}"
        ) from exc


def compute_is_overdue(loan: LendingRequest) -> bool:
    """
    Mục đích: Suy luận động trạng thái quá hạn của đơn mượn (status = ACTIVE và hiện tại > due_date).
    """
    return bool(loan.status == LoanStatus.ACTIVE and datetime.now() > normalize_naive_dt(loan.due_date))


def get_loan_by_id(db: Session, loan_id: int) -> Optional[LendingRequest]:
    """
    Mục đích: Truy vấn thông tin đơn mượn theo khóa chính ID.
    Tham số:
        - db (Session): Phiên làm việc CSDL.
        - loan_id (int): Khóa chính ID đơn mượn.
    Trả về:
        - Optional[LendingRequest]: Đối tượng đơn mượn nếu tìm thấy.
    Lỗi:
        - Không.
    Tác dụng phụ:
        - Truy vấn SELECT.
    """
    return db.query(LendingRequest).filter(LendingRequest.id == loan_id).first()


def get_loans(
    db: Session,
    user_id: Optional[int] = None,
    status_filter: Optional[LoanStatus] = None,
    skip: int = 0,
    limit: int = 100
) -> List[LendingRequest]:
    """
    Mục đích: Lấy danh sách các đơn mượn, hỗ trợ lọc theo người dùng (cho sinh viên xem đơn của mình) và trạng thái.
    Tham số:
        - db (Session): Phiên làm việc CSDL.
        - user_id (Optional[int]): Lọc theo ID người mượn (nếu có).
        - status_filter (Optional[LoanStatus]): Lọc theo trạng thái đơn.
        - skip (int): Số bản ghi bỏ qua.
        - limit (int): Số bản ghi tối đa.
    Trả về:
        - List[LendingRequest]: Danh sách các đơn mượn phù hợp.
    Lỗi:
        - Không.
    Tác dụng phụ:
        - Truy vấn SELECT.
    """
    query = db.query(LendingRequest)
    if user_id is not None:
        query = query.filter(LendingRequest.user_id == user_id)
    if status_filter is not None:
        query = query.filter(LendingRequest.status == status_filter)

    return query.order_by(LendingRequest.id.desc()).offset(skip).limit(limit).all()


def create_loan_request(
    db: Session,
    borrower_user: User,
    loan_in: LoanCreateRequest
) -> LendingRequest:
    """
    Mục đích: Sinh viên khởi tạo yêu cầu mượn thiết bị mới (trạng thái PENDING).
    Tham số:
        - db (Session): Phiên làm việc CSDL.
        - borrower_user (User): Sinh viên đang thực hiện yêu cầu.
        - loan_in (LoanCreateRequest): DTO chứa ID thiết bị và các mốc thời gian mượn.
    Trả về:
        - LendingRequest: Bản ghi yêu cầu mượn vừa được tạo trong MySQL.
    Lỗi:
        - HTTPException(400 Bad Request): Khi ngày trả <= ngày nhận hoặc ngày nhận trong quá khứ.
        - HTTPException(404 Not Found): Khi ID thiết bị không tồn tại.
        - HTTPException(409 Conflict): Khi thiết bị không ở trạng thái AVAILABLE hoặc sinh viên đang có đơn PENDING/ACTIVE cho thiết bị này.
    Tác dụng phụ:
        - Ghi mới bản ghi vào bảng `lending_requests` và `audit_logs`.
    """
    expected_handover_dt = normalize_naive_dt(loan_in.expected_handover_date)
    due_dt = normalize_naive_dt(loan_in.due_date)
    if due_dt <= expected_handover_dt:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Thời gian hạn chót trả máy phải sau thời gian dự kiến nhận máy."
        )

    raw_tx = loan_in.tx_hash.strip() if loan_in.tx_hash and loan_in.tx_hash.strip() else None
    raw_client_tx = (
        loan_in.client_tx_hash.strip() if loan_in.client_tx_hash and loan_in.client_tx_hash.strip() else None
    )
    effective_tx = raw_tx or raw_client_tx
    if not (loan_in.on_chain_loan_id and loan_in.on_chain_loan_id.strip()) or not effective_tx:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Kiến trúc Pure Web3 yêu cầu cung cấp đồng thời `on_chain_loan_id` và `tx_hash` đã ký `createLoan` qua MetaMask."
        )

    norm_loan_id = _normalize_hash_or_400(loan_in.on_chain_loan_id, "on_chain_loan_id")
    norm_tx_hash = _normalize_hash_or_400(effective_tx, "tx_hash")
    if raw_tx and raw_client_tx:
        norm_client_tx = _normalize_hash_or_400(raw_client_tx, "client_tx_hash")
        norm_primary_tx = _normalize_hash_or_400(raw_tx, "tx_hash")
        if norm_client_tx != norm_primary_tx:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Giá trị `tx_hash` và `client_tx_hash` không khớp nhau."
            )

    # Kiểm tra replay / idempotent retry theo on_chain_loan_id
    existing_by_chain = db.query(LendingRequest).filter(
        LendingRequest.on_chain_loan_id == norm_loan_id
    ).first()
    if existing_by_chain is not None:
        if existing_by_chain.user_id != borrower_user.id:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Mã on_chain_loan_id đã được sử dụng bởi tài khoản khác (chống replay)."
            )
        matching_tx = db.query(BlockchainTransaction).filter(
            BlockchainTransaction.tx_hash == norm_tx_hash,
            BlockchainTransaction.request_id == existing_by_chain.id,
            BlockchainTransaction.action_type == TxActionType.CREATE_LOAN,
        ).first()
        same_payload = (
            matching_tx is not None
            and existing_by_chain.equipment_id == loan_in.equipment_id
            and int(normalize_naive_dt(existing_by_chain.expected_handover_date).timestamp())
            == int(expected_handover_dt.timestamp())
            and int(normalize_naive_dt(existing_by_chain.due_date).timestamp())
            == int(due_dt.timestamp())
        )
        if same_payload:
            return existing_by_chain
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Mã on_chain_loan_id đã được gắn với một đơn mượn khác."
        )

    # Kiểm tra replay theo tx_hash
    existing_tx = db.query(BlockchainTransaction).filter(
        BlockchainTransaction.tx_hash == norm_tx_hash
    ).first()
    if existing_tx is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Transaction hash (tx_hash) đã được sử dụng trước đó (chống replay)."
        )

    # Bắt buộc ví MetaMask đã được xác minh chữ ký EIP-191 và thuộc chính người dùng
    borrower_wallet = _require_verified_wallet(borrower_user)

    # 1. Kiểm tra tồn tại và khả dụng của thiết bị
    equipment = get_equipment_by_id(db, loan_in.equipment_id)
    if equipment is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Không tìm thấy thiết bị với ID #{loan_in.equipment_id}."
        )

    if equipment.status != EquipmentStatus.AVAILABLE:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Thiết bị '{equipment.name}' hiện không sẵn sàng để đăng ký mượn (Trạng thái: {equipment.status.value})."
        )

    # 2. Kiểm tra sinh viên có đang giữ đơn chờ duyệt hoặc đang mượn cùng thiết bị này không
    existing_loan = db.query(LendingRequest).filter(
        LendingRequest.user_id == borrower_user.id,
        LendingRequest.equipment_id == equipment.id,
        LendingRequest.status.in_([LoanStatus.PENDING, LoanStatus.APPROVED, LoanStatus.ACTIVE])
    ).first()

    if existing_loan is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Bạn đã có một yêu cầu mượn đang chờ xử lý hoặc đang sử dụng thiết bị này."
        )

    # 3. Xác thực biên lai giao dịch MetaMask on-chain trước khi lưu đơn
    _ensure_chain_ready_or_http()
    try:
        verified_tx_info = blockchain_service.verify_create_loan_tx(
            tx_hash=norm_tx_hash,
            expected_loan_id=norm_loan_id,
            expected_equipment_id=equipment.id,
            expected_student_id=borrower_user.student_staff_id,
            expected_borrower_address=borrower_wallet,
            expected_handover_ts=int(expected_handover_dt.timestamp()),
            expected_due_ts=int(due_dt.timestamp()),
            expected_deposit=int(equipment.deposit_amount),
            expected_sender_address=borrower_wallet,
        )
    except ConnectionError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Không thể xác thực giao dịch MetaMask do mất kết nối Blockchain: {exc}"
        ) from exc
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Biên lai giao dịch MetaMask không hợp lệ: {exc}"
        ) from exc

    # 4. Tạo bản ghi yêu cầu mượn
    new_loan = LendingRequest(
        user_id=borrower_user.id,
        equipment_id=equipment.id,
        expected_handover_date=expected_handover_dt,
        due_date=due_dt,
        status=LoanStatus.PENDING,
        deposit_amount=equipment.deposit_amount,
        deposit_status=DepositStatus.PENDING,
        on_chain_loan_id=norm_loan_id,
        admin_notes=loan_in.admin_notes.strip() if loan_in.admin_notes else None
    )
    db.add(new_loan)
    db.flush()

    if verified_tx_info is not None:
        db.add(BlockchainTransaction(
            request_id=new_loan.id,
            tx_hash=verified_tx_info["tx_hash"],
            action_type=TxActionType.CREATE_LOAN,
            from_address=verified_tx_info["from_address"],
            to_address=verified_tx_info["to_address"],
            block_number=verified_tx_info.get("block_number"),
            gas_used=verified_tx_info.get("gas_used"),
            status=TxStatus.CONFIRMED
        ))

    # 5. Ghi Audit Log
    audit = AuditLog(
        user_id=borrower_user.id,
        action="LOAN_REQUEST_SUBMITTED",
        entity_name="lending_requests",
        entity_id=new_loan.id,
        details_json={
            "equipment_id": equipment.id,
            "equipment_name": equipment.name,
            "deposit_amount": str(equipment.deposit_amount),
            "on_chain_loan_id": norm_loan_id,
            "signed_by_client_wallet": bool(verified_tx_info is not None),
        }
    )
    db.add(audit)
    db.commit()
    db.refresh(new_loan)
    return new_loan


def approve_loan_request(
    db: Session,
    admin_user: User,
    loan_id: int,
    approve_in: LoanApproveRequest,
) -> LendingRequest:
    """
    Mục đích: Admin xác thực biên lai MetaMask `approveLoan`, khóa thiết bị sang RESERVED và chốt APPROVED trong MySQL.
    """
    loan = get_loan_by_id(db, loan_id)
    if loan is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Không tìm thấy đơn mượn với ID #{loan_id}."
        )

    norm_tx = _normalize_hash_or_400(approve_in.tx_hash, "tx_hash")
    if _check_tx_idempotency_or_replay(db, loan.id, TxActionType.APPROVE_LOAN, norm_tx):
        if loan.status == LoanStatus.APPROVED:
            return loan

    if loan.status != LoanStatus.PENDING:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Chỉ có thể duyệt đơn ở trạng thái PENDING (Hiện tại: {loan.status.value})."
        )

    # 1. Khóa kiểm tra thiết bị khả dụng
    equipment = get_equipment_for_update(db, loan.equipment_id)
    other_active_loan = db.query(LendingRequest).filter(
        LendingRequest.equipment_id == loan.equipment_id,
        LendingRequest.id != loan.id,
        LendingRequest.status.in_([LoanStatus.APPROVED, LoanStatus.ACTIVE])
    ).first()
    if other_active_loan is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Thiết bị #{loan.equipment_id} đang được giữ bởi đơn mượn #{other_active_loan.id}."
        )

    # 2. Xác thực biên lai MetaMask `approveLoan` của Admin và đối chiếu trạng thái Smart Contract
    verified = _verify_and_record_lifecycle_tx(
        db=db,
        loan=loan,
        actor=admin_user,
        raw_tx_hash=norm_tx,
        action_type=TxActionType.APPROVE_LOAN,
        expected_event="LoanApproved",
        expected_args={"equipmentId": loan.equipment_id},
    )
    on_chain_record = _get_onchain_loan_or_503(loan.on_chain_loan_id)
    chain_state_code = int(on_chain_record.get("state", -1))
    if chain_state_code != 1:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Đơn trên Smart Contract đang ở trạng thái state={chain_state_code}, không khớp APPROVED (1)."
        )

    # 3. Khóa thiết bị và cập nhật trạng thái APPROVED trong MySQL
    equipment.status = EquipmentStatus.RESERVED
    loan.status = LoanStatus.APPROVED
    if approve_in.notes:
        loan.admin_notes = f"{loan.admin_notes or ''}\n[Duyệt bởi Admin #{admin_user.id}]: {approve_in.notes}".strip()

    db.add(AuditLog(
        user_id=admin_user.id,
        action="LOAN_APPROVED",
        entity_name="lending_requests",
        entity_id=loan.id,
        details_json={
            "equipment_id": loan.equipment_id,
            "on_chain_loan_id": loan.on_chain_loan_id,
            "tx_hash": verified["tx_hash"],
        }
    ))

    db.commit()
    db.refresh(loan)
    return loan


def reject_loan_request(
    db: Session,
    admin_user: User,
    loan_id: int,
    reject_in: Optional[LoanRejectRequest] = None,
) -> LendingRequest:
    """
    Mục đích: Admin từ chối đơn mượn (xác thực biên lai `cancelLoan` nếu đơn đã tồn tại on-chain).
    """
    payload = reject_in or LoanRejectRequest()
    loan = get_loan_by_id(db, loan_id)
    if loan is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Không tìm thấy đơn mượn với ID #{loan_id}."
        )

    if loan.status == LoanStatus.REJECTED and payload.tx_hash:
        norm_tx = _normalize_hash_or_400(payload.tx_hash, "tx_hash")
        if _check_tx_idempotency_or_replay(db, loan.id, TxActionType.CANCEL_LOAN, norm_tx):
            return loan

    if loan.status != LoanStatus.PENDING:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Chỉ có thể từ chối đơn ở trạng thái PENDING (Hiện tại: {loan.status.value})."
        )

    verified_tx_hash: Optional[str] = None
    if loan.on_chain_loan_id:
        verified = _verify_and_record_lifecycle_tx(
            db=db,
            loan=loan,
            actor=admin_user,
            raw_tx_hash=payload.tx_hash,
            action_type=TxActionType.CANCEL_LOAN,
            expected_event="LoanCancelled",
        )
        on_chain_record = _get_onchain_loan_or_503(loan.on_chain_loan_id)
        chain_state_code = int(on_chain_record.get("state", -1))
        if chain_state_code != 4:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Đơn trên Smart Contract đang ở trạng thái state={chain_state_code}, chưa Cancelled (4)."
            )
        verified_tx_hash = verified["tx_hash"]

    loan.status = LoanStatus.REJECTED
    if payload.reason:
        loan.admin_notes = f"{loan.admin_notes or ''}\n[Từ chối bởi Admin #{admin_user.id}]: {payload.reason}".strip()

    db.add(AuditLog(
        user_id=admin_user.id,
        action="LOAN_REJECTED",
        entity_name="lending_requests",
        entity_id=loan.id,
        details_json={"reason": payload.reason, "tx_hash": verified_tx_hash}
    ))

    db.commit()
    db.refresh(loan)
    return loan


def handover_loan_equipment(
    db: Session,
    admin_user: User,
    loan_id: int,
    handover_in: LoanHandoverRequest,
) -> LendingRequest:
    """
    Mục đích: Admin xác thực biên lai MetaMask `confirmHandover`, đổi đơn sang ACTIVE và khóa tiền cọc.
    """
    loan = get_loan_by_id(db, loan_id)
    if loan is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Không tìm thấy đơn mượn với ID #{loan_id}."
        )

    norm_tx = _normalize_hash_or_400(handover_in.tx_hash, "tx_hash")
    if _check_tx_idempotency_or_replay(db, loan.id, TxActionType.HANDOVER, norm_tx):
        if loan.status == LoanStatus.ACTIVE:
            return loan

    if loan.status != LoanStatus.APPROVED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Chỉ có thể bàn giao đơn đã được duyệt (APPROVED). Hiện tại: {loan.status.value}."
        )

    verified = _verify_and_record_lifecycle_tx(
        db=db,
        loan=loan,
        actor=admin_user,
        raw_tx_hash=norm_tx,
        action_type=TxActionType.HANDOVER,
        expected_event="HandoverConfirmed",
    )
    on_chain_record = _get_onchain_loan_or_503(loan.on_chain_loan_id)
    chain_state_code = int(on_chain_record.get("state", -1))
    if chain_state_code != 2:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Đơn trên Smart Contract đang ở trạng thái state={chain_state_code}, không khớp ACTIVE (2)."
        )

    equipment = get_equipment_by_id(db, loan.equipment_id)
    if equipment:
        equipment.status = EquipmentStatus.IN_USE

    loan.status = LoanStatus.ACTIVE
    loan.actual_handover_date = datetime.now()
    if loan.deposit_amount > 0:
        loan.deposit_status = DepositStatus.LOCKED

    db.add(AuditLog(
        user_id=admin_user.id,
        action="EQUIPMENT_HANDED_OVER",
        entity_name="lending_requests",
        entity_id=loan.id,
        details_json={
            "equipment_id": loan.equipment_id,
            "actual_handover_date": str(loan.actual_handover_date),
            "tx_hash": verified["tx_hash"],
        }
    ))

    db.commit()
    db.refresh(loan)
    return loan


def return_loan_equipment(
    db: Session,
    admin_user: User,
    loan_id: int,
    return_in: LoanReturnRequest,
) -> LendingRequest:
    """
    Mục đích: Admin xác thực biên lai MetaMask `confirmReturn`, đọc mức phạt/trạng thái cọc do Smart Contract tự tính và cập nhật MySQL.
    """
    loan = get_loan_by_id(db, loan_id)
    if loan is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Không tìm thấy đơn mượn với ID #{loan_id}."
        )

    norm_tx = _normalize_hash_or_400(return_in.tx_hash, "tx_hash")
    if _check_tx_idempotency_or_replay(db, loan.id, TxActionType.RETURN_LOAN, norm_tx):
        if loan.status in (LoanStatus.RETURNED, LoanStatus.DISPUTED):
            return loan

    if loan.status != LoanStatus.ACTIVE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Chỉ có thể hoàn trả đơn đang trong trạng thái mượn (ACTIVE). Hiện tại: {loan.status.value}."
        )

    condition: ReturnCondition = return_in.return_condition
    condition_code: int = 0 if condition == ReturnCondition.GOOD else (1 if condition == ReturnCondition.DAMAGED else 2)

    verified = _verify_and_record_lifecycle_tx(
        db=db,
        loan=loan,
        actor=admin_user,
        raw_tx_hash=norm_tx,
        action_type=TxActionType.RETURN_LOAN,
        expected_event="LoanReturned",
        expected_args={"returnCondition": condition_code},
    )

    on_chain_record = _get_onchain_loan_or_503(loan.on_chain_loan_id)
    chain_state_code = int(on_chain_record.get("state", -1))
    if chain_state_code not in (3, 5):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Đơn trên Smart Contract đang ở trạng thái state={chain_state_code}, chưa hoàn tất trả máy."
        )

    event_args = verified.get("event_args", {})
    penalty_percent = int(event_args.get("penaltyPercent", on_chain_record.get("penalty_percent", 0)))
    onchain_dep_code = int(
        event_args.get("depositState", on_chain_record.get("deposit_state", 3 if chain_state_code == 5 else 2))
    )

    equipment = get_equipment_by_id(db, loan.equipment_id)
    loan.deposit_status = DepositStatus.FORFEITED if onchain_dep_code == 3 else DepositStatus.REFUNDED
    if chain_state_code == 5 or condition in [ReturnCondition.DAMAGED, ReturnCondition.LOST]:
        loan.status = LoanStatus.DISPUTED
        if equipment:
            equipment.status = EquipmentStatus.MAINTENANCE if condition == ReturnCondition.DAMAGED else EquipmentStatus.RETIRED
    else:
        loan.status = LoanStatus.RETURNED
        if equipment:
            equipment.status = EquipmentStatus.AVAILABLE

    loan.actual_return_date = datetime.now()
    loan.return_condition = condition
    if return_in.admin_notes:
        loan.admin_notes = f"{loan.admin_notes or ''}\n[Trả máy]: {return_in.admin_notes}".strip()

    db.add(AuditLog(
        user_id=admin_user.id,
        action="EQUIPMENT_RETURNED",
        entity_name="lending_requests",
        entity_id=loan.id,
        details_json={
            "condition": condition.value,
            "penalty_percent": penalty_percent,
            "deposit_status": loan.deposit_status.value,
            "tx_hash": verified["tx_hash"],
        }
    ))

    db.commit()
    db.refresh(loan)
    return loan


def cancel_loan_request(
    db: Session,
    current_user: User,
    loan_id: int,
    cancel_in: Optional[LoanCancelRequest] = None,
) -> LendingRequest:
    """
    Mục đích: Sinh viên hoặc Admin hủy đơn mượn trước khi nhận máy (xác thực biên lai `cancelLoan` on-chain).
    """
    payload = cancel_in or LoanCancelRequest()
    loan = get_loan_by_id(db, loan_id)
    if loan is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Không tìm thấy đơn mượn với ID #{loan_id}."
        )

    if current_user.role == UserRole.BORROWER and loan.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Bạn không có quyền hủy đơn mượn của người khác."
        )

    if loan.status == LoanStatus.CANCELLED and payload.tx_hash:
        norm_tx = _normalize_hash_or_400(payload.tx_hash, "tx_hash")
        if _check_tx_idempotency_or_replay(db, loan.id, TxActionType.CANCEL_LOAN, norm_tx):
            return loan

    if loan.status not in [LoanStatus.PENDING, LoanStatus.APPROVED]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Không thể hủy đơn khi thiết bị đã được bàn giao hoặc đơn đã kết thúc (Hiện tại: {loan.status.value})."
        )

    verified_tx_hash: Optional[str] = None
    if loan.on_chain_loan_id:
        verified = _verify_and_record_lifecycle_tx(
            db=db,
            loan=loan,
            actor=current_user,
            raw_tx_hash=payload.tx_hash,
            action_type=TxActionType.CANCEL_LOAN,
            expected_event="LoanCancelled",
        )
        on_chain_record = _get_onchain_loan_or_503(loan.on_chain_loan_id)
        chain_state_code = int(on_chain_record.get("state", -1))
        if chain_state_code != 4:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Đơn trên Smart Contract đang ở trạng thái state={chain_state_code}, chưa Cancelled (4)."
            )
        verified_tx_hash = verified["tx_hash"]

    equipment = get_equipment_by_id(db, loan.equipment_id)
    if loan.status == LoanStatus.APPROVED and equipment:
        equipment.status = EquipmentStatus.AVAILABLE

    loan.status = LoanStatus.CANCELLED
    loan.admin_notes = f"{loan.admin_notes or ''}\n[Hủy bởi User #{current_user.id}]: {payload.reason}".strip()

    db.add(AuditLog(
        user_id=current_user.id,
        action="LOAN_CANCELLED",
        entity_name="lending_requests",
        entity_id=loan.id,
        details_json={"reason": payload.reason, "tx_hash": verified_tx_hash}
    ))

    db.commit()
    db.refresh(loan)
    return loan

