"""
Module: backend.tests.test_auth
Mục đích: Bộ kiểm thử tự động cho Auth Service và các Endpoint xác thực.
Áp dụng: Quy định viết code và docstring tại QUY_DINH_CODE.md.
"""
from backend.app.models.user import User


def test_login_success_by_email(client, test_admin_user: User):
    """
    Mục đích: Kiểm thử đăng nhập thành công bằng email, trả về token hợp lệ.
    """
    response = client.post(
        "/api/v1/auth/login",
        json={"identifier": "admin@eduvault.edu.vn", "password": "admin123456"}
    )
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"
    assert data["role"] == "ADMIN"
    assert data["user_id"] == test_admin_user.id


def test_login_success_by_student_id(client, test_borrower_user: User):
    """
    Mục đích: Kiểm thử sinh viên đăng nhập thành công bằng mã số sinh viên.
    """
    response = client.post(
        "/api/v1/auth/login",
        json={"identifier": "SV2026001", "password": "student123"}
    )
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["role"] == "BORROWER"
    assert data["user_id"] == test_borrower_user.id


def test_login_wrong_password_returns_401(client, test_admin_user: User):
    """
    Mục đích: Kiểm thử đăng nhập sai mật khẩu bị từ chối và thông báo số lần còn lại.
    """
    response = client.post(
        "/api/v1/auth/login",
        json={"identifier": "admin@eduvault.edu.vn", "password": "wrongpassword"}
    )
    assert response.status_code == 401
    assert "Mật khẩu không chính xác" in response.json()["detail"]


def test_login_nonexistent_user_returns_401(client):
    """
    Mục đích: Kiểm thử đăng nhập với tài khoản không tồn tại.
    """
    response = client.post(
        "/api/v1/auth/login",
        json={"identifier": "nonexistent@eduvault.edu.vn", "password": "any"}
    )
    assert response.status_code == 401


def test_login_inactive_user_returns_403(client, db_session, test_borrower_user: User):
    """
    Mục đích: Kiểm thử tài khoản bị vô hiệu hóa (is_active = False) không thể đăng nhập.
    """
    test_borrower_user.is_active = False
    db_session.commit()

    response = client.post(
        "/api/v1/auth/login",
        json={"identifier": "SV2026001", "password": "student123"}
    )
    assert response.status_code == 403
    assert "vô hiệu hóa" in response.json()["detail"]


def test_brute_force_lockout_after_five_attempts(client, test_admin_user: User):
    """
    Mục đích: Kiểm thử cơ chế bảo vệ brute-force: khóa tài khoản (423 Locked) sau 5 lần nhập sai.
    """
    # 4 lần đầu nhập sai -> nhận 401
    for _ in range(4):
        res = client.post(
            "/api/v1/auth/login",
            json={"identifier": "admin@eduvault.edu.vn", "password": "wrong"}
        )
        assert res.status_code == 401

    # Lần thứ 5 nhập sai -> kích hoạt khóa tài khoản và trả về 423
    lock_res = client.post(
        "/api/v1/auth/login",
        json={"identifier": "admin@eduvault.edu.vn", "password": "wrong"}
    )
    assert lock_res.status_code == 423
    assert "tạm khóa" in lock_res.json()["detail"]

    # Kể cả nhập đúng mật khẩu ngay sau đó vẫn bị chặn do đang trong thời gian khóa
    blocked_res = client.post(
        "/api/v1/auth/login",
        json={"identifier": "admin@eduvault.edu.vn", "password": "admin123456"}
    )
    assert blocked_res.status_code == 423


def test_login_oauth2_form_success(client, test_admin_user: User):
    """
    Mục đích: Kiểm thử endpoint OAuth2 form tương thích với Swagger UI.
    """
    response = client.post(
        "/api/v1/auth/token",
        data={"username": "admin@eduvault.edu.vn", "password": "admin123456"}
    )
    assert response.status_code == 200
    assert "access_token" in response.json()


def test_get_current_user_me_success(client, admin_token_headers, test_admin_user: User):
    """
    Mục đích: Kiểm thử lấy thông tin tài khoản đang đăng nhập với Bearer Token.
    """
    response = client.get("/api/v1/users/me", headers=admin_token_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["email"] == test_admin_user.email
    assert data["student_staff_id"] == test_admin_user.student_staff_id
    assert data["role"] == "ADMIN"


def test_get_current_user_me_invalid_token(client):
    """
    Mục đích: Kiểm thử gửi token không hợp lệ bị từ chối 401.
    """
    response = client.get(
        "/api/v1/users/me",
        headers={"Authorization": "Bearer invalid_token_here"}
    )
    assert response.status_code == 401

