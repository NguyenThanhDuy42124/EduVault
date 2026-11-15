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


def test_wallet_challenge_and_eip191_verify_flow_with_one_time_nonce(
    client, db_session, test_borrower_user, borrower_token_headers
):
    """
    Mục đích: Kiểm thử liên kết ví MetaMask bằng challenge nonce dùng 1 lần, hạn 5 phút và chữ ký EIP-191.
    """
    from datetime import datetime, timedelta
    from eth_account import Account
    from eth_account.messages import encode_defunct

    acct = Account.from_key("0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d")
    other_acct = Account.from_key("0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a")

    # 1. Yêu cầu thử thách cho ví MetaMask
    chal_res = client.post(
        "/api/v1/users/wallet/challenge",
        json={"wallet_address": acct.address.lower()},
        headers=borrower_token_headers,
    )
    assert chal_res.status_code == 200
    chal = chal_res.json()
    assert chal["wallet_address"] == acct.address
    assert "Nonce:" in chal["message"]

    # 2. Ký sai khóa riêng -> 400 và tiêu thụ luôn nonce (replay cùng nonce phải fail)
    wrong_sig = other_acct.sign_message(encode_defunct(text=chal["message"])).signature.hex()
    bad_verify = client.post(
        "/api/v1/users/wallet/verify",
        json={"wallet_address": acct.address, "signature": wrong_sig},
        headers=borrower_token_headers,
    )
    assert bad_verify.status_code == 400

    valid_sig_for_consumed = acct.sign_message(encode_defunct(text=chal["message"])).signature.hex()
    reused_verify = client.post(
        "/api/v1/users/wallet/verify",
        json={"wallet_address": acct.address, "signature": valid_sig_for_consumed},
        headers=borrower_token_headers,
    )
    assert reused_verify.status_code == 400

    # 3. Xin thử thách mới nhưng để hết hạn -> 400
    chal_res_exp = client.post(
        "/api/v1/users/wallet/challenge",
        json={"wallet_address": acct.address},
        headers=borrower_token_headers,
    )
    exp_msg = chal_res_exp.json()["message"]
    test_borrower_user.wallet_nonce_expires_at = datetime.now() - timedelta(seconds=10)
    db_session.commit()
    exp_sig = acct.sign_message(encode_defunct(text=exp_msg)).signature.hex()
    exp_verify = client.post(
        "/api/v1/users/wallet/verify",
        json={"wallet_address": acct.address, "signature": exp_sig},
        headers=borrower_token_headers,
    )
    assert exp_verify.status_code == 400
    assert "hết hạn" in exp_verify.json()["detail"]

    # 4. Xin thử thách mới và ký đúng -> 200, wallet_verified=True; replay lại chữ ký -> 400
    chal_res_ok = client.post(
        "/api/v1/users/wallet/challenge",
        json={"wallet_address": acct.address},
        headers=borrower_token_headers,
    )
    ok_msg = chal_res_ok.json()["message"]
    ok_sig = acct.sign_message(encode_defunct(text=ok_msg)).signature.hex()
    verify_ok = client.post(
        "/api/v1/users/wallet/verify",
        json={"wallet_address": acct.address, "signature": ok_sig},
        headers=borrower_token_headers,
    )
    assert verify_ok.status_code == 200
    v_data = verify_ok.json()
    assert v_data["wallet_verified"] is True
    assert v_data["wallet_address"] == acct.address

    replay_ok = client.post(
        "/api/v1/users/wallet/verify",
        json={"wallet_address": acct.address, "signature": ok_sig},
        headers=borrower_token_headers,
    )
    assert replay_ok.status_code == 400

    # 5. Tài khoản khác cố chiếm cùng địa chỉ ví -> 409 Conflict
    from backend.app.core.security import create_access_token, hash_password
    from backend.app.models.user import User, UserRole

    u2 = User(
        student_staff_id="SV2026009",
        full_name="Sinh Viên Thứ 2",
        email="sv09@eduvault.edu.vn",
        password_hash=hash_password("student123"),
        role=UserRole.BORROWER,
        is_active=True,
    )
    db_session.add(u2)
    db_session.commit()
    db_session.refresh(u2)
    u2_headers = {"Authorization": f"Bearer {create_access_token(u2.id, 'BORROWER')}"}
    conflict_chal = client.post(
        "/api/v1/users/wallet/challenge",
        json={"wallet_address": acct.address},
        headers=u2_headers,
    )
    assert conflict_chal.status_code == 409


def test_post_users_wallet_alias_and_admin_pending_borrowers(
    client, db_session, admin_token_headers, test_borrower_user, monkeypatch
):
    """
    Mục đích: Kiểm thử `POST /api/v1/users/wallet` (EIP-191 alias) và `GET /api/v1/admin/pending-borrowers`.
    """
    from eth_account import Account
    from eth_account.messages import encode_defunct
    from backend.app.core.security import create_access_token, hash_password
    from backend.app.models.user import User, UserRole
    from backend.app.services import user_service as us

    acct1 = Account.from_key("0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d")
    acct2 = Account.from_key("0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a")
    borrower_headers = {
        "Authorization": f"Bearer {create_access_token(test_borrower_user.id, 'BORROWER')}"
    }

    # 1. Challenge + POST /api/v1/users/wallet (alias mới)
    chal = client.post(
        "/api/v1/users/wallet/challenge",
        json={"wallet_address": acct1.address},
        headers=borrower_headers,
    ).json()
    sig = acct1.sign_message(encode_defunct(text=chal["message"])).signature.hex()
    link_res = client.post(
        "/api/v1/users/wallet",
        json={"wallet_address": acct1.address, "signature": sig},
        headers=borrower_headers,
    )
    assert link_res.status_code == 200
    assert link_res.json()["wallet_verified"] is True
    assert link_res.json()["wallet_address"] == acct1.address

    # 2. Tạo thêm 1 borrower đã xác minh ví và 1 borrower chưa xác minh ví
    verified_2 = User(
        student_staff_id="SV_VER2",
        full_name="Đã Xác Minh 2",
        email="ver2@eduvault.edu.vn",
        password_hash=hash_password("student123"),
        role=UserRole.BORROWER,
        wallet_address=acct2.address,
        wallet_verified=True,
        is_active=True,
    )
    unverified = User(
        student_staff_id="SV_UNV_LIST",
        full_name="Chưa Xác Minh",
        email="unv_list@eduvault.edu.vn",
        password_hash=hash_password("student123"),
        role=UserRole.BORROWER,
        wallet_address="0x90F79bf6EB2c4f870365E785982E1f101E93b906",
        wallet_verified=False,
        is_active=True,
    )
    db_session.add_all([verified_2, unverified])
    db_session.commit()

    # 3. Sinh viên không có quyền gọi pending-borrowers -> 403
    forbidden_res = client.get("/api/v1/admin/pending-borrowers", headers=borrower_headers)
    assert forbidden_res.status_code == 403

    # 4. RPC online: giả lập acct1 chưa có BORROWER_ROLE, acct2 đã có BORROWER_ROLE
    monkeypatch.setattr(us.blockchain_service, "ensure_ready", lambda: None)
    monkeypatch.setattr(
        us.blockchain_service,
        "has_role",
        lambda role_name, wallet: wallet.lower() == acct2.address.lower(),
    )
    pending_res = client.get("/api/v1/admin/pending-borrowers", headers=admin_token_headers)
    assert pending_res.status_code == 200
    pending_items = pending_res.json()
    assert len(pending_items) == 1
    assert pending_items[0]["wallet_address"] == acct1.address
    assert pending_items[0]["on_chain_borrower_role"] is False

    # 5. RPC offline: vẫn trả danh sách verified với on_chain_borrower_role=None
    monkeypatch.setattr(
        us.blockchain_service,
        "ensure_ready",
        lambda: (_ for _ in ()).throw(ConnectionError("offline")),
    )
    offline_res = client.get("/api/v1/admin/pending-borrowers", headers=admin_token_headers)
    assert offline_res.status_code == 200
    offline_items = offline_res.json()
    assert {u["wallet_address"] for u in offline_items} == {acct1.address, acct2.address}
    assert all(u["on_chain_borrower_role"] is None for u in offline_items)

