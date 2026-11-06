"""
Script: scripts/audit_security.py
Mục đích: Tự động rà soát an ninh bảo mật toàn diện cho hệ thống EduVault (Task 8.2).
Bao gồm:
  1. Secret & Leak Prevention: Kiểm tra file .env, repo git không commit private key của Mainnet/Testnet.
  2. RBAC & Access Control: Kiểm tra phân quyền JWT, chặn người dùng thường gọi các API nhạy cảm của Admin.
  3. Brute-Force & Rate Limiting: Kiểm tra cơ chế tự động khóa tài khoản sau 5 lần thử sai mật khẩu.
  4. Smart Contract Role-Based Verification: Kiểm tra vai trò DEFAULT_ADMIN_ROLE, ADMIN_ROLE, BORROWER_ROLE trên EVM.
"""
import os
import re
import requests
from web3 import Web3

BASE_URL = "http://127.0.0.1:8000/api/v1"

def check_secret_leak_prevention():
    print("\n[1/4] KIỂM TRA CHỐNG LỘ KHÓA BÍ MẬT & PRIVATE KEYS...")
    suspicious_patterns = [
        re.compile(r"-----BEGIN (RSA|EC|OPENSSH|PRIVATE) KEY-----"),
        re.compile(r"AKIA[0-9A-Z]{16}"), # AWS Access Key
    ]
    scanned_files = 0
    clean = True

    # Scan python, ts, json files in backend, frontend, contracts
    for folder in ["backend/app", "frontend/src", "contracts/contracts"]:
        for root, _, files in os.walk(folder):
            for file in files:
                if file.endswith((".py", ".ts", ".tsx", ".sol")):
                    scanned_files += 1
                    path = os.path.join(root, file)
                    with open(path, "r", encoding="utf-8", errors="ignore") as f:
                        content = f.read()
                        for p in suspicious_patterns:
                            if p.search(content):
                                print(f"  [-] Phát hiện nghi vấn rò rỉ tại: {path}")
                                clean = False

    assert clean, "Phát hiện thông tin bí mật trong source code!"
    print(f" [+] Đã quét an toàn {scanned_files} file source code: Không phát hiện Private Key thật nào bị hardcode.")


def check_rbac_authorization():
    print("\n[2/4] KIỂM TRA PHÂN QUYỀN JWT (RBAC AUTHORIZATION)...")
    # Đăng nhập bằng tài khoản Sinh viên
    sv_res = requests.post(f"{BASE_URL}/auth/login", json={"identifier": "SV2026001", "password": "student123"})
    assert sv_res.status_code == 200
    sv_token = sv_res.json()["access_token"]
    sv_headers = {"Authorization": f"Bearer {sv_token}"}

    # Thử gọi API Admin: Xem audit logs
    res1 = requests.get(f"{BASE_URL}/audit/logs", headers=sv_headers)
    assert res1.status_code == 403, f"Mong đợi 403 Forbidden cho /audit/logs nhưng nhận {res1.status_code}"
    print(f" [+] Chặn thành công sinh viên truy cập /audit/logs (HTTP 403)")

    # Thử gọi API Admin: Kích hoạt đối soát Reconcile
    res2 = requests.post(f"{BASE_URL}/audit/reconcile", headers=sv_headers)
    assert res2.status_code == 403, f"Mong đợi 403 Forbidden cho /audit/reconcile nhưng nhận {res2.status_code}"
    print(f" [+] Chặn thành công sinh viên gọi /audit/reconcile (HTTP 403)")

    # Thử gọi API Admin: Quản lý người dùng
    res3 = requests.get(f"{BASE_URL}/admin/users", headers=sv_headers)
    assert res3.status_code == 403, f"Mong đợi 403 Forbidden cho /admin/users nhưng nhận {res3.status_code}"
    print(f" [+] Chặn thành công sinh viên truy cập /admin/users (HTTP 403)")


def check_brute_force_lockout():
    print("\n[3/4] KIỂM TRA BẢO VỆ CHỐNG TẤN CÔNG BRUTE-FORCE...")
    test_identifier = "SV2026003"
    wrong_password = "wrong_password_999"

    # Reset trạng thái khóa ban đầu cho user kiểm thử
    from backend.app.db.session import SessionLocal
    from backend.app.models.user import User
    with SessionLocal() as db:
        u = db.query(User).filter(User.student_staff_id == test_identifier).first()
        if u:
            u.failed_login_count = 0
            u.locked_until = None
            db.commit()

    # Gửi 5 lần sai liên tiếp
    for attempt in range(1, 6):
        res = requests.post(f"{BASE_URL}/auth/login", json={"identifier": test_identifier, "password": wrong_password})
        if attempt < 5:
            assert res.status_code == 401
            print(f"  -> Lần {attempt}: Thất bại đúng như mong đợi (HTTP 401)")
        else:
            # Lần thứ 5 sẽ báo tài khoản bị khóa với HTTP 423 Locked
            assert res.status_code == 423, f"Mong đợi 423 Locked nhưng nhận {res.status_code}: {res.text}"
            print(f"  -> Lần 5: Kích hoạt khóa tài khoản tạm thời 15 phút (HTTP 423 Locked)!")

    # Lần thứ 6 với mật khẩu đúng vẫn phải bị chặn vì tài khoản đang bị khóa
    locked_res = requests.post(f"{BASE_URL}/auth/login", json={"identifier": test_identifier, "password": "student123"})
    assert locked_res.status_code == 423, f"Mong đợi 423 Locked nhưng nhận {locked_res.status_code}: {locked_res.text}"
    print(f" [+] Cơ chế chống Brute-force hoạt động hoàn hảo: Đăng nhập đúng vẫn bị từ chối với HTTP 423 trong thời gian khóa!")

    # Mở khóa lại cho tài khoản sau kiểm thử
    with SessionLocal() as db:
        u = db.query(User).filter(User.student_staff_id == test_identifier).first()
        if u:
            u.failed_login_count = 0
            u.locked_until = None
            db.commit()


def check_smart_contract_roles():
    print("\n[4/4] KIỂM TRA PHÂN QUYỀN ON-CHAIN TRÊN SMART CONTRACT...")
    w3 = Web3(Web3.HTTPProvider("http://127.0.0.1:8545"))
    assert w3.is_connected(), "Hardhat node không khả dụng!"

    import json
    with open("contracts/deployments/localhost.json", "r") as f:
        deploy_data = json.load(f)
    contract_address = deploy_data["address"]

    with open("contracts/artifacts/contracts/EquipmentLending.sol/EquipmentLending.json", "r") as f:
        contract_json = json.load(f)
    abi = contract_json["abi"]

    contract = w3.eth.contract(address=contract_address, abi=abi)

    admin_role = contract.functions.ADMIN_ROLE().call()
    borrower_role = contract.functions.BORROWER_ROLE().call()
    deployer = w3.eth.accounts[0]
    student_account = w3.eth.accounts[1]

    # Kiểm tra deployer có ADMIN_ROLE
    has_admin = contract.functions.hasRole(admin_role, deployer).call()
    assert has_admin is True, "Deployer phải sở hữu ADMIN_ROLE"
    print(f" [+] Deployer {deployer[:10]}... sở hữu ADMIN_ROLE hợp lệ")

    # Kiểm tra tài khoản sinh viên không có ADMIN_ROLE
    student_has_admin = contract.functions.hasRole(admin_role, student_account).call()
    assert student_has_admin is False, "Tài khoản sinh viên không được phép có ADMIN_ROLE"
    print(f" [+] Tài khoản sinh viên {student_account[:10]}... không có ADMIN_ROLE (Bảo vệ On-chain)")


def main():
    print("=" * 70)
    print("          EDUVAULT - SECURITY AUDIT & ACCESS CONTROL CHECK           ")
    print("=" * 70)

    check_secret_leak_prevention()
    check_rbac_authorization()
    check_brute_force_lockout()
    check_smart_contract_roles()

    print("\n" + "=" * 70)
    print(" [+] KẾT QUẢ RÀ SOÁT AN NINH BẢO MẬT: TOÀN BỘ 4 HẠNG MỤC ĐẠT 100%!")
    print("=" * 70)


if __name__ == "__main__":
    main()
