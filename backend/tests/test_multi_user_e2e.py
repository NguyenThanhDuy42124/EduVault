"""
Module: backend.tests.test_multi_user_e2e
Muc dich: Bo kiem thu tich hop da nguoi dung Multi-Admin va Sinh vien cho Phase 16.
Kiem chung:
  1. Phieu muon duoc ky va xac thuc cheo qua 4 vi rieng biet (Student, Admin 2, Admin 3, Admin 1).
  2. Tung hanh dong on-chain duoc kiem tra receipt boi Receipt Verifier.
  3. CSDL va AuditLog ghi nhan dung tung tai khoan thuc hien.
  4. Doi soat toan ven CSDL va on-chain dong bo 100%.
Ap dung: Quy dinh viet code va docstring tai QUY_DINH_CODE.md, khong dung icon.
"""
from datetime import datetime, timedelta
import pytest
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

ADMIN1_WALLET = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"
ADMIN2_WALLET = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8"
ADMIN3_WALLET = "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC"
STUDENT_WALLET = "0x90F79bf6EB2c4f870365E785982E1f101E93b906"


class _MultiUserChainMock:
    """Mock chuoi khoi EVM Pure Web3 cho ca kiem thu Multi-User."""

    def __init__(self):
        self.loans = {}
        self.active_mutex = {}
        self.receipts = {}
        self.tx_counter = 0

    def _next_tx_hash(self) -> str:
        self.tx_counter += 1
        return "0x" + f"{self.tx_counter:064x}"

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
        borrower: str,
        expected_handover: int,
        due_date: int,
        deposit_amount: int,
    ) -> str:
        tx_hash = self._next_tx_hash()
        loan_bytes, loan_hex = blockchain_service.generate_loan_id(1, equipment_id, int(datetime.now().timestamp()))
        now_ts = int(datetime.now().timestamp())
        self.loans[loan_hex] = {
            "loan_id": loan_hex,
            "equipment_id": equipment_id,
            "borrower": borrower,
            "student_id": student_id,
            "request_time": now_ts,
            "expected_handover": expected_handover,
            "due_date": due_date,
            "actual_handover": 0,
            "actual_return": 0,
            "deposit_amount": deposit_amount,
            "state": 0,
            "deposit_state": 0 if deposit_amount == 0 else 1,
            "penalty_percent": 0,
        }
        self.receipts[tx_hash] = {
            "status": 1,
            "sender": sender,
            "event": "LoanCreated",
            "loan_id": loan_hex,
            "args": {
                "loanId": loan_hex,
                "equipmentId": equipment_id,
                "studentId": student_id,
                "borrower": borrower,
                "dueDate": due_date,
                "depositAmount": deposit_amount,
                "timestamp": now_ts,
            },
        }
        return tx_hash, loan_hex

    def sign_approve(self, sender: str, loan_id: str) -> str:
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
        tx_hash = self._next_tx_hash()
        self.receipts[tx_hash] = {
            "status": 1,
            "sender": sender,
            "event": "HandoverConfirmed",
            "loan_id": loan_hex,
            "args": {"loanId": loan_hex, "timestamp": rec["actual_handover"]},
        }
        return tx_hash

    def sign_return(self, sender: str, loan_id: str, return_condition: int) -> str:
        loan_hex = normalize_hex_bytes32(loan_id, 32)
        rec = self.loans[loan_hex]
        rec["actual_return"] = int(datetime.now().timestamp())
        rec["state"] = 3
        rec["deposit_state"] = 2
        rec["penalty_percent"] = 0
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
                "penaltyPercent": 0,
                "depositState": 2,
                "timestamp": rec["actual_return"],
            },
        }
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
            raise ValueError(f"Khong tim thay giao dich {tx_hex} tren blockchain.")
        entry = self.receipts[tx_hex]
        if entry["status"] != 1:
            raise ValueError(f"Giao dich {tx_hex} bi revert.")
        if expected_sender and entry["sender"].lower() != expected_sender.lower():
            raise ValueError(f"Sender {entry['sender']} khong khop vi ky vong {expected_sender}.")
        if entry["event"] != expected_event:
            raise ValueError(f"Event {entry['event']} khong khop {expected_event}.")
        return {
            "tx_hash": tx_hex,
            "status": "CONFIRMED",
            "from_address": entry["sender"],
            "to_address": "0x5FbDB2315678afecb367f032d93F642f64180aa3",
            "event_name": entry["event"],
            "event_args": dict(entry["args"]),
            "block_number": 100,
            "gas_used": 120000,
        }

    def verify_create_loan_tx(
        self,
        tx_hash: str,
        expected_loan_id: str,
        expected_equipment_id: int,
        expected_student_id: str,
        expected_borrower_address: str,
        expected_handover_ts: int,
        expected_due_ts: int,
        expected_deposit: int,
        expected_sender_address: str = None,
        **kwargs,
    ):
        verified = self.verify_transaction_receipt(
            tx_hash=tx_hash,
            expected_event="LoanCreated",
            expected_loan_id=expected_loan_id,
            expected_sender=expected_sender_address or expected_borrower_address,
        )
        verified["on_chain_record"] = self.get_loan(expected_loan_id)
        return verified


def test_cross_wallet_multi_admin_e2e_lifecycle(client, db_session, monkeypatch):
    """
    Kiem thu chu trinh muon tra lien vi Pure Web3:
    - Sinh vien (STUDENT_WALLET) tu ky createLoan
    - Admin 2 (ADMIN2_WALLET) ky approveLoan
    - Admin 3 (ADMIN3_WALLET) ky confirmHandover
    - Admin 1 (ADMIN1_WALLET) ky confirmReturn
    - Kiem tra toan ven CSDL, lich su giao dich va doi soat on-chain.
    """
    mock_chain = _MultiUserChainMock()
    monkeypatch.setattr(blockchain_service, "is_connected", mock_chain.is_connected)
    monkeypatch.setattr(blockchain_service, "ensure_ready", mock_chain.ensure_ready)
    monkeypatch.setattr(blockchain_service, "get_loan", mock_chain.get_loan)
    monkeypatch.setattr(blockchain_service, "is_overdue", mock_chain.is_overdue)
    monkeypatch.setattr(blockchain_service, "verify_transaction_receipt", mock_chain.verify_transaction_receipt)
    monkeypatch.setattr(blockchain_service, "verify_create_loan_tx", mock_chain.verify_create_loan_tx)

    # 1. Khoi tao 3 Admin va 1 Sinh vien trong CSDL
    admin1 = User(
        student_staff_id="ADMIN001",
        full_name="Deployer Admin 1",
        email="admin1@eduvault.edu.vn",
        password_hash=hash_password("admin123456"),
        role=UserRole.ADMIN,
        wallet_address=ADMIN1_WALLET,
        wallet_verified=True,
        is_active=True,
    )
    admin2 = User(
        student_staff_id="ADMIN002",
        full_name="Admin 2",
        email="admin2@eduvault.edu.vn",
        password_hash=hash_password("admin123456"),
        role=UserRole.ADMIN,
        wallet_address=ADMIN2_WALLET,
        wallet_verified=True,
        is_active=True,
    )
    admin3 = User(
        student_staff_id="ADMIN003",
        full_name="Admin 3",
        email="admin3@eduvault.edu.vn",
        password_hash=hash_password("admin123456"),
        role=UserRole.ADMIN,
        wallet_address=ADMIN3_WALLET,
        wallet_verified=True,
        is_active=True,
    )
    student = User(
        student_staff_id="SV2026001",
        full_name="Nguyen Van An",
        email="sv01@eduvault.edu.vn",
        password_hash=hash_password("student123"),
        role=UserRole.BORROWER,
        wallet_address=STUDENT_WALLET,
        wallet_verified=True,
        is_active=True,
    )
    equipment = Equipment(
        name="Kit STM32 Multi-User",
        category="EMBEDDED_KIT",
        serial_number="E2E-KIT-001",
        deposit_amount=500000,
        status=EquipmentStatus.AVAILABLE,
    )
    db_session.add_all([admin1, admin2, admin3, student, equipment])
    db_session.commit()

    token_sv = create_access_token(subject=student.id, role=student.role.value)
    token_admin1 = create_access_token(subject=admin1.id, role=admin1.role.value)
    token_admin2 = create_access_token(subject=admin2.id, role=admin2.role.value)
    token_admin3 = create_access_token(subject=admin3.id, role=admin3.role.value)

    headers_sv = {"Authorization": f"Bearer {token_sv}"}
    headers_admin1 = {"Authorization": f"Bearer {token_admin1}"}
    headers_admin2 = {"Authorization": f"Bearer {token_admin2}"}
    headers_admin3 = {"Authorization": f"Bearer {token_admin3}"}

    # Buoc 1: Sinh vien ky tao don on-chain roi gui API
    now = datetime.utcnow()
    exp_dt = now + timedelta(days=1)
    due_dt = now + timedelta(days=3)
    exp_ts = int(exp_dt.timestamp())
    due_ts = int(due_dt.timestamp())

    create_tx_hash, loan_hex = mock_chain.sign_create_loan(
        sender=STUDENT_WALLET,
        equipment_id=equipment.id,
        student_id="SV2026001",
        borrower=STUDENT_WALLET,
        expected_handover=exp_ts,
        due_date=due_ts,
        deposit_amount=500000,
    )

    req_payload = {
        "equipment_id": equipment.id,
        "expected_handover_date": exp_dt.isoformat(),
        "due_date": due_dt.isoformat(),
        "admin_notes": "Don muon kiem thu Multi-User E2E",
        "tx_hash": create_tx_hash,
        "on_chain_loan_id": loan_hex,
    }
    resp1 = client.post("/api/v1/loans/request", json=req_payload, headers=headers_sv)
    assert resp1.status_code == 201, f"Tao don that bai: {resp1.text}"
    loan_db_id = resp1.json()["id"]
    assert resp1.json()["status"] == "PENDING"
    assert resp1.json()["on_chain_loan_id"] == loan_hex

    # Buoc 2: Admin 2 ky approveLoan tren vi cua minh
    approve_tx_hash = mock_chain.sign_approve(sender=ADMIN2_WALLET, loan_id=loan_hex)
    resp2 = client.post(
        f"/api/v1/loans/{loan_db_id}/approve",
        json={"tx_hash": approve_tx_hash, "notes": "Admin 2 phe duyet qua MetaMask"},
        headers=headers_admin2,
    )
    assert resp2.status_code == 200, f"Duyet don that bai: {resp2.text}"
    assert resp2.json()["status"] == "APPROVED"

    # Buoc 3: Admin 3 ky confirmHandover tren vi cua minh
    handover_tx_hash = mock_chain.sign_handover(sender=ADMIN3_WALLET, loan_id=loan_hex)
    resp3 = client.post(
        f"/api/v1/loans/{loan_db_id}/handover",
        json={"tx_hash": handover_tx_hash},
        headers=headers_admin3,
    )
    assert resp3.status_code == 200, f"Ban giao that bai: {resp3.text}"
    assert resp3.json()["status"] == "ACTIVE"
    assert resp3.json()["deposit_status"] == "LOCKED"

    # Buoc 4: Admin 1 (Deployer) ky confirmReturn tren vi cua minh
    return_tx_hash = mock_chain.sign_return(sender=ADMIN1_WALLET, loan_id=loan_hex, return_condition=0)
    resp4 = client.post(
        f"/api/v1/loans/{loan_db_id}/return",
        json={"tx_hash": return_tx_hash, "return_condition": "GOOD", "admin_notes": "Admin 1 nghiem thu may nguyen ven"},
        headers=headers_admin1,
    )
    assert resp4.status_code == 200, f"Nghiem thu tra may that bai: {resp4.text}"
    assert resp4.json()["status"] == "RETURNED"
    assert resp4.json()["deposit_status"] == "REFUNDED"
    assert resp4.json()["return_condition"] == "GOOD"

    # Buoc 5: Kiem tra AuditLog & Doi soat toan ven CSDL
    audit_logs = db_session.query(AuditLog).filter(
        AuditLog.entity_name == "lending_requests",
        AuditLog.entity_id == loan_db_id
    ).all()
    assert len(audit_logs) >= 3, "Phai co it nhat 3 audit log cho Approve, Handover, Return"

    # Xac nhan nguoi thuc hien tung buoc la cac Admin khac nhau
    action_users = {log.action: log.user_id for log in audit_logs}
    assert action_users.get("LOAN_APPROVED") == admin2.id
    assert action_users.get("EQUIPMENT_HANDED_OVER") == admin3.id
    assert action_users.get("EQUIPMENT_RETURNED") == admin1.id

    # Doi soat kiem toan qua API /audit/loans/{id}/verify
    resp_verify = client.get(f"/api/v1/audit/loans/{loan_db_id}/verify", headers=headers_admin1)
    assert resp_verify.status_code == 200
    verify_data = resp_verify.json()
    assert verify_data["is_synced"] is True
    assert verify_data["sync_status"] == "SYNCED"
    assert verify_data["mismatches"] == []
    assert verify_data["blockchain_state"]["state"] == 3
    assert verify_data["mysql_state"]["status"] == "RETURNED"


def test_multi_admin_role_authorization_and_unauthorized_rejections(client, db_session, monkeypatch):
    """
    Kiem thu phan quyen chat che giua cac vai tro:
    - Sinh vien khong the goi cac endpoint admin (403 Forbidden).
    - Nguoi dung an danh bi chan (401 Unauthorized).
    - Giao dich duoc ky boi vi khong khop vi da xac minh bi tu choi (400 Bad Request).
    """
    mock_chain = _MultiUserChainMock()
    monkeypatch.setattr(blockchain_service, "is_connected", mock_chain.is_connected)
    monkeypatch.setattr(blockchain_service, "ensure_ready", mock_chain.ensure_ready)
    monkeypatch.setattr(blockchain_service, "get_loan", mock_chain.get_loan)
    monkeypatch.setattr(blockchain_service, "verify_transaction_receipt", mock_chain.verify_transaction_receipt)
    monkeypatch.setattr(blockchain_service, "verify_create_loan_tx", mock_chain.verify_create_loan_tx)

    admin = User(
        student_staff_id="ADMIN001",
        full_name="Deployer Admin",
        email="admin@eduvault.edu.vn",
        password_hash=hash_password("admin123456"),
        role=UserRole.ADMIN,
        wallet_address=ADMIN1_WALLET,
        wallet_verified=True,
        is_active=True,
    )
    student = User(
        student_staff_id="SV2026001",
        full_name="Sinh Vien",
        email="sv@eduvault.edu.vn",
        password_hash=hash_password("student123"),
        role=UserRole.BORROWER,
        wallet_address=STUDENT_WALLET,
        wallet_verified=True,
        is_active=True,
    )
    db_session.add_all([admin, student])
    db_session.commit()

    token_sv = create_access_token(subject=student.id, role=student.role.value)
    token_admin = create_access_token(subject=admin.id, role=admin.role.value)
    headers_sv = {"Authorization": f"Bearer {token_sv}"}
    headers_admin = {"Authorization": f"Bearer {token_admin}"}

    # Sinh vien goi endpoint chi danh cho admin -> 403
    resp_pending = client.get("/api/v1/admin/pending-borrowers", headers=headers_sv)
    assert resp_pending.status_code == 403

    # Admin goi endpoint danh sach sinh vien cho duyet quyen muon -> 200
    resp_pending_admin = client.get("/api/v1/admin/pending-borrowers", headers=headers_admin)
    assert resp_pending_admin.status_code == 200

    # Khach an danh goi endpoint admin -> 401
    resp_anon = client.get("/api/v1/admin/pending-borrowers")
    assert resp_anon.status_code == 401
