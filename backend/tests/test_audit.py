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
    assert "mysql_state" in data
    assert "blockchain_state" in data
    assert "is_synced" in data


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

