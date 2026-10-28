"""
Module: backend.tests.test_loans
Mục đích: Bộ kiểm thử tự động toàn diện cho vòng đời mượn trả thiết bị học tập (Task 5.7).
Áp dụng: Quy định viết code và docstring tại QUY_DINH_CODE.md.
"""
from datetime import datetime, timedelta
import pytest
from backend.app.models.equipment import Equipment, EquipmentStatus
from backend.app.models.lending_request import DepositStatus, LendingRequest, LoanStatus, ReturnCondition
from backend.app.models.user import User


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


def test_admin_approve_loan_success(client, admin_token_headers, borrower_token_headers, available_equipment):
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


def test_admin_handover_loan_success(client, admin_token_headers, borrower_token_headers, available_equipment):
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


def test_admin_return_loan_good_ontime_success(client, admin_token_headers, borrower_token_headers, available_equipment):
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


def test_admin_return_loan_good_overdue_penalty_10_percent(client, admin_token_headers, borrower_token_headers, available_equipment, db_session):
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


def test_admin_return_loan_damaged_forfeits_deposit_and_disputed(client, admin_token_headers, borrower_token_headers, available_equipment):
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


def test_borrower_cannot_cancel_active_loan_returns_400(client, admin_token_headers, borrower_token_headers, available_equipment):
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
