"""
Module: backend.app.services.loan_service
Mục đích: Xử lý toàn bộ logic nghiệp vụ vòng đời mượn trả thiết bị học tập, tích hợp MySQL và Blockchain EVM.
Áp dụng: Quy định viết code và docstring tại QUY_DINH_CODE.md.
"""
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional
from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from backend.app.models.audit_log import AuditLog
from backend.app.models.blockchain_tx import BlockchainTransaction, TxActionType, TxStatus
from backend.app.models.equipment import Equipment, EquipmentStatus
from backend.app.models.lending_request import DepositStatus, LendingRequest, LoanStatus, ReturnCondition
from backend.app.models.user import User, UserRole
from backend.app.schemas.loan import LoanCancelRequest, LoanCreateRequest, LoanReturnRequest
from backend.app.services.blockchain_service import (
    ZERO_BYTES32_HEX,
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


def _ensure_chain_ready_or_http(require_admin: bool = True) -> None:
    """
    Mục đích: Kiểm tra kết nối node RPC, đúng Chain ID và Contract bytecode; ném HTTP 503 nếu offline.
    """
    try:
        blockchain_service.ensure_ready(require_admin=require_admin)
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


def _send_durable_tx(
    db: Session,
    request_id: int,
    action_type: TxActionType,
    sender_fn: Any,
    **kwargs: Any,
) -> Dict[str, Any]:
    """
    Mục đích: Thực thi giao dịch on-chain kèm durable outbox (ghi PENDING ngay khi broadcast, cập nhật CONFIRMED/FAILED).
    """
    def _on_broadcast(tx_hash: str, from_addr: str, to_addr: Optional[str]) -> None:
        _upsert_tx_record(
            db=db,
            request_id=request_id,
            tx_hash=tx_hash,
            action_type=action_type,
            from_address=from_addr,
            to_address=to_addr or (blockchain_service.contract_address or "contract"),
            tx_status=TxStatus.PENDING,
        )
        db.commit()

    def _on_failed(tx_hash: str, block_number: Optional[int], gas_used: Optional[int], reason: str) -> None:
        _upsert_tx_record(
            db=db,
            request_id=request_id,
            tx_hash=tx_hash,
            action_type=action_type,
            from_address=blockchain_service.admin_account.address if blockchain_service.admin_account else "relayer",
            to_address=blockchain_service.contract_address or "contract",
            tx_status=TxStatus.FAILED,
            block_number=block_number,
            gas_used=gas_used,
            error_message=reason,
        )
        db.commit()

    try:
        tx_result = sender_fn(on_broadcast=_on_broadcast, on_failed=_on_failed, **kwargs)
    except ConnectionError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Mất kết nối node Blockchain khi xử lý {action_type.value}: {exc}"
        ) from exc
    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Giao dịch Blockchain {action_type.value} thất bại: {exc}"
        ) from exc
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(exc)
        ) from exc

    _upsert_tx_record(
        db=db,
        request_id=request_id,
        tx_hash=tx_result["tx_hash"],
        action_type=action_type,
        from_address=tx_result["from_address"],
        to_address=tx_result["to_address"],
        tx_status=TxStatus.CONFIRMED,
        block_number=tx_result.get("block_number"),
        gas_used=tx_result.get("gas_used"),
    )
    return tx_result


def _sync_confirmed_pending_txs(db: Session, loan_id: int, action_type: TxActionType) -> None:
    """
    Mục đích: Khi phục hồi sau lỗi/crash và xác nhận bước đó đã xong on-chain, đối chiếu biên lai PENDING nếu có.
    """
    pending_rows = db.query(BlockchainTransaction).filter(
        BlockchainTransaction.request_id == loan_id,
        BlockchainTransaction.action_type == action_type,
        BlockchainTransaction.status == TxStatus.PENDING,
    ).all()
    for row in pending_rows:
        try:
            receipt = blockchain_service.web3.eth.get_transaction_receipt(row.tx_hash)
            if receipt and getattr(receipt, "status", 0) == 1:
                row.block_number = getattr(receipt, "block_number", getattr(receipt, "blockNumber", None))
                row.gas_used = getattr(receipt, "gas_used", getattr(receipt, "gasUsed", None))
                row.status = TxStatus.CONFIRMED
        except Exception:
            continue


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

    has_chain_id = bool(loan_in.on_chain_loan_id and loan_in.on_chain_loan_id.strip())
    has_tx_hash = bool(loan_in.client_tx_hash and loan_in.client_tx_hash.strip())
    if has_chain_id != has_tx_hash:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Phải cung cấp đồng thời cả `on_chain_loan_id` và `client_tx_hash` khi đăng ký đơn đã ký MetaMask."
        )

    norm_loan_id: Optional[str] = None
    norm_tx_hash: Optional[str] = None
    verified_tx_info: Optional[Dict[str, Any]] = None

    if has_chain_id and has_tx_hash:
        try:
            norm_loan_id = normalize_hex_bytes32(loan_in.on_chain_loan_id, 32)
            norm_tx_hash = normalize_hex_bytes32(loan_in.client_tx_hash, 32)
        except ValueError as exc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Định dạng mã hash Blockchain không hợp lệ: {exc}"
            ) from exc

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

        # Kiểm tra replay theo client_tx_hash
        existing_tx = db.query(BlockchainTransaction).filter(
            BlockchainTransaction.tx_hash == norm_tx_hash
        ).first()
        if existing_tx is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Transaction hash (client_tx_hash) đã được sử dụng trước đó (chống replay)."
            )

        # Bắt buộc ví MetaMask đã được xác minh chữ ký EIP-191 và thuộc chính người dùng
        if not borrower_user.wallet_address or not borrower_user.wallet_verified:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Tài khoản chưa liên kết và xác minh quyền sở hữu ví MetaMask (EIP-191). Vui lòng xác minh ví trước."
            )

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
    if norm_loan_id and norm_tx_hash:
        _ensure_chain_ready_or_http(require_admin=False)
        try:
            verified_tx_info = blockchain_service.verify_create_loan_tx(
                tx_hash=norm_tx_hash,
                expected_loan_id=norm_loan_id,
                expected_equipment_id=equipment.id,
                expected_student_id=borrower_user.student_staff_id,
                expected_borrower_address=borrower_user.wallet_address,
                expected_handover_ts=int(expected_handover_dt.timestamp()),
                expected_due_ts=int(due_dt.timestamp()),
                expected_deposit=int(equipment.deposit_amount),
                expected_sender_address=borrower_user.wallet_address,
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
    notes: Optional[str] = None
) -> LendingRequest:
    """
    Mục đích: Admin duyệt đơn mượn, áp dụng Pessimistic Lock khóa thiết bị sang RESERVED và đẩy giao dịch lên Smart Contract.
    Tham số:
        - db (Session): Phiên làm việc CSDL.
        - admin_user (User): Quản trị viên duyệt đơn.
        - loan_id (int): Khóa chính ID đơn mượn cần duyệt.
        - notes (Optional[str]): Ghi chú bổ sung từ quản trị viên.
    Trả về:
        - LendingRequest: Bản ghi đơn mượn đã chuyển trạng thái APPROVED kèm on_chain_loan_id.
    Lỗi:
        - HTTPException(404 Not Found): Đơn mượn không tồn tại.
        - HTTPException(400 Bad Request): Đơn mượn không ở trạng thái PENDING.
        - HTTPException(409 Conflict): Thiết bị bị tranh chấp hoặc đã bị người khác đặt mượn.
    Tác dụng phụ:
        - Cập nhật `equipment.status = RESERVED`.
        - Gửi giao dịch `createLoan` & `approveLoan` on-chain.
        - Ghi `blockchain_transactions` và `audit_logs`.
    """
    loan = get_loan_by_id(db, loan_id)
    if loan is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Không tìm thấy đơn mượn với ID #{loan_id}."
        )

    if loan.status != LoanStatus.PENDING:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Chỉ có thể duyệt đơn ở trạng thái PENDING (Hiện tại: {loan.status.value})."
        )

    # 1. Khóa kiểm tra thiết bị khả dụng & đảm bảo node Blockchain sẵn sàng (fail-closed nếu offline)
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

    _ensure_chain_ready_or_http(require_admin=True)

    # 2. Xác định On-chain Loan ID và checkpoint bền vững trước khi phát sóng tx
    had_preset_chain_id = bool(loan.on_chain_loan_id)
    if loan.on_chain_loan_id:
        loan_id_hex = normalize_hex_bytes32(loan.on_chain_loan_id, 32)
        loan_id_bytes = bytes.fromhex(loan_id_hex[2:])
    else:
        req_timestamp: int = int(loan.request_date.timestamp()) if loan.request_date else int(datetime.now().timestamp())
        loan_id_bytes, loan_id_hex = blockchain_service.generate_loan_id(
            user_id=loan.user_id,
            equipment_id=loan.equipment_id,
            timestamp=req_timestamp
        )
        loan.on_chain_loan_id = loan_id_hex
        db.commit()
        db.refresh(loan)

    # 3. Kiểm tra trạng thái thực tế trên Smart Contract trước khi ký giao dịch (hỗ trợ resume khi retry)
    try:
        on_chain_record = blockchain_service.get_loan(loan_id_hex)
    except ConnectionError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Mất kết nối node Blockchain khi đọc trạng thái đơn: {exc}"
        ) from exc

    on_chain_exists = (
        on_chain_record.get("loan_id") == loan_id_hex
        and int(on_chain_record.get("request_time", 0)) > 0
    )

    if had_preset_chain_id and not on_chain_exists:
        # Chỉ báo lỗi nếu người dùng đã nộp tx MetaMask; còn nếu là checkpoint từ lần relayer fail trước đó thì tạo tiếp
        client_created_tx = db.query(BlockchainTransaction).filter(
            BlockchainTransaction.request_id == loan.id,
            BlockchainTransaction.action_type == TxActionType.CREATE_LOAN,
            BlockchainTransaction.status == TxStatus.CONFIRMED,
        ).first()
        if client_created_tx is not None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Đơn có giao dịch MetaMask nhưng chưa tồn tại trên Smart Contract (vui lòng kiểm tra đúng mạng)."
            )

    if not on_chain_exists:
        borrower: User = loan.user
        borrower_address: str = (
            borrower.wallet_address
            if (borrower.wallet_address and borrower.wallet_verified)
            else blockchain_service.admin_account.address
        )
        deposit_wei: int = int(loan.deposit_amount)
        _send_durable_tx(
            db=db,
            request_id=loan.id,
            action_type=TxActionType.CREATE_LOAN,
            sender_fn=blockchain_service.create_loan,
            loan_id=loan_id_bytes,
            equipment_id=loan.equipment_id,
            student_id=borrower.student_staff_id,
            borrower_address=borrower_address,
            expected_handover=int(normalize_naive_dt(loan.expected_handover_date).timestamp()),
            due_date=int(normalize_naive_dt(loan.due_date).timestamp()),
            deposit_amount=deposit_wei,
        )
        on_chain_record = blockchain_service.get_loan(loan_id_hex)
    else:
        _sync_confirmed_pending_txs(db, loan.id, TxActionType.CREATE_LOAN)

    chain_state_code = int(on_chain_record.get("state", 0))
    if chain_state_code == 0:
        # Đơn đã ở Submitted trên chain (do SV tạo MetaMask hoặc bước createLoan vừa xong) -> chỉ gọi approveLoan
        _send_durable_tx(
            db=db,
            request_id=loan.id,
            action_type=TxActionType.APPROVE_LOAN,
            sender_fn=blockchain_service.approve_loan,
            loan_id=loan_id_bytes,
        )
    elif chain_state_code == 1:
        # Crash recovery: approveLoan đã thành công trên chain ở lần gọi trước
        _sync_confirmed_pending_txs(db, loan.id, TxActionType.APPROVE_LOAN)
    else:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Đơn trên Smart Contract đang ở trạng thái state={chain_state_code}, không thể duyệt. Vui lòng chạy đối soát."
        )

    # 4. Chỉ sau khi on-chain approve thành công mới khóa thiết bị & chốt APPROVED trong MySQL
    equipment = get_equipment_for_update(db, loan.equipment_id)
    equipment.status = EquipmentStatus.RESERVED
    loan.status = LoanStatus.APPROVED
    loan.on_chain_loan_id = loan_id_hex
    if notes:
        loan.admin_notes = f"{loan.admin_notes or ''}\n[Duyệt bởi Admin #{admin_user.id}]: {notes}".strip()

    # 5. Ghi Audit Log
    db.add(AuditLog(
        user_id=admin_user.id,
        action="LOAN_APPROVED",
        entity_name="lending_requests",
        entity_id=loan.id,
        details_json={
            "equipment_id": loan.equipment_id,
            "on_chain_loan_id": loan_id_hex
        }
    ))

    db.commit()
    db.refresh(loan)
    return loan


def reject_loan_request(
    db: Session,
    admin_user: User,
    loan_id: int,
    reason: Optional[str] = None
) -> LendingRequest:
    """
    Mục đích: Admin từ chối yêu cầu mượn thiết bị.
    Tham số:
        - db (Session): Phiên làm việc CSDL.
        - admin_user (User): Quản trị viên từ chối.
        - loan_id (int): Khóa chính ID đơn mượn.
        - reason (Optional[str]): Lý do từ chối.
    Trả về:
        - LendingRequest: Bản ghi đơn mượn đã chuyển trạng thái REJECTED.
    Lỗi:
        - HTTPException(400 Bad Request): Đơn không ở trạng thái PENDING.
    Tác dụng phụ:
        - Cập nhật `loan.status = REJECTED` và ghi Audit Log.
    """
    loan = get_loan_by_id(db, loan_id)
    if loan is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Không tìm thấy đơn mượn với ID #{loan_id}."
        )

    if loan.status != LoanStatus.PENDING:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Chỉ có thể từ chối đơn ở trạng thái PENDING (Hiện tại: {loan.status.value})."
        )

    if loan.on_chain_loan_id:
        _ensure_chain_ready_or_http(require_admin=True)
        loan_id_hex = normalize_hex_bytes32(loan.on_chain_loan_id, 32)
        on_chain_record = blockchain_service.get_loan(loan_id_hex)
        on_chain_exists = (
            on_chain_record.get("loan_id") == loan_id_hex
            and int(on_chain_record.get("request_time", 0)) > 0
        )
        chain_state_code = int(on_chain_record.get("state", -1))
        if on_chain_exists and chain_state_code == 0:
            _send_durable_tx(
                db=db,
                request_id=loan.id,
                action_type=TxActionType.CANCEL_LOAN,
                sender_fn=blockchain_service.cancel_loan,
                loan_id=bytes.fromhex(loan_id_hex[2:]),
                reason=reason or f"Rejected by Admin #{admin_user.id}",
            )
        elif not on_chain_exists:
            loan.on_chain_loan_id = None

    loan.status = LoanStatus.REJECTED
    if reason:
        loan.admin_notes = f"{loan.admin_notes or ''}\n[Từ chối bởi Admin #{admin_user.id}]: {reason}".strip()

    db.add(AuditLog(
        user_id=admin_user.id,
        action="LOAN_REJECTED",
        entity_name="lending_requests",
        entity_id=loan.id,
        details_json={"reason": reason}
    ))

    db.commit()
    db.refresh(loan)
    return loan


def handover_loan_equipment(
    db: Session,
    admin_user: User,
    loan_id: int
) -> LendingRequest:
    """
    Mục đích: Admin xác nhận bàn giao thiết bị thực tế cho sinh viên (chuyển đơn sang ACTIVE, khóa cọc).
    Tham số:
        - db (Session): Phiên làm việc CSDL.
        - admin_user (User): Quản trị viên thực hiện bàn giao.
        - loan_id (int): Khóa chính ID đơn mượn.
    Trả về:
        - LendingRequest: Bản ghi đơn mượn chuyển trạng thái ACTIVE.
    Lỗi:
        - HTTPException(400 Bad Request): Khi đơn không ở trạng thái APPROVED.
    Tác dụng phụ:
        - Cập nhật `equipment.status = IN_USE`.
        - Cập nhật `loan.deposit_status = LOCKED`.
        - Gọi Smart Contract `confirmHandover` và ghi nhận transaction.
    """
    loan = get_loan_by_id(db, loan_id)
    if loan is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Không tìm thấy đơn mượn với ID #{loan_id}."
        )

    if loan.status != LoanStatus.APPROVED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Chỉ có thể bàn giao đơn đã được duyệt (APPROVED). Hiện tại: {loan.status.value}."
        )

    if not loan.on_chain_loan_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Đơn mượn chưa có mã định danh on_chain_loan_id. Không thể bàn giao khi chưa ghi nhận trên Smart Contract."
        )

    _ensure_chain_ready_or_http(require_admin=True)
    loan_id_hex = normalize_hex_bytes32(loan.on_chain_loan_id, 32)
    loan_id_bytes = bytes.fromhex(loan_id_hex[2:])

    try:
        on_chain_record = blockchain_service.get_loan(loan_id_hex)
    except ConnectionError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Mất kết nối node Blockchain khi kiểm tra bàn giao: {exc}"
        ) from exc

    chain_state_code = int(on_chain_record.get("state", -1))
    if chain_state_code == 1:
        _send_durable_tx(
            db=db,
            request_id=loan.id,
            action_type=TxActionType.HANDOVER,
            sender_fn=blockchain_service.confirm_handover,
            loan_id=loan_id_bytes,
        )
    elif chain_state_code == 2:
        # Crash recovery: confirmHandover đã thành công on-chain trước đó
        _sync_confirmed_pending_txs(db, loan.id, TxActionType.HANDOVER)
    else:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Đơn trên Smart Contract đang ở trạng thái state={chain_state_code}, không thể bàn giao."
        )

    # Cập nhật thiết bị và bản ghi đơn mượn sau khi on-chain xác nhận
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
            "actual_handover_date": str(loan.actual_handover_date)
        }
    ))

    db.commit()
    db.refresh(loan)
    return loan


def return_loan_equipment(
    db: Session,
    admin_user: User,
    loan_id: int,
    return_in: LoanReturnRequest
) -> LendingRequest:
    """
    Mục đích: Admin xác nhận nhận lại thiết bị, đánh giá hiện trạng và tính toán mức phạt / tiền cọc on-chain.
    Tham số:
        - db (Session): Phiên làm việc CSDL.
        - admin_user (User): Quản trị viên tiếp nhận.
        - loan_id (int): Khóa chính ID đơn mượn.
        - return_in (LoanReturnRequest): Hiện trạng hoàn trả (GOOD, DAMAGED, LOST) và mức phạt ghi đè thủ công.
    Trả về:
        - LendingRequest: Bản ghi đơn mượn chuyển trạng thái RETURNED hoặc DISPUTED.
    Lỗi:
        - HTTPException(400 Bad Request): Khi đơn không ở trạng thái ACTIVE.
    Tác dụng phụ:
        - Cập nhật `equipment.status` về AVAILABLE hoặc MAINTENANCE / RETIRED.
        - Cập nhật `deposit_status` thành REFUNDED hoặc FORFEITED.
        - Gọi Smart Contract `confirmReturn` giải phóng Mutex on-chain.
    """
    loan = get_loan_by_id(db, loan_id)
    if loan is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Không tìm thấy đơn mượn với ID #{loan_id}."
        )

    if loan.status != LoanStatus.ACTIVE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Chỉ có thể hoàn trả đơn đang trong trạng thái mượn (ACTIVE). Hiện tại: {loan.status.value}."
        )

    if not loan.on_chain_loan_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Đơn mượn chưa có mã định danh on_chain_loan_id để hoàn tất trả trên Smart Contract."
        )

    _ensure_chain_ready_or_http(require_admin=True)
    loan_id_hex = normalize_hex_bytes32(loan.on_chain_loan_id, 32)
    loan_id_bytes = bytes.fromhex(loan_id_hex[2:])

    now = datetime.now()
    equipment = get_equipment_by_id(db, loan.equipment_id)
    condition: ReturnCondition = return_in.return_condition
    condition_code: int = 0 if condition == ReturnCondition.GOOD else (1 if condition == ReturnCondition.DAMAGED else 2)

    try:
        on_chain_record = blockchain_service.get_loan(loan_id_hex)
        is_overdue_onchain = blockchain_service.is_overdue(loan_id_hex)
    except ConnectionError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Mất kết nối node Blockchain khi kiểm tra hoàn trả: {exc}"
        ) from exc

    is_overdue_effective = bool(now > normalize_naive_dt(loan.due_date) or is_overdue_onchain)

    # 1. Kiểm tra quy tắc phạt 0-100 và tránh sai lệch im lặng 0% khi quá hạn ở contract Phase 7A
    if condition in [ReturnCondition.DAMAGED, ReturnCondition.LOST]:
        if return_in.manual_penalty_percent is not None and return_in.manual_penalty_percent != 100:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Thiết bị hư hỏng (DAMAGED) hoặc mất (LOST) bắt buộc phạt 100% tiền cọc."
            )
        contract_penalty_arg = 100
        penalty_percent = 100
    else:
        if is_overdue_effective and return_in.manual_penalty_percent == 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Hợp đồng hiện hành dùng mức 0 để tự tính phạt quá hạn (10%/50%) nên không hỗ trợ miễn phạt 0% thủ công. Hãy để trống để tự tính hoặc nhập 1–100%."
            )
        if return_in.manual_penalty_percent is not None:
            contract_penalty_arg = int(return_in.manual_penalty_percent)
            penalty_percent = contract_penalty_arg
        elif is_overdue_effective:
            contract_penalty_arg = 0  # Smart contract auto-calculates 10%/50%
            if now > normalize_naive_dt(loan.due_date):
                overdue_duration: timedelta = now - normalize_naive_dt(loan.due_date)
                penalty_percent = 10 if overdue_duration <= timedelta(hours=24) else 50
            else:
                calc_info = blockchain_service.calculate_penalty(loan_id_hex, condition_code)
                penalty_percent = int(calc_info.get("penalty_percent", 10))
        else:
            contract_penalty_arg = 0
            penalty_percent = 0

    # 2. Thực thi confirmReturn on-chain (hoặc khôi phục nếu đã trả on-chain)
    chain_state_code = int(on_chain_record.get("state", -1))
    if chain_state_code == 2:
        _send_durable_tx(
            db=db,
            request_id=loan.id,
            action_type=TxActionType.RETURN_LOAN,
            sender_fn=blockchain_service.confirm_return,
            loan_id=loan_id_bytes,
            return_condition=condition_code,
            penalty_percent=contract_penalty_arg,
        )
        post_onchain = blockchain_service.get_loan(loan_id_hex)
        if isinstance(post_onchain, dict) and post_onchain.get("penalty_percent") is not None:
            penalty_percent = int(post_onchain["penalty_percent"])
    elif chain_state_code in (3, 5):
        _sync_confirmed_pending_txs(db, loan.id, TxActionType.RETURN_LOAN)
        if on_chain_record.get("penalty_percent") is not None:
            penalty_percent = int(on_chain_record["penalty_percent"])
    else:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Đơn trên Smart Contract đang ở trạng thái state={chain_state_code}, không thể xác nhận trả máy."
        )

    # 3. Chỉ sau khi on-chain xác nhận mới cập nhật MySQL (trạng thái, tiền cọc, thiết bị)
    if condition in [ReturnCondition.DAMAGED, ReturnCondition.LOST]:
        loan.deposit_status = DepositStatus.FORFEITED
        loan.status = LoanStatus.DISPUTED
        if equipment:
            equipment.status = EquipmentStatus.MAINTENANCE if condition == ReturnCondition.DAMAGED else EquipmentStatus.RETIRED
    else:
        loan.deposit_status = DepositStatus.REFUNDED
        loan.status = LoanStatus.RETURNED
        if equipment:
            equipment.status = EquipmentStatus.AVAILABLE

    loan.actual_return_date = now
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
            "deposit_status": loan.deposit_status.value
        }
    ))

    db.commit()
    db.refresh(loan)
    return loan


def cancel_loan_request(
    db: Session,
    current_user: User,
    loan_id: int,
    cancel_in: LoanCancelRequest
) -> LendingRequest:
    """
    Mục đích: Người dùng hoặc Admin hủy đơn mượn trước khi bàn giao thiết bị (chỉ khi PENDING hoặc APPROVED).
    Tham số:
        - db (Session): Phiên làm việc CSDL.
        - current_user (User): Người thực hiện (sinh viên sở hữu đơn hoặc ADMIN).
        - loan_id (int): Khóa chính ID đơn mượn.
        - cancel_in (LoanCancelRequest): Lý do hủy đơn.
    Trả về:
        - LendingRequest: Bản ghi đơn mượn chuyển sang CANCELLED.
    Lỗi:
        - HTTPException(403 Forbidden): Sinh viên cố tình hủy đơn mượn của người khác.
        - HTTPException(400 Bad Request): Đơn đã bàn giao (ACTIVE) hoặc đã kết thúc, không thể hủy.
    Tác dụng phụ:
        - Mở khóa thiết bị về AVAILABLE (nếu đang RESERVED).
        - Gọi Smart Contract `cancelLoan` giải phóng Mutex on-chain.
    """
    loan = get_loan_by_id(db, loan_id)
    if loan is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Không tìm thấy đơn mượn với ID #{loan_id}."
        )

    # Sinh viên chỉ được hủy đơn của chính mình
    if current_user.role == UserRole.BORROWER and loan.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Bạn không có quyền hủy đơn mượn của người khác."
        )

    if loan.status not in [LoanStatus.PENDING, LoanStatus.APPROVED]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Không thể hủy đơn khi thiết bị đã được bàn giao hoặc đơn đã kết thúc (Hiện tại: {loan.status.value})."
        )

    # 1. Nếu đơn đã có mã on_chain_loan_id -> bắt buộc đồng bộ hủy trên Smart Contract (fail-closed nếu RPC offline)
    if loan.on_chain_loan_id:
        _ensure_chain_ready_or_http(require_admin=True)
        loan_id_hex = normalize_hex_bytes32(loan.on_chain_loan_id, 32)
        loan_id_bytes = bytes.fromhex(loan_id_hex[2:])

        try:
            on_chain_record = blockchain_service.get_loan(loan_id_hex)
        except ConnectionError as exc:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=f"Mất kết nối node Blockchain khi hủy đơn on-chain: {exc}"
            ) from exc

        on_chain_exists = (
            on_chain_record.get("loan_id") == loan_id_hex
            and int(on_chain_record.get("request_time", 0)) > 0
        )
        chain_state_code = int(on_chain_record.get("state", -1))

        if not on_chain_exists:
            # Nếu mới checkpoint on_chain_loan_id mà chưa tạo thành công trên chain -> xóa checkpoint và hủy DB
            loan.on_chain_loan_id = None
        elif chain_state_code in (0, 1):
            _send_durable_tx(
                db=db,
                request_id=loan.id,
                action_type=TxActionType.CANCEL_LOAN,
                sender_fn=blockchain_service.cancel_loan,
                loan_id=loan_id_bytes,
                reason=cancel_in.reason or "Cancelled by user",
            )
        elif chain_state_code == 4:
            # Crash recovery: đã Cancelled sẵn on-chain
            _sync_confirmed_pending_txs(db, loan.id, TxActionType.CANCEL_LOAN)
        else:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Đơn trên Smart Contract đang ở trạng thái state={chain_state_code}, không thể hủy."
            )

    # 2. Chỉ sau khi on-chain xác nhận mới giải phóng thiết bị và chuyển trạng thái DB
    equipment = get_equipment_by_id(db, loan.equipment_id)
    if loan.status == LoanStatus.APPROVED and equipment:
        equipment.status = EquipmentStatus.AVAILABLE

    loan.status = LoanStatus.CANCELLED
    loan.admin_notes = f"{loan.admin_notes or ''}\n[Hủy bởi User #{current_user.id}]: {cancel_in.reason}".strip()

    db.add(AuditLog(
        user_id=current_user.id,
        action="LOAN_CANCELLED",
        entity_name="lending_requests",
        entity_id=loan.id,
        details_json={"reason": cancel_in.reason}
    ))

    db.commit()
    db.refresh(loan)
    return loan

