"""
Module: backend.app.services.loan_service
Mục đích: Xử lý toàn bộ logic nghiệp vụ vòng đời mượn trả thiết bị học tập, tích hợp MySQL và Blockchain EVM.
Áp dụng: Quy định viết code và docstring tại QUY_DINH_CODE.md.
"""
from datetime import datetime, timedelta
from typing import List, Optional, Tuple
from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from backend.app.models.audit_log import AuditLog
from backend.app.models.blockchain_tx import BlockchainTransaction, TxActionType, TxStatus
from backend.app.models.equipment import Equipment, EquipmentStatus
from backend.app.models.lending_request import DepositStatus, LendingRequest, LoanStatus, ReturnCondition
from backend.app.models.user import User, UserRole
from backend.app.schemas.loan import LoanCancelRequest, LoanCreateRequest, LoanReturnRequest
from backend.app.services.blockchain_service import blockchain_service
from backend.app.services.equipment_service import get_equipment_by_id, get_equipment_for_update


def compute_is_overdue(loan: LendingRequest) -> bool:
    """
    Mục đích: Suy luận động trạng thái quá hạn của đơn mượn (status = ACTIVE và hiện tại > due_date).
    Tham số:
        - loan (LendingRequest): Bản ghi đơn mượn cần kiểm tra.
    Trả về:
        - bool: True nếu đơn mượn đang active và đã quá hạn trả.
    Lỗi:
        - Không.
    Tác dụng phụ:
        - Không.
    """
    return bool(loan.status == LoanStatus.ACTIVE and datetime.now() > loan.due_date)


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
    now = datetime.now()
    if loan_in.due_date <= loan_in.expected_handover_date:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Thời gian hạn chót trả máy phải sau thời gian dự kiến nhận máy."
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

    # 3. Tạo bản ghi yêu cầu mượn
    new_loan = LendingRequest(
        user_id=borrower_user.id,
        equipment_id=equipment.id,
        expected_handover_date=loan_in.expected_handover_date,
        due_date=loan_in.due_date,
        status=LoanStatus.PENDING,
        deposit_amount=equipment.deposit_amount,
        deposit_status=DepositStatus.PENDING,
        admin_notes=loan_in.admin_notes.strip() if loan_in.admin_notes else None
    )
    db.add(new_loan)
    db.flush()

    # 4. Ghi Audit Log
    audit = AuditLog(
        user_id=borrower_user.id,
        action="LOAN_REQUEST_SUBMITTED",
        entity_name="lending_requests",
        entity_id=new_loan.id,
        details_json={
            "equipment_id": equipment.id,
            "equipment_name": equipment.name,
            "deposit_amount": str(equipment.deposit_amount)
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

    # 1. Khóa dòng thiết bị bằng MySQL Pessimistic Lock (SELECT FOR UPDATE)
    equipment = get_equipment_for_update(db, loan.equipment_id)
    equipment.status = EquipmentStatus.RESERVED

    # 2. Sinh mã On-chain Loan ID chuẩn Keccak256
    req_timestamp: int = int(loan.request_date.timestamp()) if loan.request_date else int(datetime.now().timestamp())
    loan_id_bytes, loan_id_hex = blockchain_service.generate_loan_id(
        user_id=loan.user_id,
        equipment_id=loan.equipment_id,
        timestamp=req_timestamp
    )

    # 3. Đẩy giao dịch On-chain nếu node Blockchain đang online
    if blockchain_service.is_connected() and blockchain_service.contract:
        borrower: User = loan.user
        borrower_address: str = borrower.wallet_address or blockchain_service.admin_account.address
        deposit_wei: int = int(loan.deposit_amount)

        # Gửi createLoan
        create_tx = blockchain_service.create_loan(
            loan_id=loan_id_bytes,
            equipment_id=loan.equipment_id,
            student_id=borrower.student_staff_id,
            borrower_address=borrower_address,
            expected_handover=int(loan.expected_handover_date.timestamp()),
            due_date=int(loan.due_date.timestamp()),
            deposit_amount=deposit_wei
        )
        db.add(BlockchainTransaction(
            request_id=loan.id,
            tx_hash=create_tx["tx_hash"],
            action_type=TxActionType.CREATE_LOAN,
            from_address=create_tx["from_address"],
            to_address=create_tx["to_address"],
            block_number=create_tx["block_number"],
            gas_used=create_tx["gas_used"],
            status=TxStatus.CONFIRMED
        ))

        # Gửi approveLoan (Khóa Mutex activeEquipmentLoan on-chain)
        approve_tx = blockchain_service.approve_loan(loan_id=loan_id_bytes)
        db.add(BlockchainTransaction(
            request_id=loan.id,
            tx_hash=approve_tx["tx_hash"],
            action_type=TxActionType.APPROVE_LOAN,
            from_address=approve_tx["from_address"],
            to_address=approve_tx["to_address"],
            block_number=approve_tx["block_number"],
            gas_used=approve_tx["gas_used"],
            status=TxStatus.CONFIRMED
        ))

    # 4. Cập nhật trạng thái đơn trong MySQL
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

    # 1. Cập nhật thiết bị sang IN_USE
    equipment = get_equipment_by_id(db, loan.equipment_id)
    if equipment:
        equipment.status = EquipmentStatus.IN_USE

    # 2. Gọi Smart Contract confirmHandover
    if blockchain_service.is_connected() and loan.on_chain_loan_id:
        loan_id_bytes = bytes.fromhex(loan.on_chain_loan_id.replace("0x", ""))
        handover_tx = blockchain_service.confirm_handover(loan_id=loan_id_bytes)
        db.add(BlockchainTransaction(
            request_id=loan.id,
            tx_hash=handover_tx["tx_hash"],
            action_type=TxActionType.HANDOVER,
            from_address=handover_tx["from_address"],
            to_address=handover_tx["to_address"],
            block_number=handover_tx["block_number"],
            gas_used=handover_tx["gas_used"],
            status=TxStatus.CONFIRMED
        ))

    # 3. Cập nhật bản ghi đơn mượn
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

    now = datetime.now()
    equipment = get_equipment_by_id(db, loan.equipment_id)
    condition: ReturnCondition = return_in.return_condition

    # 1. Tính toán phạt và trạng thái cọc theo quy tắc nghiệp vụ cốt lõi
    penalty_percent: int = 0
    if condition in [ReturnCondition.DAMAGED, ReturnCondition.LOST]:
        penalty_percent = 100
        loan.deposit_status = DepositStatus.FORFEITED
        loan.status = LoanStatus.DISPUTED
        if equipment:
            equipment.status = EquipmentStatus.MAINTENANCE if condition == ReturnCondition.DAMAGED else EquipmentStatus.RETIRED
    else:
        # Tình trạng GOOD
        if return_in.manual_penalty_percent is not None:
            penalty_percent = return_in.manual_penalty_percent
        elif now > loan.due_date:
            overdue_duration: timedelta = now - loan.due_date
            if overdue_duration <= timedelta(hours=24):
                penalty_percent = 10  # Trễ <= 24 giờ phạt 10%
            else:
                penalty_percent = 50  # Trễ > 24 giờ phạt 50%
        else:
            penalty_percent = 0  # Trả đúng hạn

        loan.deposit_status = DepositStatus.REFUNDED
        loan.status = LoanStatus.RETURNED
        if equipment:
            equipment.status = EquipmentStatus.AVAILABLE

    # 2. Gọi Smart Contract confirmReturn
    if blockchain_service.is_connected() and loan.on_chain_loan_id:
        loan_id_bytes = bytes.fromhex(loan.on_chain_loan_id.replace("0x", ""))
        # Quy đổi condition sang uint8: 0=GOOD, 1=DAMAGED, 2=LOST
        condition_code: int = 0 if condition == ReturnCondition.GOOD else (1 if condition == ReturnCondition.DAMAGED else 2)
        return_tx = blockchain_service.confirm_return(
            loan_id=loan_id_bytes,
            return_condition=condition_code,
            penalty_percent=penalty_percent
        )
        db.add(BlockchainTransaction(
            request_id=loan.id,
            tx_hash=return_tx["tx_hash"],
            action_type=TxActionType.RETURN_LOAN,
            from_address=return_tx["from_address"],
            to_address=return_tx["to_address"],
            block_number=return_tx["block_number"],
            gas_used=return_tx["gas_used"],
            status=TxStatus.CONFIRMED
        ))

    # 3. Cập nhật các trường còn lại trong MySQL
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

    # 1. Nếu đơn đã duyệt (APPROVED) -> Giải phóng thiết bị về AVAILABLE
    equipment = get_equipment_by_id(db, loan.equipment_id)
    if loan.status == LoanStatus.APPROVED and equipment:
        equipment.status = EquipmentStatus.AVAILABLE

    # 2. Gọi Smart Contract cancelLoan nếu có on_chain_loan_id
    if blockchain_service.is_connected() and loan.on_chain_loan_id:
        loan_id_bytes = bytes.fromhex(loan.on_chain_loan_id.replace("0x", ""))
        cancel_tx = blockchain_service.cancel_loan(
            loan_id=loan_id_bytes,
            reason=cancel_in.reason or "Cancelled by user"
        )
        db.add(BlockchainTransaction(
            request_id=loan.id,
            tx_hash=cancel_tx["tx_hash"],
            action_type=TxActionType.CANCEL_LOAN,
            from_address=cancel_tx["from_address"],
            to_address=cancel_tx["to_address"],
            block_number=cancel_tx["block_number"],
            gas_used=cancel_tx["gas_used"],
            status=TxStatus.CONFIRMED
        ))

    # 3. Cập nhật bản ghi đơn mượn
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

