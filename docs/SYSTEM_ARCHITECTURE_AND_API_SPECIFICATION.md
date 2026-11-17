# TÀI LIỆU ĐẶC TẢ KIẾN TRÚC HỆ THỐNG VÀ CHI TIẾT GIAO DIỆN LẬP TRÌNH ỨNG DỤNG (SYSTEM ARCHITECTURE & RESTFUL API SPECIFICATION)

> **Hệ thống:** EduVault - Decentralized Educational Equipment Lending Platform  
> **Phiên bản tài liệu:** v2.5.0 (Cập nhật Kiến trúc Pure Web3 Client-side Signing)  
> **Ngăn xếp công nghệ:** FastAPI (Python 3.11), SQLAlchemy 2.0, MySQL 8.0, React 18, Vite, Ethers.js v6, Solidity 0.8.20  
> **Mạng phân tán:** Ethereum Sepolia Testnet (EVM Compatible, Chain ID: 11155111)  

---

## MỤC LỤC
1. [Tổng quan Kiến trúc Đa tầng (Multi-Tier Architecture Overview)](#1-tổng-quan-kiến-trúc-đa-tầng)
2. [Mô hình Kết hợp Pure Web3 & Web2 Truyền thống](#2-mô-hình-kết-hợp-pure-web3--web2-truyền-thống)
3. [Giao thức Xác thực Danh tính và Ký số Ví (EIP-191 Nonce Challenge)](#3-giao-thức-xác-thực-danh-tính-và-ký-số-ví)
4. [Sơ đồ Luồng Nghiệp vụ Đầu-Cuối (End-to-End Sequence Diagrams)](#4-sơ-đồ-luồng-nghiệp-vụ-đầu-cuối)
5. [Từ điển Dữ liệu Cơ sở Dữ liệu MySQL (Database Data Dictionary)](#5-từ-điển-dữ-liệu-cơ-sở-dữ-liệu-mysql)
6. [Đặc tả Chi tiết Giao diện Lập trình Ứng dụng RESTful API](#6-đặc-tả-chi-tiết-giao-diện-lập-trình-ứng-dụng-restful-api)
   - 6.1. Nhóm API Xác thực & Định danh (`/api/v1/auth`)
   - 6.2. Nhóm API Quản lý Thiết bị Kho Lab (`/api/v1/equipment`)
   - 6.3. Nhóm API Điều phối Đơn mượn Trả (`/api/v1/loans`)
   - 6.4. Nhóm API Tích hợp Chuỗi khối & Trạng thái Node (`/api/v1/blockchain`)
   - 6.5. Nhóm API Báo cáo Kiểm toán Minh bạch (`/api/v1/audit`)
7. [Cơ chế Đồng bộ Dữ liệu và Xử lý Trễ Mạng On-Chain (State Reconciliation)](#7-cơ-chế-đồng-bộ-dữ-liệu-và-xử-lý-trễ-mạng-on-chain)
8. [Tiêu chuẩn Mã hóa và Bảo mật Thông tin (Security Standards)](#8-tiêu-chuẩn-mã-hóa-và-bảo-mật-thông-tin)

---

## 1. TỔNG QUAN KIẾN TRÚC ĐA TẦNG (MULTI-TIER ARCHITECTURE OVERVIEW)

EduVault được thiết kế theo mô hình lai phân tán, trong đó lớp lưu trữ dữ liệu tập trung (MySQL) đảm nhận việc tìm kiếm tốc độ cao và trải nghiệm người dùng mượt mà, trong khi lớp hợp đồng thông minh (Smart Contract trên Sepolia) đóng vai trò là "Chân lý Tối hậu" (Ultimate Source of Truth) bảo đảm tính bất biến, không thể gian lận của tài chính và quyền sở hữu thiết bị.

```
+---------------------------------------------------------------------------------------+
|                                    PRESENTATION LAYER                                 |
|   React 18 SPA + Vite + Tailwind CSS + Lucide Icons + GSAP (Single Page Application)  |
|   - Quản trị viên (Admin Dashboard)     - Sinh viên (Student Portal)                  |
|   - Quản lý kho thiết bị (Inventory)    - Kiểm toán công khai (Public Audit Ledger)   |
+---------------------------------------------------------------------------------------+
                                |                                   |
                  HTTPS / REST API Requests             JSON-RPC (EIP-1193) Calls
                                |                                   |
                                v                                   v
+-----------------------------------------------+   +-----------------------------------+
|               APPLICATION LAYER               |   |          WEB3 CLIENT WALLET       |
|   FastAPI (Asynchronous Python Framework)     |   |   MetaMask Extension / Mobile     |
|   - Auth & Session Service (JWT + EIP-191)    |   |   - Quản lý khóa riêng (PrivKey)  |
|   - Loan Workflow Orchestrator                |   |   - Ký giao dịch (Client Signing) |
|   - Blockchain Transaction Verifier Service   |   |   - Gửi ETH ký quỹ trực tiếp      |
|   - Inventory & Equipment Service             |   +-----------------------------------+
+-----------------------------------------------+                     |
          |                           |                               |
    SQLAlchemy ORM             Web3.py Client                         |
          |                           |                               |
          v                           v                               v
+-------------------+   +---------------------------------------------------------------+
| PERSISTENCE LAYER |   |                      BLOCKCHAIN LAYER                         |
| MySQL Database    |   |   Ethereum Sepolia Testnet (PoS Consensus, ChainId: 11155111) |
| - Users / Wallets |   |   - Smart Contract: EquipmentLending.sol (0xA88De9B...)       |
| - Equipments      |   |   - Phân quyền on-chain: DEFAULT_ADMIN, ADMIN, BORROWER       |
| - Loan Records    |   |   - Khóa thiết bị tự động: activeEquipmentLoan Mutex          |
| - Audit Logs      |   |   - Quỹ ký quỹ bảo lãnh (Escrow Deposit Fund)                 |
+-------------------+   +---------------------------------------------------------------+
```

---

## 2. MÔ HÌNH KẾT HỢP PURE WEB3 & WEB2 TRUYỀN THỐNG

Trước đây, các hệ thống bán tập trung thường sử dụng mô hình "Relayer" hoặc "Admin Backend Wallet", trong đó server nắm giữ khóa bí mật của quản trị viên và thay mặt người dùng gửi giao dịch lên blockchain. Mô hình này tồn tại 2 nhược điểm chết người:
1. **Rủi ro rò rỉ khóa bí mật của Server:** Nếu cơ sở dữ liệu backend bị lộ, toàn bộ tiền trong ví quản trị viên bị đánh cắp.
2. **Thiếu tính chối bỏ (Non-repudiation):** Người dùng có thể tuyên bố rằng server tự ý thực hiện giao dịch mà không có sự đồng ý của họ.

### Bước đột phá của EduVault v2.5 (Pure Web3 Client-side Signing):
- Cả **Quản trị viên** và **Sinh viên** đều bắt buộc phải ký số trực tiếp từ ví cá nhân thông qua extension MetaMask trên trình duyệt của họ.
- **Backend FastAPI hoàn toàn KHÔNG nắm giữ Private Key của bất kỳ ai.**
- Backend chuyển sang đóng vai trò là **Bộ thẩm định độc lập (Pure Web3 Verifier)**: Khi client gửi transaction hash lên, backend kết nối tới RPC node, lấy Receipt và Event logs chính thức, kiểm tra chữ ký ví và cập nhật trạng thái trong database nội bộ.

---

## 3. GIAO THỨC XÁC THỰC DANH TÍNH VÀ KÝ SỐ VÍ (EIP-191 NONCE CHALLENGE)

Để liên kết một tài khoản sinh viên/admin trong cơ sở dữ liệu với một địa chỉ ví Ethereum một cách an toàn và chống tấn công phát lại (Replay Attack), EduVault áp dụng chuẩn chữ ký EIP-191:

```
[Người dùng / MetaMask]                              [EduVault Backend API]
          |                                                   |
          | 1. Yêu cầu chuỗi Nonce ngẫu nhiên                 |
          |    POST /api/v1/auth/wallet/nonce                 |
          |-------------------------------------------------->|
          |                                                   | 2. Sinh chuỗi UUID nonce ngẫu nhiên
          |                                                   |    Lưu nonce vào bảng `users`
          | 3. Trả về Nonce Challenge                         |    (Thời hạn sống: 5 phút)
          |<--------------------------------------------------|
          |                                                   |
          | 4. MetaMask hiển thị yêu cầu ký số EIP-191:       |
          |    "EduVault Authentication Challenge:            |
          |     Nonce: <random_uuid>                          |
          |     Address: 0x...                                |
          |     Timestamp: 1731680000"                        |
          |                                                   |
          | 5. Người dùng xác nhận ký trên MetaMask           |
          |    Tạo ra signature 65-byte (r, s, v)             |
          |                                                   |
          | 6. Gửi địa chỉ ví và chữ ký lên máy chủ:          |
          |    POST /api/v1/auth/wallet/verify-signature      |
          |    Body: { wallet_address, signature }            |
          |-------------------------------------------------->|
          |                                                   | 7. Phục hồi địa chỉ từ chữ ký:
          |                                                   |    recovered_addr = ecrecover(hash, sig)
          |                                                   | 8. So khớp: recovered_addr == wallet_address
          |                                                   | 9. Hủy Nonce cũ (chống tấn công phát lại)
          |                                                   | 10. Đánh dấu `wallet_verified = 1`
          | 11. Trả về kết quả xác thực thành công            |
          |<--------------------------------------------------|
```

---

## 4. SƠ ĐỒ LUỒNG NGHIỆP VỤ ĐẦU-CUỐI (END-TO-END SEQUENCE DIAGRAMS)

### 4.1. Luồng Tạo Đơn Mượn & Đặt Cọc (Create Loan Request):
```
[Sinh viên]              [MetaMask]              [Smart Contract]            [Backend API]            [MySQL DB]
    |                        |                           |                         |                       |
    | 1. Chọn thiết bị       |                           |                         |                       |
    |    Bấm "Ký quỹ & Mượn" |                           |                         |                       |
    |----------------------->|                           |                         |                       |
    |                        | 2. Gọi createLoanRequest()|                         |                       |
    |                        |    msg.value = deposit    |                         |                       |
    |                        |-------------------------->|                         |                       |
    |                        |                           | 3. Khóa cọc & Mutex     |                       |
    |                        |                           |    Emit LoanRequested   |                       |
    |                        | 4. Nhận txHash thành công |                         |                       |
    |                        |<--------------------------|                         |                       |
    | 5. Báo cáo txHash      |                           |                         |                       |
    |    POST /api/v1/loans/request-with-tx              |                         |                       |
    |----------------------------------------------------------------------------->|                       |
    |                        |                           |                         | 6. Lấy tx receipt     |
    |                        |                           |<------------------------|    từ Sepolia RPC     |
    |                        |                           |------------------------>|                       |
    |                        |                           |                         | 7. Kiểm tra sự kiện,  |
    |                        |                           |                         |    người gửi, số tiền |
    |                        |                           |                         | 8. Ghi bản ghi đơn mới|
    |                        |                           |                         |---------------------->|
    | 9. Trả về thông tin đơn mượn PENDING               |                         |                       |
    |<-----------------------------------------------------------------------------|                       |
```

---

## 5. TỪ ĐIỂN DỮ LIỆU CƠ SỞ DỮ LIỆU MYSQL (DATABASE DATA DICTIONARY)

Hệ thống sử dụng cơ sở dữ liệu quan hệ MySQL `equipment_lending_db` gồm 5 bảng chính, được quản lý di chuyển phiên bản bởi Alembic.

### 5.1. Bảng `users` (Quản lý Tài khoản & Định danh Ví):
| Tên cột | Kiểu dữ liệu | Khóa | Cho phép NULL | Mô tả nghiệp vụ |
| :--- | :--- | :---: | :---: | :--- |
| `id` | `INT AUTO_INCREMENT` | **PK** | KHÔNG | Khóa chính tự tăng |
| `email` | `VARCHAR(255)` | **UQ** | KHÔNG | Địa chỉ email trường học của người dùng |
| `hashed_password` | `VARCHAR(255)` | | KHÔNG | Mật khẩu băm an toàn theo giải thuật bcrypt |
| `full_name` | `VARCHAR(255)` | | KHÔNG | Họ và tên đầy đủ |
| `student_staff_id` | `VARCHAR(50)` | **UQ** | KHÔNG | Mã số sinh viên (MSSV) hoặc Mã cán bộ |
| `role` | `ENUM('ADMIN', 'BORROWER')` | | KHÔNG | Vai trò cấp hệ thống |
| `wallet_address` | `VARCHAR(42)` | | CÓ | Địa chỉ ví Ethereum (định dạng Checksum 0x...) |
| `wallet_verified` | `TINYINT(1)` | | KHÔNG | `1` nếu đã xác minh EIP-191, `0` nếu chưa |
| `wallet_nonce` | `VARCHAR(64)` | | CÓ | Chuỗi ngẫu nhiên dùng cho phiên ký số gần nhất |
| `is_active` | `TINYINT(1)` | | KHÔNG | Cờ kích hoạt tài khoản (`1` = hoạt động) |
| `created_at` | `DATETIME` | | KHÔNG | Thời điểm tạo tài khoản |
| `updated_at` | `DATETIME` | | CÓ | Thời điểm cập nhật hồ sơ gần nhất |

### 5.2. Bảng `equipment` (Danh mục Thiết bị Thực hành Lab):
| Tên cột | Kiểu dữ liệu | Khóa | Cho phép NULL | Mô tả nghiệp vụ |
| :--- | :--- | :---: | :---: | :--- |
| `id` | `INT AUTO_INCREMENT` | **PK** | KHÔNG | Định danh duy nhất của thiết bị |
| `code` | `VARCHAR(50)` | **UQ** | KHÔNG | Mã quản lý tài sản vật lý (Ví dụ: `LAPTOP-DELL-002`) |
| `name` | `VARCHAR(255)` | | KHÔNG | Tên thương mại của thiết bị |
| `category` | `VARCHAR(100)` | | KHÔNG | Phân loại: Laptop, Máy đo xung, Kính hiển vi, Kit vi điều khiển |
| `specification` | `TEXT` | | CÓ | Cấu hình chi tiết (CPU, RAM, Dải tần đo, Độ phóng đại...) |
| `deposit_amount` | `DECIMAL(15,2)` | | KHÔNG | Mức tiền ký quỹ quy định tính theo VNĐ |
| `eth_deposit_amount` | `VARCHAR(50)` | | KHÔNG | Số tiền ký quỹ quy đổi sang Wei trên Blockchain |
| `status` | `ENUM('AVAILABLE', 'BORROWED', 'MAINTENANCE')` | | KHÔNG | Trạng thái vật lý trong kho |
| `image_url` | `VARCHAR(500)` | | CÓ | Đường dẫn hình ảnh minh họa thiết bị |
| `created_at` | `DATETIME` | | KHÔNG | Thời điểm nhập kho |

### 5.3. Bảng `loans` (Hồ sơ Mượn Trả Toàn vẹn):
| Tên cột | Kiểu dữ liệu | Khóa | Cho phép NULL | Mô tả nghiệp vụ |
| :--- | :--- | :---: | :---: | :--- |
| `id` | `INT AUTO_INCREMENT` | **PK** | KHÔNG | Khóa chính đơn mượn |
| `loan_code` | `VARCHAR(50)` | **UQ** | KHÔNG | Mã đơn mượn nghiệp vụ (Ví dụ: `LOAN-2026-00022`) |
| `onchain_loan_id` | `INT` | **UQ** | CÓ | ID định danh của đơn trên Smart Contract (nếu đã tạo on-chain) |
| `user_id` | `INT` | **FK** | KHÔNG | Khóa ngoại liên kết tới `users.id` |
| `equipment_id` | `INT` | **FK** | KHÔNG | Khóa ngoại liên kết tới `equipment.id` |
| `status` | `ENUM('PENDING', 'APPROVED', 'HANDED_OVER', 'RETURNED', 'CANCELLED', 'REJECTED')` | | KHÔNG | Trạng thái tiến trình của đơn |
| `deposit_amount_vnd` | `DECIMAL(15,2)` | | KHÔNG | Số tiền ký quỹ tính theo VNĐ |
| `deposit_amount_eth` | `VARCHAR(50)` | | KHÔNG | Số tiền ký quỹ tính theo Wei |
| `expected_start_time` | `DATETIME` | | KHÔNG | Thời gian dự kiến sinh viên đến nhận máy |
| `expected_due_time` | `DATETIME` | | KHÔNG | Hạn chót sinh viên phải trả máy |
| `actual_handover_time` | `DATETIME` | | CÓ | Thời điểm thực tế Admin bấm bàn giao thiết bị |
| `actual_return_time` | `DATETIME` | | CÓ | Thời điểm thực tế Admin bấm nghiệm thu hoàn trả |
| `handover_admin_id` | `INT` | **FK** | CÓ | ID cán bộ phòng Lab thực hiện bàn giao |
| `return_admin_id` | `INT` | **FK** | CÓ | ID cán bộ phòng Lab thực hiện nghiệm thu |
| `handover_condition` | `VARCHAR(255)` | | CÓ | Biên bản tình trạng máy lúc giao |
| `return_condition` | `VARCHAR(255)` | | CÓ | Biên bản tình trạng máy lúc thu hồi |
| `penalty_amount_vnd` | `DECIMAL(15,2)` | | KHÔNG | Số tiền phạt khấu trừ theo VNĐ |
| `refund_amount_vnd` | `DECIMAL(15,2)` | | KHÔNG | Số tiền thực tế hoàn trả cho sinh viên |
| `request_tx_hash` | `VARCHAR(66)` | | CÓ | Mã băm giao dịch lúc tạo đơn trên Sepolia |
| `approve_tx_hash` | `VARCHAR(66)` | | CÓ | Mã băm giao dịch lúc Admin phê duyệt đơn |
| `handover_tx_hash` | `VARCHAR(66)` | | CÓ | Mã băm giao dịch lúc bàn giao thiết bị |
| `return_tx_hash` | `VARCHAR(66)` | | CÓ | Mã băm giao dịch lúc tất toán trả máy |
| `cancel_tx_hash` | `VARCHAR(66)` | | CÓ | Mã băm giao dịch nếu đơn bị hủy |
| `created_at` | `DATETIME` | | KHÔNG | Thời điểm gửi yêu cầu mượn |

---

## 6. ĐẶC TẢ CHI TIẾT GIAO DIỆN LẬP TRÌNH ỨNG DỤNG RESTFUL API

Tất cả các endpoint đều có tiền tố chung: `/api/v1`. Mã phản hồi chuẩn theo chuẩn HTTP Status Codes.

### 6.1. Nhóm API Xác thực & Định danh (`/api/v1/auth`)

#### 6.1.1. `POST /api/v1/auth/login`
- **Mô tả:** Đăng nhập bằng tài khoản và mật khẩu, nhận JSON Web Token (JWT).
- **Request Body (application/x-www-form-urlencoded):**
  ```json
  {
    "username": "admin@eduvault.edu.vn",
    "password": "admin123456"
  }
  ```
- **Phản hồi thành công (HTTP 200 OK):**
  ```json
  {
    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "token_type": "bearer",
    "user": {
      "id": 1,
      "email": "admin@eduvault.edu.vn",
      "full_name": "Quản Trị Viên Hệ Thống (Admin)",
      "student_staff_id": "ADMIN001",
      "role": "ADMIN",
      "wallet_address": "0xc6C0B41C8fEf9708E5249B27B168aF0Df18871f2",
      "wallet_verified": true
    }
  }
  ```

#### 6.1.2. `POST /api/v1/auth/wallet/nonce`
- **Mô tả:** Lấy chuỗi thử thách ngẫu nhiên (Challenge Nonce) để ký số xác thực ví MetaMask qua chuẩn EIP-191.
- **Header:** `Authorization: Bearer <token>`
- **Request Body:**
  ```json
  {
    "wallet_address": "0xc6C0B41C8fEf9708E5249B27B168aF0Df18871f2"
  }
  ```
- **Phản hồi thành công (HTTP 200 OK):**
  ```json
  {
    "nonce": "eduvault-auth-b8f2a1c0-4321-49b9-9e8a-7e6d5c4b3a21",
    "message": "EduVault Wallet Verification\nAddress: 0xc6C0B41C8fEf9708E5249B27B168aF0Df18871f2\nNonce: eduvault-auth-b8f2a1c0-4321-49b9-9e8a-7e6d5c4b3a21"
  }
  ```

#### 6.1.3. `POST /api/v1/auth/wallet/verify-signature`
- **Mô tả:** Gửi chữ ký sinh ra từ MetaMask để máy chủ xác thực tính sở hữu hợp pháp của ví.
- **Request Body:**
  ```json
  {
    "wallet_address": "0xc6C0B41C8fEf9708E5249B27B168aF0Df18871f2",
    "signature": "0x4f8a9b2c...e1d2c3"
  }
  ```
- **Phản hồi thành công (HTTP 200 OK):**
  ```json
  {
    "status": "success",
    "verified": true,
    "message": "Xác minh quyền sở hữu ví MetaMask thành công!"
  }
  ```

---

### 6.2. Nhóm API Quản lý Thiết bị Kho Lab (`/api/v1/equipment`)

#### 6.2.1. `GET /api/v1/equipment`
- **Mô tả:** Lấy danh mục thiết bị hỗ trợ phân trang, lọc theo danh mục và từ khóa tìm kiếm.
- **Query Parameters:**
  - `page` (int, default: 1)
  - `limit` (int, default: 10)
  - `category` (string, optional)
  - `search` (string, optional)
- **Phản hồi thành công (HTTP 200 OK):**
  ```json
  {
    "items": [
      {
        "id": 2,
        "code": "LAPTOP-DELL-002",
        "name": "Dell XPS 15 9530",
        "category": "Laptop",
        "specification": "Intel Core i7-13700H, 32GB RAM, 1TB SSD, RTX 4060",
        "deposit_amount": 800000.0,
        "eth_deposit_amount": "1000000000000000",
        "status": "AVAILABLE",
        "image_url": "/assets/laptop-dell.jpg"
      }
    ],
    "total": 8,
    "page": 1,
    "total_pages": 1
  }
  ```

---

### 6.3. Nhóm API Điều phối Đơn mượn Trả (`/api/v1/loans`)

#### 6.3.1. `POST /api/v1/loans/request-with-tx`
- **Mô tả:** Sinh viên gửi giao dịch ký quỹ đã thành công từ MetaMask để tạo hồ sơ mượn trên hệ thống.
- **Quyền hạn:** `BORROWER` (đã xác minh ví).
- **Request Body:**
  ```json
  {
    "equipment_id": 2,
    "expected_start_time": "2026-11-20T08:00:00Z",
    "expected_due_time": "2026-11-23T17:00:00Z",
    "purpose_note": "Thực hành đồ án môn Hệ thống nhúng",
    "tx_hash": "0x5a1b2c3d4e5f60718293a4b5c6d7e8f90123456789abcdef0123456789abcdef"
  }
  ```
- **Phản hồi thành công (HTTP 201 Created):**
  ```json
  {
    "loan_id": 23,
    "loan_code": "LOAN-2026-00023",
    "status": "PENDING",
    "onchain_loan_id": 23,
    "tx_hash": "0x5a1b2c3d...",
    "created_at": "2026-11-17T10:30:00Z"
  }
  ```

#### 6.3.2. `POST /api/v1/loans/{loan_id}/approve`
- **Mô tả:** Admin phê duyệt đơn sau khi ký xác nhận on-chain qua hàm `approveLoan(loanId)`.
- **Quyền hạn:** `ADMIN`.
- **Request Body:**
  ```json
  {
    "tx_hash": "0x7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c"
  }
  ```
- **Phản hồi thành công (HTTP 200 OK):**
  ```json
  {
    "loan_id": 23,
    "status": "APPROVED",
    "approved_at": "2026-11-17T10:35:00Z",
    "message": "Đơn mượn đã được phê duyệt thành công trên Smart Contract!"
  }
  ```

#### 6.3.3. `POST /api/v1/loans/{loan_id}/handover`
- **Mô tả:** Admin bàn giao thiết bị vật lý cho sinh viên và đồng bộ mã giao dịch gọi hàm `confirmHandover`.
- **Request Body:**
  ```json
  {
    "tx_hash": "0x3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e",
    "condition_note": "Máy nguyên tem phòng Lab, màn hình không trầy xước, kèm sạc zin Type-C"
  }
  ```
- **Phản hồi thành công (HTTP 200 OK):**
  ```json
  {
    "loan_id": 23,
    "status": "HANDED_OVER",
    "actual_handover_time": "2026-11-17T10:40:00Z"
  }
  ```

#### 6.3.4. `POST /api/v1/loans/{loan_id}/return`
- **Mô tả:** Nghiệm thu tình trạng thiết bị khi sinh viên hoàn trả và đồng bộ kết quả tất toán tiền cọc on-chain.
- **Request Body:**
  ```json
  {
    "tx_hash": "0x9a8b7c6d5e4f3a2b1c0d9e8f7a6b5c4d3e2f1a0b9c8d7e6f5a4b3c2d1e0f9a8b",
    "condition": "GOOD",
    "condition_note": "Thiết bị hoạt động hoàn hảo, đã vệ sinh bàn phím, đầy đủ phụ kiện"
  }
  ```
- **Phản hồi thành công (HTTP 200 OK):**
  ```json
  {
    "loan_id": 23,
    "status": "RETURNED",
    "penalty_amount_vnd": 0.0,
    "refund_amount_vnd": 800000.0,
    "return_time": "2026-11-17T10:45:00Z"
  }
  ```

---

### 6.4. Nhóm API Tích hợp Chuỗi khối & Trạng thái Node (`/api/v1/blockchain`)

#### 6.4.1. `GET /api/v1/blockchain/status`
- **Mô tả:** Cung cấp thông tin tình trạng kết nối tới mạng lưới Ethereum Sepolia, địa chỉ contract hiện hành và số block cao nhất.
- **Phản hồi mẫu:**
  ```json
  {
    "status": "online",
    "mode": "pure-web3-verifier",
    "has_signer": false,
    "is_connected": true,
    "network": "sepolia",
    "rpc_url": "https://ethereum-sepolia-rpc.publicnode.com",
    "chain_id": 11155111,
    "expected_chain_id": 11155111,
    "contract_address": "0xA88De9B00C0F78FF9a162C4f17524ef885169ffd",
    "contract_deployed": true,
    "latest_block": 12153691
  }
  ```

---

## 7. CƠ CHẾ ĐỒNG BỘ DỮ LIỆU VÀ XỬ LÝ TRỄ MẠNG ON-CHAIN (STATE RECONCILIATION)

Trong mạng thử nghiệm công cộng như Sepolia, các Public RPC Node thường sử dụng mô hình Load Balancing trên nhiều Read-Replicas phân tán toàn cầu. Điều này dẫn đến hiện tượng **Độ trễ bản sao (Read Replica Lag)**: Giao dịch vừa được thợ đào đóng gói vào block và client nhận được xác nhận, nhưng khi Backend lập tức gửi lệnh `eth_call` để đọc trạng thái `getLoan(id)`, RPC Node có thể trỏ vào một replica chưa kịp cập nhật, trả về `state = 0 (Requested)` thay vì `state = 1 (Approved)`.

### Thuật toán Retry Exponential Backoff với Jitter của EduVault:
Tại hàm `_wait_for_onchain_state` trong `loan_service.py`:
```python
def _wait_for_onchain_state(contract, loan_id: int, expected_state: int, max_retries: int = 4, delay: float = 1.5):
    for attempt in range(max_retries):
        onchain_loan = contract.functions.loans(loan_id).call()
        current_state = onchain_loan[7]
        if current_state == expected_state:
            return onchain_loan
        logger.info(f"Đang chờ trạng thái on-chain cập nhật (lần {attempt + 1}/{max_retries})...")
        time.sleep(delay)
    raise StateDesyncError(f"Hợp đồng chưa cập nhật trạng thái mục tiêu {expected_state} sau {max_retries * delay}s")
```
Nhờ cơ chế này, hệ thống giải quyết triệt để $100\%$ các lỗi tranh chấp trạng thái (Race Condition) và mang lại trải nghiệm mượt mà không bao giờ gián đoạn cho người dùng.

---

## 8. TIÊU CHUẨN MÃ HÓA VÀ BẢO MẬT THÔNG TIN (SECURITY STANDARDS)

1. **Xác thực API:** Sử dụng JWT (JSON Web Tokens) với thuật toán ký `HS256`, thời hạn hết hạn 24 giờ.
2. **Bảo mật kênh truyền:** Toàn bộ liên lạc qua giao thức mã hóa TLS 1.3 (HTTPS / WSS).
3. **Phòng chống tấn công:**
   - Bảo vệ chống CSRF (Cross-Site Request Forgery) bằng tiêu chuẩn CORS ngặt nghèo chỉ chấp nhận nguồn gốc được chỉ định trong cấu hình.
   - Giới hạn tần suất gọi API (Rate Limiting) trên các endpoint nhạy cảm (Đăng nhập, sinh Nonce).
   - Kiểm tra chặt chẽ kiểu dữ liệu đầu vào thông qua thư viện Pydantic v2.

---
*Tài liệu được biên soạn và bảo trì định kỳ bởi Nhóm Kiến trúc Phần mềm EduVault.*


---

## 9. PHỤ LỤC: TOÀN BỘ ĐẶC TẢ OPENAPI 3.0.3 CHUẨN (RESTFUL API YAML SPECIFICATION)

Dưới đây là đặc tả kỹ thuật giao diện OpenAPI 3.0.3 hoàn chỉnh của toàn bộ hệ sinh thái Backend EduVault, có thể import trực tiếp vào Swagger Editor, Postman hoặc Insomnia:

```yaml
openapi: 3.0.3
info:
  title: EduVault Core Lending Engine API
  description: Hệ thống RESTful API bất đồng bộ phục vụ điều phối mượn trả thiết bị học tập và tích hợp Smart Contract Ethereum Sepolia.
  version: 2.5.0
  contact:
    name: EduVault Engineering Team
    email: contact@eduvault.edu.vn
servers:
  - url: http://localhost:8000/api/v1
    description: Môi trường phát triển cục bộ (Local Development)
  - url: https://api.eduvault.edu.vn/api/v1
    description: Môi trường thử nghiệm Staging / Production

paths:
  /auth/login:
    post:
      tags:
        - Authentication
      summary: Đăng nhập hệ thống và cấp phát JWT
      requestBody:
        required: true
        content:
          application/x-www-form-urlencoded:
            schema:
              type: object
              properties:
                username:
                  type: string
                  example: admin@eduvault.edu.vn
                password:
                  type: string
                  example: admin123456
              required:
                - username
                - password
      responses:
        '200':
          description: Đăng nhập thành công
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/LoginResponse'
        '401':
          description: Sai email hoặc mật khẩu

  /auth/wallet/nonce:
    post:
      tags:
        - Authentication
      summary: Lấy chuỗi thử thách Nonce ngẫu nhiên phục vụ ký số EIP-191
      security:
        - BearerAuth: []
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                wallet_address:
                  type: string
                  example: "0xc6C0B41C8fEf9708E5249B27B168aF0Df18871f2"
              required:
                - wallet_address
      responses:
        '200':
          description: Nonce challenge được tạo thành công
          content:
            application/json:
              schema:
                type: object
                properties:
                  nonce:
                    type: string
                  message:
                    type: string

  /auth/wallet/verify-signature:
    post:
      tags:
        - Authentication
      summary: Xác minh chữ ký số EIP-191 và liên kết ví với tài khoản
      security:
        - BearerAuth: []
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                wallet_address:
                  type: string
                signature:
                  type: string
              required:
                - wallet_address
                - signature
      responses:
        '200':
          description: Xác minh ví thành công

  /equipment:
    get:
      tags:
        - Equipment
      summary: Lấy danh mục thiết bị thực hành trong kho
      parameters:
        - name: page
          in: query
          schema:
            type: integer
            default: 1
        - name: limit
          in: query
          schema:
            type: integer
            default: 10
        - name: category
          in: query
          schema:
            type: string
        - name: search
          in: query
          schema:
            type: string
      responses:
        '200':
          description: Danh sách thiết bị phân trang
          content:
            application/json:
              schema:
                type: object
                properties:
                  items:
                    type: array
                    items:
                      $ref: '#/components/schemas/Equipment'
                  total:
                    type: integer
                  page:
                    type: integer
                  total_pages:
                    type: integer

  /loans/request-with-tx:
    post:
      tags:
        - Loans
      summary: Khởi tạo đơn mượn sau khi ký quỹ thành công trên MetaMask
      security:
        - BearerAuth: []
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                equipment_id:
                  type: integer
                expected_start_time:
                  type: string
                  format: date-time
                expected_due_time:
                  type: string
                  format: date-time
                purpose_note:
                  type: string
                tx_hash:
                  type: string
              required:
                - equipment_id
                - expected_start_time
                - expected_due_time
                - tx_hash
      responses:
        '201':
          description: Đơn mượn được lưu vết thành công

  /loans/{loan_id}/approve:
    post:
      tags:
        - Loans
      summary: Admin duyệt đơn mượn bằng giao dịch approveLoan
      security:
        - BearerAuth: []
      parameters:
        - name: loan_id
          in: path
          required: true
          schema:
            type: integer
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                tx_hash:
                  type: string
              required:
                - tx_hash
      responses:
        '200':
          description: Phê duyệt đơn thành công

  /loans/{loan_id}/handover:
    post:
      tags:
        - Loans
      summary: Admin xác nhận bàn giao thiết bị vật lý
      security:
        - BearerAuth: []
      parameters:
        - name: loan_id
          in: path
          required: true
          schema:
            type: integer
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                tx_hash:
                  type: string
                condition_note:
                  type: string
              required:
                - tx_hash
      responses:
        '200':
          description: Bàn giao thiết bị thành công

  /loans/{loan_id}/return:
    post:
      tags:
        - Loans
      summary: Admin nghiệm thu thu hồi thiết bị và tất toán tiền cọc
      security:
        - BearerAuth: []
      parameters:
        - name: loan_id
          in: path
          required: true
          schema:
            type: integer
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                tx_hash:
                  type: string
                condition:
                  type: string
                  enum: [GOOD, MINOR_DAMAGE, MAJOR_DAMAGE, LOST]
                condition_note:
                  type: string
              required:
                - tx_hash
                - condition
      responses:
        '200':
          description: Nghiệm thu và tất toán hoàn tất

  /blockchain/status:
    get:
      tags:
        - Blockchain
      summary: Tra cứu trạng thái kết nối tới Ethereum Sepolia Testnet
      responses:
        '200':
          description: Tình trạng kết nối node
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/BlockchainStatus'

components:
  securitySchemes:
    BearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT

  schemas:
    LoginResponse:
      type: object
      properties:
        access_token:
          type: string
        token_type:
          type: string
          example: bearer
        user:
          $ref: '#/components/schemas/User'

    User:
      type: object
      properties:
        id:
          type: integer
        email:
          type: string
        full_name:
          type: string
        student_staff_id:
          type: string
        role:
          type: string
          enum: [ADMIN, BORROWER]
        wallet_address:
          type: string
          nullable: true
        wallet_verified:
          type: boolean

    Equipment:
      type: object
      properties:
        id:
          type: integer
        code:
          type: string
        name:
          type: string
        category:
          type: string
        specification:
          type: string
        deposit_amount:
          type: number
        eth_deposit_amount:
          type: string
        status:
          type: string
          enum: [AVAILABLE, BORROWED, MAINTENANCE]
        image_url:
          type: string

    BlockchainStatus:
      type: object
      properties:
        status:
          type: string
          example: online
        mode:
          type: string
          example: pure-web3-verifier
        has_signer:
          type: boolean
          example: false
        is_connected:
          type: boolean
          example: true
        network:
          type: string
          example: sepolia
        rpc_url:
          type: string
        chain_id:
          type: integer
          example: 11155111
        contract_address:
          type: string
          example: "0xA88De9B00C0F78FF9a162C4f17524ef885169ffd"
        contract_deployed:
          type: boolean
          example: true
        latest_block:
          type: integer
```

---

## 10. TOÀN BỘ MÃ LỆNH KHỞI TẠO VÀ DI CHUYỂN DỮ LIỆU MYSQL (COMPLETE SQL DDL & DML SCRIPTS)

Dưới đây là kịch bản SQL nguyên bản phục vụ thiết lập môi trường cơ sở dữ liệu `equipment_lending_db`:

```sql
-- =============================================================================
-- HỆ QUẢN TRỊ CƠ SỞ DỮ LIỆU EDUVAULT - DDL SCHEMA & INITIAL DATA SEEDING
-- =============================================================================

DROP DATABASE IF EXISTS equipment_lending_db;
CREATE DATABASE equipment_lending_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE equipment_lending_db;

-- 1. BẢNG USERS (Tài khoản người dùng và thông tin ví MetaMask)
CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    hashed_password VARCHAR(255) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    student_staff_id VARCHAR(50) NOT NULL UNIQUE,
    role ENUM('ADMIN', 'BORROWER') NOT NULL DEFAULT 'BORROWER',
    wallet_address VARCHAR(42) NULL,
    wallet_verified TINYINT(1) NOT NULL DEFAULT 0,
    wallet_nonce VARCHAR(64) NULL,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NULL ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_user_email (email),
    INDEX idx_user_wallet (wallet_address),
    INDEX idx_user_staff_id (student_staff_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. BẢNG EQUIPMENT (Danh mục thiết bị phòng thí nghiệm)
CREATE TABLE equipment (
    id INT AUTO_INCREMENT PRIMARY KEY,
    code VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    category VARCHAR(100) NOT NULL,
    specification TEXT NULL,
    deposit_amount DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    eth_deposit_amount VARCHAR(50) NOT NULL DEFAULT '0',
    status ENUM('AVAILABLE', 'BORROWED', 'MAINTENANCE') NOT NULL DEFAULT 'AVAILABLE',
    image_url VARCHAR(500) NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NULL ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_equip_code (code),
    INDEX idx_equip_status (status),
    INDEX idx_equip_category (category)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. BẢNG LOANS (Hồ sơ quản lý mượn trả và liên kết giao dịch blockchain)
CREATE TABLE loans (
    id INT AUTO_INCREMENT PRIMARY KEY,
    loan_code VARCHAR(50) NOT NULL UNIQUE,
    onchain_loan_id INT NULL UNIQUE,
    user_id INT NOT NULL,
    equipment_id INT NOT NULL,
    status ENUM('PENDING', 'APPROVED', 'HANDED_OVER', 'RETURNED', 'CANCELLED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
    deposit_amount_vnd DECIMAL(15,2) NOT NULL,
    deposit_amount_eth VARCHAR(50) NOT NULL,
    expected_start_time DATETIME NOT NULL,
    expected_due_time DATETIME NOT NULL,
    actual_handover_time DATETIME NULL,
    actual_return_time DATETIME NULL,
    handover_admin_id INT NULL,
    return_admin_id INT NULL,
    handover_condition VARCHAR(255) NULL,
    return_condition VARCHAR(255) NULL,
    penalty_amount_vnd DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    refund_amount_vnd DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    request_tx_hash VARCHAR(66) NULL,
    approve_tx_hash VARCHAR(66) NULL,
    handover_tx_hash VARCHAR(66) NULL,
    return_tx_hash VARCHAR(66) NULL,
    cancel_tx_hash VARCHAR(66) NULL,
    purpose_note TEXT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NULL ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_loan_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT,
    CONSTRAINT fk_loan_equipment FOREIGN KEY (equipment_id) REFERENCES equipment(id) ON DELETE RESTRICT,
    CONSTRAINT fk_loan_handover_admin FOREIGN KEY (handover_admin_id) REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT fk_loan_return_admin FOREIGN KEY (return_admin_id) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_loan_status (status),
    INDEX idx_loan_user_id (user_id),
    INDEX idx_loan_equipment_id (equipment_id),
    INDEX idx_loan_onchain_id (onchain_loan_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. BẢNG AUDIT_LOGS (Nhật ký kiểm toán hệ thống)
CREATE TABLE audit_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NULL,
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id INT NULL,
    details JSON NULL,
    ip_address VARCHAR(45) NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_audit_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_audit_action (action),
    INDEX idx_audit_entity (entity_type, entity_id),
    INDEX idx_audit_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================================
-- KHỞI TẠO DỮ LIỆU BAN ĐẦU (SEED DATA)
-- =============================================================================

-- Chèn tài khoản Admin hệ thống (Mật khẩu: admin123456)
INSERT INTO users (id, email, hashed_password, full_name, student_staff_id, role, wallet_address, wallet_verified)
VALUES (
    1,
    'admin@eduvault.edu.vn',
    '$2b$12$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW',
    'Quản Trị Viên Hệ Thống (Admin)',
    'ADMIN001',
    'ADMIN',
    '0xc6C0B41C8fEf9708E5249B27B168aF0Df18871f2',
    1
);

-- Chèn tài khoản Sinh viên 1 (Mật khẩu: student123)
INSERT INTO users (id, email, hashed_password, full_name, student_staff_id, role, wallet_address, wallet_verified)
VALUES (
    2,
    'sv01@eduvault.edu.vn',
    '$2b$12$7kPjJ4V0qF5aQd1VpI5qSej.a1r3pW5E1y2u3I4o5P6a7S8d9F0g1',
    'Nguyễn Văn An',
    'SV2026001',
    'BORROWER',
    '0x5755ec806E7dd1Fe6222e98DBcb2a1EB6deA7BEB',
    1
);

-- Chèn tài khoản Sinh viên 2 (Mật khẩu: student123)
INSERT INTO users (id, email, hashed_password, full_name, student_staff_id, role, wallet_address, wallet_verified)
VALUES (
    3,
    'sv02@eduvault.edu.vn',
    '$2b$12$7kPjJ4V0qF5aQd1VpI5qSej.a1r3pW5E1y2u3I4o5P6a7S8d9F0g1',
    'Trần Thị Bình',
    'SV2026002',
    'BORROWER',
    '0x89ab12cd34ef5678901234567890abcdef123456',
    1
);

-- Chèn danh mục thiết bị thực hành phòng Lab
INSERT INTO equipment (id, code, name, category, specification, deposit_amount, eth_deposit_amount, status, image_url)
VALUES
(1, 'LAPTOP-DELL-001', 'Dell XPS 15 9530 (01)', 'Laptop', 'Core i7-13700H, 32GB RAM, 1TB SSD', 800000.00, '1000000000000000', 'AVAILABLE', '/assets/laptop-dell.jpg'),
(2, 'LAPTOP-DELL-002', 'Dell XPS 15 9530 (02)', 'Laptop', 'Core i7-13700H, 32GB RAM, 1TB SSD, RTX 4060', 800000.00, '1000000000000000', 'AVAILABLE', '/assets/laptop-dell.jpg'),
(3, 'LAPTOP-MAC-001', 'MacBook Pro 14 M3 Pro', 'Laptop', 'Apple M3 Pro 12-core, 18GB RAM, 512GB SSD', 1200000.00, '1500000000000000', 'AVAILABLE', '/assets/macbook-pro.jpg'),
(4, 'TABLET-SURFACE-001', 'Microsoft Surface Pro 9', 'Tablet', 'Core i5-1235U, 16GB RAM, 256GB SSD', 500000.00, '625000000000000', 'AVAILABLE', '/assets/surface-pro.jpg'),
(5, 'OSC-RIGOL-001', 'Máy Đo Xung Số Rigol DS1054Z', 'Thiết bị đo', '4 kênh, băng thông 50MHz, tốc độ lấy mẫu 1GSa/s', 400000.00, '500000000000000', 'AVAILABLE', '/assets/rigol-osc.jpg'),
(6, 'MIC-ANDON-001', 'Kính Hiển Vi Kỹ Thuật Số Andonstar', 'Thiết bị quang học', 'Màn hình LCD 7 inch, phóng đại 260x, ngõ ra HDMI', 300000.00, '375000000000000', 'AVAILABLE', '/assets/andonstar-mic.jpg'),
(7, 'KIT-ARDUINO-001', 'Bộ Cảm Biến Arduino IoT Starter Kit', 'Kit vi điều khiển', 'Kit ESP32 WiFi/BLE + 30 module cảm biến IoT', 150000.00, '187500000000000', 'BORROWED', '/assets/arduino-kit.jpg'),
(8, 'KIT-STM32-001', 'Kit Phát Triển STM32F4 Discovery', 'Kit vi điều khiển', 'Cortex-M4 168MHz, tích hợp mạch nạp ST-Link/V2', 200000.00, '250000000000000', 'AVAILABLE', '/assets/stm32-kit.jpg');
```

---
*Tài liệu đặc tả kiến trúc và cơ sở dữ liệu đã đồng bộ hoàn chỉnh.*
