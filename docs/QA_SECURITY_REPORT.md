# EDUVAULT - BÁO CÁO TOÀN DIỆN KIỂM THỬ QA & RÀ SOÁT BẢO MẬT (PHASE 8)

> **Dự án:** EduVault - Hệ thống Quản lý Mượn trả Thiết bị Học tập Đào tạo trên EVM Blockchain  
> **Phiên bản:** v1.0.0-rc  
> **Thời điểm thẩm định:** 11/2026  
> **Trạng thái tổng thể:** **100% PASS (ĐẠT TOÀN DIỆN)**

---

## 1. TỔNG QUAN KẾT QUẢ KIỂM THỬ TỰ ĐỘNG (QA MATRIX)

Toàn bộ hệ sinh thái kiểm thử của EduVault được thiết kế phân tầng từ cấp độ Smart Contract, Unit/Integration Test cho Backend đến kịch bản E2E toàn diện.

| Phân tầng kiểm thử | Công cụ / Framework | Số lượng ca kiểm thử | Kết quả | Tỷ lệ thành công | Thời gian chạy |
| :--- | :--- | :---: | :---: | :---: | :---: |
| **Smart Contract Test Suite** | Hardhat (Chai / Ethers.js) | 28 tests | 28 PASS | **100%** | ~1.2s |
| **Backend API Test Suite** | Pytest / AnyIO / SQLite in-memory | 56 tests | 56 PASS | **100%** | ~35s |
| **E2E Happy Path Scenario** | Python Web3 Integration | 1 kịch bản hoàn chỉnh | 1 PASS | **100%** | ~3.8s |
| **E2E Penalties & Forfeits** | Python Web3 Integration | 4 kịch bản ngoại lệ | 4 PASS | **100%** | ~4.2s |
| **E2E Concurrency & Recovery** | Python Web3 Integration | 3 kịch bản concurrency | 3 PASS | **100%** | ~4.0s |
| **TỔNG CỘNG** | **Hệ thống liên kết** | **92 Ca kiểm thử** | **92 PASS** | **100%** | **~48.2s** |

---

## 2. CHI TIẾT CÁC PHÂN TẦNG KIỂM THỬ

### 2.1. Phân tầng Smart Contract (`EquipmentLending.sol`)
- **Bộ kiểm thử:** `contracts/test/EquipmentLending.test.cjs` (28 ca kiểm thử).
- **Các nhóm chức năng được xác thực:**
  1. **AccessControl & Roles:** Khởi tạo deployer nhận `DEFAULT_ADMIN_ROLE` và `ADMIN_ROLE`. Chặn mọi tài khoản không có quyền duyệt/bàn giao.
  2. **Vòng đời chuẩn (Happy Path):** `createLoan` $\to$ `approveLoan` $\to$ `confirmHandover` $\to$ `confirmReturn` (Phạt 0%, cọc hoàn trả `REFUNDED`).
  3. **Phạt quá hạn tự động:**
     - Trễ hạn $\le 24$ giờ: Phạt 10%, hoàn cọc 90%.
     - Trễ hạn $> 24$ giờ: Phạt 50%, hoàn cọc 50%.
  4. **Xử lý Hỏng / Mất thiết bị:**
     - Tình trạng DAMAGED (code 1): Phạt 100%, cọc chuyển `FORFEITED`, đơn chuyển `DISPUTED`.
     - Tình trạng LOST (code 2): Phạt 100%, cọc chuyển `FORFEITED`, đơn chuyển `DISPUTED`.
  5. **Mutex Khóa thiết bị (Anti-Double Borrowing):** Chặn hoàn toàn việc duyệt đơn thứ 2 khi đơn trước đó đang chiếm giữ `activeEquipmentLoan[equipmentId]`. Mutex được tự động giải phóng an toàn khi đơn trả xong hoặc bị hủy.

### 2.2. Phân tầng Backend API (`FastAPI + Pytest`)
- **Bộ kiểm thử:** `backend/tests/` (56 ca kiểm thử).
- **Module phủ sóng:**
  - `test_auth.py` (9 tests): Đăng nhập Email / Mã SV, kiểm tra mật khẩu bcrypt, phát hiện tài khoản vô hiệu hóa, sinh JWT HS256, bảo vệ chống brute-force.
  - `test_users.py` (8 tests): RBAC phân quyền Admin / Sinh viên, quản lý danh sách tài khoản, hồ sơ `/users/me`.
  - `test_equipment.py` (12 tests): CRUD thiết bị, lọc danh mục, tìm kiếm từ khóa, khóa dòng dữ liệu Pessimistic Lock (`SELECT FOR UPDATE`).
  - `test_loans.py` (13 tests): Toàn bộ vòng đời mượn trả, kiểm tra logic ngày nhận/trả, chặn trùng đơn mượn, hủy đơn.
  - `test_blockchain.py` (6 tests): Kiểm tra tính duy nhất & Idempotent của `generate_loan_id` (Keccak256), nạp ABI, kiểm tra tính chịu lỗi khi node RPC offline.
  - `test_audit.py` (5 tests): Đối soát tính toàn vẹn độc lập (`/audit/loans/{id}/verify`), lịch sử giao dịch blockchain, nhật ký thao tác `audit_logs`.
  - `test_health.py` (3 tests): Healthcheck CSDL MySQL và hệ thống lõi.

### 2.3. Phân tầng Kiểm thử Tích hợp E2E
- **Happy Path (`scripts/test_e2e_happy_path.py`):**
  - Mô phỏng thực tế: Sinh viên `SV2026001` tạo đơn $\to$ Admin duyệt $\to$ Bàn giao $\to$ Nghiệm thu trả đúng hạn.
  - Kết quả: Mutex giải phóng, cọc chuyển `REFUNDED`, Smart Contract và MySQL đồng bộ 100%.
- **Penalties & Forfeits (`scripts/test_e2e_penalties.py`):**
  - Kịch bản A (Trễ $\le 24$h): Phạt 10% tiền cọc, cọc hoàn trả 90%.
  - Kịch bản B (Trễ $> 24$h): Phạt 50% tiền cọc, cọc hoàn trả 50%.
  - Kịch bản C (DAMAGED): Tịch thu 100% cọc (`FORFEITED`), đơn chuyển `DISPUTED`.
  - Kịch bản D (LOST): Tịch thu 100% cọc (`FORFEITED`), đơn chuyển `DISPUTED`.
- **Concurrency & Crash Recovery (`scripts/test_e2e_concurrency_recovery.py`):**
  - Hai sinh viên cùng gửi đơn mượn cho 1 thiết bị duy nhất: Đơn đầu tiên được duyệt chiếm giữ Mutex, đơn thứ 2 bị từ chối với HTTP 409 Conflict.
  - Hủy đơn đã duyệt: Thiết bị trở lại `AVAILABLE`, Mutex on-chain giải phóng về `0x0`.
  - Đối soát khôi phục: Kích hoạt `/audit/reconcile` quét toàn bộ dữ liệu, tự sửa lệch nếu có.

---

## 3. BÁO CÁO RÀ SOÁT AN NINH BẢO MẬT (SECURITY AUDIT)

Kịch bản rà soát an ninh tự động được thực hiện qua công cụ `scripts/audit_security.py`:

```
======================================================================
          EDUVAULT - SECURITY AUDIT & ACCESS CONTROL CHECK           
======================================================================

[1/4] KIỂM TRA CHỐNG LỘ KHÓA BÍ MẬT & PRIVATE KEYS...
 [+] Đã quét an toàn 59 file source code: Không phát hiện Private Key thật nào bị hardcode.

[2/4] KIỂM TRA PHÂN QUYỀN JWT (RBAC AUTHORIZATION)...
 [+] Chặn thành công sinh viên truy cập /audit/logs (HTTP 403)
 [+] Chặn thành công sinh viên gọi /audit/reconcile (HTTP 403)
 [+] Chặn thành công sinh viên truy cập /admin/users (HTTP 403)

[3/4] KIỂM TRA BẢO VỆ CHỐNG TẤN CÔNG BRUTE-FORCE...
  -> Lần 1: Thất bại đúng như mong đợi (HTTP 401)
  -> Lần 2: Thất bại đúng như mong đợi (HTTP 401)
  -> Lần 3: Thất bại đúng như mong đợi (HTTP 401)
  -> Lần 4: Thất bại đúng như mong đợi (HTTP 401)
  -> Lần 5: Kích hoạt khóa tài khoản tạm thời 15 phút (HTTP 423 Locked)!
 [+] Cơ chế chống Brute-force hoạt động hoàn hảo: Đăng nhập đúng vẫn bị từ chối với HTTP 423 trong thời gian khóa!

[4/4] KIỂM TRA PHÂN QUYỀN ON-CHAIN TRÊN SMART CONTRACT...
 [+] Deployer sở hữu ADMIN_ROLE hợp lệ
 [+] Tài khoản sinh viên không có ADMIN_ROLE (Bảo vệ On-chain)

======================================================================
 [+] KẾT QUẢ RÀ SOÁT AN NINH BẢO MẬT: TOÀN BỘ 4 HẠNG MỤC ĐẠT 100%!
======================================================================
```

### 3.1. Chống rò rỉ khóa bí mật (Secret Management)
- File cấu hình môi trường `.env` được đưa vào `.gitignore`.
- Private key của Admin Relayer chỉ được nạp qua biến môi trường `ADMIN_RELAYER_PRIVATE_KEY`.
- Quét biểu thức chính quy (Regex Scan) qua toàn bộ 59 file mã nguồn (`.py`, `.ts`, `.tsx`, `.sol`), không tồn tại khóa bí mật hoặc API key nhạy cảm nào bị đưa vào Git repo.

### 3.2. Phân quyền và kiểm soát truy cập (RBAC)
- Xác thực sử dụng JSON Web Token (JWT) thuật toán HS256 với thời gian sống 30 phút.
- Phân quyền chặt chẽ thông qua FastAPI Dependency Injection: `Depends(require_role([UserRole.ADMIN]))`.
- Sinh viên gọi API quản trị (/audit/logs, /audit/reconcile, /admin/users) lập tức bị chặn với mã lỗi HTTP 403 Forbidden.

### 3.3. Bảo vệ chống tấn công Brute-Force
- Bảng `users` trang bị 2 cột kiểm soát an ninh: `failed_login_count` và `locked_until`.
- Sau 5 lần nhập sai mật khẩu liên tiếp, tài khoản tự động bị khóa trong 15 phút (`HTTP 423 Locked`).
- Kẻ tấn công cố tình nhập đúng mật khẩu trong thời gian bị khóa vẫn bị từ chối truy cập. Khi đăng nhập thành công sau thời gian khóa, hệ thống tự động reset số lần đếm về 0.

### 3.4. Bảo vệ Smart Contract & Chống Reentrancy
- Smart Contract kế thừa `AccessControl` tiêu chuẩn của OpenZeppelin.
- Phân định rõ ràng `ADMIN_ROLE` và `BORROWER_ROLE`.
- Các hàm nhạy cảm `approveLoan`, `confirmHandover`, `confirmReturn` đều có modifier `onlyRole(ADMIN_ROLE)` (hoặc `onlyAdmin`).
- Toàn bộ trạng thái nội bộ (`state`, `depositState`, `activeEquipmentLoan`) được cập nhật theo mẫu Checks-Effects-Interactions trước khi tương tác bên ngoài, triệt tiêu nguy cơ Reentrancy.

---

## 4. KẾT LUẬN & ĐỀ XUẤT NGHIỆM THU

Hệ thống **EduVault** đã hoàn thành toàn diện giai đoạn **Phase 7 (Tích hợp E2E & Kịch bản Nghiệp vụ)** và **Phase 8 (Kiểm thử QA & Rà soát Bảo mật)**:
1. Tất cả 92 ca kiểm thử tự động đều đạt kết quả 100% PASS.
2. Cơ chế khóa hai lớp (MySQL Pessimistic Lock kết hợp Smart Contract Mutex) hoạt động hoàn hảo, ngăn chặn triệt để tình trạng tranh chấp thiết bị.
3. Cơ chế tự động đối soát và khôi phục (Background Reconciliation) xử lý an toàn các trường hợp lệch dữ liệu khi có sự cố.
4. Hệ thống sẵn sàng chuyển sang **Phase 9 (Đóng gói Triển khai & Hướng dẫn Cài đặt)**.
