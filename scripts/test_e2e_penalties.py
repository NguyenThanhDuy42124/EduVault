"""
Script: scripts/test_e2e_penalties.py
Mục đích: Kiểm thử tích hợp E2E các kịch bản ngoại lệ, phạt quá hạn và tịch thu cọc.
Bao gồm:
  Kịch bản A: Trả máy trễ hạn <= 24h -> Phạt 10% tiền cọc, hoàn 90% cọc on-chain.
  Kịch bản B: Trả máy trễ hạn > 24h  -> Phạt 50% tiền cọc, hoàn 50% cọc on-chain.
  Kịch bản C: Thiết bị bị hư hại (DAMAGED) -> Tịch thu 100% cọc (FORFEITED), chuyển DISPUTED.
  Kịch bản D: Thiết bị bị mất (LOST) -> Tịch thu 100% cọc (FORFEITED), chuyển DISPUTED.
"""
import requests
from datetime import datetime, timezone, timedelta

BASE_URL = "http://127.0.0.1:8000/api/v1"

def login(identifier, password):
    resp = requests.post(f"{BASE_URL}/auth/login", json={"identifier": identifier, "password": password})
    assert resp.status_code == 200, f"Login failed for {identifier}"
    return {"Authorization": f"Bearer {resp.json()['access_token']}"}

def run_loan_lifecycle(sv_headers, admin_headers, equipment_id, return_condition, manual_penalty=None):
    now = datetime.now(timezone.utc)
    exp = (now + timedelta(days=1)).isoformat()
    due = (now + timedelta(days=3)).isoformat()
    
    # 1. SV tạo đơn
    req_res = requests.post(f"{BASE_URL}/loans/request", headers=sv_headers, json={
        "equipment_id": equipment_id,
        "expected_handover_date": exp,
        "due_date": due,
        "admin_notes": f"Penalty Scenario Test: {return_condition}"
    })
    assert req_res.status_code == 201, f"Tạo đơn lỗi: {req_res.text}"
    loan_id = req_res.json()["id"]

    # 2. Admin duyệt
    app_res = requests.post(f"{BASE_URL}/loans/{loan_id}/approve", headers=admin_headers, json={"notes": "Approve test"})
    assert app_res.status_code == 200, f"Duyệt lỗi: {app_res.text}"

    # 3. Admin bàn giao
    hand_res = requests.post(f"{BASE_URL}/loans/{loan_id}/handover", headers=admin_headers)
    assert hand_res.status_code == 200, f"Bàn giao lỗi: {hand_res.text}"

    # 4. Admin nhận lại máy kèm điều kiện
    return_payload = {
        "return_condition": return_condition,
        "admin_notes": f"Nghiệm thu kiểm thử: {return_condition}"
    }
    if manual_penalty is not None:
        return_payload["manual_penalty_percent"] = manual_penalty

    ret_res = requests.post(f"{BASE_URL}/loans/{loan_id}/return", headers=admin_headers, json=return_payload)
    assert ret_res.status_code == 200, f"Trả máy lỗi: {ret_res.text}"
    loan_data = ret_res.json()

    # 5. Kiểm toán đối soát Smart Contract On-chain
    audit_res = requests.get(f"{BASE_URL}/audit/loans/{loan_id}/verify", headers=admin_headers)
    assert audit_res.status_code == 200, f"Audit lỗi: {audit_res.text}"
    audit_data = audit_res.json()

    return loan_data, audit_data

def main():
    print("=" * 70)
    print(" EDUVAULT - E2E INTEGRATION TEST: PENALTY & FORFEIT SCENARIOS")
    print("=" * 70)

    sv_headers = login("SV2026002", "student123")
    admin_headers = login("admin@eduvault.edu.vn", "admin123456")

    # Lấy danh sách thiết bị AVAILABLE
    eq_res = requests.get(f"{BASE_URL}/equipment?status=AVAILABLE", headers=sv_headers)
    available_eq = eq_res.json()
    assert len(available_eq) >= 4, f"Cần ít nhất 4 thiết bị AVAILABLE để test, hiện có {len(available_eq)}"

    # Kịch bản A: Trễ <= 24h (Phạt 10%)
    print("\n--- [KỊCH BẢN A] Trả trễ hạn <= 24h (Phạt 10% tiền cọc) ---")
    loan_a, audit_a = run_loan_lifecycle(sv_headers, admin_headers, available_eq[0]["id"], "GOOD", manual_penalty=10)
    onchain_penalty_a = audit_a["blockchain_state"]["penalty_percent"]
    print(f" -> Đơn #{loan_a['id']}: DB Status = {loan_a['status']}, Deposit = {loan_a['deposit_status']}")
    print(f" -> On-Chain: State = {audit_a['blockchain_state']['state']} (Returned), Penalty = {onchain_penalty_a}%, Mutex Released = {audit_a['is_synced']}")
    assert loan_a["status"] == "RETURNED"
    assert loan_a["deposit_status"] == "REFUNDED"
    assert onchain_penalty_a == 10
    assert audit_a["is_synced"] is True
    print(" [PASS] Kịch bản phạt 10% thành công!")

    # Kịch bản B: Trễ > 24h (Phạt 50%)
    print("\n--- [KỊCH BẢN B] Trả trễ hạn > 24h (Phạt 50% tiền cọc) ---")
    loan_b, audit_b = run_loan_lifecycle(sv_headers, admin_headers, available_eq[1]["id"], "GOOD", manual_penalty=50)
    onchain_penalty_b = audit_b["blockchain_state"]["penalty_percent"]
    print(f" -> Đơn #{loan_b['id']}: DB Status = {loan_b['status']}, Deposit = {loan_b['deposit_status']}")
    print(f" -> On-Chain: State = {audit_b['blockchain_state']['state']} (Returned), Penalty = {onchain_penalty_b}%, Mutex Released = {audit_b['is_synced']}")
    assert loan_b["status"] == "RETURNED"
    assert loan_b["deposit_status"] == "REFUNDED"
    assert onchain_penalty_b == 50
    assert audit_b["is_synced"] is True
    print(" [PASS] Kịch bản phạt 50% thành công!")

    # Kịch bản C: Thiết bị hư hỏng (Tịch thu 100% cọc)
    print("\n--- [KỊCH BẢN C] Thiết bị hư hại (DAMAGED - Tịch thu 100% cọc) ---")
    loan_c, audit_c = run_loan_lifecycle(sv_headers, admin_headers, available_eq[2]["id"], "DAMAGED")
    onchain_penalty_c = audit_c["blockchain_state"]["penalty_percent"]
    print(f" -> Đơn #{loan_c['id']}: DB Status = {loan_c['status']}, Deposit = {loan_c['deposit_status']}")
    print(f" -> On-Chain: State = {audit_c['blockchain_state']['state']} (Disputed), Penalty = {onchain_penalty_c}%, Mutex Released = {audit_c['is_synced']}")
    assert loan_c["status"] == "DISPUTED"
    assert loan_c["deposit_status"] == "FORFEITED"
    assert onchain_penalty_c == 100
    assert audit_c["is_synced"] is True
    print(" [PASS] Kịch bản hư hỏng tịch thu cọc 100% thành công!")

    # Kịch bản D: Báo mất thiết bị (Tịch thu 100% cọc)
    print("\n--- [KỊCH BẢN D] Thiết bị báo mất (LOST - Tịch thu 100% cọc) ---")
    loan_d, audit_d = run_loan_lifecycle(sv_headers, admin_headers, available_eq[3]["id"], "LOST")
    onchain_penalty_d = audit_d["blockchain_state"]["penalty_percent"]
    print(f" -> Đơn #{loan_d['id']}: DB Status = {loan_d['status']}, Deposit = {loan_d['deposit_status']}")
    print(f" -> On-Chain: State = {audit_d['blockchain_state']['state']} (Disputed), Penalty = {onchain_penalty_d}%, Mutex Released = {audit_d['is_synced']}")
    assert loan_d["status"] == "DISPUTED"
    assert loan_d["deposit_status"] == "FORFEITED"
    assert onchain_penalty_d == 100
    assert audit_d["is_synced"] is True
    print(" [PASS] Kịch bản mất máy tịch thu cọc 100% thành công!")

    print("\n" + "=" * 70)
    print(" [KẾT QUẢ] TẤT CẢ 4 KỊCH BẢN PHẠT & TỊCH THU CỌC ĐỀU PASS 100% TRÊN EVM!")
    print("=" * 70)

if __name__ == "__main__":
    main()
