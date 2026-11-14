"""
Module: backend.tests.test_loans
Mục đích: Bộ kiểm thử tự động toàn diện cho vòng đời mượn trả thiết bị học tập (Task 5.7 & Phase 7A).
Áp dụng: Quy định viết code và docstring tại QUY_DINH_CODE.md.
"""
from datetime import datetime, timedelta
from unittest.mock import patch
import pytest
from eth_account import Account
from backend.app.core.security import create_access_token, hash_password
from backend.app.models.blockchain_tx import BlockchainTransaction, TxActionType, TxStatus
from backend.app.models.equipment import Equipment, EquipmentStatus
from backend.app.models.lending_request import DepositStatus, LendingRequest, LoanStatus, ReturnCondition
from backend.app.models.user import User, UserRole
from backend.app.services.blockchain_service import ZERO_BYTES32_HEX, normalize_hex_bytes32


class _FakeSmartContract:
    """Mô phỏng Smart Contract stateful cục bộ phục vụ kiểm thử logic FastAPI fail-closed và recovery."""

    def __init__(self, admin_address: str):
        self.admin_address = admin_address
        self.loans = {}
        self.active_mutex = {}
        self.tx_counter = 0
        self.calls = []
        self.fail_next_action = None

    def _next_tx_hash(self) -> str:
        self.tx_counter += 1
        return "0x" + f"{self.tx_counter:064x}"

    def is_connected(self) -> bool:
        return True

    def ensure_ready(self, require_admin: bool = False) -> None:
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
        if rec["request_time"] == 0 or rec["state"] != 2:
            return False
        return int(datetime.now().timestamp()) > int(rec["due_date"])

    def calculate_penalty(self, loan_id, return_condition: int):
        rec = self.get_loan(loan_id)
        if return_condition in (1, 2):
            return {"penalty_percent": 100, "deposit_state": 3, "next_state": 5}
        if int(datetime.now().timestamp()) > int(rec["due_date"]):
            diff = int(datetime.now().timestamp()) - int(rec["due_date"])
            return {"penalty_percent": 10 if diff <= 86400 else 50, "deposit_state": 2, "next_state": 3}
        return {"penalty_percent": 0, "deposit_state": 2, "next_state": 3}

    def create_loan(
        self,
        loan_id,
        equipment_id,
        student_id,
        borrower_address,
        expected_handover,
        due_date,
        deposit_amount,
        on_broadcast=None,
        on_failed=None,
    ):
        self.calls.append("create_loan")
        tx_hash = self._next_tx_hash()
        if on_broadcast:
            on_broadcast(tx_hash, self.admin_address, "0x" + "1" * 40)
        if self.fail_next_action == "create_loan":
            self.fail_next_action = None
            if on_failed:
                on_failed(tx_hash, 10, 50000, "Mocked revert create_loan")
            raise RuntimeError("Mocked revert create_loan")

        hex_id = normalize_hex_bytes32(loan_id, 32)
        self.loans[hex_id] = {
            "loan_id": hex_id,
            "equipment_id": int(equipment_id),
            "borrower": borrower_address,
            "student_id": student_id,
            "request_time": int(datetime.now().timestamp()),
            "expected_handover": int(expected_handover),
            "due_date": int(due_date),
            "actual_handover": 0,
            "actual_return": 0,
            "deposit_amount": int(deposit_amount),
            "state": 0,
            "deposit_state": 0,
            "penalty_percent": 0,
        }
        return {
            "tx_hash": tx_hash,
            "block_number": 10,
            "gas_used": 120000,
            "status": "CONFIRMED",
            "from_address": self.admin_address,
            "to_address": "0x" + "1" * 40,
        }

    def approve_loan(self, loan_id, on_broadcast=None, on_failed=None):
        self.calls.append("approve_loan")
        tx_hash = self._next_tx_hash()
        if on_broadcast:
            on_broadcast(tx_hash, self.admin_address, "0x" + "1" * 40)
        if self.fail_next_action == "approve_loan":
            self.fail_next_action = None
            if on_failed:
                on_failed(tx_hash, 11, 50000, "Mocked revert approve_loan")
            raise RuntimeError("Mocked revert approve_loan")

        hex_id = normalize_hex_bytes32(loan_id, 32)
        self.loans[hex_id]["state"] = 1
        self.active_mutex[self.loans[hex_id]["equipment_id"]] = hex_id
        return {
            "tx_hash": tx_hash,
            "block_number": 11,
            "gas_used": 90000,
            "status": "CONFIRMED",
            "from_address": self.admin_address,
            "to_address": "0x" + "1" * 40,
        }

    def confirm_handover(self, loan_id, on_broadcast=None, on_failed=None):
        self.calls.append("confirm_handover")
        tx_hash = self._next_tx_hash()
        if on_broadcast:
            on_broadcast(tx_hash, self.admin_address, "0x" + "1" * 40)
        if self.fail_next_action == "confirm_handover":
            self.fail_next_action = None
            if on_failed:
                on_failed(tx_hash, 12, 40000, "Mocked revert confirm_handover")
            raise RuntimeError("Mocked revert confirm_handover")

        hex_id = normalize_hex_bytes32(loan_id, 32)
        self.loans[hex_id]["state"] = 2
        self.loans[hex_id]["actual_handover"] = int(datetime.now().timestamp())
        if self.loans[hex_id]["deposit_amount"] > 0:
            self.loans[hex_id]["deposit_state"] = 1
        return {
            "tx_hash": tx_hash,
            "block_number": 12,
            "gas_used": 80000,
            "status": "CONFIRMED",
            "from_address": self.admin_address,
            "to_address": "0x" + "1" * 40,
        }

    def confirm_return(self, loan_id, return_condition, penalty_percent=0, on_broadcast=None, on_failed=None):
        self.calls.append("confirm_return")
        tx_hash = self._next_tx_hash()
        if on_broadcast:
            on_broadcast(tx_hash, self.admin_address, "0x" + "1" * 40)
        if self.fail_next_action == "confirm_return":
            self.fail_next_action = None
            if on_failed:
                on_failed(tx_hash, 13, 45000, "Mocked revert confirm_return")
            raise RuntimeError("Mocked revert confirm_return")

        hex_id = normalize_hex_bytes32(loan_id, 32)
        rec = self.loans[hex_id]
        rec["actual_return"] = int(datetime.now().timestamp())
        if return_condition in (1, 2):
            rec["state"] = 5
            rec["deposit_state"] = 3
            rec["penalty_percent"] = 100
        else:
            rec["state"] = 3
            rec["deposit_state"] = 2
            if int(datetime.now().timestamp()) > int(rec["due_date"]) and penalty_percent == 0:
                diff = int(datetime.now().timestamp()) - int(rec["due_date"])
                rec["penalty_percent"] = 10 if diff <= 86400 else 50
            else:
                rec["penalty_percent"] = penalty_percent
        self.active_mutex.pop(rec["equipment_id"], None)
        return {
            "tx_hash": tx_hash,
            "block_number": 13,
            "gas_used": 95000,
            "status": "CONFIRMED",
            "from_address": self.admin_address,
            "to_address": "0x" + "1" * 40,
        }

    def cancel_loan(self, loan_id, reason="Cancelled", on_broadcast=None, on_failed=None):
        self.calls.append("cancel_loan")
        tx_hash = self._next_tx_hash()
        if on_broadcast:
            on_broadcast(tx_hash, self.admin_address, "0x" + "1" * 40)
        hex_id = normalize_hex_bytes32(loan_id, 32)
        rec = self.loans[hex_id]
        rec["state"] = 4
        self.active_mutex.pop(rec["equipment_id"], None)
        return {
            "tx_hash": tx_hash,
            "block_number": 14,
            "gas_used": 60000,
            "status": "CONFIRMED",
            "from_address": self.admin_address,
            "to_address": "0x" + "1" * 40,
        }


@pytest.fixture
def fake_chain(monkeypatch):
    """Gắn Smart Contract giả lập vào blockchain_service cho các bài kiểm thử luồng chuẩn."""
    from backend.app.services import loan_service as ls

    fake = _FakeSmartContract(admin_address="0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266")
    monkeypatch.setattr(ls.blockchain_service, "is_connected", fake.is_connected)
    monkeypatch.setattr(ls.blockchain_service, "ensure_ready", fake.ensure_ready)
    monkeypatch.setattr(ls.blockchain_service, "get_loan", fake.get_loan)
    monkeypatch.setattr(ls.blockchain_service, "is_overdue", fake.is_overdue)
    monkeypatch.setattr(ls.blockchain_service, "calculate_penalty", fake.calculate_penalty)
    monkeypatch.setattr(ls.blockchain_service, "create_loan", fake.create_loan)
    monkeypatch.setattr(ls.blockchain_service, "approve_loan", fake.approve_loan)
    monkeypatch.setattr(ls.blockchain_service, "confirm_handover", fake.confirm_handover)
    monkeypatch.setattr(ls.blockchain_service, "confirm_return", fake.confirm_return)
    monkeypatch.setattr(ls.blockchain_service, "cancel_loan", fake.cancel_loan)
    return fake


def test_borrower_request_loan_success(client, borrower_token_headers, available_equipment):
    """
    Mục đích: Kiểm thử sinh viên gửi yêu cầu mượn thành công (201 Created).
    """
    now = datetime.now()
    payload = {
        "equipment_id": available_equipment.id,
        "expected_handover_date": (now + timedelta(days=1)).isoformat(),
        "due_date": (now + timedelta(days=7)).isoformat(),
        "admin_notes": "Mượn làm bài tập lớn môn Blockchain"
    }
    response = client.post("/api/v1/loans/request", json=payload, headers=borrower_token_headers)
    assert response.status_code == 201
    data = response.json()
    assert data["status"] == "PENDING"
    assert data["equipment_id"] == available_equipment.id
    assert float(data["deposit_amount"]) == 1000000.00
    assert data["deposit_status"] == "PENDING"


def test_request_loan_invalid_dates_returns_400(client, borrower_token_headers, available_equipment):
    """
    Mục đích: Kiểm thử chặn tạo đơn khi ngày trả trước hoặc bằng ngày nhận (400 Bad Request).
    """
    now = datetime.now()
    payload = {
        "equipment_id": available_equipment.id,
        "expected_handover_date": (now + timedelta(days=5)).isoformat(),
        "due_date": (now + timedelta(days=2)).isoformat()
    }
    response = client.post("/api/v1/loans/request", json=payload, headers=borrower_token_headers)
    assert response.status_code == 400
    assert "hạn chót trả máy phải sau" in response.json()["detail"]


def test_request_loan_unavailable_equipment_returns_409(client, borrower_token_headers, available_equipment, db_session):
    """
    Mục đích: Kiểm thử chặn mượn khi thiết bị đang ở trạng thái không khả dụng (409 Conflict).
    """
    available_equipment.status = EquipmentStatus.IN_USE
    db_session.commit()

    now = datetime.now()
    payload = {
        "equipment_id": available_equipment.id,
        "expected_handover_date": (now + timedelta(days=1)).isoformat(),
        "due_date": (now + timedelta(days=3)).isoformat()
    }
    response = client.post("/api/v1/loans/request", json=payload, headers=borrower_token_headers)
    assert response.status_code == 409
    assert "không sẵn sàng" in response.json()["detail"]


def test_request_loan_duplicate_pending_returns_409(client, borrower_token_headers, available_equipment):
    """
    Mục đích: Kiểm thử chặn sinh viên gửi nhiều yêu cầu mượn trùng lặp cho cùng một thiết bị (409 Conflict).
    """
    now = datetime.now()
    payload = {
        "equipment_id": available_equipment.id,
        "expected_handover_date": (now + timedelta(days=1)).isoformat(),
        "due_date": (now + timedelta(days=3)).isoformat()
    }
    res1 = client.post("/api/v1/loans/request", json=payload, headers=borrower_token_headers)
    assert res1.status_code == 201

    res2 = client.post("/api/v1/loans/request", json=payload, headers=borrower_token_headers)
    assert res2.status_code == 409
    assert "đã có một yêu cầu mượn" in res2.json()["detail"]


def test_admin_approve_loan_success(client, admin_token_headers, borrower_token_headers, available_equipment, fake_chain):
    """
    Mục đích: Kiểm thử Admin duyệt đơn mượn: đổi đơn sang APPROVED, khóa thiết bị sang RESERVED và sinh on_chain_loan_id.
    """
    now = datetime.now()
    req_res = client.post("/api/v1/loans/request", json={
        "equipment_id": available_equipment.id,
        "expected_handover_date": (now + timedelta(days=1)).isoformat(),
        "due_date": (now + timedelta(days=5)).isoformat()
    }, headers=borrower_token_headers)
    loan_id = req_res.json()["id"]

    approve_res = client.post(f"/api/v1/loans/{loan_id}/approve", json={"notes": "Đã kiểm tra thẻ SV hợp lệ"}, headers=admin_token_headers)
    assert approve_res.status_code == 200
    data = approve_res.json()
    assert data["status"] == "APPROVED"
    assert data["on_chain_loan_id"] is not None
    assert data["on_chain_loan_id"].startswith("0x")


def test_admin_reject_loan_success(client, admin_token_headers, borrower_token_headers, available_equipment):
    """
    Mục đích: Kiểm thử Admin từ chối đơn mượn (200 OK, chuyển trạng thái REJECTED).
    """
    now = datetime.now()
    req_res = client.post("/api/v1/loans/request", json={
        "equipment_id": available_equipment.id,
        "expected_handover_date": (now + timedelta(days=1)).isoformat(),
        "due_date": (now + timedelta(days=5)).isoformat()
    }, headers=borrower_token_headers)
    loan_id = req_res.json()["id"]

    reject_res = client.post(f"/api/v1/loans/{loan_id}/reject", json={"reason": "Sinh viên chưa hoàn tất cọc học kỳ trước"}, headers=admin_token_headers)
    assert reject_res.status_code == 200
    assert reject_res.json()["status"] == "REJECTED"


def test_admin_handover_loan_success(client, admin_token_headers, borrower_token_headers, available_equipment, fake_chain):
    """
    Mục đích: Kiểm thử Admin bàn giao máy thực tế (APPROVED -> ACTIVE, thiết bị IN_USE, cọc LOCKED).
    """
    now = datetime.now()
    req_res = client.post("/api/v1/loans/request", json={
        "equipment_id": available_equipment.id,
        "expected_handover_date": (now + timedelta(days=1)).isoformat(),
        "due_date": (now + timedelta(days=5)).isoformat()
    }, headers=borrower_token_headers)
    loan_id = req_res.json()["id"]

    client.post(f"/api/v1/loans/{loan_id}/approve", json={}, headers=admin_token_headers)

    handover_res = client.post(f"/api/v1/loans/{loan_id}/handover", headers=admin_token_headers)
    assert handover_res.status_code == 200
    data = handover_res.json()
    assert data["status"] == "ACTIVE"
    assert data["actual_handover_date"] is not None
    assert data["deposit_status"] == "LOCKED"


def test_admin_return_loan_good_ontime_success(client, admin_token_headers, borrower_token_headers, available_equipment, fake_chain):
    """
    Mục đích: Kiểm thử trả máy đúng hạn & nguyên vẹn: phạt 0%, hoàn cọc 100% (deposit_status = REFUNDED, status = RETURNED).
    """
    now = datetime.now()
    req_res = client.post("/api/v1/loans/request", json={
        "equipment_id": available_equipment.id,
        "expected_handover_date": (now + timedelta(days=1)).isoformat(),
        "due_date": (now + timedelta(days=5)).isoformat()  # Còn hạn
    }, headers=borrower_token_headers)
    loan_id = req_res.json()["id"]

    client.post(f"/api/v1/loans/{loan_id}/approve", json={}, headers=admin_token_headers)
    client.post(f"/api/v1/loans/{loan_id}/handover", headers=admin_token_headers)

    return_res = client.post(f"/api/v1/loans/{loan_id}/return", json={
        "return_condition": "GOOD",
        "admin_notes": "Máy hoạt động tốt, phụ kiện đầy đủ"
    }, headers=admin_token_headers)

    assert return_res.status_code == 200
    data = return_res.json()
    assert data["status"] == "RETURNED"
    assert data["deposit_status"] == "REFUNDED"
    assert data["return_condition"] == "GOOD"


def test_admin_return_loan_good_overdue_penalty_10_percent(client, admin_token_headers, borrower_token_headers, available_equipment, db_session, fake_chain):
    """
    Mục đích: Kiểm thử trả máy quá hạn <= 24h: tự động tính phạt 10%, hoàn trả 90% cọc.
    """
    now = datetime.now()
    req_res = client.post("/api/v1/loans/request", json={
        "equipment_id": available_equipment.id,
        "expected_handover_date": (now - timedelta(days=3)).isoformat(),
        "due_date": (now - timedelta(hours=5)).isoformat()  # Đã quá hạn 5 tiếng (<= 24h)
    }, headers=borrower_token_headers)
    loan_id = req_res.json()["id"]

    # Chỉnh due_date về quá khứ trong CSDL
    loan = db_session.query(LendingRequest).filter(LendingRequest.id == loan_id).first()
    loan.due_date = now - timedelta(hours=5)
    db_session.commit()

    client.post(f"/api/v1/loans/{loan_id}/approve", json={}, headers=admin_token_headers)
    client.post(f"/api/v1/loans/{loan_id}/handover", headers=admin_token_headers)

    return_res = client.post(f"/api/v1/loans/{loan_id}/return", json={
        "return_condition": "GOOD"
    }, headers=admin_token_headers)

    assert return_res.status_code == 200
    data = return_res.json()
    assert data["status"] == "RETURNED"
    assert data["deposit_status"] == "REFUNDED"


def test_admin_return_loan_damaged_forfeits_deposit_and_disputed(client, admin_token_headers, borrower_token_headers, available_equipment, fake_chain):
    """
    Mục đích: Kiểm thử trả máy hỏng: tịch thu 100% cọc (FORFEITED), chuyển DISPUTED, thiết bị chuyển MAINTENANCE.
    """
    now = datetime.now()
    req_res = client.post("/api/v1/loans/request", json={
        "equipment_id": available_equipment.id,
        "expected_handover_date": (now + timedelta(days=1)).isoformat(),
        "due_date": (now + timedelta(days=5)).isoformat()
    }, headers=borrower_token_headers)
    loan_id = req_res.json()["id"]

    client.post(f"/api/v1/loans/{loan_id}/approve", json={}, headers=admin_token_headers)
    client.post(f"/api/v1/loans/{loan_id}/handover", headers=admin_token_headers)

    return_res = client.post(f"/api/v1/loans/{loan_id}/return", json={
        "return_condition": "DAMAGED",
        "admin_notes": "Vỡ màn hình LCD góc phải"
    }, headers=admin_token_headers)

    assert return_res.status_code == 200
    data = return_res.json()
    assert data["status"] == "DISPUTED"
    assert data["deposit_status"] == "FORFEITED"
    assert data["return_condition"] == "DAMAGED"


def test_borrower_cancel_pending_loan_success(client, borrower_token_headers, available_equipment):
    """
    Mục đích: Kiểm thử sinh viên hủy đơn mượn khi đang PENDING thành công (200 OK, CANCELLED).
    """
    now = datetime.now()
    req_res = client.post("/api/v1/loans/request", json={
        "equipment_id": available_equipment.id,
        "expected_handover_date": (now + timedelta(days=1)).isoformat(),
        "due_date": (now + timedelta(days=5)).isoformat()
    }, headers=borrower_token_headers)
    loan_id = req_res.json()["id"]

    cancel_res = client.post(f"/api/v1/loans/{loan_id}/cancel", json={"reason": "Đổi ý mượn thiết bị khác"}, headers=borrower_token_headers)
    assert cancel_res.status_code == 200
    assert cancel_res.json()["status"] == "CANCELLED"


def test_borrower_cannot_cancel_active_loan_returns_400(client, admin_token_headers, borrower_token_headers, available_equipment, fake_chain):
    """
    Mục đích: Kiểm thử không thể hủy đơn khi thiết bị đã được bàn giao ACTIVE (400 Bad Request).
    """
    now = datetime.now()
    req_res = client.post("/api/v1/loans/request", json={
        "equipment_id": available_equipment.id,
        "expected_handover_date": (now + timedelta(days=1)).isoformat(),
        "due_date": (now + timedelta(days=5)).isoformat()
    }, headers=borrower_token_headers)
    loan_id = req_res.json()["id"]

    client.post(f"/api/v1/loans/{loan_id}/approve", json={}, headers=admin_token_headers)
    client.post(f"/api/v1/loans/{loan_id}/handover", headers=admin_token_headers)

    cancel_res = client.post(f"/api/v1/loans/{loan_id}/cancel", json={"reason": "Muốn hủy ngang"}, headers=borrower_token_headers)
    assert cancel_res.status_code == 400
    assert "Không thể hủy đơn khi thiết bị đã được bàn giao" in cancel_res.json()["detail"]


def test_list_loans_borrower_sees_only_own_loans(client, borrower_token_headers, admin_token_headers, available_equipment):
    """
    Mục đích: Kiểm thử sinh viên gọi GET /loans chỉ nhìn thấy các đơn mượn của chính mình.
    """
    now = datetime.now()
    client.post("/api/v1/loans/request", json={
        "equipment_id": available_equipment.id,
        "expected_handover_date": (now + timedelta(days=1)).isoformat(),
        "due_date": (now + timedelta(days=3)).isoformat()
    }, headers=borrower_token_headers)

    response = client.get("/api/v1/loans", headers=borrower_token_headers)
    assert response.status_code == 200
    loans = response.json()
    assert len(loans) >= 1


def test_offline_rpc_fails_closed_on_approve_handover_return_cancel(
    client, admin_token_headers, borrower_token_headers, available_equipment, db_session, monkeypatch
):
    """
    Mục đích: Khi RPC Blockchain offline, các bước chuyển trạng thái on-chain bắt buộc trả 503 và không được chốt sai trong DB.
    """
    from backend.app.services import loan_service as ls

    monkeypatch.setattr(
        ls.blockchain_service,
        "ensure_ready",
        lambda require_admin=False: (_ for _ in ()).throw(ConnectionError("RPC offline test"))
    )

    now = datetime.now()
    req_res = client.post("/api/v1/loans/request", json={
        "equipment_id": available_equipment.id,
        "expected_handover_date": (now + timedelta(days=1)).isoformat(),
        "due_date": (now + timedelta(days=5)).isoformat()
    }, headers=borrower_token_headers)
    loan_id = req_res.json()["id"]

    # 1. Approve khi RPC offline -> 503, DB vẫn PENDING & AVAILABLE
    res_app = client.post(f"/api/v1/loans/{loan_id}/approve", json={}, headers=admin_token_headers)
    assert res_app.status_code == 503
    loan_db = db_session.query(LendingRequest).filter(LendingRequest.id == loan_id).first()
    eq_db = db_session.query(Equipment).filter(Equipment.id == available_equipment.id).first()
    assert loan_db.status == LoanStatus.PENDING
    assert eq_db.status == EquipmentStatus.AVAILABLE

    # 2. Thiết lập đơn APPROVED giả lập đã lên chain -> handover/cancel cũng phải fail 503
    loan_db.status = LoanStatus.APPROVED
    loan_db.on_chain_loan_id = "0x" + "ab" * 32
    eq_db.status = EquipmentStatus.RESERVED
    db_session.commit()

    res_ho = client.post(f"/api/v1/loans/{loan_id}/handover", headers=admin_token_headers)
    assert res_ho.status_code == 503
    db_session.refresh(loan_db)
    assert loan_db.status == LoanStatus.APPROVED

    res_cancel = client.post(f"/api/v1/loans/{loan_id}/cancel", json={"reason": "Test offline"}, headers=borrower_token_headers)
    assert res_cancel.status_code == 503
    db_session.refresh(loan_db)
    assert loan_db.status == LoanStatus.APPROVED

    # 3. Đơn ACTIVE khi RPC offline -> return phải fail 503 và giữ nguyên ACTIVE
    loan_db.status = LoanStatus.ACTIVE
    eq_db.status = EquipmentStatus.IN_USE
    db_session.commit()
    res_ret = client.post(f"/api/v1/loans/{loan_id}/return", json={"return_condition": "GOOD"}, headers=admin_token_headers)
    assert res_ret.status_code == 503
    db_session.refresh(loan_db)
    assert loan_db.status == LoanStatus.ACTIVE


def test_reverted_tx_does_not_advance_loan_state_and_marks_tx_failed(
    client, admin_token_headers, borrower_token_headers, available_equipment, db_session, fake_chain
):
    """
    Mục đích: Khi giao dịch Smart Contract bị revert (status == 0), trả 502, lưu BlockchainTransaction=FAILED và giữ DB an toàn.
    """
    now = datetime.now()
    req_res = client.post("/api/v1/loans/request", json={
        "equipment_id": available_equipment.id,
        "expected_handover_date": (now + timedelta(days=1)).isoformat(),
        "due_date": (now + timedelta(days=4)).isoformat()
    }, headers=borrower_token_headers)
    loan_id = req_res.json()["id"]

    fake_chain.fail_next_action = "approve_loan"
    res = client.post(f"/api/v1/loans/{loan_id}/approve", json={}, headers=admin_token_headers)
    assert res.status_code == 502

    loan_db = db_session.query(LendingRequest).filter(LendingRequest.id == loan_id).first()
    eq_db = db_session.query(Equipment).filter(Equipment.id == available_equipment.id).first()
    assert loan_db.status == LoanStatus.PENDING
    assert loan_db.on_chain_loan_id is not None  # Durable checkpoint đã lưu
    assert eq_db.status == EquipmentStatus.AVAILABLE

    failed_tx = db_session.query(BlockchainTransaction).filter(
        BlockchainTransaction.request_id == loan_id,
        BlockchainTransaction.action_type == TxActionType.APPROVE_LOAN,
    ).first()
    assert failed_tx is not None
    assert failed_tx.status == TxStatus.FAILED


def test_approve_resumes_when_chain_already_approved_without_duplicate_create(
    client, admin_token_headers, borrower_token_headers, available_equipment, db_session, fake_chain
):
    """
    Mục đích: Phục hồi sau crash (chain đã approveLoan trước khi DB commit): retry chỉ đồng bộ DB, không tạo lại createLoan.
    """
    now = datetime.now()
    req_res = client.post("/api/v1/loans/request", json={
        "equipment_id": available_equipment.id,
        "expected_handover_date": (now + timedelta(days=1)).isoformat(),
        "due_date": (now + timedelta(days=4)).isoformat()
    }, headers=borrower_token_headers)
    loan_id = req_res.json()["id"]

    # Giả lập đã checkpoint và đã xong cả createLoan + approveLoan trên chain nhưng DB chưa cập nhật APPROVED
    pre_id = "0x" + "cd" * 32
    loan_db = db_session.query(LendingRequest).filter(LendingRequest.id == loan_id).first()
    loan_db.on_chain_loan_id = pre_id
    db_session.commit()

    fake_chain.loans[pre_id] = {
        "loan_id": pre_id,
        "equipment_id": available_equipment.id,
        "borrower": "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
        "student_id": "SV2026001",
        "request_time": int(now.timestamp()),
        "expected_handover": int((now + timedelta(days=1)).timestamp()),
        "due_date": int((now + timedelta(days=4)).timestamp()),
        "actual_handover": 0,
        "actual_return": 0,
        "deposit_amount": int(available_equipment.deposit_amount),
        "state": 1,  # Approved on-chain
        "deposit_state": 0,
        "penalty_percent": 0,
    }

    res = client.post(f"/api/v1/loans/{loan_id}/approve", json={}, headers=admin_token_headers)
    assert res.status_code == 200
    assert res.json()["status"] == "APPROVED"
    assert "create_loan" not in fake_chain.calls
    assert "approve_loan" not in fake_chain.calls


def test_metamask_receipt_verification_approve_only_and_idempotent_retry(
    client, admin_token_headers, available_equipment, db_session, fake_chain, monkeypatch
):
    """
    Mục đích:
      - Tài khoản chưa xác minh ví bị từ chối gửi client_tx_hash (403).
      - Tài khoản đã xác minh ví + biên lai hợp lệ được chấp nhận, retry idempotent không tạo trùng đơn.
      - Admin duyệt đơn đã tạo bằng MetaMask CHỈ gọi approveLoan (không gọi createLoan lần 2).
      - Từ chối tx replay từ người khác (409).
    """
    from backend.app.services import loan_service as ls

    acct = Account.from_key("0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d")
    sv_unverified = User(
        student_staff_id="SV_UNV",
        full_name="Sinh Viên Chưa Xác Minh",
        email="unverified@eduvault.edu.vn",
        password_hash=hash_password("student123"),
        role=UserRole.BORROWER,
        wallet_address=acct.address,
        wallet_verified=False,
        is_active=True,
    )
    db_session.add(sv_unverified)
    db_session.commit()
    db_session.refresh(sv_unverified)
    unv_headers = {"Authorization": f"Bearer {create_access_token(sv_unverified.id, 'BORROWER')}"}

    now = datetime.now().replace(microsecond=0)
    chain_loan_id = "0x" + "ef" * 32
    client_tx_hash = "0x" + "12" * 32
    handover_dt = now + timedelta(days=1)
    due_dt = now + timedelta(days=3)

    payload = {
        "equipment_id": available_equipment.id,
        "expected_handover_date": handover_dt.isoformat(),
        "due_date": due_dt.isoformat(),
        "on_chain_loan_id": chain_loan_id,
        "client_tx_hash": client_tx_hash,
    }

    # 1. Chưa verify ví -> 403
    res_unv = client.post("/api/v1/loans/request", json=payload, headers=unv_headers)
    assert res_unv.status_code == 403

    # 2. Đánh dấu ví đã xác minh EIP-191 và mock biên lai hợp lệ
    sv_unverified.wallet_verified = True
    db_session.commit()

    def _mock_verify(
        tx_hash,
        expected_loan_id,
        expected_equipment_id,
        expected_student_id,
        expected_borrower_address,
        expected_handover_ts,
        expected_due_ts,
        expected_deposit,
        expected_sender_address=None,
    ):
        fake_chain.loans[expected_loan_id] = {
            "loan_id": expected_loan_id,
            "equipment_id": expected_equipment_id,
            "borrower": expected_borrower_address,
            "student_id": expected_student_id,
            "request_time": int(now.timestamp()),
            "expected_handover": expected_handover_ts,
            "due_date": expected_due_ts,
            "actual_handover": 0,
            "actual_return": 0,
            "deposit_amount": expected_deposit,
            "state": 0,
            "deposit_state": 0,
            "penalty_percent": 0,
        }
        return {
            "tx_hash": tx_hash,
            "block_number": 5,
            "gas_used": 110000,
            "status": "CONFIRMED",
            "from_address": expected_borrower_address,
            "to_address": "0x" + "1" * 40,
            "on_chain_record": fake_chain.loans[expected_loan_id],
        }

    monkeypatch.setattr(ls.blockchain_service, "verify_create_loan_tx", _mock_verify)

    res_ok = client.post("/api/v1/loans/request", json=payload, headers=unv_headers)
    assert res_ok.status_code == 201
    created_loan_id = res_ok.json()["id"]

    # 3. Retry cùng payload -> trả lại đúng đơn cũ (idempotent, không trùng DB)
    res_retry = client.post("/api/v1/loans/request", json=payload, headers=unv_headers)
    assert res_retry.status_code == 201
    assert res_retry.json()["id"] == created_loan_id

    # 4. Admin duyệt -> CHỈ gọi approve_loan, KHÔNG gọi create_loan
    res_app = client.post(f"/api/v1/loans/{created_loan_id}/approve", json={}, headers=admin_token_headers)
    assert res_app.status_code == 200
    assert fake_chain.calls == ["approve_loan"]

    # 5. Tài khoản khác cố tình replay client_tx_hash / on_chain_loan_id -> 409
    sv2 = User(
        student_staff_id="SV_OTHER",
        full_name="Kẻ Giả Mạo",
        email="attacker@eduvault.edu.vn",
        password_hash=hash_password("student123"),
        role=UserRole.BORROWER,
        wallet_verified=True,
        wallet_address="0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
        is_active=True,
    )
    db_session.add(sv2)
    db_session.commit()
    db_session.refresh(sv2)
    atk_headers = {"Authorization": f"Bearer {create_access_token(sv2.id, 'BORROWER')}"}
    res_replay = client.post("/api/v1/loans/request", json=payload, headers=atk_headers)
    assert res_replay.status_code == 409


def test_overdue_return_rejects_zero_manual_penalty_waiver_and_allows_custom_or_auto(
    client, admin_token_headers, borrower_token_headers, available_equipment, fake_chain
):
    """
    Mục đích: Đơn quá hạn ở Phase 7A phải chặn nhập manual_penalty_percent=0 (tránh im lặng tự tính 10%/50%),
             nhưng cho phép null (auto-calc) hoặc 1-100%.
    """
    now = datetime.now()
    req_res = client.post("/api/v1/loans/request", json={
        "equipment_id": available_equipment.id,
        "expected_handover_date": (now - timedelta(days=3)).isoformat(),
        "due_date": (now - timedelta(hours=3)).isoformat()
    }, headers=borrower_token_headers)
    loan_id = req_res.json()["id"]

    client.post(f"/api/v1/loans/{loan_id}/approve", json={}, headers=admin_token_headers)
    client.post(f"/api/v1/loans/{loan_id}/handover", headers=admin_token_headers)

    res_zero = client.post(
        f"/api/v1/loans/{loan_id}/return",
        json={"return_condition": "GOOD", "manual_penalty_percent": 0},
        headers=admin_token_headers,
    )
    assert res_zero.status_code == 400
    assert "miễn phạt 0%" in res_zero.json()["detail"]

    res_custom = client.post(
        f"/api/v1/loans/{loan_id}/return",
        json={"return_condition": "GOOD", "manual_penalty_percent": 25},
        headers=admin_token_headers,
    )
    assert res_custom.status_code == 200
    assert res_custom.json()["status"] == "RETURNED"
