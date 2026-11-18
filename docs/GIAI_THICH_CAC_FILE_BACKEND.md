# Tai Lieu Giai Thich Chi Tiet Cac Tep Tin Backend EduVault

Tài liệu này thuyết minh chi tiết chức năng, vai trò và cơ chế vận hành của toàn bộ các tệp tin trong hệ thống May chu Backend của dự án EduVault.

---

## 1. Tong Quan Kien Truc Backend

Hệ thống Backend được phát triển bằng ngôn ngữ Python 3.11 và framework FastAPI, xây dựng theo mô hình kiến trúc Pure Web3 (Non-Custodial) kết hợp lớp lưu trữ quan hệ MySQL (thông qua SQLAlchemy ORM) và công cụ di chuyển dữ liệu Alembic:
- Không lưu trữ khóa riêng tư (Private Key) của người dùng hoặc quản trị viên trên máy chủ.
- Mọi thao tác làm thay đổi trạng thái mượn trả đều được người dùng ký trực tiếp từ ví MetaMask on-chain trên mạng Ethereum Sepolia Testnet.
- Backend đóng vai trò là Bộ thẩm tra biên lai giao dịch on-chain (On-chain Transaction Receipt Verifier) và đồng bộ trạng thái vào cơ sở dữ liệu MySQL nhằm tối ưu hóa tốc độ truy vấn danh mục, tìm kiếm và phân trang.

---

## 2. Bang Tra Cuu Nhanh Cac Tep Tin Backend

| Đường dẫn tệp tin | Tầng kiến trúc | Vai trò và chức năng cốt lõi |
| :--- | :--- | :--- |
| `backend/app/main.py` | Entrypoint | Khởi động ứng dụng FastAPI, nạp middleware CORS, kiểm tra kết nối mạng blockchain qua sự kiện Lifespan, đăng ký API router |
| `backend/app/core/config.py` | Cấu hình | Quản lý tập trung toàn bộ biến môi trường (Database URL, JWT Secret, RPC URL, Chain ID, Contract Address) bằng Pydantic Settings |
| `backend/app/core/security.py` | Bảo mật | Băm mật khẩu người dùng bằng Bcrypt (xử lý giới hạn 72 byte), xác thực mật khẩu, phát hành mã thông báo truy cập JWT (HS256) |
| `backend/app/db/session.py` | Cơ sở dữ liệu | Cấu hình SQLAlchemy Engine kết nối MySQL qua PyMySQL, thiết lập pool_pre_ping chống ngắt kết nối và tạo Session factory |
| `backend/app/db/base.py` | Cơ sở dữ liệu | Nạp toàn bộ các model ORM để Alembic tự động phát hiện và sinh các tệp migration thay đổi cấu trúc bảng |
| `backend/app/models/user.py` | Models (Thực thể) | Bảng `users`: Quản lý tài khoản đăng nhập, mật khẩu băm, vai trò (ADMIN/BORROWER), địa chỉ ví MetaMask, cờ xác thực ví EIP-191 và bộ đếm khóa tài khoản chống brute-force |
| `backend/app/models/equipment.py` | Models (Thực thể) | Bảng `equipment`: Quản lý danh mục thiết bị thực tế trong phòng lab, số seri duy nhất, thể loại, mức tiền cọc quy định và trạng thái kho |
| `backend/app/models/lending_request.py` | Models (Thực thể) | Bảng `lending_requests`: Quản lý toàn bộ vòng đời đơn mượn, liên kết khóa ngoại với người dùng, thiết bị, mã định danh on-chain loanId, trạng thái duyệt và tiền cọc |
| `backend/app/models/blockchain_tx.py` | Models (Thực thể) | Bảng `blockchain_transactions`: Sổ cái lưu vết toàn bộ các biên lai giao dịch blockchain đã được Backend thẩm tra hợp lệ thành công trên EVM |
| `backend/app/models/audit_log.py` | Models (Thực thể) | Bảng `audit_logs`: Nhật ký kiểm toán ghi nhận mọi thao tác thay đổi dữ liệu trong hệ thống phục vụ thanh tra và truy vết độc lập |
| `backend/app/services/blockchain_service.py` | Nghiệp vụ cốt lõi | Thư viện Web3.py kết nối node Sepolia: đọc trạng thái on-chain, thẩm tra biên lai giao dịch (kiểm tra status, địa chỉ contract, giải mã event log, đối chiếu người gửi), kiểm tra phân quyền on-chain |
| `backend/app/services/loan_service.py` | Nghiệp vụ cốt lõi | Điều phối toàn bộ quy trình mượn trả thiết bị, kiểm tra chống tấn công phát lại Replay Attack, đồng bộ trạng thái đơn và thiết bị |
| `backend/app/services/auth_service.py` | Nghiệp vụ cốt lõi | Xử lý logic đăng nhập, kiểm tra mật khẩu, bộ đếm lỗi đăng nhập sai để khóa tài khoản 15 phút, sinh chuỗi thử thách nonce ký ví |
| `backend/app/services/equipment_service.py` | Nghiệp vụ cốt lõi | Quản lý kho thiết bị, hỗ trợ tìm kiếm mờ, áp dụng cơ chế khóa bi quan (Pessimistic Locking `FOR UPDATE`) khi duyệt đơn chống race condition |
| `backend/app/services/reconciliation_service.py` | Nghiệp vụ cốt lõi | Tiến trình đối soát tự động định kỳ: so sánh trạng thái giữa MySQL và Smart Contract, tự động khôi phục dữ liệu theo chân lý on-chain |
| `backend/app/schemas/loan.py` | DTOs (Schemas) | Định nghĩa cấu trúc dữ liệu đầu vào và đầu ra cho đơn mượn (LoanCreateRequest, LoanApproveRequest, LoanResponse...) |
| `backend/app/schemas/user.py` | DTOs (Schemas) | Định nghĩa cấu trúc dữ liệu đăng nhập, yêu cầu xác thực chữ ký ví EIP-191 và thông tin hồ sơ trả về cho người dùng |
| `backend/app/schemas/equipment.py` | DTOs (Schemas) | Định nghĩa cấu trúc dữ liệu tạo mới, cập nhật và hiển thị danh mục thiết bị phòng lab |
| `backend/app/schemas/token.py` | DTOs (Schemas) | Định nghĩa cấu trúc mã xác thực JWT trả về sau khi đăng nhập thành công |
| `backend/app/schemas/audit.py` | DTOs (Schemas) | Định nghĩa cấu trúc bản ghi nhật ký kiểm toán hệ thống |
| `backend/app/api/deps.py` | API Routers | Bộ tiêm phụ thuộc (Dependency Injection): tạo và đóng SQLAlchemy Session an toàn, giải mã JWT xác định người dùng, kiểm tra phân quyền vai trò |
| `backend/app/api/v1/auth.py` | API Endpoints | Các điểm cuối đăng nhập, lấy chuỗi nonce thử thách và xác thực chữ ký số ví MetaMask (EIP-191) |
| `backend/app/api/v1/loans.py` | API Endpoints | Các điểm cuối xử lý quy trình mượn trả: tạo đơn, duyệt đơn, bàn giao máy, nghiệm thu trả máy, từ chối và hủy đơn |
| `backend/app/api/v1/equipment.py` | API Endpoints | Các điểm cuối xem danh mục thiết bị, thêm thiết bị mới vào kho và điều chỉnh trạng thái thiết bị |
| `backend/app/api/v1/users.py` | API Endpoints | Các điểm cuối xem hồ sơ cá nhân và danh sách người dùng đã xác minh ví |
| `backend/app/api/v1/blockchain.py` | API Endpoints | Các điểm cuối kiểm tra tình trạng kết nối node Sepolia và tra cứu chi tiết một biên lai giao dịch on-chain |
| `backend/app/api/v1/audit.py` | API Endpoints | Các điểm cuối truy vấn nhật ký kiểm toán và kích hoạt tác vụ đối soát dữ liệu thủ công |
| `backend/tests/` | Kiểm thử tự động | Bộ 80 bài kiểm thử tự động toàn diện bằng Pytest, kiểm thử độc lập trên SQLite in-memory, đạt tỷ lệ vượt qua 100% |

---

## 3. Chi Tiet Tung Tang Kien Truc

### 3.1. Tang Khoi Chay va Cau Hinh (Entrypoint & Core)

#### [backend/app/main.py](file:///c:/Users/phucd/OneDrive/Desktop/Blockchain/EduVault/backend/app/main.py)
- **Mục đích:** Khởi tạo phiên bản FastAPI ứng dụng, thiết lập middleware và điều phối tuyến đường.
- **Các thành phần chính:**
  * `FastAPI(title="EduVault API", ...)`: Khởi tạo ứng dụng kèm Swagger UI tại `/docs`.
  * `CORSMiddleware`: Cho phép Frontend (cổng 5173) gửi yêu cầu tới Backend (cổng 8000) kèm Authorization header.
  * Sự kiện `lifespan`: Khi server bật, tự động kiểm tra kết nối tới MySQL và node Blockchain Sepolia, cảnh báo nếu sai Chain ID hoặc node offline.
  * Đăng ký toàn bộ router `/api/v1` từ thư mục `app/api/v1`.

#### [backend/app/core/config.py](file:///c:/Users/phucd/OneDrive/Desktop/Blockchain/EduVault/backend/app/core/config.py)
- **Mục đích:** Quản lý tập trung toàn bộ thông số cấu hình hệ thống bằng thư viện `pydantic-settings`.
- **Các biến môi trường quan trọng:**
  * `DATABASE_URL`: Chuỗi kết nối CSDL MySQL (`mysql+pymysql://root:@localhost:3306/equipment_lending_db`).
  * `SECRET_KEY`, `ALGORITHM`: Chìa khóa ký và thuật toán sinh mã thông báo JWT (HS256).
  * `BLOCKCHAIN_RPC_URL`: Địa chỉ node RPC mạng Sepolia (`https://ethereum-sepolia-rpc.publicnode.com`).
  * `CHAIN_ID`: Mã mạng blockchain (`11155111` cho Sepolia Testnet).
  * `CONTRACT_ADDRESS`: Địa chỉ Smart Contract đang triển khai (`0xA88De9B00C0F78FF9a162C4f17524ef885169ffd`).

#### [backend/app/core/security.py](file:///c:/Users/phucd/OneDrive/Desktop/Blockchain/EduVault/backend/app/core/security.py)
- **Mục đích:** Cung cấp các hàm mã hóa và bảo mật.
- **Các hàm xử lý:**
  * `verify_password(plain, hashed)`: Đối chiếu mật khẩu nhập với chuỗi băm Bcrypt.
  * `get_password_hash(password)`: Băm mật khẩu bằng Bcrypt kết hợp muối ngẫu nhiên (chống lộ lọt).
  * `create_access_token(data, expires_delta)`: Đóng gói thông tin người dùng thành chuỗi JWT Bearer token có thời hạn.

---

### 3.2. Tang Co So Du Lieu va Thuc The (Database & Models)

#### [backend/app/db/session.py](file:///c:/Users/phucd/OneDrive/Desktop/Blockchain/EduVault/backend/app/db/session.py)
- Tạo `engine` kết nối MySQL với tham số `pool_pre_ping=True` (tự động thử lại nếu kết nối MySQL bị timeout do XAMPP sleep).
- Tạo `SessionLocal` để mỗi request API có một phiên làm việc riêng biệt, tự động đóng sau khi xử lý xong.

#### [backend/app/models/user.py](file:///c:/Users/phucd/OneDrive/Desktop/Blockchain/EduVault/backend/app/models/user.py)
- **Bảng `users`:**
  * `student_staff_id`: Mã sinh viên/cán bộ (duy nhất).
  * `role`: Vai trò trong hệ thống (`ADMIN`, `BORROWER`).
  * `wallet_address`: Địa chỉ ví Ethereum MetaMask dạng `0x...` (42 ký tự).
  * `wallet_verified`: Cờ đánh dấu đã xác thực chữ ký EIP-191 hay chưa.
  * `failed_login_count`, `locked_until`: Cơ chế chống tấn công brute-force mật khẩu (khóa tạm 15 phút nếu sai quá 5 lần).

#### [backend/app/models/equipment.py](file:///c:/Users/phucd/OneDrive/Desktop/Blockchain/EduVault/backend/app/models/equipment.py)
- **Bảng `equipment`:**
  * Quản lý danh mục thiết bị thực tế trong phòng lab.
  * `status`: Trạng thái kho (`AVAILABLE`, `RESERVED`, `IN_USE`, `MAINTENANCE`, `RETIRED`).
  * `deposit_amount`: Mức tiền đặt cọc quy định (VND).

#### [backend/app/models/lending_request.py](file:///c:/Users/phucd/OneDrive/Desktop/Blockchain/EduVault/backend/app/models/lending_request.py)
- **Bảng `lending_requests`:**
  * Quản lý đơn mượn của sinh viên.
  * `on_chain_loan_id`: Mã định danh đơn mượn trên Smart Contract (chuỗi 66 ký tự dạng `bytes32` tạo bởi keccak256).
  * `status`: Trạng thái đơn (`PENDING`, `APPROVED`, `ACTIVE`, `RETURNED`, `CANCELLED`, `REJECTED`, `DISPUTED`).
  * `return_condition`: Tình trạng khi trả (0 = Nguyên vẹn, 1 = Hư hỏng nhẹ, 2 = Mất máy/Hư hỏng nặng).

#### [backend/app/models/blockchain_tx.py](file:///c:/Users/phucd/OneDrive/Desktop/Blockchain/EduVault/backend/app/models/blockchain_tx.py)
- **Bảng `blockchain_transactions`:**
  * Lưu vết tất cả giao dịch blockchain đã được Backend xác thực thành công.
  * `tx_hash`: Khóa chính duy nhất. Chống replay attack (không cho phép dùng lại cùng 1 hash).
  * `action_type`: Loại hành động (`CREATE_LOAN`, `APPROVE_LOAN`, `HANDOVER`, `RETURN_LOAN`, `CANCEL_LOAN`).

---

### 3.3. Tang Xu Ly Nghiep Vu (Services)

#### [backend/app/services/blockchain_service.py](file:///c:/Users/phucd/OneDrive/Desktop/Blockchain/EduVault/backend/app/services/blockchain_service.py)
Module quan trọng nhất thể hiện kiến trúc Pure Web3:
- **`verify_transaction_receipt(tx_hash, ...)`:**
  1. Gọi RPC `eth_getTransactionReceipt(tx_hash)` lên mạng Sepolia.
  2. Kiểm tra `receipt.status == 1` (giao dịch thành công, không bị revert trên chuỗi).
  3. Kiểm tra `receipt.to == CONTRACT_ADDRESS` (tương tác đúng địa chỉ Smart Contract của trường).
  4. Giải mã log sự kiện (event logs) bằng ABI để kiểm tra sự kiện mong muốn (`LoanCreated`, `LoanApproved`, `HandoverConfirmed`, `LoanReturned`).
  5. Đối chiếu tham số trong sự kiện: `loanId`, `equipmentId`, địa chỉ ví người gửi.
- **`has_role(role_name, address)`:** Kiểm tra địa chỉ ví có quyền ADMIN_ROLE trên Smart Contract hay không.
- **`get_loan(loan_id)`:** Đọc trực tiếp trạng thái đơn mượn từ Smart Contract trên blockchain.
- **`is_overdue(loan_id)`:** Kiểm tra đơn mượn đã quá hạn so với block timestamp hay chưa.

#### [backend/app/services/loan_service.py](file:///c:/Users/phucd/OneDrive/Desktop/Blockchain/EduVault/backend/app/services/loan_service.py)
Điều phối toàn bộ vòng đời đơn mượn:
- Kiểm tra tính duy nhất của giao dịch (chống Replay Attack).
- Cập nhật đồng bộ trạng thái giữa MySQL và Smart Contract khi có giao dịch được xác thực.
- Tích hợp cơ chế đồng bộ mềm cho thao tác hủy/từ chối đơn nếu trên blockchain đơn đã ở trạng thái `Cancelled`.

#### [backend/app/services/equipment_service.py](file:///c:/Users/phucd/OneDrive/Desktop/Blockchain/EduVault/backend/app/services/equipment_service.py)
- Quản lý danh mục thiết bị phòng lab.
- Sử dụng cơ chế khóa dòng bi quan `SELECT ... FOR UPDATE` khi duyệt đơn để chống tranh chấp đồng thời giữa nhiều quản trị viên.

#### [backend/app/services/reconciliation_service.py](file:///c:/Users/phucd/OneDrive/Desktop/Blockchain/EduVault/backend/app/services/reconciliation_service.py)
- Quét và đối soát tự động trạng thái giữa CSDL MySQL và Smart Contract trên Sepolia, lấy Smart Contract làm chân lý tối cao để tự động sửa chữa dữ liệu bị lệch pha.

---

### 3.4. Tang Kiem Tra Kieu Du Lieu (Schemas - DTOs)

Sử dụng Pydantic v2:
- **`backend/app/schemas/loan.py`:** `LoanCreateRequest` (gồm `tx_hash` và `on_chain_loan_id`), `LoanApproveRequest`, `LoanReturnRequest`, `LoanResponse`...
- **`backend/app/schemas/user.py`:** `LoginRequest`, `WalletVerifyRequest`, `UserResponse`...
- **`backend/app/schemas/equipment.py`:** `EquipmentCreate`, `EquipmentUpdate`, `EquipmentResponse`...

---

### 3.5. Tang Dinh Tuyen API (API Endpoints)

- **`backend/app/api/deps.py`:** Dependency injection quản lý DB Session, xác thực token JWT, kiểm tra quyền hạn (Role Guard).
- **`backend/app/api/v1/auth.py`:** Đăng nhập, lấy nonce ngẫu nhiên, xác thực chữ ký ví MetaMask EIP-191.
- **`backend/app/api/v1/loans.py`:** Tạo đơn, duyệt đơn, bàn giao máy, nghiệm thu trả máy, hủy/từ chối đơn.
- **`backend/app/api/v1/equipment.py`:** Xem danh mục, thêm mới và đổi trạng thái thiết bị.
- **`backend/app/api/v1/blockchain.py`:** Kiểm tra kết nối mạng Sepolia, tra cứu giao dịch theo hash.
- **`backend/app/api/v1/audit.py`:** Xem lịch sử kiểm toán hệ thống, kích hoạt đối soát dữ liệu.

---

### 3.6. Tang Kiem Thu Tu Dong (Tests)

Thư mục `backend/tests/` gồm 80 bài kiểm thử tự động bằng Pytest, kiểm thử độc lập trên SQLite in-memory:
- `test_loans.py`: Kiểm thử các kịch bản mượn trả Pure Web3, chống replay attack, chặn giao dịch revert.
- `test_multi_user_e2e.py`: Kiểm thử chu trình liên ví giữa nhiều Admin và Sinh viên.
- `test_auth.py`: Kiểm thử đăng nhập, cơ chế khóa brute-force, xác thực chữ ký EIP-191.
- `test_equipment.py`: Kiểm thử kho và khóa bi quan tranh chấp thiết bị.
- `test_blockchain.py`, `test_users.py`, `test_audit.py`, `test_health.py`: Kiểm thử các module phụ trợ.
