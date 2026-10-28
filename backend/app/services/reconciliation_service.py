"""
Module: backend.app.services.reconciliation_service
Mục đích: Đối soát tính toàn vẹn độc lập và khôi phục lệch dữ liệu (Reconciliation) giữa MySQL và Smart Contract.
Áp dụng: Quy định viết code và docstring tại QUY_DINH_CODE.md.
"""
from datetime import datetime
from typing import Any, Dict, List, Optional
from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from backend.app.models.audit_log import AuditLog
from backend.app.models.blockchain_tx import BlockchainTransaction, TxStatus
from backend.app.models.equipment import Equipment, EquipmentStatus
from backend.app.models.lending_request import DepositStatus, LendingRequest, LoanStatus
from backend.app.models.user import User
from backend.app.services.blockchain_service import blockchain_service
from backend.app.services.loan_service import get_loan_by_id

# Bảng ánh xạ trạng thái Smart Contract (Solidity uint8) sang MySQL Enum
ONCHAIN_TO_MYSQL_STATE = {
    0: LoanStatus.PENDING,     # Submitted
    1: LoanStatus.APPROVED,    # Approved
    2: LoanStatus.ACTIVE,      # Active
    3: LoanStatus.RETURNED,    # Returned
    4: LoanStatus.CANCELLED,   # Cancelled
    5: LoanStatus.DISPUTED     # Disputed
}

MYSQL_TO_ONCHAIN_STATE = {v: k for k, v in ONCHAIN_TO_MYSQL_STATE.items()}


def verify_loan_integrity(db: Session, loan_id: int) -> Dict[str, Any]:
    """
    Mục đích: Đối soát chi tiết từng trường dữ liệu giữa MySQL và Smart Contract của một đơn mượn.
    Tham số:
        - db (Session): Phiên làm việc CSDL.
        - loan_id (int): Khóa chính ID đơn mượn cần kiểm toán.
    Trả về:
        - Dict[str, Any]: Kết quả so khớp, danh sách các trường lệch (nếu có), snapshot dữ liệu 2 bên.
    Lỗi:
        - HTTPException(404 Not Found): Khi ID đơn mượn không tồn tại.
    Tác dụng phụ:
        - Thực thi truy vấn SELECT và đọc contract on-chain (call).
    """
    loan = get_loan_by_id(db, loan_id)
    if loan is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Không tìm thấy đơn mượn với ID #{loan_id}."
        )

    mysql_state = {
        "status": loan.status.value,
        "equipment_id": loan.equipment_id,
        "deposit_amount": float(loan.deposit_amount),
        "deposit_status": loan.deposit_status.value,
        "on_chain_loan_id": loan.on_chain_loan_id
    }

    if not loan.on_chain_loan_id or not blockchain_service.is_connected():
        return {
            "loan_id": loan.id,
            "on_chain_loan_id": loan.on_chain_loan_id,
            "is_synced": True if not loan.on_chain_loan_id else False,
            "mismatches": ["Đơn chưa được đẩy lên Blockchain" if not loan.on_chain_loan_id else "Node Blockchain đang offline"],
            "mysql_state": mysql_state,
            "blockchain_state": {}
        }

    mismatches: List[str] = []
    blockchain_state: Dict[str, Any] = {}

    try:
        blockchain_state = blockchain_service.get_loan(loan.on_chain_loan_id)
        active_mutex = blockchain_service.get_active_equipment_loan(loan.equipment_id)

        # 1. So khớp trạng thái đơn mượn
        expected_onchain_state = MYSQL_TO_ONCHAIN_STATE.get(loan.status)
        actual_onchain_state = blockchain_state.get("state")
        if expected_onchain_state != actual_onchain_state:
            mismatches.append(
                f"Lệch trạng thái: MySQL={loan.status.value} (code {expected_onchain_state}), On-chain code={actual_onchain_state}"
            )

        # 2. So khớp Equipment ID
        if blockchain_state.get("equipment_id") != loan.equipment_id:
            mismatches.append(
                f"Lệch thiết bị: MySQL={loan.equipment_id}, On-chain={blockchain_state.get('equipment_id')}"
            )

        # 3. So khớp Mutex khóa thiết bị
        clean_loan_hex = loan.on_chain_loan_id.lower().replace("0x", "")
        clean_mutex_hex = active_mutex.lower().replace("0x", "")
        if loan.status in [LoanStatus.APPROVED, LoanStatus.ACTIVE]:
            if clean_mutex_hex != clean_loan_hex:
                mismatches.append("Lệch Mutex: Đơn đang duyệt/mượn nhưng Mutex on-chain không trỏ tới đơn này.")
        elif loan.status in [LoanStatus.RETURNED, LoanStatus.CANCELLED]:
            if clean_mutex_hex != "0" * 64 and clean_mutex_hex == clean_loan_hex:
                mismatches.append("Lệch Mutex: Đơn đã kết thúc nhưng Mutex on-chain chưa được giải phóng.")

    except Exception as e:
        mismatches.append(f"Không thể đọc Smart Contract: {str(e)}")

    return {
        "loan_id": loan.id,
        "on_chain_loan_id": loan.on_chain_loan_id,
        "is_synced": (len(mismatches) == 0),
        "mismatches": mismatches,
        "mysql_state": mysql_state,
        "blockchain_state": blockchain_state
    }


def reconcile_database_with_blockchain(
    db: Session,
    admin_user: User
) -> Dict[str, Any]:
    """
    Mục đích: Background Reconciliation Worker tự động quét và khôi phục đồng bộ các đơn bị lệch trạng thái
             (ví dụ: do máy chủ bị crash ngay sau khi transaction on-chain đã gửi thành công).
    Tham số:
        - db (Session): Phiên làm việc CSDL.
        - admin_user (User): Quản trị viên kích hoạt đối soát.
    Trả về:
        - Dict[str, Any]: Tổng số đơn đã quét (scanned_count), số lượng đã sửa (fixed_count), chi tiết.
    Lỗi:
        - HTTPException(503 Service Unavailable): Khi node Blockchain đang offline không thể đọc dữ liệu.
    Tác dụng phụ:
        - Tự động UPDATE trạng thái bảng `lending_requests`, `equipment`, `blockchain_transactions` và ghi `audit_logs`.
    """
    if not blockchain_service.is_connected():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Node Blockchain đang offline, không thể thực hiện đối soát tự động."
        )

    # Lấy các đơn mượn đã có on_chain_loan_id
    loans_to_check = db.query(LendingRequest).filter(
        LendingRequest.on_chain_loan_id.isnot(None)
    ).all()

    scanned_count: int = len(loans_to_check)
    fixed_count: int = 0
    details: List[str] = []

    for loan in loans_to_check:
        try:
            onchain_record = blockchain_service.get_loan(loan.on_chain_loan_id)
            onchain_state_code = onchain_record.get("state")
            correct_mysql_status = ONCHAIN_TO_MYSQL_STATE.get(onchain_state_code)

            if correct_mysql_status and correct_mysql_status != loan.status:
                old_status = loan.status.value
                loan.status = correct_mysql_status

                # Đồng bộ trạng thái thiết bị tương ứng
                equipment = db.query(Equipment).filter(Equipment.id == loan.equipment_id).first()
                if equipment:
                    if correct_mysql_status == LoanStatus.APPROVED:
                        equipment.status = EquipmentStatus.RESERVED
                    elif correct_mysql_status == LoanStatus.ACTIVE:
                        equipment.status = EquipmentStatus.IN_USE
                    elif correct_mysql_status in [LoanStatus.RETURNED, LoanStatus.CANCELLED]:
                        equipment.status = EquipmentStatus.AVAILABLE

                fixed_count += 1
                msg = f"Đơn #{loan.id} (Hash: {loan.on_chain_loan_id[:10]}...): Tự động sửa từ '{old_status}' -> '{correct_mysql_status.value}' theo Smart Contract."
                details.append(msg)

                db.add(AuditLog(
                    user_id=admin_user.id,
                    action="RECONCILIATION_FIX",
                    entity_name="lending_requests",
                    entity_id=loan.id,
                    details_json={"old_status": old_status, "new_status": correct_mysql_status.value}
                ))
        except Exception:
            continue

    # Đồng bộ các giao dịch đang ở trạng thái PENDING
    pending_txs = db.query(BlockchainTransaction).filter(
        BlockchainTransaction.status == TxStatus.PENDING
    ).all()

    for tx in pending_txs:
        try:
            receipt = blockchain_service.web3.eth.get_transaction_receipt(tx.tx_hash)
            if receipt:
                tx.block_number = receipt.blockNumber
                tx.gas_used = receipt.gasUsed
                tx.status = TxStatus.CONFIRMED if receipt.status == 1 else TxStatus.FAILED
                fixed_count += 1
                details.append(f"Giao dịch {tx.tx_hash[:10]}...: Cập nhật từ PENDING -> {tx.status.value}")
        except Exception:
            continue

    if fixed_count > 0:
        db.commit()

    return {
        "scanned_count": scanned_count,
        "fixed_count": fixed_count,
        "details": details
    }

