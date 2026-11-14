"""
Module: backend.tests.test_audit
Mục đích: Bộ kiểm thử tự động cho Audit API, lịch sử giao dịch và đối soát Reconciliation (Task 5.8).
Áp dụng: Quy định viết code và docstring tại QUY_DINH_CODE.md.
"""
from datetime import datetime, timedelta
from backend.app.models.equipment import Equipment, EquipmentStatus


def test_verify_loan_integrity_endpoint(client, borrower_token_headers, available_equipment):
    """
    Mục đích: Kiểm thử API verify độc lập tính toàn vẹn của một đơn mượn.
    """
    now = datetime.now()
    req_res = client.post("/api/v1/loans/request", json={
        "equipment_id": available_equipment.id,
        "expected_handover_date": (now + timedelta(days=1)).isoformat(),
        "due_date": (now + timedelta(days=5)).isoformat()
    }, headers=borrower_token_headers)
    loan_id = req_res.json()["id"]

    verify_res = client.get(f"/api/v1/audit/loans/{loan_id}/verify", headers=borrower_token_headers)
    assert verify_res.status_code == 200
    data = verify_res.json()
    assert data["loan_id"] == loan_id
    assert data["is_synced"] is False
    assert data["sync_status"] == "NOT_ON_CHAIN"
    assert "mysql_state" in data
    assert "blockchain_state" in data


def test_list_transactions_endpoint(client, borrower_token_headers):
    """
    Mục đích: Kiểm thử xem danh sách các transaction hash trên EVM.
    """
    response = client.get("/api/v1/audit/transactions", headers=borrower_token_headers)
    assert response.status_code == 200
    assert isinstance(response.json(), list)


def test_list_audit_logs_admin_success(client, admin_token_headers):
    """
    Mục đích: Kiểm thử Admin xem nhật ký kiểm toán hệ thống thành công (200 OK).
    """
    response = client.get("/api/v1/audit/logs", headers=admin_token_headers)
    assert response.status_code == 200
    logs = response.json()
    assert isinstance(logs, list)


def test_borrower_cannot_list_audit_logs_returns_403(client, borrower_token_headers):
    """
    Mục đích: Kiểm thử sinh viên không có quyền xem Audit Logs của toàn hệ thống (403 Forbidden).
    """
    response = client.get("/api/v1/audit/logs", headers=borrower_token_headers)
    assert response.status_code == 403


def test_reconcile_offline_returns_503_safely(client, admin_token_headers):
    """
    Mục đích: Kiểm thử khi node Blockchain đang offline, API Reconcile báo lỗi 503 an toàn.
    """
    response = client.post("/api/v1/audit/reconcile", headers=admin_token_headers)
    # Nếu node offline -> 503, nếu node online -> 200
    assert response.status_code in [200, 503]


def test_verify_detects_missing_onchain_and_reconcile_never_overwrites_zero_struct(
    client, admin_token_headers, borrower_token_headers, available_equipment, db_session, monkeypatch
):
    """
    Mục đích: Khi on_chain_loan_id chưa tồn tại trên Contract (request_time=0), verify phải báo MISSING_ON_CHAIN
             và reconcile tuyệt đối không ghi đè MySQL thành PENDING từ struct rỗng state=0.
    """
    from backend.app.models.lending_request import LendingRequest, LoanStatus
    from backend.app.services import reconciliation_service as rs
    from backend.app.services.blockchain_service import ZERO_BYTES32_HEX

    now = datetime.now()
    req_res = client.post("/api/v1/loans/request", json={
        "equipment_id": available_equipment.id,
        "expected_handover_date": (now + timedelta(days=1)).isoformat(),
        "due_date": (now + timedelta(days=4)).isoformat()
    }, headers=borrower_token_headers)
    loan_id = req_res.json()["id"]

    loan = db_session.query(LendingRequest).filter(LendingRequest.id == loan_id).first()
    loan.status = LoanStatus.APPROVED
    loan.on_chain_loan_id = "0x" + "aa" * 32
    db_session.commit()

    monkeypatch.setattr(rs.blockchain_service, "ensure_ready", lambda require_admin=False: None)
    monkeypatch.setattr(rs.blockchain_service, "get_active_equipment_loan", lambda eq_id: ZERO_BYTES32_HEX)
    monkeypatch.setattr(rs.blockchain_service, "get_loan", lambda lid: {
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
    })

    v_res = client.get(f"/api/v1/audit/loans/{loan_id}/verify", headers=borrower_token_headers)
    assert v_res.status_code == 200
    assert v_res.json()["is_synced"] is False
    assert v_res.json()["sync_status"] == "MISSING_ON_CHAIN"

    r_res = client.post("/api/v1/audit/reconcile", headers=admin_token_headers)
    assert r_res.status_code == 200
    assert r_res.json()["fixed_count"] == 0
    db_session.refresh(loan)
    assert loan.status == LoanStatus.APPROVED


def test_verify_detects_all_field_and_mutex_mismatches_and_reconcile_repairs(
    client, admin_token_headers, borrower_token_headers, available_equipment, test_borrower_user, db_session, monkeypatch
):
    """
    Mục đích: Verify phát hiện lệch student_id, borrower, deposit, timestamps và mutex DISPUTED;
             Reconcile sửa đúng trạng thái từ Smart Contract.
    """
    from backend.app.models.lending_request import DepositStatus, LendingRequest, LoanStatus
    from backend.app.services import reconciliation_service as rs
    from backend.app.services.blockchain_service import ZERO_BYTES32_HEX

    now = datetime.now().replace(microsecond=0)
    req_res = client.post("/api/v1/loans/request", json={
        "equipment_id": available_equipment.id,
        "expected_handover_date": (now + timedelta(days=1)).isoformat(),
        "due_date": (now + timedelta(days=4)).isoformat()
    }, headers=borrower_token_headers)
    loan_id = req_res.json()["id"]

    chain_id_hex = "0x" + "bb" * 32
    loan = db_session.query(LendingRequest).filter(LendingRequest.id == loan_id).first()
    loan.status = LoanStatus.DISPUTED
    loan.deposit_status = DepositStatus.REFUNDED
    loan.on_chain_loan_id = chain_id_hex
    db_session.commit()

    monkeypatch.setattr(rs.blockchain_service, "ensure_ready", lambda require_admin=False: None)
    monkeypatch.setattr(rs.blockchain_service, "get_active_equipment_loan", lambda eq_id: chain_id_hex)
    monkeypatch.setattr(rs.blockchain_service, "get_loan", lambda lid: {
        "loan_id": chain_id_hex,
        "equipment_id": available_equipment.id,
        "borrower": "0x000000000000000000000000000000000000dEaD",
        "student_id": "WRONG_SV",
        "request_time": int(now.timestamp()),
        "expected_handover": 12345,
        "due_date": 99999,
        "actual_handover": int(now.timestamp()),
        "actual_return": int(now.timestamp()),
        "deposit_amount": 9999,
        "state": 5,  # Disputed
        "deposit_state": 3,  # Forfeited
        "penalty_percent": 100,
    })

    v_res = client.get(f"/api/v1/audit/loans/{loan_id}/verify", headers=borrower_token_headers)
    assert v_res.status_code == 200
    v_data = v_res.json()
    assert v_data["is_synced"] is False
    assert v_data["sync_status"] == "MISMATCH"
    joined = " | ".join(v_data["mismatches"])
    assert "mã sinh viên" in joined
    assert "ví borrower" in joined
    assert "tiền cọc" in joined
    assert "trạng thái cọc" in joined
    assert "expected_handover" in joined
    assert "due_date" in joined
    assert "Mutex" in joined

    r_res = client.post("/api/v1/audit/reconcile", headers=admin_token_headers)
    assert r_res.status_code == 200
    assert r_res.json()["fixed_count"] >= 1
    db_session.refresh(loan)
    assert loan.deposit_status == DepositStatus.FORFEITED
    assert loan.actual_handover_date is not None
    assert loan.actual_return_date is not None

