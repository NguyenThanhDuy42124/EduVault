# Progress Log: EduVault - Educational Equipment Lending System

## Session: 2026-10-23

### Phase 0: Khảo sát Môi trường & Hiện trạng
- **Status:** complete
- **Started:** 2026-10-23 15:23:40
- **Completed:** 2026-10-23 15:25:00
- **Actions taken:**
  - Khảo sát thư mục gốc và các công cụ: Node.js `v24.15.0`, npm `11.15.0`, Python `3.13.13` (via `py -3.13`), pip `26.0.1`, Git `2.54.0`.
  - Xác nhận yêu cầu sử dụng **MySQL** làm CSDL quan hệ chính.

---

### Phase 1: Phạm vi & Yêu cầu Nghiệp vụ
- **Status:** complete
- **Started:** 2026-10-23 15:25:00
- **Completed:** 2026-10-23 15:27:00
- **Actions taken:**
  - Xác lập phạm vi MVP: mượn 1 thiết bị/lần, 2 vai trò ADMIN và BORROWER, chạy EVM cục bộ.
  - Phân chia rõ ràng ranh giới On-chain vs Off-chain để bảo vệ dữ liệu PII sinh viên.

---

### Phase 2: Thiết kế Kiến trúc & Đặc tả Kỹ thuật
- **Status:** complete
- **Started:** 2026-10-23 15:28:30
- **Completed:** 2026-10-23 15:32:00
- **Actions taken:**
  - Gom toàn bộ đặc tả kiến trúc vào `findings.md` theo yêu cầu của người dùng, không tạo file lẻ tẻ.
  - Quyết định dùng **Simulated Deposit Accounting** trong Smart Contract: loại bỏ hoàn toàn rủi ro Reentrancy và lỗi kẹt tiền test ETH, đơn giản hóa và tăng độ tin cậy cho đồ án.
  - Làm rõ **Nguồn dữ liệu chuẩn (Source of Truth)** giữa MySQL và Smart Contract.
  - Định nghĩa mô hình **Web2.5 Custodial Relayer / Admin Signer**: FastAPI backend ký giao dịch on-chain, sinh viên dùng JWT không cần MetaMask.
  - Quy định rõ ràng quy tắc phạt trễ (10%, 50%), hỏng/mất (100% forfeit cọc) và điều kiện suy luận của `OVERDUE`.
  - Thiết kế cơ chế khóa dòng MySQL Pessimistic Lock (`SELECT ... FOR UPDATE`) để chống đặt trùng thiết bị.
  - Thiết kế cơ chế Dual-write idempotency và Background Reconciliation Worker tự phục hồi khi crash.
  - Cập nhật đồng bộ toàn bộ trạng thái trong `findings.md`, `task_plan.md` và `progress.md`.
- **Files created/modified:**
  - `findings.md` (cập nhật đầy đủ 10 mục kiến trúc & thiết kế)
  - `task_plan.md` (đồng bộ trạng thái Phase 2 hoàn thành)
  - `progress.md` (cập nhật nhật ký)

---

### Phase 3: Thiết lập Cấu trúc Thư mục & Môi trường Dự án
- **Status:** complete
- **Started:** 2026-10-23 15:45:00
- **Completed:** 2026-10-23 15:56:00
- **Actions taken:**
  - Khởi tạo khung thư mục monorepo: `backend/app/` (api, core, db, models, schemas, services), `contracts/` (contracts, test, scripts), `frontend/` (React+TS+Vite), `scripts/`, `docs/`.
  - Cấu hình `.gitignore` và `.env.example` an toàn, không chứa thông tin nhạy cảm.
  - Cấu hình Hardhat với Solidity `^0.8.24` và khung contract `EquipmentLending.sol` (Simulated Deposit Accounting). Viết test và chạy `npx hardhat test` thành công (2/2 passing).
  - Thiết lập môi trường ảo Python 3.13 (`backend/.venv`), cài đặt FastAPI, SQLAlchemy 2.0, PyMySQL, Alembic, Web3.py.
  - Giải quyết lỗi tương thích Windows wheel của `web3.py` trên Python 3.13 bằng cách ghim `eth-account<0.11.0`, `eth-typing<5.0.0` và `eth-utils<5.0.0`.
  - Khởi tạo Alembic baseline trong `backend/alembic/`.
  - Viết và chạy thành công bộ test khởi động và health check của backend: `pytest backend/tests/test_health.py` (3/3 passing).
  - Khởi tạo Frontend React 18 + TypeScript + Vite, tích hợp `lucide-react`, `tailwindcss`, `clsx`, `tailwind-merge` và Axios service. Chạy `npm run build` thành công.
  - Tích hợp thông tin xác thực MySQL của người dùng (`root` / `123456`), tạo database `equipment_lending_db` (UTF8MB4). Chạy script `test_db_connection.py` thành công 100%.

---

### Phase 4: Triển khai Smart Contract & EVM Testing
- **Status:** complete
- **Started:** 2026-10-27 13:24:00
- **Completed:** 2026-10-27 13:31:00
- **Actions taken:**
  - **Task 4.1**: Hoàn thiện Smart Contract `EquipmentLending.sol`:
    - Tổ chức code theo sections rõ ràng: ENUMS → STRUCTS → STATE VARIABLES → EVENTS → CONSTRUCTOR → VIEW FUNCTIONS → LIFECYCLE FUNCTIONS.
    - NatSpec comments đầy đủ bằng Tiếng Việt, giải thích từng hàm, từng tham số.
    - Logic nghiệp vụ đầy đủ: 6 LoanState, 4 DepositState, 5 lifecycle functions, 2 view functions.
    - Simulated Deposit Accounting (không giữ ETH thật), Mutex `activeEquipmentLoan`, phạt tự động (10%/50%/100%).
    - Biên dịch thành công: `Compiled 3 Solidity files successfully (evm target: paris)`.
  - **Task 4.2**: Xây dựng Hardhat test suite toàn diện:
    - **28 test cases** bao phủ 10 nhóm kiểm thử:
      1. Deployment & Ownership (2 tests)
      2. Luồng chuẩn trả đúng hạn - 0% penalty (1 test)
      3. Quy tắc phạt quá hạn - 10% và 50% (2 tests)
      4. Hỏng/Mất → tịch thu 100% cọc (2 tests)
      5. Hủy đơn mượn - Submitted/Approved/Active/Returned (4 tests)
      6. Mutex chống đặt trùng thiết bị (3 tests)
      7. Kiểm tra trùng Loan ID (1 test)
      8. Chuyển trạng thái không hợp lệ - Revert cases (6 tests)
      9. View Functions - getLoan/isOverdue/calculatePenalty (4 tests)
      10. Edge cases - deposit=0, multi-equipment, manual penalty (3 tests)
    - Sử dụng helper functions (`createDefaultLoan`, `advanceToActive`) giảm code lặp.
    - Kết quả: **28 passing (893ms)** ✅
  - **Task 4.3**: Viết script deploy `contracts/scripts/deploy.cjs`:
    - Deploy contract lên Hardhat node (in-process hoặc localhost).
    - Tự động lưu deployment info vào `contracts/deployments/localhost.json`.
    - Tự động export ABI và contract address sang backend.
    - Kết quả deploy thành công: Contract `0x5FbDB2315678afecb367f032d93F642f64180aa3`.
  - **Task 4.4**: Export ABI và Contract Address sang backend:
    - `backend/app/core/contracts/EquipmentLending.json` (ABI + address).
    - `backend/app/core/contracts/contract_address.json` (address + network info).
    - `backend/app/core/contracts/__init__.py` (Python module init).
- **Files created/modified:**
  - `contracts/contracts/EquipmentLending.sol` (hoàn thiện, comments đầy đủ)
  - `contracts/test/EquipmentLending.test.cjs` (28 test cases toàn diện)
  - `contracts/scripts/deploy.cjs` (deploy + export script)
  - `contracts/deployments/localhost.json` (deployment record)
  - `backend/app/core/contracts/EquipmentLending.json` (ABI export)
  - `backend/app/core/contracts/contract_address.json` (address export)
  - `backend/app/core/contracts/__init__.py` (module init)

---

### Phase 5: Triển khai Backend (FastAPI + MySQL + Web3.py)
- **Status:** complete
- **Started:** 2026-10-27 21:05:00
- **Completed:** 2026-10-27 22:25:00
- **Summary:** Đã triển khai hoàn tất 10/10 tasks của Phase 5. CSDL MySQL 5 bảng + Alembic migration, Auth bcrypt/JWT chống brute-force, MySQL Pessimistic Lock chống mượn trùng thiết bị, Web3 Custodial Relayer, 6 API vòng đời mượn trả, reconciliation worker, seed data mẫu, 56/56 unit tests pass 100%. Báo cáo kỹ thuật chi tiết tại docs/PHASE_5_REPORT.md.


---

### Bổ sung thiết kế: Toàn diện Hóa Bản Kế hoạch & Kiến trúc Dự án (Full Blueprint Finalization)
- **Status:** complete
- **Session:** 2026-10-23
- **Actions taken:**
  - Hoàn tất 100% tài liệu thiết kế và thuật toán chi tiết trong `findings.md`, không để sót bất kỳ vùng xám nào trước khi triển khai:
    - **Mục 11**: Thiết kế Xác thực & Phân quyền (Auth & RBAC), băm mật khẩu `bcrypt`, JWT HS256, chống brute-force (khóa 15 phút sau 5 lần sai), seed data mẫu, 3 endpoint bổ sung (`POST /admin/users`, `GET /admin/users`, `GET /users/me`).
    - **Mục 12**: Chi tiết 5 thuật toán vòng đời mượn trả (`Request`, `Approve`, `Handover`, `Return`, `Cancel`) với đầy đủ điều kiện kiểm tra, khóa dòng MySQL `FOR UPDATE` và tương tác Smart Contract.
    - **Mục 13**: Thuật toán Worker tự đối soát và tự phục hồi (Background Reconciliation Worker) giải quyết dứt điểm bài toán Dual-Write lệch dữ liệu giữa MySQL và Blockchain.
    - **Mục 14**: Thiết kế chi tiết UX/UI Frontend (hệ thống màu Slate/Indigo/Emerald/Rose, icon `lucide-react`, bản đồ màn hình từ `/login`, `/equipment`, `/my-loans`, `/admin/loans`, `/admin/inventory` tới `/audit`).
    - **Mục 15**: Kịch bản bảo vệ đồ án (Kịch bản demo 5 bước 5-7 phút trước hội đồng & Bộ câu hỏi phản biện kỹ thuật chuẩn).
  - Chi tiết hóa toàn bộ danh mục nhiệm vụ từ Phase 4 đến Phase 11 trong `task_plan.md` với các tiêu chí nghiệm thu rõ ràng.
- **Files modified:**
  - `findings.md` (bổ sung đầy đủ Mục 11, 12, 13, 14, 15)
  - `task_plan.md` (làm mịn chi tiết các task từ Phase 4 đến Phase 11)
  - `progress.md` (cập nhật nhật ký tiến độ)

---

## Bảng Kết quả Kiểm thử Thực tế (Phase 4 Verification Matrix)

| Hạng mục kiểm thử | Lệnh thực thi thực tế | Kết quả mong đợi | Kết quả thực tế | Trạng thái |
| :--- | :--- | :--- | :--- | :--- |
| **Smart Contract Compile** | `npx hardhat compile` | Biên dịch 0.8.24 thành công | Compiled 3 Solidity files successfully (evm target: paris) | **PASS** |
| **Smart Contract Test Suite** | `npx hardhat test` | 28 tests pass, bao phủ toàn bộ lifecycle | 28 passing (893ms) | **PASS** |
| **Deploy Script** | `npx hardhat run scripts/deploy.cjs` | Deploy thành công, lưu address + ABI | Contract deployed at: `0x5FbDB2315678afecb367f032d93F642f64180aa3` | **PASS** |
| **ABI Export to Backend** | Kiểm tra file tồn tại | `EquipmentLending.json` + `contract_address.json` trong `backend/app/core/contracts/` | Cả 2 file tạo thành công (13.3KB + 160B) | **PASS** |

---

## Session: 2026-10-27 (Phase 5 - Backend Kickoff & Complete Implementation)

### Chặng 1: ORM & Migration (Task 5.1 & Task 5.2)
- **Status:** complete
- **Started:** 2026-10-27 21:05:00
- **Completed:** 2026-10-27 21:12:00
- **Actions taken:**
  - Khắc phục lỗi đường dẫn XAMPP chuyển vùng `D:\App_hoc_tap\Ampp`, sửa `my.ini` và `data/my.ini`, hỗ trợ người dùng khởi động MySQL & Apache thành công.
  - Tạo môi trường ảo `.venv` với `virtualenv` cho Python 3.11, cài đặt toàn bộ `requirements.txt`.
  - Cấu hình file `.env` kết nối MySQL `equipment_lending_db` qua `pymysql`.
  - Chạy script chẩn đoán `scripts/test_db_connection.py` xác nhận kết nối thành công 100%.
  - Triển khai đầy đủ 5 SQLAlchemy 2.0 declarative models trong `backend/app/models/`:
    + `User` (`users`): `student_staff_id`, `password_hash`, `role`, `failed_login_count`, `locked_until`.
    + `Equipment` (`equipment`): `serial_number`, `status`, `deposit_amount`.
    + `LendingRequest` (`lending_requests`): `status`, `deposit_status`, `on_chain_loan_id`, `due_date`.
    + `BlockchainTransaction` (`blockchain_transactions`): `tx_hash`, `action_type`, `block_number`, `gas_used`, `status`.
    + `AuditLog` (`audit_logs`): `action`, `entity_name`, `entity_id`, `details_json`.
  - Cấu hình `backend/alembic/env.py` kết nối metadata và sinh migration file `8bd1d029877b_initial_schema_5_tables.py`.
  - Áp dụng migration vào MySQL bằng `alembic upgrade head`, xác nhận 5 bảng + `alembic_version` đã được tạo thành công trên MySQL.
  - Thêm cấu hình `pytest.ini` loại trừ quét `node_modules` và chạy pass 3/3 health check tests trong 1.95s.
- **Files created/modified:**
  - `.env` & `backend/.env`
  - `backend/app/models/user.py`
  - `backend/app/models/equipment.py`
  - `backend/app/models/lending_request.py`
  - `backend/app/models/blockchain_tx.py`
  - `backend/app/models/audit_log.py`
  - `backend/app/models/__init__.py`
  - `backend/alembic/env.py`
  - `backend/alembic/versions/8bd1d029877b_initial_schema_5_tables.py`
  - `pytest.ini`

### Chặng 2: Authentication & User Management (Task 5.3 & Task 5.4)
- **Status:** complete
- **Started:** 2026-10-27 21:22:00
- **Completed:** 2026-10-27 21:28:00
- **Tuân thủ quy chuẩn:** Toàn bộ code tuân thủ nghiêm ngặt theo `QUY_DINH_CODE.md` (chuẩn đặt tên, hàm đơn nhiệm, docstring 5 thành phần: Mục đích / Tham số / Trả về / Lỗi / Tác dụng phụ, phân tầng rõ ràng).
- **Actions taken:**
  - Triển khai `backend/app/core/security.py`: thuật toán băm `bcrypt` an toàn trực tiếp, ký/giải mã JWT token HS256 (`python-jose`), hằng số hệ thống `MAX_FAILED_LOGIN_ATTEMPTS=5`, `ACCOUNT_LOCKOUT_MINUTES=15`.
  - Triển khai Pydantic Schemas (`backend/app/schemas/`): `Token`, `TokenPayload`, `UserBase`, `UserCreate`, `UserLoginRequest`, `UserResponse`.
  - Triển khai User Service (`backend/app/services/user_service.py`): CRUD người dùng, kiểm tra chống trùng lặp `email` và `student_staff_id`.
  - Triển khai Auth Service (`backend/app/services/auth_service.py`): nghiệp vụ đăng nhập cho phép đăng nhập bằng cả Email hoặc Mã sinh viên/cán bộ; tự động đếm số lần sai và tạm khóa tài khoản 15 phút sau 5 lần sai liên tiếp; reset bộ đếm khi đăng nhập đúng.
  - Triển khai Dependency Injection (`backend/app/api/deps.py`): `get_current_user` trích xuất và xác thực Bearer token, `require_role(allowed_roles)` kiểm soát phân quyền RBAC.
  - Triển khai API Routers:
    + `POST /api/v1/auth/login`: Nhận JSON `UserLoginRequest` cho client Web.
    + `POST /api/v1/auth/token`: Nhận OAuth2 Form cho Swagger UI Authorize.
    + `GET /api/v1/users/me`: Trả về thông tin người dùng đang đăng nhập.
    + `POST /api/v1/admin/users`: Quyền ADMIN tạo người dùng mới.
    + `GET /api/v1/admin/users`: Quyền ADMIN xem danh sách người dùng có bộ lọc role và phân trang.
  - Tích hợp 2 router vào `backend/app/main.py`.
  - Xây dựng 2 test suites toàn diện (`test_auth.py`, `test_users.py`) cùng `conftest.py` in-memory test database.
  - Chạy `pytest backend/tests -v`: **20/20 tests passed** (9.59s).
- **Files created/modified:**
  - `backend/app/core/security.py`
  - `backend/app/schemas/token.py`
  - `backend/app/schemas/user.py`
  - `backend/app/schemas/__init__.py`
  - `backend/app/services/user_service.py`
  - `backend/app/services/auth_service.py`
  - `backend/app/api/deps.py`
  - `backend/app/api/v1/auth.py`
  - `backend/app/api/v1/users.py`
  - `backend/requirements.txt`
  - `backend/tests/conftest.py`
  - `backend/tests/test_auth.py`
  - `backend/tests/test_users.py`

### Chặng 3: Equipment CRUD, Pessimistic Lock & Web3 Service (Task 5.5 & Task 5.6)
- **Status:** complete
- **Started:** 2026-10-27 21:52:00
- **Completed:** 2026-10-27 21:58:00
- **Tuân thủ quy chuẩn:** Toàn bộ code tuân thủ nghiêm ngặt theo `QUY_DINH_CODE.md` (hàm đơn nhiệm, docstring 5 thành phần đầy đủ, phân tầng Model/Schema/Service/Controller, xử lý ngoại lệ chuẩn).
- **Actions taken:**
  - Triển khai Schemas Thiết bị (`backend/app/schemas/equipment.py`): `EquipmentBase`, `EquipmentCreate`, `EquipmentUpdate`, `EquipmentResponse`.
  - Triển khai Equipment Service (`backend/app/services/equipment_service.py`):
    + `get_equipment_list`: Lọc theo danh mục, trạng thái và tìm kiếm mờ tên/serial.
    + `create_equipment`: Thêm thiết bị mới, chặn trùng serial (`409 Conflict`).
    + `update_equipment`: Sửa thông số, đổi tiền cọc.
    + `delete_equipment`: Thu hồi chuyển `RETIRED` an toàn (bảo tồn audit log, chặn thu hồi khi đang `IN_USE`).
    + `get_equipment_for_update`: Áp dụng MySQL Pessimistic Lock (`SELECT ... FOR UPDATE`), chặn xung đột khi thiết bị không ở trạng thái `AVAILABLE`.
  - Triển khai Router Thiết bị (`backend/app/api/v1/equipment.py`):
    + `GET /api/v1/equipment`: Công khai danh mục thiết bị có lọc/phân trang.
    + `GET /api/v1/equipment/{id}`: Chi tiết thiết bị.
    + `POST /api/v1/equipment`: Quyền ADMIN tạo thiết bị mới.
    + `PUT /api/v1/equipment/{id}`: Quyền ADMIN cập nhật.
    + `DELETE /api/v1/equipment/{id}`: Quyền ADMIN thu hồi thiết bị.
  - Triển khai Web3.py Blockchain Service (`backend/app/services/blockchain_service.py`):
    + Tự động nạp ABI và Contract Address từ artifacts đã xuất ở Phase 4.
    + Thuật toán sinh `loan_id` duy nhất chuẩn Keccak256 (`bytes32` và chuỗi hex `0x...` 66 ký tự).
    + Cơ chế Custodial Relayer: ước tính gas có buffer an toàn 20%, nạp nonce pending, ký cục bộ với `ADMIN_PRIVATE_KEY`, phát sóng raw transaction và đợi biên lai `wait_for_transaction_receipt`.
    + Đọc trạng thái bất biến từ Smart Contract: `get_loan`, `is_overdue`, `calculate_penalty`, `get_active_equipment_loan`.
    + Các hàm bọc tương tác lifecycle Smart Contract (`create_loan`, `approve_loan`, `confirm_handover`, `confirm_return`, `cancel_loan`).
  - Triển khai API chẩn đoán mạng Blockchain (`backend/app/api/v1/blockchain.py`): `GET /api/v1/blockchain/status`.
  - Đăng ký `equipment_router` và `blockchain_router` vào `backend/app/main.py`.
  - Viết bộ kiểm thử toàn diện `backend/tests/test_equipment.py` (12 tests) và `backend/tests/test_blockchain.py` (6 tests).
  - Chạy `pytest backend/tests -v`: **38/38 tests passed** (23.43s).
- **Files created/modified:**
  - `backend/app/schemas/equipment.py`
  - `backend/app/services/equipment_service.py`
  - `backend/app/services/blockchain_service.py`
  - `backend/app/api/v1/equipment.py`
  - `backend/app/api/v1/blockchain.py`
  - `backend/tests/test_equipment.py`
  - `backend/tests/test_blockchain.py`

### Chặng 4: Vòng đời Mượn Trả, Đối Soát & Tự Phục Hồi Dual-Write (Task 5.7 & Task 5.8)
- **Status:** complete
- **Started:** 2026-10-27 21:59:00
- **Completed:** 2026-10-27 22:10:00
- **Tuân thủ quy chuẩn:** Toàn bộ code tuân thủ nghiêm ngặt theo `QUY_DINH_CODE.md` (hàm đơn nhiệm, docstring 5 thành phần đầy đủ, phân tầng sạch sẽ, bắt lỗi chặt chẽ, kiểm thử tự động toàn diện).
- **Actions taken:**
  - Triển khai Pydantic Schemas Vòng đời & Kiểm toán (`backend/app/schemas/loan.py` & `backend/app/schemas/audit.py`): `LoanCreateRequest`, `LoanReturnRequest`, `LoanCancelRequest`, `LoanResponse` (kèm cờ suy luận `is_overdue`), `BlockchainTxResponse`, `AuditLogResponse`, `LoanVerificationResponse`, `ReconcileResultResponse`.
  - Triển khai Loan Service (`backend/app/services/loan_service.py`):
    + `create_loan_request`: Sinh viên gửi yêu cầu mượn, kiểm tra ngày hợp lệ, kiểm tra thiết bị `AVAILABLE`, chặn mượn trùng lặp.
    + `approve_loan_request`: Admin duyệt đơn, áp dụng Pessimistic Lock MySQL (`SELECT ... FOR UPDATE`), chuyển thiết bị sang `RESERVED`, sinh mã `on_chain_loan_id` Keccak256 và phát sóng giao dịch on-chain (`createLoan` + `approveLoan` khóa Mutex).
    + `reject_loan_request`: Admin từ chối đơn mượn (chuyển sang `REJECTED`).
    + `handover_loan_equipment`: Admin bàn giao thiết bị thực tế, chuyển `IN_USE`, đơn sang `ACTIVE`, gọi `confirmHandover` khóa tiền cọc mô phỏng on-chain.
    + `return_loan_equipment`: Admin nhận lại máy, tự động tính phạt (0%, 10%, 50%, 100%), cập nhật `deposit_status` (`REFUNDED` / `FORFEITED`), chuyển trạng thái đơn (`RETURNED` / `DISPUTED`), giải phóng thiết bị và gọi `confirmReturn` mở khóa Mutex on-chain.
    + `cancel_loan_request`: Sinh viên hoặc Admin hủy đơn mượn khi chưa nhận máy (`PENDING` hoặc `APPROVED`), tự động giải phóng thiết bị về `AVAILABLE` và gọi `cancelLoan` trên Smart Contract.
  - Triển khai Reconciliation Service (`backend/app/services/reconciliation_service.py`):
    + `verify_loan_integrity`: So sánh độc lập từng trường giữa MySQL và Smart Contract (State code, Equipment ID, Mutex lock, Deposit amount), phát hiện các điểm sai lệch dữ liệu.
    + `reconcile_database_with_blockchain`: Background Worker tự động sửa lệch dữ liệu (Idempotent Crash Recovery) khi server bị tắt đột ngột, cập nhật MySQL theo sự thật on-chain mà không tạo giao dịch trùng lặp.
  - Triển khai API Routers:
    + `backend/app/api/v1/loans.py`: `POST /loans/request`, `GET /loans`, `GET /loans/{id}`, `POST /loans/{id}/approve`, `POST /loans/{id}/reject`, `POST /loans/{id}/handover`, `POST /loans/{id}/return`, `POST /loans/{id}/cancel`.
    + `backend/app/api/v1/audit.py`: `GET /audit/loans/{id}/verify`, `POST /audit/reconcile`, `GET /audit/transactions`, `GET /audit/logs`.
  - Đăng ký các router mới vào `backend/app/main.py`.
  - Bổ sung bộ kiểm thử `backend/tests/test_loans.py` (14 test cases) và `backend/tests/test_audit.py` (5 test cases).
  - Chạy `pytest backend/tests -v`: **56/56 tests passed** (100% pass).
- **Files created/modified:**
  - `backend/app/schemas/loan.py`
  - `backend/app/schemas/audit.py`
  - `backend/app/services/loan_service.py`
  - `backend/app/services/reconciliation_service.py`
  - `backend/app/api/v1/loans.py`
  - `backend/app/api/v1/audit.py`
  - `backend/tests/test_loans.py`
  - `backend/tests/test_audit.py`

### Chặng 5: Khởi Tạo Dữ Liệu Mẫu & Nghiệm Thu Toàn Diện (Task 5.9 & Task 5.10)
- **Status:** complete
- **Started:** 2026-10-27 22:12:00
- **Completed:** 2026-10-27 22:25:00
- **Actions taken:**
  - Viết và thực thi script khởi tạo dữ liệu mẫu thực tế `scripts/seed.py`:
    + 1 Tài khoản Quản trị viên (`ADMIN001`, `admin@eduvault.edu.vn` / `admin123456`, ví Hardhat #0).
    + 3 Tài khoản Sinh viên (`SV2026001`, `SV2026002`, `SV2026003`, `student123`, ví Hardhat #1-#3).
    + 8 Thiết bị học tập với tiền cọc đa dạng (MacBook Pro, Dell XPS, iPad Pro, Máy chiếu, Máy đo xung, Kính hiển vi, Kit STM32, Kit Arduino).
    + 1 Đơn mượn mẫu kèm Audit Log.
    + Đã xác thực thành công dữ liệu lưu trực tiếp vào MySQL `equipment_lending_db` qua phpMyAdmin.
  - Chạy toàn bộ 7 test suites Pytest (Task 5.10): **56/56 passed (100% PASS)** trong 68.84s.
  - Biên soạn file báo cáo nghiệm thu kỹ thuật chi tiết `docs/PHASE_5_REPORT.md` trình bày toàn bộ 10 nhiệm vụ đã hoàn thành, kiến trúc phân tầng, bảng ma trận test, và hướng dẫn vận hành/demo.
- **Files created/modified:**
  - `scripts/seed.py`
  - `docs/PHASE_5_REPORT.md`
  - `progress.md`
  - `task_plan.md`

---

## 5-Question Reboot Check (Post Phase 5)

| Câu hỏi | Câu trả lời |
| :--- | :--- |
| **Đang ở đâu?** | Đã hoàn thành 100% Phase 5: Triển khai Backend (FastAPI + MySQL + Web3.py). CSDL 5 bảng hoạt động, seed data sẵn sàng, 56/56 test pass, tài liệu nghiệm thu `docs/PHASE_5_REPORT.md` đã xuất bản. |
| **Sắp đi đâu?** | Phase 6: Triển khai Giao diện Người dùng Frontend (React 18 + Vite + Tailwind CSS + Lucide Icons). |
| **Mục tiêu là gì?** | Hệ thống mượn trả thiết bị học tập EduVault hoàn chỉnh kết hợp Web2.5 (FastAPI + MySQL + Hardhat Smart Contract + React UI). |
| **Đã học được gì?** | Cần khởi động Apache cùng MySQL trên XAMPP để truy cập phpMyAdmin; Bcrypt trực tiếp ổn định hơn Passlib trên Python 3.11/3.13; Pytest cần cấu hình `pytest.ini` chặn quét `node_modules`. |
| **Đã làm được gì?** | Hoàn tất Phase 0, 1, 2, 3, 4, 5. Backend có đủ 7 routers, xác thực Bcrypt/JWT, chống brute-force, MySQL Pessimistic Lock, Custodial Relayer Web3.py, 6 APIs vòng đời mượn trả, reconciliation worker và seed data. |


---

## Session: 2026-10-28 (Trải Nghiệm Thực Tế, Negative Testing & Chuẩn Bị Phase 6)

### Hạng mục thực hiện:
- **Khởi chạy máy chủ Backend thực tế:**
  - Hướng dẫn cấu hình PowerShell ExecutionPolicy (RemoteSigned) và sửa lỗi thư mục làm việc để chạy uvicorn backend.app.main:app --reload.
  - Kết nối thành công với MySQL trên XAMPP (Port 3306) và phục vụ tài liệu tương tác tại Swagger UI (http://127.0.0.1:8000/docs).
- **Thử nghiệm tương tác & Negative Testing (Kiểm thử lỗi):**
  - Xác nhận chức năng GET /health/db kết nối MySQL thành công.
  - Hướng dẫn quy trình đăng nhập Authorize (Admin / Sinh viên).
  - Kiểm thử 6 kịch bản bắt lỗi: Chống Brute-force khóa 15 phút sau 5 lần sai, phân quyền RBAC 403 Forbidden khi sinh viên gọi API Admin, kiểm tra logic mốc thời gian mượn/trả (400 Bad Request), chặn mượn trùng thiết bị (409 Conflict), chặn đăng ký trùng email/mã số.
- **Rà soát chất lượng & Kiểm thử toàn diện:**
  - Chạy lại bộ kiểm thử tự động 7 test suites: **56/56 unit tests passed 100%** (67.15s).
  - Xác nhận 100% code tuân thủ QUY_DINH_CODE.md (docstring 5 phần, phân tầng sạch sẽ, bảo mật không hard-code).
- **Quy trình chia sẻ CSDL (Team Collaboration):**
  - Tài liệu hóa quy trình cho đồng đội khi pull/clone code: tạo DB rỗng equipment_lending_db, chạy lembic upgrade head sinh 5 bảng và chạy scripts/seed.py nạp dữ liệu mẫu ban đầu, hoặc xuất/nhập file .sql qua phpMyAdmin.
- **Trạng thái:** Phase 5 hoàn tất 100%. Sẵn sàng chuyển giao sang **Phase 6: Triển khai Frontend (React + TypeScript + Vite + Tailwind CSS + Lucide Icons)**.


---

## Session: 2026-10-29 (Phase 6 - Frontend Implementation Complete)

### Hạng mục thực hiện:
- **Kích hoạt các kỹ năng chuyên môn:**
  - `design-taste-frontend-v1`: Thiết kế Clean Corporate Dashboard, cấm triệt để emoji (100% dùng Lucide icons), phối màu Slate-900 / Indigo-600 / Emerald / Amber / Rose với sắc độ hài hòa, bố cục Bento Grid phi đối xứng, `min-h-[100dvh]`, interaction cycles (skeletons, empty states, tactile feedback `active:scale-[0.98]`).
  - `fastapi-python`: Đồng bộ 100% hợp đồng dữ liệu giữa Pydantic Schemas của Backend và TypeScript Interfaces của Frontend (User, Token, Equipment, Loan, BlockchainTx, LoanVerification, ReconcileResult).
  - `code-review-and-quality`: Rà soát chất lượng 5 trục (Tính đúng đắn, Dễ đọc, Kiến trúc phân tầng, Bảo mật Bearer token và Hiệu năng).

### Các thành phần đã triển khai:
1. **Types (`frontend/src/types/index.ts`)**:
   - Định nghĩa đầy đủ các model: `User`, `TokenResponse`, `Equipment`, `Loan`, `BlockchainTx`, `AuditLog`, `LoanVerification`, `ReconcileResult`, `BlockchainStatus`, `ContractInfo`.
2. **Hệ thống Services (`frontend/src/services/`)**:
   - `api.ts`: Cấu hình Axios instance kèm request interceptor tự động gán Bearer token từ `localStorage`, response interceptor tự động dọn dẹp phiên khi nhận mã `401 Unauthorized`.
   - `authService.ts`: Đăng nhập, thông tin `getMe`, quản lý người dùng.
   - `equipmentService.ts`: Lấy danh mục, thêm mới, cập nhật, xóa thiết bị.
   - `loanService.ts`: Đăng ký mượn, lấy đơn cá nhân, duyệt đơn, từ chối, bàn giao, nhận lại kèm kiểm định, hủy đơn.
   - `auditService.ts`: Lấy lịch sử giao dịch on-chain, đối soát đơn mượn MySQL vs Smart Contract, chạy reconciliation worker.
   - `blockchainService.ts`: Đọc trạng thái mạng Hardhat node và địa chỉ hợp đồng.
3. **Context Quản lý Phiên (`frontend/src/context/AuthContext.tsx`)**:
   - Quản lý trạng thái xác thực `user`, `token`, `role`, `isAuthenticated`, `isLoading`.
   - Tích hợp 2 nút đăng nhập nhanh phục vụ demo (`quickLogin('ADMIN')` và `quickLogin('BORROWER')`).
4. **Bộ UI Components Tái Sử Dụng (`frontend/src/components/`)**:
   - `Navbar.tsx`: Thanh điều hướng gắn đỉnh, logo EduVault, hiển thị vai trò người dùng, nút chuyển đổi nhanh vai trò demo và nút đăng xuất.
   - `ProtectedRoute.tsx`: Bảo vệ tuyến đường theo trạng thái đăng nhập và phân quyền vai trò (`ADMIN` vs `BORROWER`).
   - `StatusBadge.tsx`: Huy hiệu trạng thái tiêu chuẩn cho thiết bị, đơn mượn, tiền cọc và điều kiện hoàn trả.
   - `Modal.tsx`: Hộp thoại tương tác modal hiện đại kèm nền mờ và phím tắt Escape.
   - `LoadingSkeleton.tsx`: Khung tải giao diện dạng Shimmer thay cho vòng xoay truyền thống.
   - `EmptyState.tsx`: Giao diện trạng thái rỗng chuyên nghiệp kèm nút hành động.
   - `Layout.tsx`: Bọc toàn bộ các trang với Navbar và Footer thương hiệu EduVault.
5. **Giao diện các Trang Nghiệp vụ (`frontend/src/pages/`)**:
   - `LoginPage.tsx`: Trang đăng nhập trực quan kèm form xác thực và 2 thẻ Quick Fill tài khoản demo cho giảng viên/hội đồng.
   - `EquipmentPage.tsx`: Danh mục thiết bị dạng lưới Bento, tìm kiếm theo tên/serial, lọc danh mục bằng chips, lọc trạng thái; Modal "Đăng ký mượn thiết bị" kèm tính toán thời hạn và tóm tắt quy định ký quỹ mô phỏng.
   - `MyLoansPage.tsx`: Trang theo dõi đơn cá nhân của sinh viên; Stepper tiến trình trực quan 4 bước; huy hiệu cảnh báo Quá hạn `OVERDUE`; theo dõi trạng thái cọc (`LOCKED`, `REFUNDED`, `FORFEITED`); nút hủy đơn an toàn.
   - `AdminLoansPage.tsx`: Trung tâm điều phối mượn trả phân tab (Tất cả, Chờ duyệt, Đã duyệt, Đang mượn, Đã hoàn tất); nút Duyệt đơn (ký on-chain), nút Từ chối, nút Bàn giao máy; Modal nghiệm thu hoàn trả máy (chọn tình trạng Nguyên vẹn / Hư hại / Mất, tính phạt tự động hoặc ghi đè).
   - `AdminInventoryPage.tsx`: Quản trị kho thiết bị; bảng danh mục; modal thêm thiết bị mới; modal cập nhật trạng thái bảo trì/định mức cọc; nút xóa an toàn.
   - `AuditPage.tsx`: Trình kiểm toán Blockchain Explorer cho node Hardhat cục bộ; hiển thị số hiệu block, gas tiêu thụ, hash giao dịch; **Công cụ đối soát độc lập (Dual-State Verification)** so khớp 100% dữ liệu giữa MySQL và Smart Contract; nút kích hoạt Background Reconciliation Worker.

### Bảng Kết quả Kiểm thử Frontend (Phase 6 Verification Matrix):
| Hạng mục kiểm thử | Lệnh thực thi thực tế | Kết quả mong đợi | Kết quả thực tế | Trạng thái |
| :--- | :--- | :--- | :--- | :--- |
| **TypeScript Type Checking** | `node .\node_modules\typescript\bin\tsc -b` | 0 lỗi cú pháp, 0 biến không dùng | Hoàn thành sạch sẽ, không cảnh báo | **PASS** |
| **Vite Production Build** | `node .\node_modules\vite\bin\vite.js build` | Bundle thành công HTML, CSS, JS | `built in 2.65s`, CSS 27.57kB, JS 309.22kB | **PASS** |
| **Route Protection & RBAC** | Cấu hình Route | Phân tách trang theo vai trò ADMIN / BORROWER | Đúng quy định phân quyền hệ thống | **PASS** |

---

## 5-Question Reboot Check (Post Phase 6)

| Câu hỏi | Câu trả lời |
| :--- | :--- |
| **Đang ở đâu?** | Đã hoàn thành 100% Phase 6: Triển khai Giao diện Người dùng Frontend (React 18 + Vite + Tailwind CSS + Lucide Icons). Toàn bộ 6 trang nghiệp vụ, AuthContext, Axios client và kiểm toán đối soát đã build thành công. |
| **Sắp đi đâu?** | Phase 7: Tích hợp End-to-End & Xác minh Nghiệp vụ (chạy luồng mượn trả trọn vẹn, thử nghiệm các kịch bản ngoại lệ phạt trễ, hỏng máy, crash phục hồi). |
| **Mục tiêu là gì?** | Hệ thống mượn trả thiết bị học tập EduVault hoàn chỉnh kết hợp Web2.5 (FastAPI + MySQL + Hardhat Smart Contract + React UI). |
| **Đã học được gì?** | Áp dụng `design-taste-frontend-v1` giúp giao diện không bị AI slop, loại bỏ hoàn toàn emoji, dùng màu sắc desaturated Slate/Indigo/Emerald và bọc tương tác an toàn; các biến thư viện Node cục bộ chạy trực tiếp ổn định qua đường dẫn `node_modules`. |
| **Đã làm được gì?** | Hoàn tất Phase 0, 1, 2, 3, 4, 5, 6. Hệ thống có trọn vẹn Smart Contract (28 tests passed), Backend API (56 tests passed), và Frontend Web App hiện đại, sẵn sàng cho khâu tích hợp End-to-End. |

---

## Cải tiến UI/UX & Ảnh Sản Phẩm Phòng Lab (Theo yêu cầu người dùng)
- **Status:** complete
- **Time:** 2026-10-29 23:22:00
- **Nội dung thực hiện:**
  - Áp dụng các kỹ năng `/impeccable` và `/doubt-driven-development`.
  - **Bỏ tài khoản demo:** Xóa bỏ hoàn toàn khối "Tài khoản Demo Hội đồng" và các button quick fill trên [`LoginPage.tsx`](file:///d:/BaiThucHanh/PythonFile/BLockChain/frontend/src/pages/LoginPage.tsx).
  - **Tạo & tích hợp 8 ảnh sản phẩm thiết bị lab chân thực:** Sử dụng AI Image Generator tạo ảnh studio độ phân giải cao cho 8 thiết bị đào tạo lưu tại `frontend/public/images/equipment/`:
    1. MacBook Pro 14" M2 Pro (`macbook-pro.jpg`)
    2. Dell XPS 15 9530 (`dell-xps.jpg`)
    3. iPad Pro 11" M2 (`ipad-pro.jpg`)
    4. Máy chiếu Sony VPL-EX570 (`sony-projector.jpg`)
    5. Máy đo xung số Rigol DS1054Z (`rigol-oscilloscope.jpg`)
    6. Kính hiển vi kỹ thuật số Andonstar AD407 (`andonstar-microscope.jpg`)
    7. Kit vi điều khiển STM32F407 Discovery (`stm32-kit.jpg`)
    8. Bộ cảm biến Arduino IoT Kit (`arduino-kit.jpg`)
  - **Cập nhật Database:** Đồng bộ `image_url` nội bộ cho 8 thiết bị trong [`scripts/seed.py`](file:///d:/BaiThucHanh/PythonFile/BLockChain/scripts/seed.py) và bảng `equipment` trong MySQL.
  - **Nâng cấp `EquipmentPage.tsx`:** Tích hợp khung ảnh tỉ lệ 16:10, hiệu ứng hover mượt mà, fallback icon tự động, khắc phục toàn bộ các cảnh báo Accessibility & Typography (thứ bậc heading h1 -> h2, contrast text >= 4.5:1, loại bỏ nested card div).
  - **Xác minh kỹ thuật:** `node node_modules\typescript\bin\tsc -b` 0 lỗi; `node node_modules\vite\bin\vite.js build` hoàn thành trong 3.58s.

---

## Thiết lập Kế hoạch Phase 6B: Interactive Showcase Dashboard (GSAP Web 3D & Live Logs)
- **Status:** complete (Planning Phase)
- **Time:** 2026-10-30 00:06:00
- **Nội dung thực hiện:**
  - Lập bản thiết kế kiến trúc 4 phân vùng cho trang Showcase Dashboard:
    1. *Zone 1:* Hero Section & Khối 3D Digital Vault tương tác xoay theo chuột (GSAP perspective tilt) và bộ counter nhảy số động.
    2. *Zone 2:* Visual Pipeline trực quan hóa 4 trạm dừng của dòng chảy Web2.5 (MySQL Lock -> Relayer Signer -> Smart Contract Mutex -> Quyết toán cọc).
    3. *Zone 3:* Live On-Chain Transaction Terminal stream trực tiếp log giao dịch từ Hardhat EVM.
    4. *Zone 4:* Equipment Spotlight & Bảng giả lập tương tác Simulator Playground.
  - Xây dựng 5 đề xuất tính năng công nghệ cao để người dùng lựa chọn giao việc.
  - Cập nhật đồng bộ vào `task_plan.md` (bổ sung Phase 6B với 6 nhiệm vụ chi tiết), `findings.md` (Mục 17 đặc tả kiến trúc kỹ thuật) và `progress.md`.


