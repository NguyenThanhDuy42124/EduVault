# HƯỚNG DẪN DÀNH CHO LẬP TRÌNH VIÊN VÀ QUY CHUẨN ĐÓNG GÓP MÃ NGUỒN (DEVELOPER ONBOARDING & CONTRIBUTION GUIDE)

> **Dự án:** EduVault Core Engineering Repository  
> **Ngôn ngữ & Khung phát triển:** Solidity 0.8.20, Python FastAPI, TypeScript React Vite, MySQL 8.0  
> **Tiêu chuẩn mã nguồn:** Clean Architecture, Domain-Driven Design (DDD), Solidity Style Guide, PEP 8, ESLint / Prettier  

---

## MỤC LỤC
1. [Thiết lập Môi trường Phát triển Cục bộ (Local Development Setup)](#1-thiết-lập-môi-trường-phát-triển-cục-bộ)
2. [Cấu trúc Thư mục Toàn dự án (Monorepo Folder Structure)](#2-cấu-trúc-thư-mục-toàn-dự-án)
3. [Quy chuẩn Viết Mã nguồn (Coding Standards & Conventions)](#3-quy-chuẩn-viết-mã-nguồn)
   - 3.1. Tiêu chuẩn viết Smart Contract Solidity
   - 3.2. Tiêu chuẩn viết Backend Python FastAPI
   - 3.3. Tiêu chuẩn viết Frontend React TypeScript
4. [Quy trình Quản lý Nhánh và Đặt tên Commit (Git Flow & Conventional Commits)](#4-quy-trình-quản-lý-nhánh-và-đặt-tên-commit)
5. [Quy trình Kiểm thử Trước khi Tạo Pull Request (Pre-PR Checklist)](#5-quy-trình-kiểm-thử-trước-khi-tạo-pull-request)
6. [Tích hợp Liên tục và Triển khai Tự động (CI/CD Pipelines)](#6-tích-hợp-liên-tục-và-triển-khai-tự-động)

---

## 1. THIẾT LẬP MÔI TRƯỜNG PHÁT TRIỂN CỤC BỘ (LOCAL DEVELOPMENT SETUP)

### 1.1. Yêu cầu công cụ phần mềm:
- **Node.js:** Phiên bản LTS 20.x trở lên.
- **Python:** Phiên bản 3.11 trở lên.
- **MySQL:** Phiên bản 8.0 hoặc máy chủ MariaDB tương đương (AMPPS, XAMPP hoặc Docker).
- **Git CLI:** Bản mới nhất.
- **Visual Studio Code:** Đi kèm các extensions khuyến nghị:
  - `JuanBlanco.solidity` (Hỗ trợ cú pháp Solidity).
  - `ms-python.python` (Hỗ trợ Python).
  - `dbaeumer.vscode-eslint` (Kiểm tra lỗi TypeScript/React).
  - `esbenp.prettier-vscode` (Tự động định dạng mã nguồn).

### 1.2. Khởi tạo kho mã nguồn:
```bash
git clone https://github.com/ntduyit2023/EduVault.git
cd EduVault
```

### 1.3. Khởi tạo Backend:
```bash
cd backend
python -m venv .venv
# Trên Windows:
.venv\Scripts\activate
# Trên Linux/macOS:
source .venv/bin/activate

pip install -r requirements.txt
alembic upgrade head
python -m uvicorn app.main:app --reload --port 8000
```

### 1.4. Khởi tạo Frontend:
```bash
cd ../frontend
npm install
npm run dev
```

---

## 2. CẤU TRÚC THƯ MỤC TOÀN DỰ ÁN (MONOREPO FOLDER STRUCTURE)

```
EduVault/
├── backend/                        # Máy chủ dịch vụ RESTful API (Python FastAPI)
│   ├── alembic/                    # Kịch bản di chuyển lược đồ database (Migrations)
│   ├── app/
│   │   ├── api/v1/endpoints/       # Các router điều phối (auth, loans, equipment, blockchain)
│   │   ├── core/                   # Cấu hình bảo mật, JWT, Web3 provider singleton
│   │   ├── models/                 # Lớp thực thể cơ sở dữ liệu SQLAlchemy ORM
│   │   ├── schemas/                # Lớp đối tượng truyền tải dữ liệu Pydantic DTO
│   │   ├── services/               # Tầng xử lý logic nghiệp vụ lõi (loan_service, auth_service)
│   │   └── main.py                 # Điểm khởi chạy ứng dụng FastAPI
│   └── requirements.txt            # Danh mục các thư viện Python phụ thuộc
│
├── frontend/                       # Ứng dụng giao diện người dùng (React 18 + Vite + TS)
│   ├── src/
│   │   ├── components/             # Các khối giao diện tái sử dụng (Navbar, Modal, StatusBadge)
│   │   ├── context/                # Trạng thái toàn cục (AuthContext, Web3Context)
│   │   ├── contracts/              # ABI và địa chỉ Smart Contract được đồng bộ
│   │   ├── pages/                  # Các màn hình chính (AdminLoansPage, EquipmentPage, AuditPage)
│   │   └── services/               # Lớp gọi API Axios kết nối tới Backend
│   ├── package.json                # Thư viện npm phụ thuộc
│   └── vite.config.ts              # Cấu hình biên dịch Vite
│
├── contracts/                      # Hợp đồng thông minh và kịch bản Web3 (Hardhat)
│   ├── contracts/                  # Mã nguồn Solidity (EquipmentLending.sol)
│   ├── scripts/                    # Script triển khai (deploy.js, init_roles.js)
│   ├── test/                       # Bộ kiểm thử tự động Mocha/Chai
│   └── hardhat.config.js           # Cấu hình mạng Sepolia và trình xác minh Etherscan
│
└── docs/                           # Tài liệu kỹ thuật, báo cáo kiến trúc và kiểm toán
```

---

## 3. QUY CHUẨN VIẾT MÃ NGUỒN (CODING STANDARDS & CONVENTIONS)

### 3.1. Tiêu chuẩn viết Smart Contract Solidity:
- **Chuẩn phong cách:** Tuân thủ [Official Solidity Style Guide](https://docs.soliditylang.org/en/latest/style-guide.html).
- **Thứ tự bố trí tệp:**
  1. Giấy phép bản quyền (`SPDX-License-Identifier`).
  2. Khai báo phiên bản Pragma (`pragma solidity ^0.8.20;`).
  3. Các lệnh Import.
  4. Interfaces, Libraries, Contracts.
  5. State Variables (Hằng số -> Immutables -> Biến thường).
  6. Events và Custom Errors.
  7. Modifiers.
  8. Functions: Constructor -> Receive/Fallback -> External -> Public -> Internal -> Private.
- **Tiết kiệm Gas:**
  - Tuyệt đối ưu tiên sử dụng `Custom Errors` (`error MyError(); revert MyError();`) thay vì chuỗi `require(condition, "error string")`.
  - Sử dụng từ khóa `calldata` cho các tham số mảng/chuỗi chỉ đọc trong hàm external.
  - Sử dụng khối `unchecked` cho các phép toán cộng bộ đếm không bao giờ tràn.

### 3.2. Tiêu chuẩn viết Backend Python FastAPI:
- Định dạng chuẩn: Tuân thủ nghiêm ngặt chuẩn PEP 8.
- Luôn chỉ định Type Hints (Static Typing) cho toàn bộ tham số hàm và giá trị trả về.
- Xử lý bất đồng bộ (Asynchronous): Sử dụng từ khóa `async def` cho các endpoint và tác vụ I/O.
- Tách biệt rành mạch các tầng: Router chỉ nhận Request và gọi Service; Service xử lý nghiệp vụ; Model chỉ định nghĩa dữ liệu.

### 3.3. Tiêu chuẩn viết Frontend React TypeScript:
- Sử dụng Functional Components kết hợp Hooks hiện đại.
- Không sử dụng kiểu dữ liệu `any` trừ trường hợp ngoại lệ bất khả kháng; luôn định nghĩa Interface rõ ràng.
- Sử dụng Tailwind CSS tiện ích, ưu tiên tính tương thích responsive trên thiết bị di động.

---

## 4. QUY TRÌNH QUẢN LÝ NHÁNH VÀ ĐẶT TÊN COMMIT (GIT FLOW & CONVENTIONAL COMMITS)

Dự án áp dụng quy chuẩn **Conventional Commits** để tự động hóa nhật ký thay đổi (Changelog):

```
<loại thay đổi>(<phạm vi>): <mô tả ngắn gọn bằng thể mệnh lệnh>

[Nội dung mô tả chi tiết nếu cần]

[Liên kết mã ticket / issue nếu có]
```

### Các tiền tố hợp lệ:
- `feat`: Thêm tính năng mới cho người dùng.
- `fix`: Sửa lỗi phần mềm.
- `docs`: Bổ sung hoặc chỉnh sửa tài liệu.
- `style`: Định dạng mã nguồn, không thay đổi logic.
- `refactor`: Tái cấu trúc mã nguồn nhằm tối ưu hiệu năng hoặc độ sạch.
- `test`: Thêm hoặc bổ sung ca kiểm thử tự động.
- `chore`: Cập nhật cấu hình build, thêm gói npm/pip.

---

## 5. QUY TRÌNH KIỂM THỬ TRƯỚC KHI TẠO PULL REQUEST (PRE-PR CHECKLIST)

Trước khi gửi Pull Request (PR) lên nhánh `main`, lập trình viên bắt buộc phải kiểm tra đạt các tiêu chuẩn sau:

- [ ] Lệnh `npm --prefix frontend run build` kết thúc với mã thoát 0 (Không có lỗi TypeScript).
- [ ] Lệnh `npx hardhat compile` trong thư mục `contracts` không có cảnh báo nghiêm trọng.
- [ ] Tất cả các bài kiểm thử `npx hardhat test` đều đạt 100% Pass.
- [ ] Backend vượt qua kiểm tra cú pháp và migrate database hoàn tất `alembic check`.
- [ ] Không vô tình commit các tệp bí mật như `.env`, khóa private key hoặc tệp `.venv`.

---
*Tài liệu hướng dẫn phát triển được thông qua bởi Ban Kỹ thuật EduVault.*
