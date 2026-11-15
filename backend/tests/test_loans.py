"""
Module: backend.tests.test_loans
Mục đích: Bộ kiểm thử tự động cho vòng đời mượn trả thiết bị Pure Web3 (MetaMask + Receipt Verifier).
Áp dụng: Quy định viết code và docstring tại QUY_DINH_CODE.md.
"""
from datetime import datetime, timedelta
import pytest
from eth_account import Account
from backend.app.core.security import create_access_token, hash_password
from backend.app.models.audit_log import AuditLog
from backend.app.models.blockchain_tx import BlockchainTransaction, TxActionType, TxStatus
from backend.app.models.equipment import Equipment, EquipmentStatus
from backend.app.models.lending_request import DepositStatus, LendingRequest, LoanStatus, ReturnCondition
from backend.app.models.user import User, UserRole
from backend.app.services.blockchain_service import (
    ZERO_BYTES32_HEX,
    blockchain_service,
    normalize_hex_bytes32,
)

ADMIN_WALLET = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"
BORROWER_WALLET = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8"
OTHER_WALLET = "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC"
CONTRACT_ADDR = "0x5FbDB2315678afecb367f032d93F642f64180aa3"


class _FakePureWeb3Chain:
    """Mô phỏng node EVM và Receipt Verifier cho kiến trúc Pure Web3."""

    def __init__(self):
        self.loans = {}
        self.active_mutex = {}
        self.receipts = {}
        self.tx_counter = 0
        self.loan_counter = 0

    def _next_tx_hash(self) -> str:
        self.tx_counter += 1
        return "0x" + f"{self.tx_counter:064x}"

    def next_loan_id(self, user_id: int = 1, eq_id: int = 1) -> str:
        self.loan_counter += 1
        _, hex_id = blockchain_service.generate_loan_id(user_id, eq_id, 1700000000 + self.loan_counter)
        return hex_id

    def is_connected(self) -> bool:
        return True

    def ensure_ready(self) -> None:
        return None

    def get_loan(self, loan_id):
        hex_id = normalize_hex_bytes32(loan_id, 32)
        if hex_id not in self.loans:
            return {
                "loan_id": ZERO_BYTES32_HEX,
                "equipment_id": 0,
                "borrower": "0x" + "0" * 40,
                "student_id": "",
                "request_time": 0,
                "expected_handover": 0,
                "due_date": 0,
                "actual_handover": 0,
                "actual_return": 0,
                "deposit_amount": 0,
                "state": 0,
                "deposit_state": 0,
                "penalty_percent": 0,
            }
        return dict(self.loans[hex_id])

    def is_overdue(self, loan_id) -> bool:
        rec = self.get_loan(loan_id)
        return bool(rec["request_time"] > 0 and rec["state"] == 2 and datetime.now().timestamp() > rec["due_date"])

    def sign_create_loan(
        self,
        sender: str,
        equipment_id: int,
        student_id: str,
        expected_handover_ts: int,
        due_ts: int,
        deposit_amount: int,
        loan_id: str = None,
    ):
        loan_hex = normalize_hex_bytes32(loan_id, 32) if loan_id else self.next_loan_id(1, equipment_id)
        tx_hash = self._next_tx_hash()
        self.loans[loan_hex] = {
            "loan_id": loan_hex,
            "equipment_id": int(equipment_id),
            "borrower": sender,
            "student_id": student_id,
            "request_time": int(datetime.now().timestamp()),
            "expected_handover": int(expected_handover_ts),
            "due_date": int(due_ts),
            "actual_handover": 0,
            "actual_return": 0,
            "deposit_amount": int(deposit_amount),
            "state": 0,
            "deposit_state": 0,
            "penalty_percent": 0,
        }
        self.receipts[tx_hash] = {
            "status": 1,
            "sender": sender,
            "event": "LoanCreated",
            "loan_id": loan_hex,
            "args": {
                "loanId": loan_hex,
                "equipmentId": int(equipment_id),
                "studentId": student_id,
                "borrower": sender,
                "dueDate": int(due_ts),
                "depositAmount": int(deposit_amount),
            },
        }
        return loan_hex, tx_hash

    def sign_approve_loan(self, sender: str, loan_id: str) -> str:
        loan_hex = normalize_hex_bytes32(loan_id, 32)
        rec = self.loans[loan_hex]
        rec["state"] = 1
        self.active_mutex[rec["equipment_id"]] = loan_hex
        tx_hash = self._next_tx_hash()
        self.receipts[tx_hash] = {
            "status": 1,
            "sender": sender,
            "event": "LoanApproved",
            "loan_id": loan_hex,
            "args": {"loanId": loan_hex, "equipmentId": rec["equipment_id"], "timestamp": int(datetime.now().timestamp())},
        }
        return tx_hash

    def sign_handover(self, sender: str, loan_id: str) -> str:
        loan_hex = normalize_hex_bytes32(loan_id, 32)
        rec = self.loans[loan_hex]
        rec["state"] = 2
        rec["actual_handover"] = int(datetime.now().timestamp())
        if rec["deposit_amount"] > 0:
            rec["deposit_state"] = 1
        tx_hash = self._next_tx_hash()
        self.receipts[tx_hash] = {
            "status": 1,
            "sender": sender,
            "event": "HandoverConfirmed",
            "loan_id": loan_hex,
            "args": {"loanId": loan_hex, "timestamp": rec["actual_handover"]},
        }
        return tx_hash

    def sign_return(self, sender: str, loan_id: str, return_condition: int, overdue_penalty_percent: int = 0) -> str:
        loan_hex = normalize_hex_bytes32(loan_id, 32)
        rec = self.loans[loan_hex]
        rec["actual_return"] = int(datetime.now().timestamp())
        if return_condition in (1, 2):
            rec["state"] = 5
            rec["deposit_state"] = 3
            rec["penalty_percent"] = 100
        else:
            rec["state"] = 3
            rec["deposit_state"] = 2
            rec["penalty_percent"] = overdue_penalty_percent
        self.active_mutex.pop(rec["equipment_id"], None)
        tx_hash = self._next_tx_hash()
        self.receipts[tx_hash] = {
            "status": 1,
            "sender": sender,
            "event": "LoanReturned",
            "loan_id": loan_hex,
            "args": {
                "loanId": loan_hex,
                "returnCondition": return_condition,
                "penaltyPercent": rec["penalty_percent"],
                "depositState": rec["deposit_state"],
                "timestamp": rec["actual_return"],
            },
        }
        return tx_hash

    def sign_cancel(self, sender: str, loan_id: str, reason: str = "Cancelled") -> str:
        loan_hex = normalize_hex_bytes32(loan_id, 32)
        rec = self.loans[loan_hex]
        rec["state"] = 4
        self.active_mutex.pop(rec["equipment_id"], None)
        tx_hash = self._next_tx_hash()
        self.receipts[tx_hash] = {
            "status": 1,
            "sender": sender,
            "event": "LoanCancelled",
            "loan_id": loan_hex,
            "args": {"loanId": loan_hex, "reason": reason, "timestamp": int(datetime.now().timestamp())},
        }
        return tx_hash

    def mint_reverted_tx(self, sender: str) -> str:
        tx_hash = self._next_tx_hash()
        self.receipts[tx_hash] = {"status": 0, "sender": sender, "event": None, "loan_id": None, "args": {}}
        return tx_hash

    def verify_transaction_receipt(
        self,
        tx_hash: str,
        expected_event: str,
        expected_loan_id=None,
        expected_sender: str = None,
        expected_args=None,
        wait_timeout: int = 30,
    ):
        tx_hex = normalize_hex_bytes32(tx_hash, 32)
        if tx_hex not in self.receipts:
            raise ValueError(f"Không tìm thấy giao dịch {tx_hex} trên blockchain.")
        entry = self.receipts[tx_hex]
        if entry["status"] != 1:
            raise ValueError(f"Giao dịch {tx_hex} đã bị revert on-chain (status != 1).")
        if expected_sender and entry["sender"].lower() != expected_sender.lower():
            raise ValueError(f"Địa chỉ gửi giao dịch ({entry['sender']}) không khớp ví đã xác minh ({expected_sender}).")
        if entry["event"] != expected_event:
            raise ValueError(f"Biên lai giao dịch {tx_hex} không phát sự kiện {expected_event}.")
        if expected_loan_id:
            norm_lid = normalize_hex_bytes32(expected_loan_id, 32)
            if entry["loan_id"] != norm_lid:
                raise ValueError(f"Sự kiện {expected_event} không khớp loanId {norm_lid}.")
        if expected_args:
            for key, val in expected_args.items():
                actual = entry["args"].get(key)
                if str(actual).lower() != str(val).lower():
                    raise ValueError(f"Tham số {key} không khớp ({actual} != {val}).")
        return {
            "tx_hash": tx_hex,
            "block_number": 100 + self.tx_counter,
            "gas_used": 85000,
            "status": "CONFIRMED",
            "from_address": entry["sender"],
            "to_address": CONTRACT_ADDR,
            "event_name": expected_event,
            "event_args": dict(entry["args"]),
        }

    def verify_create_loan_tx(
        self,
        tx_hash: str,
        expected_loan_id,
        expected_equipment_id: int,
        expected_student_id: str,
        expected_borrower_address: str,
        expected_handover_ts: int,
        expected_due_ts: int,
        expected_deposit: int,
        expected_sender_address: str = None,
    ):
        norm_lid = normalize_hex_bytes32(expected_loan_id, 32)
        verified = self.verify_transaction_receipt(
            tx_hash=tx_hash,
            expected_event="LoanCreated",
            expected_loan_id=norm_lid,
            expected_sender=expected_sender_address or expected_borrower_address,
            expected_args={
                "equipmentId": int(expected_equipment_id),
                "studentId": str(expected_student_id),
                "borrower": expected_borrower_address,
                "dueDate": int(expected_due_ts),
                "depositAmount": int(expected_deposit),
            },
        )
        on_chain = self.get_loan(norm_lid)
        if int(on_chain["expected_handover"]) != int(expected_handover_ts):
            raise ValueError("expected_handover trên chain không khớp.")
        verified["on_chain_record"] = on_chain
        return verified


@pytest.fixture
def fake_chain(monkeypatch, db_session, test_admin_user, test_borrower_user):
    """Gắn Pure Web3 Verifier mock và ví đã xác minh EIP-191 cho Admin/Borrower."""
    from backend.app.services import loan_service as ls

    test_admin_user.wallet_address = ADMIN_WALLET
    test_admin_user.wallet_verified = True
    test_borrower_user.wallet_address = BORROWER_WALLET
    test_borrower_user.wallet_verified = True
    db_session.commit()

    chain = _FakePureWeb3Chain()
    monkeypatch.setattr(ls.blockchain_service, "is_connected", chain.is_connected)
    monkeypatch.setattr(ls.blockchain_service, "ensure_ready", chain.ensure_ready)
    monkeypatch.setattr(ls.blockchain_service, "get_loan", chain.get_loan)
    monkeypatch.setattr(ls.blockchain_service, "is_overdue", chain.is_overdue)
    monkeypatch.setattr(ls.blockchain_service, "verify_transaction_receipt", chain.verify_transaction_receipt)
    monkeypatch.setattr(ls.blockchain_service, "verify_create_loan_tx", chain.verify_create_loan_tx)
    return chain


def _create_pure_web3_loan(
    client,
    chain: _FakePureWeb3Chain,
    borrower: User,
    equipment: Equipment,
    headers: dict,
    handover_dt: datetime = None,
    due_dt: datetime = None,
    use_client_alias: bool = False,
):
    now = datetime.now().replace(microsecond=0)
    ho = handover_dt or (now + timedelta(days=1))
    due = due_dt or (now + timedelta(days=5))
    loan_id_hex, tx_hash = chain.sign_create_loan(
        sender=borrower.wallet_address,
        equipment_id=equipment.id,
        student_id=borrower.student_staff_id,
        expected_handover_ts=int(ho.timestamp()),
        due_ts=int(due.timestamp()),
        deposit_amount=int(equipment.deposit_amount),
    )
    payload = {
        "equipment_id": equipment.id,
        "expected_handover_date": ho.isoformat(),
        "due_date": due.isoformat(),
        "on_chain_loan_id": loan_id_hex,
        "client_tx_hash" if use_client_alias else "tx_hash": tx_hash,
    }
    res = client.post("/api/v1/loans/request", json=payload, headers=headers)
    return res, payload, loan_id_hex, tx_hash


def test_request_loan_requires_pure_web3_tx_hash_and_loan_id(client, borrower_token_headers, available_equipment):
    """
    Mục đích: Chặn tạo đơn khi thiếu `tx_hash`/`on_chain_loan_id` hoặc khi `tx_hash` và `client_tx_hash` mâu thuẫn (400).
    """
    now = datetime.now().replace(microsecond=0)
    res_missing = client.post("/api/v1/loans/request", json={
        "equipment_id": available_equipment.id,
        "expected_handover_date": (now + timedelta(days=1)).isoformat(),
        "due_date": (now + timedelta(days=5)).isoformat(),
    }, headers=borrower_token_headers)
    assert res_missing.status_code == 400
    assert "Pure Web3" in res_missing.json()["detail"]

    res_conflict = client.post("/api/v1/loans/request", json={
        "equipment_id": available_equipment.id,
        "expected_handover_date": (now + timedelta(days=1)).isoformat(),
        "due_date": (now + timedelta(days=5)).isoformat(),
        "on_chain_loan_id": "0x" + "aa" * 32,
        "tx_hash": "0x" + "11" * 32,
        "client_tx_hash": "0x" + "22" * 32,
    }, headers=borrower_token_headers)
    assert res_conflict.status_code == 400
    assert "không khớp" in res_conflict.json()["detail"]


def test_request_loan_unverified_wallet_returns_403(
    client, db_session, available_equipment, fake_chain
):
    """
    Mục đích: Tài khoản chưa xác minh ví MetaMask bị từ chối gửi giao dịch (403 Forbidden).
    """
    sv_unv = User(
        student_staff_id="SV_UNV_LOAN",
        full_name="Sinh Viên Chưa Verify",
        email="unv_loan@eduvault.edu.vn",
        password_hash=hash_password("student123"),
        role=UserRole.BORROWER,
        wallet_address=OTHER_WALLET,
        wallet_verified=False,
        is_active=True,
    )
    db_session.add(sv_unv)
    db_session.commit()
    db_session.refresh(sv_unv)
    unv_headers = {"Authorization": f"Bearer {create_access_token(sv_unv.id, 'BORROWER')}"}

    now = datetime.now().replace(microsecond=0)
    ho = now + timedelta(days=1)
    due = now + timedelta(days=3)
    loan_id_hex, tx_hash = fake_chain.sign_create_loan(
        sender=OTHER_WALLET,
        equipment_id=available_equipment.id,
        student_id=sv_unv.student_staff_id,
        expected_handover_ts=int(ho.timestamp()),
        due_ts=int(due.timestamp()),
        deposit_amount=int(available_equipment.deposit_amount),
    )
    res = client.post("/api/v1/loans/request", json={
        "equipment_id": available_equipment.id,
        "expected_handover_date": ho.isoformat(),
        "due_date": due.isoformat(),
        "on_chain_loan_id": loan_id_hex,
        "tx_hash": tx_hash,
    }, headers=unv_headers)
    assert res.status_code == 403


def test_request_loan_invalid_dates_unavailable_and_duplicate_checks(
    client, borrower_token_headers, test_borrower_user, available_equipment, db_session, fake_chain
):
    """
    Mục đích: Kiểm tra validation ngày (400), thiết bị không khả dụng (409) và đơn trùng thiết bị (409).
    """
    now = datetime.now().replace(microsecond=0)
    bad_dates = client.post("/api/v1/loans/request", json={
        "equipment_id": available_equipment.id,
        "expected_handover_date": (now + timedelta(days=5)).isoformat(),
        "due_date": (now + timedelta(days=2)).isoformat(),
        "on_chain_loan_id": "0x" + "11" * 32,
        "tx_hash": "0x" + "22" * 32,
    }, headers=borrower_token_headers)
    assert bad_dates.status_code == 400

    res1, _, _, _ = _create_pure_web3_loan(
        client, fake_chain, test_borrower_user, available_equipment, borrower_token_headers
    )
    assert res1.status_code == 201

    res_dup, _, _, _ = _create_pure_web3_loan(
        client, fake_chain, test_borrower_user, available_equipment, borrower_token_headers
    )
    assert res_dup.status_code == 409

    available_equipment.status = EquipmentStatus.IN_USE
    db_session.commit()
    res_unavail, _, _, _ = _create_pure_web3_loan(
        client, fake_chain, test_borrower_user, available_equipment, borrower_token_headers
    )
    assert res_unavail.status_code == 409


def test_pure_web3_full_lifecycle_ontime_good_and_client_tx_alias(
    client, admin_token_headers, borrower_token_headers, test_admin_user, test_borrower_user, available_equipment, db_session, fake_chain
):
    """
    Mục đích: Kiểm thử vòng đời đầy đủ Pure Web3 từ `request` (dùng alias `client_tx_hash`) -> `approve` -> `handover` -> `return` (GOOD, đúng hạn).
    """
    res_req, _, loan_hex, _ = _create_pure_web3_loan(
        client,
        fake_chain,
        test_borrower_user,
        available_equipment,
        borrower_token_headers,
        use_client_alias=True,
    )
    assert res_req.status_code == 201
    loan_id = res_req.json()["id"]
    assert res_req.json()["on_chain_loan_id"] == loan_hex

    tx_approve = fake_chain.sign_approve_loan(test_admin_user.wallet_address, loan_hex)
    res_app = client.post(
        f"/api/v1/loans/{loan_id}/approve",
        json={"tx_hash": tx_approve, "notes": "Đã kiểm tra thẻ SV"},
        headers=admin_token_headers,
    )
    assert res_app.status_code == 200
    assert res_app.json()["status"] == "APPROVED"

    tx_handover = fake_chain.sign_handover(test_admin_user.wallet_address, loan_hex)
    res_ho = client.post(
        f"/api/v1/loans/{loan_id}/handover",
        json={"tx_hash": tx_handover},
        headers=admin_token_headers,
    )
    assert res_ho.status_code == 200
    assert res_ho.json()["status"] == "ACTIVE"
    assert res_ho.json()["deposit_status"] == "LOCKED"

    tx_return = fake_chain.sign_return(test_admin_user.wallet_address, loan_hex, return_condition=0)
    res_ret = client.post(
        f"/api/v1/loans/{loan_id}/return",
        json={"tx_hash": tx_return, "return_condition": "GOOD", "admin_notes": "Nguyên vẹn"},
        headers=admin_token_headers,
    )
    assert res_ret.status_code == 200
    data = res_ret.json()
    assert data["status"] == "RETURNED"
    assert data["deposit_status"] == "REFUNDED"
    assert data["return_condition"] == "GOOD"

    db_session.refresh(available_equipment)
    assert available_equipment.status == EquipmentStatus.AVAILABLE
    tx_rows = db_session.query(BlockchainTransaction).filter(BlockchainTransaction.request_id == loan_id).all()
    assert len(tx_rows) == 4
    assert all(row.status == TxStatus.CONFIRMED for row in tx_rows)


def test_pure_web3_overdue_return_reads_auto_penalty_from_chain(
    client, admin_token_headers, borrower_token_headers, test_admin_user, test_borrower_user, available_equipment, db_session, fake_chain
):
    """
    Mục đích: Đơn trả GOOD nhưng Smart Contract tự phạt 10% quá hạn -> backend đọc penaltyPercent=10 từ event LoanReturned.
    """
    now = datetime.now().replace(microsecond=0)
    res_req, _, loan_hex, _ = _create_pure_web3_loan(
        client,
        fake_chain,
        test_borrower_user,
        available_equipment,
        borrower_token_headers,
        handover_dt=now - timedelta(days=3),
        due_dt=now - timedelta(hours=5),
    )
    loan_id = res_req.json()["id"]

    tx_app = fake_chain.sign_approve_loan(test_admin_user.wallet_address, loan_hex)
    client.post(f"/api/v1/loans/{loan_id}/approve", json={"tx_hash": tx_app}, headers=admin_token_headers)
    tx_ho = fake_chain.sign_handover(test_admin_user.wallet_address, loan_hex)
    client.post(f"/api/v1/loans/{loan_id}/handover", json={"tx_hash": tx_ho}, headers=admin_token_headers)

    tx_ret = fake_chain.sign_return(
        test_admin_user.wallet_address, loan_hex, return_condition=0, overdue_penalty_percent=10
    )
    res_ret = client.post(
        f"/api/v1/loans/{loan_id}/return",
        json={"tx_hash": tx_ret, "return_condition": "GOOD"},
        headers=admin_token_headers,
    )
    assert res_ret.status_code == 200
    assert res_ret.json()["status"] == "RETURNED"
    assert res_ret.json()["deposit_status"] == "REFUNDED"

    audit = (
        db_session.query(AuditLog)
        .filter(AuditLog.entity_id == loan_id, AuditLog.action == "EQUIPMENT_RETURNED")
        .first()
    )
    assert audit is not None
    assert audit.details_json["penalty_percent"] == 10


def test_pure_web3_return_damaged_and_condition_mismatch_rejected(
    client, admin_token_headers, borrower_token_headers, test_admin_user, test_borrower_user, available_equipment, db_session, fake_chain
):
    """
    Mục đích: Báo sai return_condition so với event LoanReturned bị chặn (400), còn DAMAGED thực tế chuyển DISPUTED + FORFEITED.
    """
    res_req, _, loan_hex, _ = _create_pure_web3_loan(
        client, fake_chain, test_borrower_user, available_equipment, borrower_token_headers
    )
    loan_id = res_req.json()["id"]
    tx_app = fake_chain.sign_approve_loan(test_admin_user.wallet_address, loan_hex)
    client.post(f"/api/v1/loans/{loan_id}/approve", json={"tx_hash": tx_app}, headers=admin_token_headers)
    tx_ho = fake_chain.sign_handover(test_admin_user.wallet_address, loan_hex)
    client.post(f"/api/v1/loans/{loan_id}/handover", json={"tx_hash": tx_ho}, headers=admin_token_headers)

    tx_damaged = fake_chain.sign_return(test_admin_user.wallet_address, loan_hex, return_condition=1)
    bad_claim = client.post(
        f"/api/v1/loans/{loan_id}/return",
        json={"tx_hash": tx_damaged, "return_condition": "GOOD"},
        headers=admin_token_headers,
    )
    assert bad_claim.status_code == 400
    loan_db = db_session.query(LendingRequest).filter(LendingRequest.id == loan_id).first()
    assert loan_db.status == LoanStatus.ACTIVE

    ok_damaged = client.post(
        f"/api/v1/loans/{loan_id}/return",
        json={"tx_hash": tx_damaged, "return_condition": "DAMAGED", "admin_notes": "Vỡ màn hình"},
        headers=admin_token_headers,
    )
    assert ok_damaged.status_code == 200
    assert ok_damaged.json()["status"] == "DISPUTED"
    assert ok_damaged.json()["deposit_status"] == "FORFEITED"
    db_session.refresh(available_equipment)
    assert available_equipment.status == EquipmentStatus.MAINTENANCE


def test_reject_and_cancel_pure_web3_flows(
    client, admin_token_headers, borrower_token_headers, test_admin_user, test_borrower_user, available_equipment, db_session, fake_chain
):
    """
    Mục đích: Kiểm thử Admin reject (bắt buộc tx_hash `cancelLoan` khi có on_chain_loan_id) và Borrower cancel đơn APPROVED giải phóng thiết bị.
    """
    # 1. Admin reject loan on-chain
    res1, _, loan_hex1, _ = _create_pure_web3_loan(
        client, fake_chain, test_borrower_user, available_equipment, borrower_token_headers
    )
    loan1_id = res1.json()["id"]

    res_no_tx = client.post(
        f"/api/v1/loans/{loan1_id}/reject",
        json={"reason": "Thiếu thông tin"},
        headers=admin_token_headers,
    )
    assert res_no_tx.status_code == 400

    tx_reject = fake_chain.sign_cancel(test_admin_user.wallet_address, loan_hex1, reason="Từ chối")
    res_reject = client.post(
        f"/api/v1/loans/{loan1_id}/reject",
        json={"tx_hash": tx_reject, "reason": "Không đủ điều kiện"},
        headers=admin_token_headers,
    )
    assert res_reject.status_code == 200
    assert res_reject.json()["status"] == "REJECTED"

    # 2. Borrower approve rồi cancel -> thiết bị trở về AVAILABLE
    res2, _, loan_hex2, _ = _create_pure_web3_loan(
        client, fake_chain, test_borrower_user, available_equipment, borrower_token_headers
    )
    loan2_id = res2.json()["id"]
    tx_app = fake_chain.sign_approve_loan(test_admin_user.wallet_address, loan_hex2)
    client.post(f"/api/v1/loans/{loan2_id}/approve", json={"tx_hash": tx_app}, headers=admin_token_headers)

    tx_cancel = fake_chain.sign_cancel(test_borrower_user.wallet_address, loan_hex2, reason="Đổi lịch")
    res_cancel = client.post(
        f"/api/v1/loans/{loan2_id}/cancel",
        json={"tx_hash": tx_cancel, "reason": "Đổi lịch học"},
        headers=borrower_token_headers,
    )
    assert res_cancel.status_code == 200
    assert res_cancel.json()["status"] == "CANCELLED"
    db_session.refresh(available_equipment)
    assert available_equipment.status == EquipmentStatus.AVAILABLE


def test_idempotent_retry_and_anti_replay_across_lifecycle(
    client, admin_token_headers, borrower_token_headers, test_admin_user, test_borrower_user, available_equipment, db_session, fake_chain
):
    """
    Mục đích: Retry cùng (loan_id, action_type, tx_hash) trả kết quả idempotent; dùng lại tx_hash cho đơn hoặc bước khác bị chặn 409.
    """
    res_req, payload, loan_hex, tx_create = _create_pure_web3_loan(
        client, fake_chain, test_borrower_user, available_equipment, borrower_token_headers
    )
    assert res_req.status_code == 201
    loan_id = res_req.json()["id"]

    # Retry createLoan idempotent
    res_retry_req = client.post("/api/v1/loans/request", json=payload, headers=borrower_token_headers)
    assert res_retry_req.status_code == 201
    assert res_retry_req.json()["id"] == loan_id

    # Retry approveLoan idempotent
    tx_app = fake_chain.sign_approve_loan(test_admin_user.wallet_address, loan_hex)
    assert client.post(
        f"/api/v1/loans/{loan_id}/approve", json={"tx_hash": tx_app}, headers=admin_token_headers
    ).status_code == 200
    assert client.post(
        f"/api/v1/loans/{loan_id}/approve", json={"tx_hash": tx_app}, headers=admin_token_headers
    ).status_code == 200

    # Replay tx_create vào handover -> 409 Conflict
    res_replay_step = client.post(
        f"/api/v1/loans/{loan_id}/handover",
        json={"tx_hash": tx_create},
        headers=admin_token_headers,
    )
    assert res_replay_step.status_code == 409

    # Tài khoản khác replay tx_create -> 409 Conflict
    sv2 = User(
        student_staff_id="SV_ATTACKER",
        full_name="Kẻ Replay",
        email="attacker@eduvault.edu.vn",
        password_hash=hash_password("student123"),
        role=UserRole.BORROWER,
        wallet_address=OTHER_WALLET,
        wallet_verified=True,
        is_active=True,
    )
    db_session.add(sv2)
    db_session.commit()
    db_session.refresh(sv2)
    atk_headers = {"Authorization": f"Bearer {create_access_token(sv2.id, 'BORROWER')}"}
    assert client.post("/api/v1/loans/request", json=payload, headers=atk_headers).status_code == 409


def test_offline_rpc_and_reverted_tx_fail_closed(
    client, admin_token_headers, borrower_token_headers, test_admin_user, test_borrower_user, available_equipment, db_session, fake_chain, monkeypatch
):
    """
    Mục đích:
      - Reverted tx (status=0) hoặc sai người gửi bị chặn 400, không làm đổi trạng thái DB.
      - Khi node RPC offline -> tất cả endpoint vòng đời fail-closed 503 và giữ nguyên DB.
    """
    from backend.app.services import loan_service as ls

    res_req, _, loan_hex, _ = _create_pure_web3_loan(
        client, fake_chain, test_borrower_user, available_equipment, borrower_token_headers
    )
    loan_id = res_req.json()["id"]

    # 1. Reverted tx -> 400, DB vẫn PENDING
    bad_tx = fake_chain.mint_reverted_tx(test_admin_user.wallet_address)
    res_rev = client.post(
        f"/api/v1/loans/{loan_id}/approve",
        json={"tx_hash": bad_tx},
        headers=admin_token_headers,
    )
    assert res_rev.status_code == 400
    loan_db = db_session.query(LendingRequest).filter(LendingRequest.id == loan_id).first()
    assert loan_db.status == LoanStatus.PENDING

    # 2. RPC offline -> 503 trên approve / handover / cancel / return
    monkeypatch.setattr(
        ls.blockchain_service,
        "ensure_ready",
        lambda: (_ for _ in ()).throw(ConnectionError("RPC offline test")),
    )

    assert client.post(
        f"/api/v1/loans/{loan_id}/approve", json={"tx_hash": "0x" + "11" * 32}, headers=admin_token_headers
    ).status_code == 503

    loan_db.status = LoanStatus.APPROVED
    db_session.commit()
    assert client.post(
        f"/api/v1/loans/{loan_id}/handover", json={"tx_hash": "0x" + "22" * 32}, headers=admin_token_headers
    ).status_code == 503
    assert client.post(
        f"/api/v1/loans/{loan_id}/cancel", json={"tx_hash": "0x" + "33" * 32}, headers=borrower_token_headers
    ).status_code == 503

    loan_db.status = LoanStatus.ACTIVE
    db_session.commit()
    assert client.post(
        f"/api/v1/loans/{loan_id}/return",
        json={"tx_hash": "0x" + "44" * 32, "return_condition": "GOOD"},
        headers=admin_token_headers,
    ).status_code == 503


def test_list_loans_borrower_sees_only_own_loans(
    client, borrower_token_headers, test_borrower_user, available_equipment, fake_chain
):
    """
    Mục đích: Sinh viên gọi GET /loans chỉ nhìn thấy đơn mượn của chính mình.
    """
    res, _, _, _ = _create_pure_web3_loan(
        client, fake_chain, test_borrower_user, available_equipment, borrower_token_headers
    )
    assert res.status_code == 201
    list_res = client.get("/api/v1/loans", headers=borrower_token_headers)
    assert list_res.status_code == 200
    items = list_res.json()
    assert len(items) >= 1
    assert all(item["user_id"] == test_borrower_user.id for item in items)
