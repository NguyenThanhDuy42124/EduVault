"""
Module: backend.app.services.reconciliation_service
Mục đích: Đối soát tính toàn vẹn độc lập và khôi phục lệch dữ liệu (Reconciliation) giữa MySQL và Smart Contract.
Áp dụng: Quy định viết code và docstring tại QUY_DINH_CODE.md.
"""
from datetime import datetime
from typing import Any, Dict, List
from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from backend.app.models.audit_log import AuditLog
from backend.app.models.blockchain_tx import BlockchainTransaction, TxActionType, TxStatus
from backend.app.models.equipment import Equipment, EquipmentStatus
from backend.app.models.lending_request import DepositStatus, LendingRequest, LoanStatus
from backend.app.models.user import User
from backend.app.services.blockchain_service import (
    ZERO_BYTES32_HEX,
    blockchain_service,
    normalize_hex_bytes32,
)
from backend.app.services.loan_service import get_loan_by_id, normalize_naive_dt

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

# Bảng ánh xạ DepositState (Solidity uint8: 0=None, 1=Locked, 2=Refunded, 3=Forfeited)
ONCHAIN_DEPOSIT_TO_MYSQL = {
    0: DepositStatus.PENDING,
    1: DepositStatus.LOCKED,
    2: DepositStatus.REFUNDED,
    3: DepositStatus.FORFEITED,
}

MYSQL_TO_ONCHAIN_DEPOSIT = {v: k for k, v in ONCHAIN_DEPOSIT_TO_MYSQL.items()}


def verify_loan_integrity(db: Session, loan_id: int) -> Dict[str, Any]:
    """
    Mục đích: Đối soát toàn diện từng trường dữ liệu giữa MySQL và Smart Contract của một đơn mượn.
    """
    loan = get_loan_by_id(db, loan_id)
    if loan is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Không tìm thấy đơn mượn với ID #{loan_id}."
        )

    expected_handover_ts = int(normalize_naive_dt(loan.expected_handover_date).timestamp())
    due_ts = int(normalize_naive_dt(loan.due_date).timestamp())

    mysql_state = {
        "status": loan.status.value,
        "equipment_id": loan.equipment_id,
        "student_id": loan.user.student_staff_id if loan.user else None,
        "borrower_wallet": loan.user.wallet_address if loan.user else None,
        "wallet_verified": bool(loan.user.wallet_verified) if loan.user else False,
        "deposit_amount": float(loan.deposit_amount),
        "deposit_status": loan.deposit_status.value,
        "expected_handover": expected_handover_ts,
        "due_date": due_ts,
        "actual_handover": int(normalize_naive_dt(loan.actual_handover_date).timestamp()) if loan.actual_handover_date else 0,
        "actual_return": int(normalize_naive_dt(loan.actual_return_date).timestamp()) if loan.actual_return_date else 0,
        "on_chain_loan_id": loan.on_chain_loan_id
    }

    if not loan.on_chain_loan_id:
        return {
            "loan_id": loan.id,
            "on_chain_loan_id": None,
            "is_synced": False,
            "sync_status": "NOT_ON_CHAIN",
            "mismatches": ["Đơn chưa được ghi nhận trên Blockchain (on_chain_loan_id = NULL)."],
            "mysql_state": mysql_state,
            "blockchain_state": {}
        }

    try:
        blockchain_service.ensure_ready(require_admin=False)
    except Exception as exc:
        return {
            "loan_id": loan.id,
            "on_chain_loan_id": loan.on_chain_loan_id,
            "is_synced": False,
            "sync_status": "RPC_OFFLINE",
            "mismatches": [f"Node Blockchain offline hoặc sai mạng/contract: {exc}"],
            "mysql_state": mysql_state,
            "blockchain_state": {}
        }

    mismatches: List[str] = []
    blockchain_state: Dict[str, Any] = {}

    try:
        norm_loan_id = normalize_hex_bytes32(loan.on_chain_loan_id, 32)
        blockchain_state = blockchain_service.get_loan(norm_loan_id)
        active_mutex = blockchain_service.get_active_equipment_loan(loan.equipment_id)

        # 0. Kiểm tra sự tồn tại thực tế của bản ghi trên Smart Contract
        if (
            blockchain_state.get("loan_id") == ZERO_BYTES32_HEX
            or int(blockchain_state.get("request_time", 0)) == 0
        ):
            return {
                "loan_id": loan.id,
                "on_chain_loan_id": loan.on_chain_loan_id,
                "is_synced": False,
                "sync_status": "MISSING_ON_CHAIN",
                "mismatches": ["Bản ghi đơn mượn chưa tồn tại trên Smart Contract (request_time = 0)."],
                "mysql_state": mysql_state,
                "blockchain_state": blockchain_state
            }

        # 1. So khớp trạng thái đơn mượn
        actual_onchain_state = int(blockchain_state.get("state", -1))
        if loan.status == LoanStatus.REJECTED:
            if actual_onchain_state != 4:
                mismatches.append(
                    f"Lệch trạng thái: MySQL=REJECTED (kỳ vọng on-chain Cancelled=4), On-chain code={actual_onchain_state}"
                )
        else:
            expected_onchain_state = MYSQL_TO_ONCHAIN_STATE.get(loan.status)
            if expected_onchain_state != actual_onchain_state:
                mismatches.append(
                    f"Lệch trạng thái: MySQL={loan.status.value} (code {expected_onchain_state}), On-chain code={actual_onchain_state}"
                )

        # 2. So khớp Equipment ID
        if int(blockchain_state.get("equipment_id", -1)) != int(loan.equipment_id):
            mismatches.append(
                f"Lệch thiết bị: MySQL={loan.equipment_id}, On-chain={blockchain_state.get('equipment_id')}"
            )

        # 3. So khớp student_id
        if loan.user and str(blockchain_state.get("student_id", "")) != str(loan.user.student_staff_id):
            mismatches.append(
                f"Lệch mã sinh viên: MySQL={loan.user.student_staff_id}, On-chain={blockchain_state.get('student_id')}"
            )

        # 4. So khớp địa chỉ ví borrower (phân biệt client MetaMask vs Admin Relayer)
        chain_borrower = str(blockchain_state.get("borrower", "")).lower()
        admin_addr = (
            blockchain_service.admin_account.address.lower()
            if blockchain_service.admin_account
            else ""
        )
        create_tx = db.query(BlockchainTransaction).filter(
            BlockchainTransaction.request_id == loan.id,
            BlockchainTransaction.action_type == TxActionType.CREATE_LOAN,
            BlockchainTransaction.status == TxStatus.CONFIRMED,
        ).first()

        if create_tx and create_tx.from_address and create_tx.from_address.lower() != admin_addr:
            if not (loan.user and loan.user.wallet_verified and loan.user.wallet_address):
                mismatches.append("Giao dịch do ví client tạo nhưng tài khoản MySQL chưa xác minh ví hợp lệ.")
            elif chain_borrower != loan.user.wallet_address.lower():
                mismatches.append(
                    f"Lệch ví borrower: MySQL={loan.user.wallet_address}, On-chain={blockchain_state.get('borrower')}"
                )
        elif loan.user:
            allowed_borrowers = set()
            if loan.user.wallet_verified and loan.user.wallet_address:
                allowed_borrowers.add(loan.user.wallet_address.lower())
            if admin_addr:
                allowed_borrowers.add(admin_addr)
            if allowed_borrowers and chain_borrower not in allowed_borrowers:
                mismatches.append(
                    f"Lệch ví borrower không hợp lệ trên chain: On-chain={blockchain_state.get('borrower')}"
                )

        # 5. So khớp tiền cọc & trạng thái tiền cọc
        if int(blockchain_state.get("deposit_amount", -1)) != int(loan.deposit_amount):
            mismatches.append(
                f"Lệch tiền cọc: MySQL={int(loan.deposit_amount)}, On-chain={blockchain_state.get('deposit_amount')}"
            )

        expected_deposit_state = MYSQL_TO_ONCHAIN_DEPOSIT.get(loan.deposit_status)
        actual_deposit_state = int(blockchain_state.get("deposit_state", -1))
        if expected_deposit_state != actual_deposit_state:
            mismatches.append(
                f"Lệch trạng thái cọc: MySQL={loan.deposit_status.value} (code {expected_deposit_state}), On-chain code={actual_deposit_state}"
            )

        # 6. So khớp các mốc thời gian
        if int(blockchain_state.get("expected_handover", 0)) != expected_handover_ts:
            mismatches.append(
                f"Lệch expected_handover: MySQL={expected_handover_ts}, On-chain={blockchain_state.get('expected_handover')}"
            )
        if int(blockchain_state.get("due_date", 0)) != due_ts:
            mismatches.append(
                f"Lệch due_date: MySQL={due_ts}, On-chain={blockchain_state.get('due_date')}"
            )
        chain_actual_handover = int(blockchain_state.get("actual_handover", 0))
        if (loan.actual_handover_date is not None) != (chain_actual_handover > 0):
            mismatches.append(
                f"Lệch dấu mốc actual_handover: MySQL={'có' if loan.actual_handover_date else 'không'}, On-chain={chain_actual_handover}"
            )
        chain_actual_return = int(blockchain_state.get("actual_return", 0))
        if (loan.actual_return_date is not None) != (chain_actual_return > 0):
            mismatches.append(
                f"Lệch dấu mốc actual_return: MySQL={'có' if loan.actual_return_date else 'không'}, On-chain={chain_actual_return}"
            )

        # 7. So khớp Mutex khóa thiết bị (bao gồm cả DISPUTED & REJECTED)
        mutex_hex = normalize_hex_bytes32(active_mutex, 32)
        if loan.status in [LoanStatus.APPROVED, LoanStatus.ACTIVE]:
            if mutex_hex != norm_loan_id:
                mismatches.append("Lệch Mutex: Đơn đang duyệt/mượn nhưng Mutex on-chain không trỏ tới đơn này.")
        elif loan.status in [
            LoanStatus.PENDING,
            LoanStatus.RETURNED,
            LoanStatus.DISPUTED,
            LoanStatus.CANCELLED,
            LoanStatus.REJECTED,
        ]:
            if mutex_hex == norm_loan_id:
                mismatches.append("Lệch Mutex: Đơn đã kết thúc hoặc chưa duyệt nhưng Mutex on-chain vẫn đang bị giữ.")

    except Exception as e:
        mismatches.append(f"Không thể đọc Smart Contract: {str(e)}")

    is_synced = len(mismatches) == 0
    return {
        "loan_id": loan.id,
        "on_chain_loan_id": loan.on_chain_loan_id,
        "is_synced": is_synced,
        "sync_status": "SYNCED" if is_synced else "MISMATCH",
        "mismatches": mismatches,
        "mysql_state": mysql_state,
        "blockchain_state": blockchain_state
    }


def reconcile_database_with_blockchain(
    db: Session,
    admin_user: User
) -> Dict[str, Any]:
    """
    Mục đích: Quét và khôi phục đồng bộ từ nguồn chân lý Smart Contract sang MySQL một cách an toàn.
    """
    try:
        blockchain_service.ensure_ready(require_admin=False)
    except ConnectionError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Node Blockchain đang offline hoặc sai cấu hình mạng, không thể đối soát: {exc}"
        ) from exc

    fixed_count: int = 0
    details: List[str] = []

    # 1. Đồng bộ các giao dịch PENDING trước
    pending_txs = db.query(BlockchainTransaction).filter(
        BlockchainTransaction.status == TxStatus.PENDING
    ).all()

    for tx in pending_txs:
        try:
            receipt = blockchain_service.web3.eth.get_transaction_receipt(tx.tx_hash)
            if receipt:
                tx.block_number = getattr(receipt, "block_number", getattr(receipt, "blockNumber", None))
                tx.gas_used = getattr(receipt, "gas_used", getattr(receipt, "gasUsed", None))
                tx.status = TxStatus.CONFIRMED if receipt.status == 1 else TxStatus.FAILED
                fixed_count += 1
                details.append(f"Giao dịch {tx.tx_hash[:10]}...: Cập nhật từ PENDING -> {tx.status.value}")
        except Exception:
            continue

    # 2. Quét các đơn đã có on_chain_loan_id
    loans_to_check = db.query(LendingRequest).filter(
        LendingRequest.on_chain_loan_id.isnot(None)
    ).all()
    scanned_count: int = len(loans_to_check)

    for loan in loans_to_check:
        try:
            norm_loan_id = normalize_hex_bytes32(loan.on_chain_loan_id, 32)
            onchain_record = blockchain_service.get_loan(norm_loan_id)

            # Bảo vệ: Tuyệt đối không ghi đè DB từ struct rỗng nếu đơn chưa tồn tại trên Contract
            if (
                onchain_record.get("loan_id") == ZERO_BYTES32_HEX
                or int(onchain_record.get("request_time", 0)) == 0
            ):
                details.append(
                    f"Đơn #{loan.id} ({norm_loan_id[:10]}...): Chưa tồn tại trên Smart Contract (bỏ qua ghi đè DB)."
                )
                continue

            onchain_state_code = int(onchain_record.get("state", -1))
            correct_mysql_status = ONCHAIN_TO_MYSQL_STATE.get(onchain_state_code)

            # Đơn bị từ chối ở Web2 (REJECTED) và Cancelled trên chain (4) là hợp lệ
            if loan.status == LoanStatus.REJECTED and onchain_state_code == 4:
                continue

            loan_changed = False
            changes: Dict[str, Any] = {}

            if correct_mysql_status and correct_mysql_status != loan.status:
                old_status = loan.status.value
                loan.status = correct_mysql_status
                changes["status"] = {"old": old_status, "new": correct_mysql_status.value}
                loan_changed = True

                equipment = db.query(Equipment).filter(Equipment.id == loan.equipment_id).first()
                if equipment:
                    if correct_mysql_status == LoanStatus.APPROVED:
                        equipment.status = EquipmentStatus.RESERVED
                    elif correct_mysql_status == LoanStatus.ACTIVE:
                        equipment.status = EquipmentStatus.IN_USE
                    elif correct_mysql_status in [LoanStatus.RETURNED, LoanStatus.CANCELLED]:
                        equipment.status = EquipmentStatus.AVAILABLE
                    elif correct_mysql_status == LoanStatus.DISPUTED:
                        equipment.status = EquipmentStatus.MAINTENANCE

            onchain_dep_code = int(onchain_record.get("deposit_state", -1))
            correct_dep_status = ONCHAIN_DEPOSIT_TO_MYSQL.get(onchain_dep_code)
            if correct_dep_status and correct_dep_status != loan.deposit_status:
                changes["deposit_status"] = {"old": loan.deposit_status.value, "new": correct_dep_status.value}
                loan.deposit_status = correct_dep_status
                loan_changed = True

            chain_handover_ts = int(onchain_record.get("actual_handover", 0))
            if chain_handover_ts > 0 and loan.actual_handover_date is None:
                loan.actual_handover_date = datetime.fromtimestamp(chain_handover_ts)
                loan_changed = True

            chain_return_ts = int(onchain_record.get("actual_return", 0))
            if chain_return_ts > 0 and loan.actual_return_date is None:
                loan.actual_return_date = datetime.fromtimestamp(chain_return_ts)
                loan_changed = True

            if loan_changed:
                fixed_count += 1
                msg = f"Đơn #{loan.id} ({norm_loan_id[:10]}...): Đã đồng bộ theo Smart Contract ({loan.status.value}, cọc {loan.deposit_status.value})."
                details.append(msg)
                db.add(AuditLog(
                    user_id=admin_user.id,
                    action="RECONCILIATION_FIX",
                    entity_name="lending_requests",
                    entity_id=loan.id,
                    details_json=changes
                ))
        except Exception:
            continue

    if fixed_count > 0:
        db.commit()

    return {
        "scanned_count": scanned_count,
        "fixed_count": fixed_count,
        "details": details
    }

