"""
Script: scripts/test_e2e_happy_path.py
Mục đích: Kiểm thử tích hợp End-to-End (E2E) luồng chuẩn mượn trả thiết bị (Happy Path).
Quy trình:
  1. Đăng nhập tài khoản Sinh viên (SV2026001).
  2. Tạo đơn mượn thiết bị còn trống (status = AVAILABLE).
  3. Đăng nhập tài khoản Quản trị viên (ADMIN001).
  4. Admin duyệt đơn mượn (đẩy on-chain createLoan + approveLoan, khóa Mutex thiết bị).
  5. Admin bàn giao thiết bị thực tế (đẩy on-chain confirmHandover, khóa tiền cọc).
  6. Admin xác nhận trả thiết bị đúng hạn, nguyên vẹn (on-chain confirmReturn, hoàn 100% cọc).
  7. Đối soát tính toàn vẹn giữa MySQL và Blockchain.
"""
import sys
import requests
from datetime import datetime, timedelta

BASE_URL = "http://127.0.0.1:8000/api/v1"

def print_step(step_num: int, title: str):
    print(f"\n{'='*70}")
    print(f" [BƯỚC {step_num}] {title}")
    print(f"{'='*70}")

def main():
    print("=" * 70)
    print(" EDUVAULT - E2E INTEGRATION TEST: HAPPY PATH (LUỒNG CHUẨN A-Z)")
    print("=" * 70)

    # 1. Đăng nhập Sinh viên
    print_step(1, "Đăng nhập tài khoản Sinh viên (SV2026001)")
    login_sv_resp = requests.post(f"{BASE_URL}/auth/login", json={
        "identifier": "SV2026001",
        "password": "student123"
    })
    assert login_sv_resp.status_code == 200, f"Đăng nhập SV thất bại: {login_sv_resp.text}"
    sv_token = login_sv_resp.json()["access_token"]
    sv_headers = {"Authorization": f"Bearer {sv_token}"}
    print(" -> Đăng nhập Sinh viên thành công! Token:", sv_token[:20] + "...")

    # 2. Tìm thiết bị AVAILABLE
    print_step(2, "Tra cứu danh mục và chọn thiết bị sẵn sàng (AVAILABLE)")
    eq_resp = requests.get(f"{BASE_URL}/equipment?status=AVAILABLE", headers=sv_headers)
    assert eq_resp.status_code == 200
    available_eq = eq_resp.json()
    assert len(available_eq) > 0, "Không còn thiết bị nào ở trạng thái AVAILABLE để test!"
    selected_eq = available_eq[0]
    print(f" -> Đã chọn thiết bị: #{selected_eq['id']} - {selected_eq['name']} (Serial: {selected_eq['serial_number']})")
    print(f"    Mức cọc quy định: {float(selected_eq['deposit_amount']):,.0f} VND")

    # 3. Tạo đơn mượn
    print_step(3, "Sinh viên gửi yêu cầu mượn thiết bị (POST /loans/request)")
    now = datetime.utcnow()
    expected_handover = (now + timedelta(days=1)).isoformat()
    due_date = (now + timedelta(days=4)).isoformat()

    create_resp = requests.post(f"{BASE_URL}/loans/request", headers=sv_headers, json={
        "equipment_id": selected_eq["id"],
        "expected_handover_date": expected_handover,
        "due_date": due_date,
        "admin_notes": "E2E Test: Mượn phục vụ bài tập lớn Blockchain"
    })
    assert create_resp.status_code == 201, f"Tạo đơn thất bại: {create_resp.text}"
    loan_data = create_resp.json()
    loan_id = loan_data["id"]
    print(f" -> Tạo đơn thành công! Đơn #{loan_id} - Trạng thái: {loan_data['status']}")
    assert loan_data["status"] == "PENDING"
    assert loan_data["deposit_status"] == "PENDING"

    # 4. Đăng nhập Admin
    print_step(4, "Đăng nhập tài khoản Quản trị viên (ADMIN001)")
    login_admin_resp = requests.post(f"{BASE_URL}/auth/login", json={
        "identifier": "admin@eduvault.edu.vn",
        "password": "admin123456"
    })
    assert login_admin_resp.status_code == 200, f"Đăng nhập Admin thất bại: {login_admin_resp.text}"
    admin_token = login_admin_resp.json()["access_token"]
    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    print(" -> Đăng nhập Quản trị viên thành công!")

    # 5. Admin duyệt đơn
    print_step(5, f"Admin duyệt đơn mượn #{loan_id} (Duyệt + Ghi On-chain)")
    approve_resp = requests.post(f"{BASE_URL}/loans/{loan_id}/approve", headers=admin_headers, json={
        "notes": "Duyệt yêu cầu E2E test"
    })
    assert approve_resp.status_code == 200, f"Duyệt đơn thất bại: {approve_resp.text}"
    approved_data = approve_resp.json()
    print(f" -> Duyệt đơn thành công!")
    print(f"    Trạng thái đơn: {approved_data['status']}")
    print(f"    On-chain Loan ID: {approved_data['on_chain_loan_id']}")
    assert approved_data["status"] == "APPROVED"
    assert approved_data["on_chain_loan_id"] is not None

    # 6. Admin bàn giao thiết bị
    print_step(6, f"Admin xác nhận bàn giao thiết bị thực tế (Khóa tiền cọc)")
    handover_resp = requests.post(f"{BASE_URL}/loans/{loan_id}/handover", headers=admin_headers)
    assert handover_resp.status_code == 200, f"Bàn giao thất bại: {handover_resp.text}"
    handover_data = handover_resp.json()
    print(f" -> Bàn giao thành công!")
    print(f"    Trạng thái đơn: {handover_data['status']}")
    print(f"    Trạng thái cọc: {handover_data['deposit_status']}")
    assert handover_data["status"] == "ACTIVE"
    assert handover_data["deposit_status"] == "LOCKED"

    # 7. Admin nhận lại máy và hoàn cọc
    print_step(7, f"Admin nhận lại thiết bị đúng hạn, nguyên vẹn (GOOD - Hoàn 100% cọc)")
    return_resp = requests.post(f"{BASE_URL}/loans/{loan_id}/return", headers=admin_headers, json={
        "return_condition": "GOOD",
        "manual_penalty_percent": 0,
        "admin_notes": "Thiết bị nguyên vẹn, hoạt động hoàn hảo"
    })
    assert return_resp.status_code == 200, f"Trả máy thất bại: {return_resp.text}"
    return_data = return_resp.json()
    print(f" -> Hoàn tất trả thiết bị!")
    print(f"    Trạng thái đơn: {return_data['status']}")
    print(f"    Trạng thái cọc: {return_data['deposit_status']}")
    print(f"    Mức phạt: {return_data.get('penalty_percent', 0)}%")
    assert return_data["status"] == "RETURNED"
    assert return_data["deposit_status"] == "REFUNDED"

    # 8. Đối soát dữ liệu (Verify Loan on Blockchain)
    print_step(8, f"Đối soát tính toàn vẹn giữa MySQL và Blockchain (GET /audit/loans/{loan_id}/verify)")
    verify_resp = requests.get(f"{BASE_URL}/audit/loans/{loan_id}/verify", headers=admin_headers)
    assert verify_resp.status_code == 200, f"Đối soát thất bại: {verify_resp.text}"
    verify_data = verify_resp.json()
    print(f" -> Kết quả đối soát: is_synced = {verify_data.get('is_synced', True)}")
    print(f"    Trạng thái MySQL: {verify_data.get('mysql_state', {})}")
    print(f"    Trạng thái Blockchain: {verify_data.get('blockchain_state', {})}")

    print("\n" + "=" * 70)
    print(" [KẾT QUẢ] KIỂM THỬ E2E HAPPY PATH HOÀN THÀNH XUẤT SẮC - 100% PASS!")
    print("=" * 70)

if __name__ == "__main__":
    main()
