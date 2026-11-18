# Tài Liệu Báo Cáo Chuyên Sâu: Backend & Deploy Smart Contract (EduVault)

Tài liệu này được biên soạn toàn diện phục vụ việc báo cáo, thuyết minh và phản biện đồ án với Giảng viên về hai phân hệ cốt lõi: **Hệ thống Máy chủ (Backend FastAPI)** và **Quy trình Triển khai Hợp đồng thông minh (Smart Contract Deploy)** theo kiến trúc Pure Web3.

---

## PHẦN 1: KIẾN TRÚC VÀ CHI TIẾT CÁC TỆP TIN BACKEND

### 1.1. Bảng Tra Cứu Toàn Bộ Các Tệp Tin Backend

| Phân tầng | Tệp tin & Đường dẫn liên kết | Vai trò cốt lõi trong hệ thống |
|---|---|---|
| Khởi chạy | [main.py](file:///c:/Users/phucd/OneDrive/Desktop/Blockchain/EduVault/backend/app/main.py) | Điểm khởi động ứng dụng FastAPI, cấu hình CORS, thiết lập middleware và kiểm tra pre-flight khi bật server |
| Cấu hình | [config.py](file:///c:/Users/phucd/OneDrive/Desktop/Blockchain/EduVault/backend/app/core/config.py) | Quản lý tập trung toàn bộ biến môi trường (.env) bằng Pydantic BaseSettings |
| Bảo mật | [security.py](file:///c:/Users/phucd/OneDrive/Desktop/Blockchain/EduVault/backend/app/core/security.py) | Băm mật khẩu Bcrypt, cấp phát và giải mã mã thông báo JSON Web Token (JWT HS256) |
| Hợp đồng ABI | [EquipmentLending.json](file:///c:/Users/phucd/OneDrive/Desktop/Blockchain/EduVault/backend/app/core/contracts/EquipmentLending.json) | Chứa giao diện ABI để thư viện Web3.py dịch và giải mã các hàm, sự kiện của hợp đồng |
| Địa chỉ hợp đồng | [contract_address.json](file:///c:/Users/phucd/OneDrive/Desktop/Blockchain/EduVault/backend/app/core/contracts/contract_address.json) | Lưu địa chỉ hợp đồng Sepolia hiện tại (0xA88De9B00C0F78FF9a162C4f17524ef885169ffd) |
| Kết nối CSDL | [session.py](file:///c:/Users/phucd/OneDrive/Desktop/Blockchain/EduVault/backend/app/db/session.py) | Khởi tạo SQLAlchemy Engine, cấu hình Connection Pool chống ngắt kết nối trên MySQL XAMPP |
| Bảng Người dùng | [user.py (Model)](file:///c:/Users/phucd/OneDrive/Desktop/Blockchain/EduVault/backend/app/models/user.py) | Định nghĩa bảng `users`: lưu MSSV, mật khẩu hash, vai trò, địa chỉ ví và trạng thái xác minh ví |
| Bảng Thiết bị | [equipment.py (Model)](file:///c:/Users/phucd/OneDrive/Desktop/Blockchain/EduVault/backend/app/models/equipment.py) | Định nghĩa bảng `equipments`: lưu số serial, tên máy, danh mục, mức cọc quy định, trạng thái kho |
| Bảng Đơn mượn | [lending_request.py (Model)](file:///c:/Users/phucd/OneDrive/Desktop/Blockchain/EduVault/backend/app/models/lending_request.py) | Định nghĩa bảng `lending_requests`: lưu quan hệ mượn, các mốc thời gian, mã on-chain loanId |
| Bảng Giao dịch | [blockchain_tx.py (Model)](file:///c:/Users/phucd/OneDrive/Desktop/Blockchain/EduVault/backend/app/models/blockchain_tx.py) | Định nghĩa bảng `blockchain_transactions`: lưu mã băm tx_hash, block, gas, trạng thái CONFIRMED |
| Bảng Kiểm toán | [audit_log.py (Model)](file:///c:/Users/phucd/OneDrive/Desktop/Blockchain/EduVault/backend/app/models/audit_log.py) | Định nghĩa bảng `audit_logs`: ghi nhật ký kiểm toán độc lập mọi thay đổi dữ liệu trong hệ thống |
| DTO Đơn mượn | [loan.py (Schema)](file:///c:/Users/phucd/OneDrive/Desktop/Blockchain/EduVault/backend/app/schemas/loan.py) | Kiểm thực tính hợp lệ dữ liệu tạo đơn, duyệt đơn, bàn giao, nhận trả máy và phản hồi API |
| DTO Người dùng | [user.py (Schema)](file:///c:/Users/phucd/OneDrive/Desktop/Blockchain/EduVault/backend/app/schemas/user.py) | Kiểm thực dữ liệu đăng nhập, đăng ký và chữ ký ví EIP-191 cá nhân |
| DTO Thiết bị | [equipment.py (Schema)](file:///c:/Users/phucd/OneDrive/Desktop/Blockchain/EduVault/backend/app/schemas/equipment.py) | Kiểm thực dữ liệu tạo mới, chỉnh sửa thông tin thiết bị và cập nhật trạng thái kho |
| Dịch vụ Blockchain | [blockchain_service.py](file:///c:/Users/phucd/OneDrive/Desktop/Blockchain/EduVault/backend/app/services/blockchain_service.py) | Kết nối RPC Sepolia, thẩm tra biên lai on-chain, kiểm tra vai trò hasRole, đọc trạng thái đơn |
| Dịch vụ Đơn mượn | [loan_service.py](file:///c:/Users/phucd/OneDrive/Desktop/Blockchain/EduVault/backend/app/services/loan_service.py) | Điều phối vòng đời mượn trả, chống tấn công Replay Attack, đồng bộ dữ liệu giữa MySQL và Smart Contract |
| Dịch vụ Xác thực | [auth_service.py](file:///c:/Users/phucd/OneDrive/Desktop/Blockchain/EduVault/backend/app/services/auth_service.py) | Kiểm tra đăng nhập, đếm số lần sai liên tiếp để khóa tài khoản tự động 15 phút chống brute-force |
| Dịch vụ Kho máy | [equipment_service.py](file:///c:/Users/phucd/OneDrive/Desktop/Blockchain/EduVault/backend/app/services/equipment_service.py) | Quản lý kho máy, áp dụng khóa dòng SELECT FOR UPDATE tránh xung đột khi nhiều người đặt cùng lúc |
| Dịch vụ Đối soát | [reconciliation_service.py](file:///c:/Users/phucd/OneDrive/Desktop/Blockchain/EduVault/backend/app/services/reconciliation_service.py) | Quét và tự phục hồi sai lệch trạng thái giữa cơ sở dữ liệu MySQL và sổ cái Smart Contract |
| Dependency Injection | [deps.py](file:///c:/Users/phucd/OneDrive/Desktop/Blockchain/EduVault/backend/app/api/deps.py) | Cung cấp DB Session, xác thực token JWT và kiểm tra phân quyền RBAC cho từng API endpoint |
| Router Xác thực | [auth.py (Endpoint)](file:///c:/Users/phucd/OneDrive/Desktop/Blockchain/EduVault/backend/app/api/v1/auth.py) | Cung cấp các API đăng nhập (/login), cấp nonce ngẫu nhiên và xác minh chữ ký ví EIP-191 (/verify-wallet) |
| Router Đơn mượn | [loans.py (Endpoint)](file:///c:/Users/phucd/OneDrive/Desktop/Blockchain/EduVault/backend/app/api/v1/loans.py) | Cung cấp các API vòng đời: tạo đơn (/request), duyệt (/approve), bàn giao (/handover), trả máy (/return) |
| Router Thiết bị | [equipment.py (Endpoint)](file:///c:/Users/phucd/OneDrive/Desktop/Blockchain/EduVault/backend/app/api/v1/equipment.py) | Cung cấp các API danh mục kho máy, tìm kiếm, thêm mới và chuyển trạng thái bảo trì thiết bị |
| Router Người dùng | [users.py (Endpoint)](file:///c:/Users/phucd/OneDrive/Desktop/Blockchain/EduVault/backend/app/api/v1/users.py) | Cung cấp các API xem hồ sơ cá nhân (/me) và danh sách sinh viên đã xác minh ví Web3 |
| Router Blockchain | [blockchain.py (Endpoint)](file:///c:/Users/phucd/OneDrive/Desktop/Blockchain/EduVault/backend/app/api/v1/blockchain.py) | Cung cấp các API kiểm tra sức khỏe mạng node RPC Sepolia và tra cứu chi tiết giao dịch |
| Router Kiểm toán | [audit.py (Endpoint)](file:///c:/Users/phucd/OneDrive/Desktop/Blockchain/EduVault/backend/app/api/v1/audit.py) | Cung cấp các API truy xuất lịch sử đối soát và kích hoạt tiến trình tự động đối soát dữ liệu |
| Fixture Kiểm thử | [conftest.py](file:///c:/Users/phucd/OneDrive/Desktop/Blockchain/EduVault/backend/tests/conftest.py) | Cấu hình cơ sở dữ liệu SQLite in-memory độc lập và tài khoản mẫu cho bộ kiểm thử Pytest |
| Kiểm thử Đơn mượn | [test_loans.py](file:///c:/Users/phucd/OneDrive/Desktop/Blockchain/EduVault/backend/tests/test_loans.py) | Bộ bài kiểm thử vòng đời Pure Web3, chống tấn công Replay Attack và xử lý lỗi on-chain |
| Kiểm thử Đa ví | [test_multi_user_e2e.py](file:///c:/Users/phucd/OneDrive/Desktop/Blockchain/EduVault/backend/tests/test_multi_user_e2e.py) | Kiểm thử chu trình liên ví giữa nhiều Quản trị viên (Multi-Admin) và Sinh viên tương tác chéo |

---

## PHẦN 2: QUY TRÌNH VÀ CƠ CHẾ DEPLOY SMART CONTRACT

### 2.1. Công Cụ Phát Triển và Mạng Triển Khai

* **Khung phát triển hợp đồng:** **Hardhat** (Node.js).
* **Trình biên dịch Solidity:** `solc` phiên bản `^0.8.20`.
* **Thư viện tiêu chuẩn:** **OpenZeppelin Contracts v5.0** (module `AccessControl`).
* **Mạng thử nghiệm:** **Ethereum Sepolia Testnet** (Chain ID: `11155111`).
* **Hợp đồng thông minh:** [contracts/contracts/EquipmentLending.sol](file:///c:/Users/phucd/OneDrive/Desktop/Blockchain/EduVault/contracts/contracts/EquipmentLending.sol) (395 dòng mã nguồn Solidity đã được kiểm thử toàn diện).
* **Địa chỉ hợp đồng triển khai trên Sepolia:** `0xA88De9B00C0F78FF9a162C4f17524ef885169ffd` ([Tra cứu trên Sepolia Etherscan](https://sepolia.etherscan.io/address/0xA88De9B00C0F78FF9a162C4f17524ef885169ffd)).
* **Địa chỉ ví Deployer khởi tạo:** `0x6396121f971a55bc844301E039F6C6F472C5CbBB`.

---

### 2.2. Phân Tích Kịch Bản Triển Khai Tự Động ([contracts/scripts/deploy.cjs](file:///c:/Users/phucd/OneDrive/Desktop/Blockchain/EduVault/contracts/scripts/deploy.cjs))

Kịch bản `deploy.cjs` được thiết kế theo mô hình **Đường ống tự động đồng bộ (Auto-Sync Deployment Pipeline)**. Khi chạy một lệnh duy nhất, toàn bộ hệ thống từ Blockchain, Backend tới Frontend đều được đồng bộ tự động.

Quy trình thực thi gồm 6 bước khép kín:

1. **Kiểm tra điều kiện tiên quyết (Pre-flight Checks):**
   - Xác định mạng đích (`localhost` hoặc `sepolia`).
   - Kết nối tới ví Deployer qua `hre.ethers.getSigners()`.
   - Kiểm tra số dư Sepolia ETH: nếu số dư nhỏ hơn `0.01 ETH`, kịch bản tự động dừng lại và cảnh báo cần nạp thêm testnet ETH từ Faucet.
2. **Khởi tạo và Biên dịch Hợp đồng (Contract Deployment):**
   - Nạp Contract Factory `EquipmentLending`.
   - Gửi giao dịch khởi tạo: `Factory.deploy(deployer.address)`.
   - Constructor trong Solidity tự động cấp hai quyền ban đầu cho ví Deployer:
     - `DEFAULT_ADMIN_ROLE`: Quyền quản trị tối cao (có thể thêm hoặc bãi nhiệm các Admin khác).
     - `ADMIN_ROLE`: Quyền quản trị phòng lab (có quyền duyệt đơn, bàn giao và nhận trả máy).
3. **Chờ xác thực khối (Block Mining Confirmation):**
   - Gọi `await contract.waitForDeployment()` để đảm bảo giao dịch khởi tạo đã được đào vào một block chính thức trên mạng blockchain Sepolia.
   - Lấy địa chỉ hợp đồng mới vừa được tạo thông qua `await contract.getAddress()`.
4. **Lưu trữ hồ sơ triển khai (Deployment Artifacts):**
   - Đọc tệp ABI được Hardhat biên dịch từ `artifacts/contracts/EquipmentLending.sol/EquipmentLending.json`.
   - Tạo bản ghi chi tiết gồm: tên hợp đồng, địa chỉ, ví deployer, mạng, Chain ID, thời gian triển khai dạng ISO 8601 và đường link Etherscan tương ứng.
   - Ghi bản ghi vào tệp `contracts/deployments/sepolia.json` (hoặc `localhost.json`).
5. **Tự động xuất cấu hình sang Backend:**
   - Tạo thư mục `backend/app/core/contracts/` nếu chưa có.
   - Xuất file ABI: `backend/app/core/contracts/EquipmentLending.json`.
   - Xuất file địa chỉ: `backend/app/core/contracts/contract_address.json` chứa địa chỉ hợp đồng mới và Chain ID tương ứng.
6. **Tự động xuất cấu hình sang Frontend:**
   - Tạo thư mục `frontend/src/contracts/` nếu chưa có.
   - Xuất file ABI: `frontend/src/contracts/EquipmentLending.json`.
   - Xuất file địa chỉ: `frontend/src/contracts/contract_address.json`.
   - Nhờ bước này, mã giao diện React và thư viện Ethers.js của Frontend nhận diện ngay lập tức địa chỉ Smart Contract mới mà lập trình viên không phải sao chép thủ công.

---

### 2.3. Cấu Hình Mạng và Biến Môi Trường

* **Cấu hình Hardhat tại [contracts/hardhat.config.cjs](file:///c:/Users/phucd/OneDrive/Desktop/Blockchain/EduVault/contracts/hardhat.config.cjs):**
  ```javascript
  require("@nomicfoundation/hardhat-toolbox");
  require("dotenv").config({ path: "../.env" });

  module.exports = {
    solidity: "0.8.20",
    networks: {
      localhost: {
        url: "http://127.0.0.1:8545",
        chainId: 31337,
      },
      sepolia: {
        url: process.env.SEPOLIA_RPC_URL || "https://ethereum-sepolia-rpc.publicnode.com",
        accounts: process.env.SEPOLIA_PRIVATE_KEY ? [process.env.SEPOLIA_PRIVATE_KEY] : [],
        chainId: 11155111,
      },
    },
  };
  ```

* **Lệnh thực thi triển khai:**
  - Triển khai lên mạng Sepolia công khai:
    ```bash
    cd contracts
    npx hardhat run scripts/deploy.cjs --network sepolia
    ```
  - Triển khai lên mạng Hardhat cục bộ:
    ```bash
    cd contracts
    npx hardhat run scripts/deploy.cjs --network localhost
    ```

---

## PHẦN 3: KỊCH BẢN THUYẾT MINH & TRẢ LỜI PHẢN BIỆN VỚI GIẢNG VIÊN

### Câu hỏi 1: Tại sao nhóm không lưu Private Key của Quản trị viên trên Backend để tự động ký giao dịch cho tiện, mà lại yêu cầu kết nối ví MetaMask (Pure Web3)?
* **Trả lời:**
  - Mô hình lưu Private Key trên máy chủ backend được gọi là **Custodial (Ủy thác)**. Mô hình này tồn tại lỗ hổng bảo mật chí mạng: nếu máy chủ web hoặc cơ sở dữ liệu bị tấn công (SQL Injection, lộ file `.env`), kẻ tấn công sẽ chiếm đoạt được Private Key của Quản trị viên và có toàn quyền rút tiền, xóa quyền hoặc thao túng Smart Contract.
  - Dự án EduVault áp dụng kiến trúc **Pure Web3 (Non-Custodial)**: Toàn bộ giao dịch ghi dữ liệu lên blockchain đều do chính chủ thể (Sinh viên, Quản trị viên) trực tiếp ký qua ví cá nhân MetaMask ở trình duyệt. Máy chủ Backend hoàn toàn không lưu giữ bất kỳ Private Key nào, triệt tiêu 100% rủi ro lộ khóa bí mật từ phía hệ thống.

---

### Câu hỏi 2: Vai trò thực sự của Backend trong hệ thống này là gì nếu người dùng đã tự ký giao dịch trực tiếp lên Blockchain?
* **Trả lời:**
  Backend đóng 3 vai trò chiến lược:
  1. **Thẩm tra biên lai giao dịch on-chain (On-chain Receipt Verifier):** Khi người dùng ký xong, frontend gửi mã giao dịch `tx_hash` về backend. Backend dùng thư viện `Web3.py` đọc trực tiếp biên lai từ mạng Sepolia để kiểm tra: giao dịch đã thành công (`status == 1`), đúng địa chỉ hợp đồng của trường, phát đúng sự kiện và tham số trước khi cập nhật dữ liệu vào MySQL.
  2. **Chống tấn công gửi lại (Anti-Replay Attack):** Backend kiểm soát chặt chẽ tính Idempotent, đảm bảo mỗi mã `tx_hash` chỉ được chấp nhận duy nhất một lần, ngăn chặn việc sử dụng lại biên lai cũ.
  3. **Lưu trữ dữ liệu mở rộng (Off-chain Metadata):** Lưu trữ thông tin cá nhân (MSSV, mật khẩu), hình ảnh thiết bị và nhật ký kiểm toán. Việc này giúp hệ thống đạt tốc độ phản hồi tính bằng mili-giây và tiết kiệm chi phí gas đắt đỏ nếu lưu toàn bộ dữ liệu lên blockchain.

---

### Câu hỏi 3: Quy trình Deploy tự động giải quyết bài toán gì trong quá trình phát triển dự án?
* **Trả lời:**
  - Trong các dự án Blockchain thông thường, mỗi khi chỉnh sửa Smart Contract và deploy lại, lập trình viên thường phải thực hiện thủ công việc sao chép file ABI và cập nhật từng địa chỉ hợp đồng mới vào file cấu hình của Backend và Frontend. Việc này rất dễ gây ra sai sót, lệch phiên bản ABI hoặc gọi nhầm vào địa chỉ hợp đồng cũ.
  - Kịch bản `deploy.cjs` của EduVault xây dựng một **Pipeline tự động hóa**: Ngay sau khi hợp đồng được đào thành công trên mạng Sepolia, kịch bản tự động trích xuất file ABI chuẩn và cập nhật đồng thời địa chỉ hợp đồng mới vào cả thư mục lõi của Backend (`backend/app/core/contracts/`) và Frontend (`frontend/src/contracts/`). Nhờ đó, toàn bộ hệ thống được đồng bộ hóa tức thì chỉ với một câu lệnh deploy duy nhất.

---

### Câu hỏi 4: Cơ chế phân quyền trên Smart Contract được thiết kế như thế nào?
* **Trả lời:**
  Hợp đồng sử dụng chuẩn `AccessControl` của OpenZeppelin với 3 cấp độ phân quyền phân tầng rõ rệt:
  1. `DEFAULT_ADMIN_ROLE`: Quyền cao nhất, do ví Deployer ban đầu nắm giữ. Chỉ quyền này mới có thể thêm (`addAdmin`) hoặc bãi nhiệm (`removeAdmin`) các tài khoản quản trị khác.
  2. `ADMIN_ROLE`: Dành cho các Quản trị viên phòng lab của các khoa, có quyền duyệt đơn (`approveLoan`), bàn giao máy (`confirmHandover`), nghiệm thu trả máy (`confirmReturn`) và cấp quyền mượn cho sinh viên (`registerBorrower`).
  3. `BORROWER_ROLE`: Cấp cho sinh viên đã được hệ thống xác minh danh tính và kiểm tra thẻ sinh viên để được phép gọi hàm tạo đơn mượn (`createLoan`) trên Smart Contract.

---

EduVault - Tài Liệu Kỹ Thuật Chuyên Sâu Dành Cho Báo Cáo & Phản Biện Đồ Án.
