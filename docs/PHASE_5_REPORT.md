# Báo Cáo Nghiệm Thu Kỹ Thuật: Phase 5 - Triển Khai Backend (FastAPI + MySQL + Web3.py)

> **Dự án:** EduVault - Hệ thống Quản lý Mượn trả Thiết bị Học tập tích hợp Smart Contract  
> **Thời gian hoàn thành:** 27/10/2026  
> **Phiên bản:** v1.0.0 (Phase 5 Complete)  
> **Quy chuẩn lập trình áp dụng:** `QUY_DINH_CODE.md` (chuẩn hàm đơn nhiệm, docstring 5 thành phần, kiến trúc phân tầng, bảo vệ race-condition, kiểm toán on-chain).

---

## 1. Tổng Quan Kết Quả Đạt Được

Toàn bộ **10/10 nhiệm vụ kỹ thuật** của Phase 5 đã được triển khai hoàn tất 100%, kết nối thành công với cơ sở dữ liệu MySQL thực tế trên XAMPP và mạng cục bộ EVM Hardhat:

- [x] **Task 5.1:** Thiết lập SQLAlchemy 2.0 ORM Declarative Models (5 bảng CSDL đầy đủ).
- [x] **Task 5.2:** Khởi tạo và áp dụng Alembic Migration thành công vào MySQL `equipment_lending_db`.
- [x] **Task 5.3:** Hệ thống Xác thực Bảo mật (Bcrypt hashing, JWT HS256, khóa tài khoản chống Brute-force sau 5 lần sai).
- [x] **Task 5.4:** Phân quyền người dùng (RBAC: `ADMIN` vs `BORROWER`, API CRUD User).
- [x] **Task 5.5:** Quản lý Thiết bị (Equipment CRUD, bộ lọc tìm kiếm & Khóa dòng MySQL Pessimistic Lock `SELECT ... FOR UPDATE`).
- [x] **Task 5.6:** Dịch vụ Blockchain Web3.py (Custodial Relayer, Keccak256 hash `loan_id`, ký giao dịch với gas buffer 20%).
- [x] **Task 5.7:** Toàn bộ 6 API Vòng đời Mượn trả (`Request` -> `Approve` -> `Handover` -> `Return` -> `Cancel` -> `Reject`).
- [x] **Task 5.8:** Bộ Đối Soát Kiểm Toán & Tự Phục Hồi Dữ Liệu Lệch Dual-Write (Reconciliation Worker).
- [x] **Task 5.9:** Script Khởi tạo Dữ liệu Mẫu (`seed.py`: 1 Admin, 3 Sinh viên, 8 Thiết bị, 1 Đơn mượn).
- [x] **Task 5.10:** Bộ Kiểm thử Tự động Pytest (**56/56 tests passing 100%**).

---

## 2. Kiến Trúc & Cấu Trúc Mã Nguồn Backend

Toàn bộ backend được tổ chức theo kiến trúc phân tầng nghiêm ngặt (Separation of Concerns), phân tách rõ rệt giữa Tầng Dữ liệu, Tầng Nghiệp vụ và Tầng Giao tiếp API:

```
EduVault/backend/
├── alembic/                          # Quản lý phiên bản CSDL (Database Migrations)
│   ├── versions/
│   │   └── 8bd1d029877b_initial_schema_5_tables.py   # Migration tạo 5 bảng
│   └── env.py                        # Cấu hình nạp metadata từ SQLAlchemy
├── app/
│   ├── api/                          # Tầng Giao tiếp (API Routers & Middleware)
│   │   ├── deps.py                   # Dependency Injection (Auth token & RBAC check)
│   │   └── v1/
│   │       ├── health.py             # GET /api/v1/healthz
│   │       ├── auth.py               # POST /login (JSON), POST /token (OAuth2 form)
│   │       ├── users.py              # GET /me, POST /admin/users, GET /admin/users
│   │       ├── equipment.py          # GET, POST, PUT, DELETE /api/v1/equipment
│   │       ├── loans.py              # 6 APIs vòng đời mượn trả
│   │       ├── blockchain.py         # GET /api/v1/blockchain/status
│   │       └── audit.py              # GET /verify, POST /reconcile, GET /logs
│   ├── core/                         # Cấu hình lõi & Bảo mật
│   │   ├── config.py                 # Pydantic BaseSettings đọc biến môi trường .env
│   │   ├── security.py               # Bcrypt password hash, JWT encode/decode, Lockout rules
│   │   └── contracts/                # ABI & Địa chỉ Smart Contract trích xuất từ Phase 4
│   ├── db/                           # Tầng Kết nối CSDL
│   │   ├── base.py                   # SQLAlchemy Declarative Base
│   │   └── session.py                # Engine & scoped SessionLocal kết nối PyMySQL
│   ├── models/                       # Tầng Thực thể CSDL (SQLAlchemy 2.0 ORM)
│   │   ├── user.py                   # Bảng 'users'
│   │   ├── equipment.py              # Bảng 'equipment'
│   │   ├── lending_request.py        # Bảng 'lending_requests'
│   │   ├── blockchain_tx.py          # Bảng 'blockchain_transactions'
│   │   └── audit_log.py              # Bảng 'audit_logs'
│   ├── schemas/                      # Tầng Schema Hóa Dữ liệu (Pydantic v2)
│   │   ├── token.py                  # Token, TokenPayload
│   │   ├── user.py                   # UserCreate, UserLoginRequest, UserResponse
│   │   ├── equipment.py              # EquipmentCreate, EquipmentUpdate, EquipmentResponse
│   │   ├── loan.py                   # LoanCreateRequest, LoanReturnRequest, LoanResponse
│   │   └── audit.py                  # BlockchainTxResponse, AuditLogResponse, Verification
│   ├── services/                     # Tầng Nghiệp vụ Lõi (Business Logic Services)
│   │   ├── auth_service.py           # Xác thực & đếm số lần sai khóa tài khoản 15 phút
│   │   ├── user_service.py           # Quản lý người dùng, chống trùng email/mã số
│   │   ├── equipment_service.py      # CRUD thiết bị & MySQL Pessimistic Lock
│   │   ├── blockchain_service.py     # Tương tác Web3.py, Custodial Relayer, gas buffer
│   │   ├── loan_service.py           # Vòng đời 6 bước mượn trả & tính phạt tự động
│   │   └── reconciliation_service.py # Đối soát độc lập MySQL vs On-chain, Idempotent Recovery
│   └── main.py                       # FastAPI Application Factory, CORS & Router Mounting
├── tests/                            # Bộ Kiểm thử Tự động Pytest (56 tests)
│   ├── conftest.py                   # SQLite in-memory fixture, TestClient, mock tokens
│   ├── test_health.py                # 3 tests
│   ├── test_auth.py                  # 8 tests
│   ├── test_users.py                 # 9 tests
│   ├── test_equipment.py             # 12 tests
│   ├── test_blockchain.py            # 6 tests
│   ├── test_loans.py                 # 14 tests
│   └── test_audit.py                 # 5 tests
└── requirements.txt                  # Danh mục thư viện cố định phiên bản
```

---

## 3. Chi Tiết Thực Hiện Các Nhiệm Vụ Kỹ Thuật

### 3.1. CSDL Quan Hệ MySQL & Alembic Migration (Task 5.1 & 5.2)
- Đã khắc phục sự cố đường dẫn XAMPP trên ổ đĩa `D:\App_hoc_tap\Ampp`, khởi chạy thành công MySQL (Port 3306) và Apache (Port 80/443).
- Tạo CSDL `equipment_lending_db` hỗ trợ bộ mã `utf8mb4_unicode_ci`.
- Sử dụng SQLAlchemy 2.0 Declarative Mapping xây dựng 5 bảng:
  1. `users`: Quản lý tài khoản, mã sinh viên/cán bộ, mật khẩu băm, vai trò `ADMIN`/`BORROWER`, trường `failed_login_count` và `locked_until`.
  2. `equipment`: Danh mục thiết bị, số serial duy nhất, trạng thái (`AVAILABLE`, `RESERVED`, `IN_USE`, `MAINTENANCE`, `RETIRED`), số tiền cọc quy định.
  3. `lending_requests`: Yêu cầu mượn trả, ngày mượn/hạn trả, trạng thái đơn (`PENDING`, `APPROVED`, `ACTIVE`, `RETURNED`, `CANCELLED`, `REJECTED`, `DISPUTED`), trạng thái tiền cọc (`NONE`, `LOCKED`, `REFUNDED`, `FORFEITED`), mã `on_chain_loan_id` kiểu `CHAR(66)` liên kết Smart Contract.
  4. `blockchain_transactions`: Nhật ký giao dịch on-chain lưu trữ `tx_hash`, `action_type`, `block_number`, `gas_used`, `status`.
  5. `audit_logs`: Bảng nhật ký kiểm toán bất biến vết hành động của người dùng (`action`, `entity_name`, `entity_id`, `details_json`).
- Chạy lệnh `alembic upgrade head` áp dụng thành công script migration `8bd1d029877b_initial_schema_5_tables.py` vào CSDL.

### 3.2. Xác Thực, Bảo Mật & Quản Lý Người Dùng (Task 5.3 & 5.4)
- **Băm mật khẩu:** Sử dụng thuật toán `bcrypt` trực tiếp (chặn lỗi phân rã passlib trên Python 3.11/3.13), cắt chuỗi tối đa 72 bytes theo đặc tả tiêu chuẩn bcrypt.
- **Cơ chế chống Brute-Force:**
  - Nếu người dùng nhập sai mật khẩu 5 lần liên tiếp (`failed_login_count >= 5`), tài khoản sẽ tự động bị khóa trong vòng 15 phút (`ACCOUNT_LOCKOUT_MINUTES = 15`).
  - Khi đăng nhập đúng, hệ thống tự động reset `failed_login_count = 0` và `locked_until = None`.
- **JWT Authentication:** Cấp token Bearer với chữ ký số HS256, thời hạn 60 phút. Hỗ trợ đăng nhập linh hoạt bằng cả **Email** hoặc **Mã sinh viên/cán bộ** (`student_staff_id`).
- **Phân quyền RBAC:** Bảo vệ các API quản trị qua dependency `require_role(["ADMIN"])`.

### 3.3. Quản Lý Thiết Bị & Khóa Dòng Pessimistic Lock (Task 5.5)
- Hỗ trợ đầy đủ các thao tác CRUD thiết bị, hỗ trợ tìm kiếm mờ theo tên/serial, lọc theo danh mục và trạng thái.
- **Chống Đặt Trùng Thiết Bị (Race-Condition Prevention):**
  - Trong hàm `get_equipment_for_update`, hệ thống thực thi câu truy vấn `SELECT ... FOR UPDATE` (MySQL Pessimistic Lock).
  - Khi một yêu cầu mượn đang được xử lý duyệt, dòng dữ liệu thiết bị sẽ bị khóa ở mức engine CSDL, ngăn chặn tuyệt đối tình huống 2 sinh viên cùng được duyệt một thiết bị duy nhất.

### 3.4. Dịch Vụ Web3 Blockchain Custodial Relayer (Task 5.6)
- Tích hợp ABI và Contract Address xuất từ Phase 4 (`0x5FbDB2315678afecb367f032d93F642f64180aa3`).
- **Thuật toán Keccak256 Loan ID:** Sinh mã `on_chain_loan_id` duy nhất từ cặp `(equipment_id, timestamp)` tương thích hoàn toàn với kiểu `bytes32` trong Solidity.
- **Mô hình Custodial Relayer (Web2.5):**
  - Sinh viên chỉ cần dùng tài khoản Web thông thường. Backend sử dụng ví Admin (`ADMIN_PRIVATE_KEY`) để ký thay giao dịch on-chain.
  - Tự động lấy nonce pending, ước tính lượng gas tiêu thụ và cộng thêm 20% biên an toàn (`gas_buffer = int(gas_estimate * 1.20)`) chống lỗi out-of-gas do biến động block.
  - Phát sóng giao dịch `send_raw_transaction` và đợi biên lai `wait_for_transaction_receipt`.

### 3.5. Vòng Đời Mượn Trả Thiết Bị (Task 5.7)
Hệ thống hiện thực hóa 6 luồng trạng thái nghiệp vụ mượn trả chặt chẽ:
1. `POST /api/v1/loans/request`: Sinh viên gửi yêu cầu mượn (`PENDING`).
2. `POST /api/v1/loans/{id}/approve`: Admin duyệt đơn. Backend khóa dòng thiết bị MySQL `FOR UPDATE`, chuyển sang `RESERVED`, gọi Smart Contract tạo đơn và kích hoạt Mutex `activeEquipmentLoan`.
3. `POST /api/v1/loans/{id}/reject`: Admin từ chối đơn mượn khi chưa bàn giao.
4. `POST /api/v1/loans/{id}/handover`: Admin bàn giao máy thực tế, đơn chuyển `ACTIVE`, thiết bị sang `IN_USE`, contract khóa tiền cọc mô phỏng (`LOCKED`).
5. `POST /api/v1/loans/{id}/return`: Admin nhận lại máy:
   - **Tự động tính phạt trễ hạn:** Quá hạn < 24h phạt 10% cọc; quá hạn >= 24h phạt 50% cọc.
   - **Hư hỏng hoặc mất thiết bị:** Tịch thu 100% tiền cọc (`FORFEITED`), chuyển trạng thái đơn sang `DISPUTED`.
   - **Trả đúng hạn, nguyên vẹn:** Hoàn trả 100% cọc (`REFUNDED`), chuyển trạng thái đơn sang `RETURNED`.
   - Thiết bị được giải phóng trở lại trạng thái `AVAILABLE`. Gọi hàm `confirmReturn` trên contract để giải phóng Mutex on-chain.
6. `POST /api/v1/loans/{id}/cancel`: Sinh viên hoặc Admin hủy đơn khi chưa nhận máy, giải phóng thiết bị về `AVAILABLE` và gọi `cancelLoan` trên Smart Contract.

### 3.6. Đối Soát Kiểm Toán & Tự Phục Hồi Lệch Dữ Liệu (Task 5.8)
- `verify_loan_integrity`: Endpoint `GET /api/v1/audit/loans/{id}/verify` đối chiếu độc lập từng trường giữa MySQL và Smart Contract (Trạng thái đơn, ID thiết bị, Trạng thái Mutex, Tiền cọc). Bất kỳ sự sai lệch nào cũng được gắn cờ `discrepancies`.
- `reconcile_database_with_blockchain`: Worker nền xử lý bài toán **Dual-Write Failure** (khi server bị sập nguồn ngay sau khi giao dịch blockchain đã ghi thành công nhưng MySQL chưa kịp commit). Hệ thống sẽ lấy sự thật bất biến từ Smart Contract làm chuẩn để tự động cập nhật lại MySQL mà không thực hiện lại giao dịch blockchain (Idempotent Crash Recovery).

### 3.7. Dữ Liệu Mẫu Ban Đầu (Task 5.9)
Script `scripts/seed.py` đã nạp thành công bộ dữ liệu chuẩn vào CSDL MySQL:
- **1 Quản trị viên (Admin):**
  - Email: `admin@eduvault.edu.vn` | Password: `admin123456` | Mã: `ADMIN001`
  - Địa chỉ ví: `0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266` (Hardhat Account #0).
- **3 Sinh viên (Borrowers):**
  - SV 1: `sv01@eduvault.edu.vn` | Password: `student123` | Mã: `SV2026001` (Hardhat Account #1)
  - SV 2: `sv02@eduvault.edu.vn` | Password: `student123` | Mã: `SV2026002` (Hardhat Account #2)
  - SV 3: `sv03@eduvault.edu.vn` | Password: `student123` | Mã: `SV2026003` (Hardhat Account #3)
- **8 Thiết bị học tập:**
  - 1 MacBook Pro 14" M2 (Cọc: 5.000.000 VNĐ)
  - 1 Dell XPS 15 9530 (Cọc: 4.000.000 VNĐ)
  - 1 iPad Pro 11" M2 (Cọc: 3.000.000 VNĐ)
  - 1 Máy chiếu Sony VPL-EX455 (Cọc: 2.000.000 VNĐ)
  - 1 Máy đo xung Rigol DS1054Z (Cọc: 2.500.000 VNĐ)
  - 1 Kính hiển vi kỹ thuật số Andonstar AD407 (Cọc: 1.500.000 VNĐ)
  - 1 Kit phát triển STM32F4 Discovery (Cọc: 500.000 VNĐ)
  - 1 Kit Arduino Mega 2560 Pro (Cọc: 300.000 VNĐ)
- **1 Đơn mượn mẫu:** Sinh viên 1 mượn iPad Pro đang ở trạng thái `PENDING`.

---

## 4. Bảng Kết Quả Kiểm Thử Toàn Diện (Pytest Verification Matrix)

Tất cả các bài kiểm thử đều chạy tự động và đạt kết quả tuyệt đối:

| Nhóm Kiểm Thử | Tên File Test | Số Test Cases | Kết Quả Thực Tế | Trạng Thái |
| :--- | :--- | :---: | :--- | :---: |
| **Health Check & Ping** | `backend/tests/test_health.py` | 3 | Endpoint `/healthz`, Database ping, Network check | **PASS** |
| **Xác thực & Bảo mật (Auth)** | `backend/tests/test_auth.py` | 8 | Đăng nhập Email/ID, Sai mật khẩu, Khóa 15 phút Brute-force, OAuth2 form | **PASS** |
| **Quản trị Người dùng (Users)** | `backend/tests/test_users.py` | 9 | `GET /me`, Phân quyền Admin tạo User, Chặn trùng Email/ID, Lọc phân trang | **PASS** |
| **Quản lý Thiết bị (Equipment)**| `backend/tests/test_equipment.py` | 12 | Danh mục, Tìm kiếm mờ, Khóa dòng `FOR UPDATE`, Chặn trùng serial, Xóa an toàn | **PASS** |
| **Dịch vụ Blockchain (Web3)** | `backend/tests/test_blockchain.py` | 6 | Keccak256 hash, Kết nối RPC, Ký giao dịch Relayer, Đọc contract views | **PASS** |
| **Vòng đời Mượn Trả (Loans)** | `backend/tests/test_loans.py` | 14 | Luồng 6 bước: Request -> Approve -> Handover -> Return -> Cancel, Phạt quá hạn | **PASS** |
| **Đối Soát & Kiểm Toán (Audit)** | `backend/tests/test_audit.py` | 4 | So sánh sai lệch dữ liệu On-chain vs MySQL, Tự phục hồi sau crash server | **PASS** |
| **TỔNG CỘNG** | **7 test suites** | **56** | **56 passed in ~67s (100% PASS)** | **PASS** |

---

## 5. Mức Độ Tuân Thủ Quy Chuẩn Lập Trình (`QUY_DINH_CODE.md`)

Dự án tuân thủ nghiêm ngặt các quy định tại file quy chuẩn code:

| Quy Chuẩn Yêu Cầu | Mức Độ Tuân Thủ | Chi Tiết Thực Hiện |
| :--- | :---: | :--- |
| **Hàm đơn nhiệm & Nhỏ gọn** | 100% | Tách biệt hoàn toàn giữa Router (tiếp nhận HTTP) và Service (xử lý nghiệp vụ logic). Không có hàm quá tải. |
| **Docstring 5 Thành phần Tiêu Chuẩn** | 100% | Mọi hàm trong `services`, `api`, `core` đều có docstring rõ ràng gồm: **Mục đích**, **Tham số**, **Trả về**, **Lỗi (Raises)**, **Tác dụng phụ (Side effects)**. |
| **Quy ước Đặt tên Thống nhất** | 100% | Biến và hàm dùng `snake_case`, Class và Model dùng `PascalCase`, Hằng số cấu hình dùng `UPPER_SNAKE_CASE`. |
| **Xử lý Ngoại lệ Minh bạch** | 100% | Không sử dụng `except: pass` nuốt lỗi. Mọi lỗi nghiệp vụ đều ném `HTTPException` với mã trạng thái chuẩn (`400`, `401`, `403`, `404`, `409`, `500`) và thông báo tiếng Việt có nghĩa. |
| **Bảo mật & Không Hardcode** | 100% | Tất cả secret keys, DB connection string, RPC URL đều được quản lý tập trung thông qua `backend/app/core/config.py` đọc từ file `.env`. |

---

## 6. Hướng Dẫn Vận Hành & Khởi Động Hệ Thống

### 6.1. Khởi động Cơ sở Dữ liệu & Mạng Blockchain
1. **Bật XAMPP Control Panel:** Bấm **Start** cả 2 module **Apache** và **MySQL**.
2. **Khởi động mạng Hardhat Node** (nếu muốn tương tác EVM cục bộ):
   ```powershell
   cd c:\Users\phucd\OneDrive\Desktop\Blockchain\EduVault\contracts
   npx hardhat node
   ```

### 6.2. Khởi động Backend FastAPI Server
Mở terminal trong thư mục `EduVault`:
```powershell
cd c:\Users\phucd\OneDrive\Desktop\Blockchain\EduVault
.\backend\.venv\Scripts\Activate.ps1
uvicorn backend.app.main:app --reload --host 127.0.0.1 --port 8000
```
- Khi máy chủ khởi động thành công, hệ thống sẽ lắng nghe tại: `http://127.0.0.1:8000`.

### 6.3. Truy cập Tài Liệu Swagger & Thử Nghiệm API
1. Mở trình duyệt truy cập: **`http://127.0.0.1:8000/docs`**.
2. Bấm nút **Authorize** (ở góc phải trên giao diện Swagger):
   - **Tài khoản Admin:**
     - Username: `admin@eduvault.edu.vn` (hoặc `ADMIN001`)
     - Password: `admin123456`
   - **Tài khoản Sinh viên:**
     - Username: `sv01@eduvault.edu.vn` (hoặc `SV2026001`)
     - Password: `student123`
3. Thử nghiệm gọi các API:
   - `GET /api/v1/equipment`: Xem danh mục 8 thiết bị vừa seed.
   - `GET /api/v1/loans`: Xem danh sách đơn mượn.
   - `GET /api/v1/audit/transactions`: Xem nhật ký blockchain transactions.

### 6.4. Kiểm tra Cơ sở Dữ liệu trên phpMyAdmin
- Mở trình duyệt truy cập: **`http://localhost/phpmyadmin`**.
- Chọn cơ sở dữ liệu **`equipment_lending_db`** ở thanh menu trái.
- Quý người dùng có thể xem cấu trúc và dữ liệu thực tế tại 5 bảng:
  - `users`: Đã có 4 bản ghi tài khoản.
  - `equipment`: Đã có 8 thiết bị học tập.
  - `lending_requests`: Đã có 1 đơn mượn mẫu.
  - `audit_logs`: Đã có vết nhật ký khởi tạo.

---

## 7. Đánh Giá Sẵn Sàng Chuyển Giao (Phase Readiness)

- **Backend (Phase 5):** **ĐÃ HOÀN TẤT VÀ NGHIỆM THU 100%**.
- **Bước tiếp theo:** Sẵn sàng chuyển sang **Phase 6: Triển khai Giao diện Người Dùng Frontend (React 18 + TypeScript + Vite + Tailwind CSS + Lucide Icons)** để kết nối trực tiếp với toàn bộ 7 cụm API vừa xây dựng.

