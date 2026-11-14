# EDUVAULT - BÁO CÁO TOÀN DIỆN KIỂM THỬ QA & RÀ SOÁT BẢO MẬT (PHASE 7A / PHASE 8)

> **Dự án:** EduVault - Hệ thống Quản lý Mượn trả Thiết bị Học tập Đào tạo trên EVM Blockchain  
> **Phiên bản:** v1.1.0-phase7a  
> **Thời điểm thẩm định:** 11/2026  
> **Trạng thái tổng thể:** **100% PASS (ĐẠT CHUẨN PHASE 7A)**

---

## 1. TỔNG QUAN KẾT QUẢ KIỂM THỬ TỰ ĐỘNG (QA MATRIX)

Toàn bộ hệ sinh thái kiểm thử của EduVault được thiết kế phân tầng từ cấp độ Smart Contract, Unit/Integration Test cho Backend đến Frontend Build và kịch bản E2E trực tiếp với Hardhat EVM.

| Phân tầng kiểm thử | Công cụ / Framework | Số lượng ca kiểm thử | Kết quả | Tỷ lệ thành công | Ghi chú / Thời gian |
| :--- | :--- | :---: | :---: | :---: | :--- |
| **Smart Contract Test Suite** | Hardhat (Chai / Ethers.js) | 28 tests | 28 PASS | **100%** | `npx hardhat test` (~1s) |
| **Backend API Test Suite** | Pytest / AnyIO / SQLite + Mock Contract | 65 tests | 65 PASS | **100%** | `python -m pytest` (~51s) |
| **Frontend Compile & Build** | TypeScript (`tsc`) + Vite | Typecheck + Build | PASS | **100%** | Exit code 0 |
| **E2E Happy Path Scenario** | Python Web3 + Live Hardhat EVM + MySQL | 1 kịch bản | 1 PASS | **100%** | `scripts/test_e2e_happy_path.py` |
| **E2E Penalties & Forfeits** | Python Web3 + Live Hardhat EVM + MySQL | 4 kịch bản ngoại lệ | 4 PASS | **100%** | `scripts/test_e2e_penalties.py` |
| **E2E Concurrency & Recovery** | Python Web3 + Live Hardhat EVM + MySQL | 3 kịch bản concurrency | 3 PASS | **100%** | `scripts/test_e2e_concurrency_recovery.py` |
| **E2E MetaMask EIP-191 & Offline Guard** | Multi-Account Hardhat #1 + FastAPI | 5 bước xác minh | 5 PASS | **100%** | Verify EIP-191, approve-only, replay `409`, offline `503` |

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
- **Bộ kiểm thử:** `backend/tests/` (**65 ca kiểm thử**).
- **Module phủ sóng:**
  - `test_auth.py` (9 tests): Đăng nhập Email / Mã SV, kiểm tra mật khẩu bcrypt, phát hiện tài khoản vô hiệu hóa, sinh JWT HS256, bảo vệ chống brute-force (`HTTP 423`).
  - `test_users.py` (9 tests): RBAC phân quyền Admin / Sinh viên, quản lý danh sách tài khoản, hồ sơ `/users/me`, và luồng xác minh ví EIP-191 challenge-response với one-time nonce (`/users/wallet/challenge`, `/users/wallet/verify`).
  - `test_equipment.py` (12 tests): CRUD thiết bị, lọc danh mục, tìm kiếm từ khóa, khóa dòng dữ liệu Pessimistic Lock (`SELECT FOR UPDATE`).
  - `test_loans.py` (18 tests): Vòng đời mượn trả hoàn chỉnh, logic ngày nhận/trả, fail-closed `HTTP 503` khi RPC offline, xử lý tx revert không làm tiến trạng thái DB (`FAILED` tx record), crash recovery `approve` khi chain đã `Approved`, xác minh biên lai MetaMask `createLoan` + `approve`-only + idempotent retry, chặn hạ phạt `0%` sai quy chế khi trả trễ.
  - `test_blockchain.py` (7 tests): Tính duy nhất & Idempotent của `generate_loan_id`, chuẩn hóa `normalize_hex_bytes32`, phân giải địa chỉ hợp đồng theo `CHAIN_ID`, nạp ABI, trạng thái `/blockchain/status`, kiểm tra an toàn khi node RPC offline.
  - `test_audit.py` (7 tests): Đối soát độc lập (`/audit/loans/{id}/verify`, `sync_status`), phát hiện lệch toàn phần (trạng thái, cọc, ví, thời gian, mutex), chặn ghi đè từ struct rỗng trên chain, fail-closed `503` khi reconcile offline, lịch sử `BlockchainTransaction` & `AuditLog`.
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
- Private key của Admin Relayer chỉ được nạp qua biến môi trường `ADMIN_PRIVATE_KEY`.
- Quét biểu thức chính quy (Regex Scan) qua toàn bộ mã nguồn (`.py`, `.ts`, `.tsx`, `.sol`), không tồn tại khóa bí mật sản xuất thật nào bị đưa vào Git repo.

### 3.2. Phân quyền và kiểm soát truy cập (RBAC)
- Xác thực sử dụng JSON Web Token (JWT) thuật toán HS256 với thời gian sống cấu hình qua `ACCESS_TOKEN_EXPIRE_MINUTES` (30 phút mặc định trong `config.py`, 1440 phút trong `.env` phát triển).
- Phân quyền chặt chẽ thông qua FastAPI Dependency Injection: `Depends(require_role([UserRole.ADMIN]))`.
- Sinh viên gọi API quản trị (/audit/logs, /audit/reconcile, /admin/users) lập tức bị chặn với mã lỗi HTTP 403 Forbidden.

### 3.3. Bảo vệ chống tấn công Brute-Force
- Bảng `users` trang bị 2 cột kiểm soát an ninh: `failed_login_count` và `locked_until`.
- Sau 5 lần nhập sai mật khẩu liên tiếp, tài khoản tự động bị khóa trong 15 phút (`HTTP 423 Locked`).
- Kẻ tấn công cố tình nhập đúng mật khẩu trong thời gian bị khóa vẫn bị từ chối truy cập. Khi đăng nhập thành công sau thời gian khóa, hệ thống tự động reset số lần đếm về 0.

### 3.4. Bảo vệ Smart Contract, Mô hình Ký quỹ & Ranh giới Tin cậy (Phase 7A vs Phase 13)
- Smart Contract kế thừa `AccessControl` tiêu chuẩn của OpenZeppelin.
- **Ký quỹ mô phỏng VND (không phải ETH escrow):** Hợp đồng lưu số nguyên `depositAmount` (VND) và vòng đời `depositState` (`Pending` $\to$ `Locked` $\to$ `Refunded`/`Forfeited`), không nhận hoặc giữ ETH, loại bỏ hoàn toàn Reentrancy.
- **Ràng buộc ví Sinh viên (EIP-191 One-Time Nonce) & Chống Replay Tx Hash:** Backend xác minh chữ ký `personal_sign` (`wallet_verified`), kiểm tra biên lai giao dịch thật trên EVM (`status == 1`, `chainId`, địa chỉ hợp đồng, người gửi, event `LoanCreated`), và chặn sử dụng lại `client_tx_hash` hoặc `on_chain_loan_id` giữa các người dùng (`HTTP 409`).
- **Thẩm quyền Admin & Phạm vi nâng cấp Phase 13:** Các hàm `approveLoan`, `confirmHandover`, `confirmReturn`, `cancelLoan` được bảo vệ bởi `onlyRole(ADMIN_ROLE)`; hợp đồng vẫn tin cậy nhận định của `ADMIN` về tình trạng vật lý thiết bị (`GOOD`/`DAMAGED`/`LOST`). Việc đăng ký `BORROWER_ROLE` on-chain cho từng ví sinh viên và loại bỏ hẳn tham số `manual_penalty_percent` khỏi `EquipmentLending.sol` được giữ tách biệt sang **Phase 13** (bảo toàn ABI ổn định trong Phase 7A).
- **Đối soát kích hoạt thủ công:** API `POST /api/v1/audit/reconcile` là tiến trình kích hoạt theo yêu cầu của Admin (không phải worker nền chạy cron tự động).
- **Dữ liệu `studentId` on-chain:** `LoanRecord` có lưu mã sinh viên nội bộ (`studentId`), trong khi PII nhạy cảm (họ tên, email, mật khẩu) được giữ 100% trong MySQL.

---

## 4. KẾT LUẬN & ĐỀ XUẤT NGHIỆM THU (PHASE 7A)

Hệ thống **EduVault** đã hoàn thành toàn diện giai đoạn **Phase 7A (Hoàn thiện tích hợp MetaMask & tính nhất quán dữ liệu)** trên nền kết quả Phase 7–8 trước đó:
1. Toàn bộ 28 tests Smart Contract + 65 tests Backend Pytest + Frontend `tsc`/`vite build` + kịch bản E2E trực tiếp trên Hardhat EVM đều đạt 100% PASS.
2. Cơ chế khóa hai lớp (MySQL Pessimistic Lock + Smart Contract Mutex), EIP-191 wallet verification, durable `PENDING`/`FAILED`/`CONFIRMED` transaction tracking và fail-closed RPC `HTTP 503` vận hành đồng bộ.
3. Cơ chế đối soát thủ công (`POST /api/v1/audit/reconcile` và `GET /api/v1/audit/loans/{id}/verify`) phát hiện chính xác sai lệch `NOT_ON_CHAIN` / `MISSING_ON_CHAIN` / `MISMATCH` và phục hồi an toàn từ Smart Contract mà không bao giờ ghi đè bằng bản ghi rỗng.
4. Sẵn sàng tiến sang bước nâng cấp Smart Contract (**Phase 13**) sau khi xác nhận nghiệm thu Phase 7A.

