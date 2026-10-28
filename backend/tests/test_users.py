"""
Module: backend.tests.test_users
Mục đích: Bộ kiểm thử tự động cho User Service, RBAC và các API quản trị người dùng.
Áp dụng: Quy định viết code và docstring tại QUY_DINH_CODE.md.
"""
def test_admin_create_user_success(client, admin_token_headers):
    """
    Mục đích: Kiểm thử Admin tạo người dùng mới thành công (201 Created).
    """
    new_user_payload = {
        "student_staff_id": "SV2026099",
        "full_name": "Trần Thị Mai",
        "email": "mai.tran@eduvault.edu.vn",
        "role": "BORROWER",
        "password": "securepassword123",
        "wallet_address": "0x70997970C51812dc3A010C7d01b50e0d17dc79C8"
    }
    response = client.post("/api/v1/admin/users", json=new_user_payload, headers=admin_token_headers)
    assert response.status_code == 201
    data = response.json()
    assert data["student_staff_id"] == "SV2026099"
    assert data["email"] == "mai.tran@eduvault.edu.vn"
    assert data["role"] == "BORROWER"
    assert "password_hash" not in data


def test_admin_create_user_duplicate_email(client, admin_token_headers, test_borrower_user):
    """
    Mục đích: Kiểm thử chặn tạo tài khoản khi email đã tồn tại (409 Conflict).
    """
    duplicate_payload = {
        "student_staff_id": "SV_DIFF",
        "full_name": "Người Trùng Email",
        "email": test_borrower_user.email,
        "role": "BORROWER",
        "password": "password123"
    }
    response = client.post("/api/v1/admin/users", json=duplicate_payload, headers=admin_token_headers)
    assert response.status_code == 409
    assert "Email" in response.json()["detail"]


def test_admin_create_user_duplicate_student_id(client, admin_token_headers, test_borrower_user):
    """
    Mục đích: Kiểm thử chặn tạo tài khoản khi mã số sinh viên đã tồn tại (409 Conflict).
    """
    duplicate_payload = {
        "student_staff_id": test_borrower_user.student_staff_id,
        "full_name": "Người Trùng Mã",
        "email": "unique_email@eduvault.edu.vn",
        "role": "BORROWER",
        "password": "password123"
    }
    response = client.post("/api/v1/admin/users", json=duplicate_payload, headers=admin_token_headers)
    assert response.status_code == 409
    assert "Mã số" in response.json()["detail"]


def test_borrower_cannot_create_user_returns_403(client, borrower_token_headers):
    """
    Mục đích: Kiểm thử sinh viên (BORROWER) không có quyền tạo tài khoản (403 Forbidden).
    """
    new_user_payload = {
        "student_staff_id": "SV_ILLEGAL",
        "full_name": "Bị Chặn Quyền",
        "email": "blocked@eduvault.edu.vn",
        "role": "BORROWER",
        "password": "password123"
    }
    response = client.post("/api/v1/admin/users", json=new_user_payload, headers=borrower_token_headers)
    assert response.status_code == 403


def test_anonymous_cannot_create_user_returns_401(client):
    """
    Mục đích: Kiểm thử request không đính kèm token bị từ chối 401 Unauthorized.
    """
    new_user_payload = {
        "student_staff_id": "SV_NO_TOKEN",
        "full_name": "Không Có Token",
        "email": "notoken@eduvault.edu.vn",
        "role": "BORROWER",
        "password": "password123"
    }
    response = client.post("/api/v1/admin/users", json=new_user_payload)
    assert response.status_code == 401


def test_admin_list_users_success(client, admin_token_headers, test_admin_user, test_borrower_user):
    """
    Mục đích: Kiểm thử Admin xem danh sách người dùng thành công (200 OK).
    """
    response = client.get("/api/v1/admin/users", headers=admin_token_headers)
    assert response.status_code == 200
    users = response.json()
    assert len(users) >= 2


def test_admin_list_users_filter_by_role(client, admin_token_headers, test_admin_user, test_borrower_user):
    """
    Mục đích: Kiểm thử Admin lọc danh sách theo vai trò BORROWER.
    """
    response = client.get("/api/v1/admin/users?role=BORROWER", headers=admin_token_headers)
    assert response.status_code == 200
    borrowers = response.json()
    assert all(u["role"] == "BORROWER" for u in borrowers)


def test_borrower_cannot_list_users_returns_403(client, borrower_token_headers):
    """
    Mục đích: Kiểm thử BORROWER không có quyền xem danh sách người dùng (403 Forbidden).
    """
    response = client.get("/api/v1/admin/users", headers=borrower_token_headers)
    assert response.status_code == 403

