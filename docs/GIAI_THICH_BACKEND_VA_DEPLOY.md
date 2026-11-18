# Tai Lieu Chuyen Sau: Co Che Deploy Smart Contract va Chi Tiet Cac Tep Tin Backend

Tài liệu này giải thích toàn diện hai nội dung quan trọng nhất của hệ thống EduVault phục vụ thuyết minh và báo cáo đồ án:
- Phần 1: Cơ chế triển khai (Deploy) Smart Contract tự động và quy trình đồng bộ đa tầng.
- Phần 2: Cấu trúc và chức năng chi tiết của từng tệp tin trong phần Máy chủ Backend.
- Phần 3: Bộ câu hỏi - đáp trọng tâm khi báo cáo và phản biện với Hội đồng Giảng viên.

---

# PHAN 1: CO CHE DEPLOY SMART CONTRACT TRONG DU AN

## 1.1. Tong Quan He Thong Hop Dong Thong Minh

Hợp đồng thông minh cốt lõi của hệ thống là `EquipmentLending.sol`, được lưu trữ tại thư mục `contracts/contracts/EquipmentLending.sol`.

| Thông số | Giá trị thiết lập | Giải thích kỹ thuật |
| :--- | :--- | :--- |
| Ngôn ngữ | Solidity ^0.8.20 | Hỗ trợ các opcode hiện đại, tích hợp sẵn cơ chế chống tràn số học (overflow/underflow) |
| Khung phát triển | Hardhat | Môi trường biên dịch, mô phỏng mạng cục bộ, chạy kiểm thử tự động và script triển khai |
| Thư viện bảo mật | OpenZeppelin Contracts v5.0 | Sử dụng module `AccessControl` để phân quyền phi tập trung theo vai trò (Role-based) |
| Mạng chính thức | Ethereum Sepolia Testnet | Mạng thử nghiệm công khai (Proof of Stake), Mã mạng (Chain ID): 11155111 |
| Mạng cục bộ | Hardhat Local Node | Mạng ảo chạy nội bộ trên máy chủ (Localhost:8545), Mã mạng (Chain ID): 31337 |
| Địa chỉ Contract hiện tại | 0xA88De9B00C0F78FF9a162C4f17524ef885169ffd | Địa chỉ hợp đồng đã được deploy và xác thực thành công trên mạng Sepolia |
| Ví Deployer (Khởi tạo) | 0x6396121f971a55bc844301E039F6C6F472C5CbBB | Ví nắm giữ quyền Admin tối cao khởi tạo, cấp quyền vận hành cho hệ thống |
| Trình duyệt khối | Etherscan Sepolia | https://sepolia.etherscan.io/address/0xA88De9B00C0F78FF9a162C4f17524ef885169ffd |

---

## 1.2. Quy Trinh Trien Khai Tu Dong Hoa (Tap Lenh contracts/scripts/deploy.cjs)

Toàn bộ quy trình biên dịch, đưa hợp đồng lên blockchain và đồng bộ thông tin sang Backend và Frontend được tự động hóa 100% trong tệp lệnh `contracts/scripts/deploy.cjs`.

Quy trình thực thi tuần tự qua 6 bước:

```
[Bước 1: Pre-flight Check]
      |  Kiểm tra mạng, ví deployer và số dư Sepolia ETH (yêu cầu tối thiểu 0.01 ETH)
      v
[Bước 2: Deploy Contract]
      |  Khởi tạo Factory và gửi transaction deploy(deployer.address) lên EVM
      v
[Bước 3: Mining Confirmation]
      |  Chờ giao dịch được xác nhận vào block, trích xuất địa chỉ hợp đồng chính thức
      v
[Bước 4: Lưu Deployment Log]
      |  Lưu ABI, địa chỉ, chainId, timestamp vào contracts/deployments/sepolia.json
      v
[Bước 5: Đường Ống Đồng Bộ Backend]
      |  Chép ABI và địa chỉ hợp đồng sang backend/app/core/contracts/
      v
[Bước 6: Đường Ống Đồng Bộ Frontend]
         Chép ABI và địa chỉ hợp đồng sang frontend/src/contracts/
```

### Bước 1: Kiểm tra điều kiện môi trường và số dư ví (Pre-flight Check)
- Tệp lệnh đọc tham số `--network` truyền vào từ dòng lệnh để xác định mạng đích (`localhost` hoặc `sepolia`).
- Lấy thông tin tài khoản ví thực thi thông qua lệnh `hre.ethers.getSigners()`.
- Kiểm tra số dư ETH thực tế thông qua lệnh `hre.ethers.provider.getBalance(deployer.address)`.
- Nếu triển khai lên mạng Sepolia mà số dư nhỏ hơn 0.01 ETH, kịch bản tự động ngắt và cảnh báo người dùng cần nạp thêm Sepolia ETH từ vòi Faucet để chi trả phí gas giao dịch.

### Bước 2: Khởi tạo và Triển khai Contract
- Khởi tạo Contract Factory thông qua Hardhat: `hre.ethers.getContractFactory("EquipmentLending")`.
- Gửi giao dịch khởi tạo lên máy ảo Ethereum (EVM): `Factory.deploy(deployer.address)`.
- Hàm khởi tạo `constructor` trên hợp đồng thông minh được thực thi và tự động cấp hai quyền cao nhất cho ví Deployer:
  * `DEFAULT_ADMIN_ROLE`: Quyền quản trị tối cao theo chuẩn OpenZeppelin, có thẩm quyền bổ nhiệm hoặc thu hồi các quyền quản trị khác.
  * `ADMIN_ROLE`: Quyền quản trị nghiệp vụ phòng lab, có thẩm quyền duyệt đơn mượn, xác nhận bàn giao máy, xác nhận nghiệm thu trả máy và cấu hình danh mục.

### Bước 3: Chờ xác nhận khối (Mining Confirmation)
- Kịch bản thực thi lệnh `await contract.waitForDeployment()` để chờ giao dịch được các thợ đào/trình xác thực (validators) đóng gói thành công vào một block trên mạng Sepolia.
- Trích xuất địa chỉ hợp đồng chính thức vừa được sinh ra trên blockchain bằng lệnh `await contract.getAddress()`.

### Bước 4: Lưu trữ nhật ký triển khai (Deployment Record)
- Kịch bản trích xuất tệp ABI (Application Binary Interface) từ thư mục `artifacts/contracts/EquipmentLending.sol/EquipmentLending.json`.
- Tạo một bản ghi nhật ký tiêu chuẩn chứa: tên hợp đồng, địa chỉ hợp đồng, địa chỉ ví deployer, tên mạng, mã chainId, thời điểm triển khai chuẩn ISO 8601 và đường liên kết tra cứu trên Etherscan.
- Lưu trữ bản ghi vào tệp `contracts/deployments/sepolia.json` (hoặc `localhost.json` nếu chạy mạng cục bộ).

### Bước 5: Đường ống tự động đồng bộ sang Backend (Auto-sync Pipeline to Backend)
Kịch bản tự động kiểm tra và tạo thư mục `backend/app/core/contracts/` nếu chưa có, sau đó xuất ra 2 tệp tin:
1. `backend/app/core/contracts/EquipmentLending.json`: Chứa toàn bộ mã ABI để thư viện Web3.py trên Backend có thể nạp vào, mã hóa tham số hàm và giải mã các sự kiện (event log) phát ra từ blockchain.
2. `backend/app/core/contracts/contract_address.json`: Chứa địa chỉ hợp đồng và mã chainId hiện tại để Backend luôn kết nối chính xác vào contract mới nhất mà không cần sửa code thủ công.

### Bước 6: Đường ống tự động đồng bộ sang Frontend (Auto-sync Pipeline to Frontend)
Kịch bản tự động kiểm tra và tạo thư mục `frontend/src/contracts/` nếu chưa có, sau đó xuất ra 2 tệp tin:
1. `frontend/src/contracts/EquipmentLending.json`: Chứa mã ABI để thư viện Ethers.js trên giao diện React có thể gọi hàm và yêu cầu người dùng ký giao dịch thông qua ví MetaMask.
2. `frontend/src/contracts/contract_address.json`: Chứa địa chỉ hợp đồng để Frontend kết nối chính xác với Smart Contract vừa triển khai.

Cơ chế tự động hóa 6 bước này giải quyết triệt để vấn đề lệch phiên bản hợp đồng (Contract Drift), giúp lập trình viên không bao giờ phải sao chép thủ công ABI hay địa chỉ hợp đồng giữa ba phân mảng của dự án.

---

## 1.3. Huong Dan Thuc Thi Lenh Deploy

Các biến môi trường bắt buộc cần khai báo trong tệp `.env` ở thư mục gốc dự án:
```env
SEPOLIA_RPC_URL=https://ethereum-sepolia-rpc.publicnode.com
SEPOLIA_PRIVATE_KEY=khoa_bi_mat_cua_vi_co_sepolia_eth
CONTRACT_ADDRESS=0xA88De9B00C0F78FF9a162C4f17524ef885169ffd
CHAIN_ID=11155111
```

Lệnh thực thi triển khai:
- Triển khai lên mạng thử nghiệm Ethereum Sepolia Testnet:
  ```bash
  cd contracts
  npx hardhat run scripts/deploy.cjs --network sepolia
  ```
- Triển khai lên mạng cục bộ Hardhat Node (phục vụ phát triển và kiểm thử nhanh):
  ```bash
  # Cửa sổ terminal 1:
  cd contracts
  npx hardhat node

  # Cửa sổ terminal 2:
  cd contracts
  npx hardhat run scripts/deploy.cjs --network localhost
  ```

---

# PHAN 2: CHUC NANG CHI TIET CAC TEP TIN BACKEND

Máy chủ Backend được xây dựng bằng ngôn ngữ Python 3.11 trên nền tảng framework hiện đại FastAPI, áp dụng mô hình kiến trúc Pure Web3 (Non-Custodial) - Máy chủ tuyệt đối không lưu trữ khóa riêng tư (Private Key) của người dùng. Backend đóng vai trò là Bộ thẩm tra biên lai giao dịch on-chain và đồng bộ cơ sở dữ liệu quan hệ MySQL để phục vụ truy vấn tốc độ cao.

```
backend/
├── app/
│   ├── main.py                     # Điểm khởi chạy FastAPI và kiểm tra Lifespan
│   ├── core/
│   │   ├── config.py               # Quản lý biến môi trường bằng pydantic-settings
│   │   ├── security.py             # Băm Bcrypt và tạo mã thông báo JWT
│   │   └── contracts/              # Thư mục chứa ABI và Address đồng bộ tự động từ Hardhat
│   ├── db/
│   │   ├── session.py              # Thiết lập kết nối MySQL SQLAlchemy Engine
│   │   └── base.py                 # Tập hợp toàn bộ các model ORM
│   ├── models/                     # Các bảng thực thể trong MySQL
│   │   ├── user.py                 # Người dùng, tài khoản, trạng thái ví MetaMask
│   │   ├── equipment.py            # Danh mục thiết bị phòng lab và trạng thái kho
│   │   ├── lending_request.py      # Đơn mượn thiết bị và mã định danh on-chain loanId
│   │   ├── blockchain_tx.py        # Sổ cái biên lai giao dịch đã thẩm tra
│   │   └── audit_log.py            # Nhật ký kiểm toán toàn diện của hệ thống
│   ├── schemas/                    # Pydantic Schemas kiểm tra dữ liệu đầu vào (DTOs)
│   │   ├── auth.py, user.py, equipment.py, loan.py, blockchain.py, audit.py
│   │   └── token.py
│   ├── services/                   # Xử lý logic nghiệp vụ cốt lõi
│   │   ├── blockchain_service.py   # Web3.py thẩm tra biên lai giao dịch on-chain
│   │   ├── loan_service.py         # Điều phối vòng đời mượn trả và chống tấn công replay
│   │   ├── auth_service.py         # Xác thực đăng nhập và chống brute-force
│   │   ├── equipment_service.py    # Quản lý kho thiết bị kèm cơ chế khóa bi quan
│   │   └── reconciliation_service.py # Công cụ tự động đối soát và tự sửa lệch dữ liệu
│   └── api/
│       ├── deps.py                 # Dependency Injection (DB Session, JWT, Role Guard)
│       └── v1/                     # Bộ định tuyến các API Endpoints
│           ├── auth.py, users.py, equipment.py, loans.py, blockchain.py, audit.py
└── tests/                          # 80 bài kiểm thử tự động Pytest (100% Passed)
```

---

## 2.1. Tang Khoi Chay va Cau Hinh He Thong (Entrypoint & Core)

### [backend/app/main.py](file:///c:/Users/phucd/OneDrive/Desktop/Blockchain/EduVault/backend/app/main.py)
- Mục đích: Tệp khởi động chính của toàn bộ ứng dụng Máy chủ Backend FastAPI.
- Chức năng cụ thể:
  * Khởi tạo ứng dụng FastAPI tích hợp sẵn tài liệu tự động Swagger UI tại đường dẫn `/docs` và ReDoc tại `/redoc`.
  * Cấu hình middleware `CORSMiddleware`: Cho phép ứng dụng Frontend React từ cổng `http://localhost:5173` gửi yêu cầu tới Backend, hỗ trợ đầy đủ các phương thức HTTP (GET, POST, PATCH, PUT, DELETE) và đính kèm Authorization header.
  * Xử lý sự kiện vòng đời `lifespan`: Khi máy chủ khởi động, hệ thống tự động kiểm tra kết nối tới MySQL và kiểm tra kết nối tới node Sepolia RPC, đối chiếu đúng Chain ID 11155111 và kiểm tra hợp đồng đã được triển khai sẵn sàng trên mạng.
  * Đăng ký toàn bộ các tuyến đường API Router từ thư mục `app/api/v1` với tiền tố chung `/api/v1`.

### [backend/app/core/config.py](file:///c:/Users/phucd/OneDrive/Desktop/Blockchain/EduVault/backend/app/core/config.py)
- Mục đích: Quản lý tập trung toàn bộ tham số cấu hình của hệ thống bằng thư viện `pydantic-settings`.
- Các biến môi trường quan trọng:
  * `DATABASE_URL`: Chuỗi kết nối cơ sở dữ liệu quan hệ MySQL (`mysql+pymysql://root:@localhost:3306/equipment_lending_db`).
  * `SECRET_KEY`, `ALGORITHM`: Khóa bí mật và thuật toán mã hóa JWT (HS256) dùng để ký và xác thực chữ ký token.
  * `BLOCKCHAIN_RPC_URL`: Địa chỉ node RPC kết nối mạng Sepolia (`https://ethereum-sepolia-rpc.publicnode.com`).
  * `CHAIN_ID`: Mã định danh mạng blockchain (11155111 cho Sepolia, 31337 cho Hardhat Local).
  * `CONTRACT_ADDRESS`: Địa chỉ Smart Contract hệ thống đang liên kết (`0xA88De9B00C0F78FF9a162C4f17524ef885169ffd`).

### [backend/app/core/security.py](file:///c:/Users/phucd/OneDrive/Desktop/Blockchain/EduVault/backend/app/core/security.py)
- Mục đích: Cung cấp các tiện ích mật mã học và bảo mật thông tin cho hệ thống.
- Các hàm nghiệp vụ:
  * `verify_password(plain_password, hashed_password)`: So khớp mật khẩu người dùng nhập vào với chuỗi băm Bcrypt lưu trong cơ sở dữ liệu.
  * `get_password_hash(password)`: Băm mật khẩu mới bằng thuật toán Bcrypt kết hợp muối (salt) ngẫu nhiên, tự động xử lý giới hạn độ dài 72 byte của Bcrypt.
  * `create_access_token(data, expires_delta)`: Đóng gói thông tin định danh người dùng (ID, vai trò) vào chuỗi JSON Web Token (JWT) có thời hạn sử dụng xác định.

### [backend/app/core/contracts/](file:///c:/Users/phucd/OneDrive/Desktop/Blockchain/EduVault/backend/app/core/contracts/)
- `EquipmentLending.json`: Tệp chứa mã ABI đầy đủ của hợp đồng do kịch bản deploy tự động sao chép sang. Thư viện Web3.py cần tệp này để mã hóa lời gọi hàm và giải mã các event log phát ra từ blockchain.
- `contract_address.json`: Tệp lưu trữ địa chỉ hợp đồng và mã chainId hiện tại của hệ thống.

---

## 2.2. Tang Co So Du Lieu va Thuc The (Database & Models)

### [backend/app/db/session.py](file:///c:/Users/phucd/OneDrive/Desktop/Blockchain/EduVault/backend/app/db/session.py)
- Mục đích: Thiết lập kết nối cơ sở dữ liệu quan hệ MySQL thông qua SQLAlchemy 2.0.
- Đặc điểm kỹ thuật:
  * `engine = create_engine(DATABASE_URL, pool_pre_ping=True, pool_recycle=3600)`: Khởi tạo connection pool. Thuộc tính `pool_pre_ping=True` giúp tự động kiểm tra tình trạng kết nối còn sống trước khi thực thi truy vấn, giải quyết triệt để lỗi "MySQL server has gone away" khi chạy trên XAMPP.
  * `SessionLocal`: Factory dùng để khởi tạo phiên làm việc độc lập cho từng HTTP request đến máy chủ.
  * `Base`: Lớp cơ sở mà tất cả các model ORM đều kế thừa để SQLAlchemy tự động quản lý schema.

### [backend/app/models/user.py](file:///c:/Users/phucd/OneDrive/Desktop/Blockchain/EduVault/backend/app/models/user.py)
- Bảng CSDL: `users`
- Ý nghĩa: Quản lý hồ sơ người dùng, tài khoản đăng nhập và thông tin ví điện tử MetaMask.
- Các trường dữ liệu chính:
  * `id`: Khóa chính.
  * `student_staff_id`: Mã số sinh viên hoặc mã cán bộ (unique), ví dụ: `SV2026001`, `ADMIN001`.
  * `email`: Địa chỉ thư điện tử dùng để đăng nhập hệ thống.
  * `password_hash`: Chuỗi mật khẩu đã được băm an toàn bằng thuật toán Bcrypt.
  * `role`: Vai trò trong hệ thống (`UserRole.ADMIN` hoặc `UserRole.BORROWER`).
  * `wallet_address`: Địa chỉ ví Ethereum MetaMask (chuỗi hex 42 ký tự `0x...`, unique).
  * `wallet_verified`: Cờ Boolean đánh dấu ví này đã vượt qua xác thực chữ ký số chuẩn EIP-191 hay chưa.
  * `wallet_nonce`, `wallet_nonce_expires_at`: Chuỗi ngẫu nhiên dùng làm thử thách ký ví và thời hạn hết hạn của chuỗi.
  * `failed_login_count`, `locked_until`: Cơ chế chống tấn công vét cạn (Brute-force) - tự động khóa tài khoản 15 phút nếu người dùng nhập sai mật khẩu quá 5 lần liên tiếp.

### [backend/app/models/equipment.py](file:///c:/Users/phucd/OneDrive/Desktop/Blockchain/EduVault/backend/app/models/equipment.py)
- Bảng CSDL: `equipment`
- Ý nghĩa: Quản lý danh mục thiết bị thực tế trong phòng thí nghiệm.
- Các trường dữ liệu chính:
  * `id`: Khóa chính (mã định danh thiết bị).
  * `serial_number`: Mã số seri duy nhất trên thiết bị (unique), ví dụ: `LAPTOP-DELL-001`, `OSC-RIGOL-001`.
  * `name`, `category`: Tên thiết bị và danh mục phân loại (Laptop, Máy tính bảng, Máy chiếu, Thiết bị đo kiểm, Bộ vi điều khiển nhúng).
  * `deposit_amount`: Mức tiền ký quỹ quy định cho thiết bị (VND).
  * `status`: Trạng thái kho của thiết bị (`AVAILABLE` - sẵn sàng, `RESERVED` - đã được đặt trước, `IN_USE` - đang cho mượn, `MAINTENANCE` - đang bảo trì, `RETIRED` - đã thanh lý).
  * `image_url`: Đường dẫn ảnh chụp thực tế của thiết bị phòng lab.

### [backend/app/models/lending_request.py](file:///c:/Users/phucd/OneDrive/Desktop/Blockchain/EduVault/backend/app/models/lending_request.py)
- Bảng CSDL: `lending_requests`
- Ý nghĩa: Quản lý toàn bộ vòng đời của một yêu cầu mượn trả thiết bị.
- Các trường dữ liệu chính:
  * `id`: Mã định danh đơn mượn trong cơ sở dữ liệu MySQL (khóa chính).
  * `user_id`: Khóa ngoại liên kết tới người mượn trong bảng `users`.
  * `equipment_id`: Khóa ngoại liên kết tới thiết bị trong bảng `equipment`.
  * `on_chain_loan_id`: Mã định danh đơn mượn trên Smart Contract (chuỗi hex 66 ký tự kiểu `bytes32` được sinh bằng hàm keccak256).
  * `status`: Trạng thái đơn mượn (`PENDING` - chờ duyệt, `APPROVED` - đã duyệt, `ACTIVE` - đang mượn, `RETURNED` - đã trả máy, `CANCELLED` - đã hủy, `REJECTED` - từ chối, `DISPUTED` - có khiếu nại).
  * `deposit_status`: Tình trạng tiền cọc (`NONE`, `LOCKED`, `REFUNDED`, `FORFEITED`).
  * `return_condition`: Tình trạng thiết bị lúc nghiệm thu trả máy (0 = Nguyên vẹn, 1 = Hư hỏng nhẹ, 2 = Mất mát hoặc hư hỏng hoàn toàn).
  * `expected_handover_date`, `due_date`, `actual_handover_date`, `actual_return_date`: Các mốc thời gian miêu tả quy trình mượn trả thực tế.

### [backend/app/models/blockchain_tx.py](file:///c:/Users/phucd/OneDrive/Desktop/Blockchain/EduVault/backend/app/models/blockchain_tx.py)
- Bảng CSDL: `blockchain_transactions`
- Ý nghĩa: Sổ cái ghi nhận toàn bộ các biên lai giao dịch blockchain đã được Backend xác thực thành công trên EVM.
- Các trường dữ liệu: `tx_hash` (khóa chính, unique), `request_id` (khóa ngoại đơn mượn), `action_type` (`CREATE_LOAN`, `APPROVE_LOAN`, `HANDOVER`, `RETURN_LOAN`, `CANCEL_LOAN`), `from_address`, `to_address`, `block_number`, `gas_used`, `status` (`CONFIRMED`).

### [backend/app/models/audit_log.py](file:///c:/Users/phucd/OneDrive/Desktop/Blockchain/EduVault/backend/app/models/audit_log.py)
- Bảng CSDL: `audit_logs`
- Ý nghĩa: Lưu trữ nhật ký hoạt động của mọi hành vi quản trị và người dùng, phục vụ công tác thanh tra, kiểm toán độc lập và hỗ trợ phục hồi dữ liệu khi có sự cố.

---

## 2.3. Tang Xu Ly Nghiep Vu Cot Loi (Services)

### [backend/app/services/blockchain_service.py](file:///c:/Users/phucd/OneDrive/Desktop/Blockchain/EduVault/backend/app/services/blockchain_service.py)
Đây là module cốt lõi quan trọng nhất của Backend trong kiến trúc Pure Web3. Backend không ký thay người dùng mà đóng vai trò là **Bộ Thẩm Tra Biên Lai Giao Dịch On-chain (On-chain Transaction Receipt Verifier)**.
- Hàm `verify_transaction_receipt(tx_hash, expected_event, expected_loan_id, expected_sender, expected_args)`:
  1. Sử dụng Web3.py kết nối tới node Sepolia, gọi hàm RPC `eth_getTransactionReceipt(tx_hash)`.
  2. Kiểm tra `receipt.status == 1`: Nếu bằng 0 tức giao dịch đã bị EVM đảo ngược (revert) do vi phạm điều kiện logic trên chuỗi, Backend lập tức từ chối cập nhật cơ sở dữ liệu.
  3. Kiểm tra `receipt.to`: Địa chỉ nhận giao dịch phải khớp chính xác với `CONTRACT_ADDRESS` của trường, loại trừ khả năng giả mạo biên lai từ hợp đồng khác.
  4. Giải mã nhật ký sự kiện (event log) bằng mã ABI của hợp đồng để xác minh sự kiện on-chain mong đợi (ví dụ `LoanCreated`, `LoanApproved`, `HandoverConfirmed`, `LoanReturned`, `LoanCancelled`).
  5. So sánh các đối số sự kiện: Mã `loanId`, `equipmentId`, địa chỉ ví người gửi phải trùng khớp hoàn toàn với dữ liệu gửi lên Backend.
- Hàm `has_role(role_name, account_address)`: Đọc hàm view `hasRole()` trên Smart Contract để kiểm tra xem địa chỉ ví đó có nắm giữ quyền `ADMIN_ROLE` trên blockchain hay không.
- Hàm `get_loan(loan_id)`: Đọc nguyên bản dữ liệu trạng thái, các mốc thời gian, tiền đặt cọc và tỷ lệ phạt của đơn mượn trực tiếp từ Smart Contract.
- Hàm `is_overdue(loan_id)`: So sánh thời hạn trả trên hợp đồng với timestamp của block Sepolia mới nhất để xác định đơn mượn có bị quá hạn hay không.

### [backend/app/services/loan_service.py](file:///c:/Users/phucd/OneDrive/Desktop/Blockchain/EduVault/backend/app/services/loan_service.py)
Module điều phối toàn bộ vòng đời của đơn mượn, kết nối giữa tầng API và Blockchain Service.
- Hàm `_check_tx_idempotency_or_replay()`: Cơ chế phòng vệ chống tấn công phát lại (Replay Attack). Một mã `tx_hash` chỉ được chấp nhận duy nhất một lần trên hệ thống. Nếu mã giao dịch đã tồn tại trong bảng `blockchain_transactions`, Backend lập tức từ chối với lỗi HTTP 400.
- Hàm `create_loan_request()`: Tạo đơn mượn mới trong MySQL sau khi xác thực tính hợp lệ của giao dịch `createLoan` do Sinh viên ký từ ví MetaMask.
- Hàm `approve_loan_request()`: Chuyển trạng thái đơn sang `APPROVED` sau khi Quản trị viên ký giao dịch `approveLoan` on-chain.
- Hàm `handover_loan_equipment()`: Chuyển đơn sang `ACTIVE` và chuyển thiết bị sang `IN_USE` sau khi Admin ký giao dịch `confirmHandover`.
- Hàm `return_loan_equipment()`: Nghiệm thu thu hồi máy, giải phóng thiết bị về `AVAILABLE`, đồng bộ tỷ lệ phạt hư hại và quá hạn từ hợp đồng về CSDL sau khi Admin ký giao dịch `confirmReturn`.
- Hàm `cancel_loan_request()` và `reject_loan_request()`: Hủy đơn hoặc từ chối đơn mượn. Module tích hợp cơ chế đồng bộ mềm: nếu đơn mượn trên blockchain đã ở trạng thái `Cancelled` (trạng thái 4) từ trước, Backend cho phép đồng bộ trạng thái trực tiếp vào CSDL mà không bắt buộc người dùng ký thêm giao dịch mới.

### [backend/app/services/auth_service.py](file:///c:/Users/phucd/OneDrive/Desktop/Blockchain/EduVault/backend/app/services/auth_service.py)
- Xử lý nghiệp vụ đăng nhập, đối chiếu mật khẩu băm Bcrypt.
- Quản lý bộ đếm lần đăng nhập sai và kích hoạt khóa tài khoản tạm thời 15 phút để ngăn chặn tấn công vét cạn mật khẩu.
- Sinh chuỗi thử thách ngẫu nhiên (nonce) kèm thời hạn 5 phút phục vụ quy trình xác minh ví bằng chữ ký số EIP-191.

### [backend/app/services/equipment_service.py](file:///c:/Users/phucd/OneDrive/Desktop/Blockchain/EduVault/backend/app/services/equipment_service.py)
- Quản lý danh mục thiết bị, hỗ trợ lọc theo thể loại và tìm kiếm mờ theo tên.
- Ứng dụng cơ chế khóa dòng bi quan (Pessimistic Locking) bằng mệnh đề SQL `SELECT ... FOR UPDATE` khi duyệt đơn, triệt tiêu hoàn toàn nguy cơ tranh chấp (Race Condition) khi nhiều quản trị viên cùng thao tác trên một thiết bị tại cùng một thời điểm.

### [backend/app/services/reconciliation_service.py](file:///c:/Users/phucd/OneDrive/Desktop/Blockchain/EduVault/backend/app/services/reconciliation_service.py)
- Tiến trình tự động đối soát dữ liệu độc lập giữa cơ sở dữ liệu MySQL và Smart Contract trên Sepolia.
- Quét toàn bộ các đơn mượn trong hệ thống: nếu phát hiện sự lệch pha về trạng thái giữa MySQL và Smart Contract (ví dụ do mất mạng đột ngột trong lúc ghi CSDL), tiến trình sẽ lấy dữ liệu trên Smart Contract làm chân lý tối cao (Single Source of Truth) để tự động điều chỉnh CSDL MySQL về đúng trạng thái on-chain.

---

## 2.4. Tang Kiem Tra Kieu Du Lieu (Schemas - DTOs)

Sử dụng thư viện Pydantic v2 để kiểm tra tính hợp lệ của dữ liệu gửi lên từ giao diện và lọc sạch dữ liệu phản hồi:
- **`backend/app/schemas/loan.py`:** Định nghĩa các DTO: `LoanCreateRequest` (chứa `tx_hash` và `on_chain_loan_id`), `LoanApproveRequest`, `LoanHandoverRequest`, `LoanReturnRequest` (chứa `return_condition`), `LoanResponse` (trả về chi tiết đơn mượn kèm cờ `is_overdue`).
- **`backend/app/schemas/user.py`:** Định nghĩa các DTO: `LoginRequest` (email/mã số và mật khẩu), `WalletVerifyRequest` (địa chỉ ví, thông điệp thử thách và chữ ký EIP-191), `UserResponse` (thông tin hồ sơ, tuyệt đối không để lộ password_hash).
- **`backend/app/schemas/equipment.py`:** Định nghĩa các DTO: `EquipmentCreate`, `EquipmentUpdate`, `EquipmentResponse`.
- **`backend/app/schemas/token.py`:** Định nghĩa cấu trúc mã xác thực JWT: `access_token`, `token_type = "bearer"`.
- **`backend/app/schemas/audit.py`:** Định nghĩa cấu trúc bản ghi nhật ký đối soát hệ thống.

---

## 2.5. Tang Dinh Tuyen API (API Endpoints / Routers)

### [backend/app/api/deps.py](file:///c:/Users/phucd/OneDrive/Desktop/Blockchain/EduVault/backend/app/api/deps.py)
Cung cấp cơ chế Dependency Injection cho toàn bộ hệ thống API:
- `get_db()`: Cung cấp phiên làm việc SQLAlchemy Session, tự động quản lý commit hoặc rollback khi có ngoại lệ và đóng phiên giải phóng kết nối sau mỗi HTTP request.
- `get_current_user()`: Trích xuất Bearer Token từ Authorization header, giải mã chuỗi JWT và truy vấn thông tin người dùng từ CSDL.
- `require_role([UserRole.ADMIN])`: Kiểm tra phân quyền theo vai trò, lập tức chặn các truy cập trái thẩm quyền bằng mã lỗi HTTP 403 Forbidden.

### [backend/app/api/v1/auth.py](file:///c:/Users/phucd/OneDrive/Desktop/Blockchain/EduVault/backend/app/api/v1/auth.py)
- `POST /api/v1/auth/login`: Đăng nhập hệ thống bằng Email hoặc Mã số (MSSV/Cán bộ) và mật khẩu, trả về token JWT.
- `GET /api/v1/auth/wallet-nonce`: Lấy thông điệp thử thách ngẫu nhiên kèm dấu thời gian để sinh viên chuẩn bị ký bằng ví MetaMask.
- `POST /api/v1/auth/verify-wallet`: Sử dụng thư viện `eth_account.messages.encode_defunct` để giải mã chữ ký số chuẩn EIP-191 và phục hồi địa chỉ ví của người ký. Nếu trùng khớp với ví của sinh viên, hệ thống đánh dấu `wallet_verified = True`.

### [backend/app/api/v1/loans.py](file:///c:/Users/phucd/OneDrive/Desktop/Blockchain/EduVault/backend/app/api/v1/loans.py)
- `POST /api/v1/loans/request`: Sinh viên gửi đơn mượn kèm mã `tx_hash` của giao dịch `createLoan`.
- `POST /api/v1/loans/{id}/approve`: Admin duyệt đơn mượn kèm mã `tx_hash` của giao dịch `approveLoan`.
- `POST /api/v1/loans/{id}/handover`: Admin xác nhận bàn giao máy kèm mã `tx_hash` của giao dịch `confirmHandover`.
- `POST /api/v1/loans/{id}/return`: Admin nghiệm thu nhận lại thiết bị kèm mã `tx_hash` của giao dịch `confirmReturn`.
- `POST /api/v1/loans/{id}/reject`: Admin từ chối yêu cầu mượn thiết bị.
- `POST /api/v1/loans/{id}/cancel`: Sinh viên hoặc Admin hủy đơn mượn trước khi bàn giao thiết bị.
- `GET /api/v1/loans`: Tra cứu danh sách đơn mượn (Sinh viên chỉ xem được đơn của chính mình, Admin xem được toàn bộ đơn trong phòng lab).

### [backend/app/api/v1/equipment.py](file:///c:/Users/phucd/OneDrive/Desktop/Blockchain/EduVault/backend/app/api/v1/equipment.py)
- `GET /api/v1/equipment`: Tra cứu danh mục thiết bị phòng lab, hỗ trợ bộ lọc phân loại và tìm kiếm theo tên thiết bị.
- `POST /api/v1/equipment`: Thêm thiết bị mới vào kho phòng lab (yêu cầu quyền ADMIN).
- `PATCH /api/v1/equipment/{id}/status`: Chuyển đổi trạng thái thiết bị (ví dụ đưa vào bảo trì định kỳ hoặc thanh lý).

### [backend/app/api/v1/users.py](file:///c:/Users/phucd/OneDrive/Desktop/Blockchain/EduVault/backend/app/api/v1/users.py)
- `GET /api/v1/users/me`: Lấy thông tin hồ sơ của tài khoản đang đăng nhập và trạng thái xác minh ví MetaMask.
- `GET /api/v1/users/verified-borrowers`: Danh sách sinh viên đã xác minh ví để Admin thực hiện cấp quyền on-chain.

### [backend/app/api/v1/blockchain.py](file:///c:/Users/phucd/OneDrive/Desktop/Blockchain/EduVault/backend/app/api/v1/blockchain.py)
- `GET /api/v1/blockchain/status`: Kiểm tra tình trạng kết nối tới node Sepolia và đọc số khối (block number) mới nhất trên mạng.
- `GET /api/v1/blockchain/tx/{tx_hash}`: Tra cứu trực tiếp thông tin chi tiết của một biên lai giao dịch trên blockchain.

### [backend/app/api/v1/audit.py](file:///c:/Users/phucd/OneDrive/Desktop/Blockchain/EduVault/backend/app/api/v1/audit.py)
- `GET /api/v1/audit/logs`: Xem toàn bộ nhật ký thao tác người dùng phục vụ công tác kiểm toán hệ thống.
- `POST /api/v1/audit/reconcile`: Kích hoạt công cụ tự động quét và đồng bộ lệch dữ liệu giữa MySQL và Smart Contract.

---

## 2.6. Tang Kiem Thu Tu Dong (Tests Suite)

Thư mục `backend/tests/` chứa 80 bài kiểm thử tự động bằng framework Pytest đạt tỷ lệ vượt qua 100%:
- `conftest.py`: Khởi tạo môi trường SQLite in-memory mock, cung cấp database fixture và tài khoản giả lập để chạy kiểm thử độc lập mà không làm xáo trộn dữ liệu trên MySQL thật.
- `test_loans.py`: Kiểm thử toàn bộ các kịch bản mượn trả theo kiến trúc Pure Web3, xác minh chữ ký ví, chặn ví chưa xác thực, chặn giao dịch bị revert trên chuỗi, chặn tấn công Replay Attack.
- `test_multi_user_e2e.py`: Kiểm thử chu trình liên ví giữa nhiều Quản trị viên và Sinh viên trên cùng một hợp đồng.
- `test_auth.py`: Kiểm thử đăng nhập, cơ chế chống brute-force và xác minh chữ ký số EIP-191.
- `test_blockchain.py`: Kiểm thử kết nối Web3 và các hàm tính toán tỷ lệ phạt on-chain.
- `test_equipment.py`: Kiểm thử kho thiết bị và cơ chế khóa dòng bi quan ngăn chặn đặt trùng máy.
- `test_users.py`, `test_audit.py`, `test_health.py`: Kiểm thử các tính năng hỗ trợ và đo lường tính ổn định của hệ thống.

---

# PHAN 3: BO CAU HOI - DAP TRONG TAM KHI PHAN BIEN DO AN

### Câu hỏi 1: Tại sao dự án lại sử dụng cả Cơ sở dữ liệu quan hệ (MySQL) lẫn Blockchain (Ethereum Sepolia)?
- **Trả lời:**
  * Blockchain Ethereum Sepolia là **Sổ cái bất biến (Immutable Ledger)** lưu trữ các mốc dữ liệu mang tính pháp lý và cam kết cao: hợp đồng mượn, tiền đặt cọc, trạng thái bàn giao máy, tỷ lệ phạt và bằng chứng giao dịch không thể bị sửa đổi bởi bất kỳ ai (kể cả quản trị viên hệ thống).
  * Cơ sở dữ liệu MySQL là **Lớp lưu trữ tốc độ cao (Fast Query Layer)** phục vụ việc tìm kiếm thiết bị, phân trang, lọc danh mục, lưu trữ hình ảnh, quản lý tài khoản và ghi nhật ký thao tác. Nếu đọc mọi thông tin trực tiếp từ Blockchain, tốc độ hệ thống sẽ rất chậm và phụ thuộc hoàn toàn vào độ trễ của node RPC mạng công cộng.
  * Mô hình kết hợp (Hybrid Architecture) này đảm bảo hài hòa tuyệt đối giữa **Tính minh bạch bất biến** và **Hiệu năng trải nghiệm người dùng**.

### Câu hỏi 2: Cơ chế bảo mật chống tấn công phát lại (Replay Attack) được thực hiện thế nào?
- **Trả lời:**
  * Khi người dùng gửi một mã giao dịch `tx_hash` lên Backend (ví dụ để thông báo đã tạo đơn mượn hoặc đã duyệt đơn), Backend sẽ lập tức kiểm tra trong bảng `blockchain_transactions`.
  * Nếu mã `tx_hash` này đã từng được lưu vết trước đó, Backend lập tức từ chối yêu cầu với mã lỗi HTTP 400. Nhờ đó, kẻ tấn công không thể sử dụng lại một giao dịch cũ trong quá khứ để lặp lại hành vi trục lợi trên hệ thống.

### Câu hỏi 3: Nếu sinh viên hoặc kẻ xấu gửi một mã giao dịch giả mạo (fake tx_hash) thì sao?
- **Trả lời:**
  * Backend hoàn toàn không tin tưởng dữ liệu gửi lên từ giao diện người dùng mà gọi trực tiếp hàm RPC `eth_getTransactionReceipt(tx_hash)` lên node mạng Sepolia.
  * Backend thẩm tra qua 4 lớp nghiêm ngặt:
    1. Trạng thái biên lai phải thành công: `receipt.status == 1`.
    2. Địa chỉ đích `receipt.to` phải khớp chính xác với `CONTRACT_ADDRESS` của trường.
    3. Sự kiện (event log) phát ra từ hợp đồng phải đúng loại sự kiện mong đợi.
    4. Các tham số trong sự kiện (`loanId`, `equipmentId`, địa chỉ ví người ký) phải trùng khớp hoàn toàn với dữ liệu của đơn mượn.
  * Chỉ cần 1 trong 4 điều kiện trên không thỏa mãn, yêu cầu bị từ chối ngay lập tức và hệ thống không thay đổi cơ sở dữ liệu.

### Câu hỏi 4: Tại sao Backend không ký giao dịch thay người dùng mà bắt buộc phải ký qua MetaMask?
- **Trả lời:**
  * Đây là nguyên lý cốt lõi của kiến trúc Pure Web3 (Non-Custodial). Người sở hữu tài sản và trách nhiệm pháp lý phải là người trực tiếp ký giao dịch bằng khóa riêng tư của mình.
  * Máy chủ Backend tuyệt đối không lưu giữ Private Key của bất kỳ ai, loại bỏ hoàn toàn nguy cơ khi máy chủ bị tấn công thì toàn bộ khóa bảo mật của sinh viên và phòng lab bị lộ.
