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


def _build_register_payload(**overrides):
    payload = {
        "student_staff_id": "SV2026999",
        "full_name": "Trần Minh Khoa",
        "email": "khoa.sv@eduvault.edu.vn",
        "password": "Password123!",
        "password_confirmation": "Password123!",
    }
    payload.update(overrides)
    return payload


def test_public_register_borrower_success(client, db_session):
    """Kiểm thử sinh viên tự đăng ký tài khoản BORROWER thành công qua cổng công khai."""
    response = client.post(
        "/api/v1/auth/register",
        json=_build_register_payload(
            student_staff_id="  SV2026999  ",
            full_name="  Trần Minh Khoa  ",
            email="  Khoa.SV@EduVault.EDU.VN  ",
        ),
    )
    assert response.status_code == 201
    data = response.json()
    assert data["student_staff_id"] == "SV2026999"
    assert data["full_name"] == "Trần Minh Khoa"
    assert data["email"] == "khoa.sv@eduvault.edu.vn"
    assert data["role"] == "BORROWER"
    assert data["is_active"] is True
    assert data["wallet_verified"] is False
    assert data["wallet_address"] is None

    db_user = db_session.query(User).filter(User.email == "khoa.sv@eduvault.edu.vn").first()
    assert db_user is not None
    assert db_user.role.value == "BORROWER"


def test_public_register_default_role_is_borrower(client, db_session):
    """Kiểm thử đăng ký công khai luôn gán mặc định quyền BORROWER."""
    response = client.post("/api/v1/auth/register", json=_build_register_payload())
    assert response.status_code == 201
    data = response.json()
    assert data["role"] == "BORROWER"

    created = db_session.query(User).filter(User.id == data["id"]).first()
    assert created is not None
    assert created.role.value == "BORROWER"


def test_public_register_rejects_admin_role(client, db_session):
    """Kiểm thử không cho phép truyền role=ADMIN khi tự đăng ký công khai."""
    response = client.post(
        "/api/v1/auth/register",
        json=_build_register_payload(role="ADMIN"),
    )
    assert response.status_code == 422
    assert db_session.query(User).filter(User.email == "khoa.sv@eduvault.edu.vn").first() is None


def test_public_register_rejects_wallet_address(client, db_session):
    """Kiểm thử không cho phép tự truyền wallet_address tùy ý khi đăng ký công khai."""
    response = client.post(
        "/api/v1/auth/register",
        json=_build_register_payload(
            wallet_address="0x70997970C51812dc3A010C7d01b50e0d17dc79C8"
        ),
    )
    assert response.status_code == 422
    assert db_session.query(User).filter(User.email == "khoa.sv@eduvault.edu.vn").first() is None


def test_public_register_duplicate_email_returns_409(client, test_borrower_user: User):
    """Kiểm thử trùng email (không phân biệt hoa thường) trả về 409 Conflict."""
    response = client.post(
        "/api/v1/auth/register",
        json=_build_register_payload(
            student_staff_id="SV2026888",
            email=test_borrower_user.email.upper(),
        ),
    )
    assert response.status_code == 409
    assert "Email" in response.json()["detail"]


def test_public_register_duplicate_student_id_returns_409(client, test_borrower_user: User):
    """Kiểm thử trùng mã số sinh viên trả về 409 Conflict."""
    response = client.post(
        "/api/v1/auth/register",
        json=_build_register_payload(
            student_staff_id=test_borrower_user.student_staff_id.lower(),
            email="newstudent@eduvault.edu.vn",
        ),
    )
    assert response.status_code == 409
    assert "Mã số" in response.json()["detail"]


def test_public_register_password_mismatch_returns_422(client):
    """Kiểm thử mật khẩu xác nhận không khớp trả về 422 Unprocessable Entity."""
    response = client.post(
        "/api/v1/auth/register",
        json=_build_register_payload(password_confirmation="DifferentPass123!"),
    )
    assert response.status_code == 422
    assert "khớp" in str(response.json()["detail"]).lower()


def test_public_register_short_password_returns_422(client):
    """Kiểm thử mật khẩu ngắn hơn 8 ký tự bị từ chối với HTTP 422."""
    response = client.post(
        "/api/v1/auth/register",
        json=_build_register_payload(
            password="short77",
            password_confirmation="short77",
        ),
    )
    assert response.status_code == 422


def test_public_register_invalid_email_returns_422(client):
    """Kiểm thử email sai định dạng trả về HTTP 422."""
    response = client.post(
        "/api/v1/auth/register",
        json=_build_register_payload(email="not-an-email"),
    )
    assert response.status_code == 422


def test_public_register_whitespace_fields_return_422(client):
    """Kiểm thử chuỗi chỉ chứa khoảng trắng cho mã SV hoặc họ tên trả về HTTP 422."""
    bad_id = client.post(
        "/api/v1/auth/register",
        json=_build_register_payload(student_staff_id="   "),
    )
    assert bad_id.status_code == 422

    bad_name = client.post(
        "/api/v1/auth/register",
        json=_build_register_payload(full_name="   "),
    )
    assert bad_name.status_code == 422


def test_registered_borrower_can_login_by_email(client):
    """Kiểm thử sinh viên vừa đăng ký có thể đăng nhập bằng email và gọi /users/me."""
    reg_res = client.post("/api/v1/auth/register", json=_build_register_payload())
    assert reg_res.status_code == 201

    login_res = client.post(
        "/api/v1/auth/login",
        json={"identifier": "khoa.sv@eduvault.edu.vn", "password": "Password123!"},
    )
    assert login_res.status_code == 200
    token_data = login_res.json()
    assert token_data["role"] == "BORROWER"

    me_res = client.get(
        "/api/v1/users/me",
        headers={"Authorization": f"Bearer {token_data['access_token']}"},
    )
    assert me_res.status_code == 200
    assert me_res.json()["email"] == "khoa.sv@eduvault.edu.vn"


def test_registered_borrower_can_login_by_student_id(client):
    """Kiểm thử sinh viên vừa đăng ký có thể đăng nhập bằng mã số sinh viên."""
    reg_res = client.post("/api/v1/auth/register", json=_build_register_payload())
    assert reg_res.status_code == 201

    login_res = client.post(
        "/api/v1/auth/login",
        json={"identifier": "SV2026999", "password": "Password123!"},
    )
    assert login_res.status_code == 200
    assert login_res.json()["role"] == "BORROWER"


def test_public_register_response_excludes_sensitive_fields(client, db_session):
    """Kiểm thử response đăng ký không rò rỉ password_hash và CSDL chỉ lưu bản băm."""
    response = client.post("/api/v1/auth/register", json=_build_register_payload())
    assert response.status_code == 201
    data = response.json()
    assert "password_hash" not in data
    assert "password" not in data
    assert "wallet_nonce" not in data
    assert "wallet_nonce_expires_at" not in data

    db_user = db_session.query(User).filter(User.id == data["id"]).first()
    assert db_user is not None
    assert db_user.password_hash != "Password123!"
    assert db_user.password_hash.startswith("$2")


def test_public_register_works_without_authorization_header(client):
    """Kiểm thử endpoint /auth/register hoạt động công khai không cần JWT."""
    response = client.post(
        "/api/v1/auth/register",
        json=_build_register_payload(),
        headers={},
    )
    assert response.status_code == 201


