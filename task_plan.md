# Task Plan: EduVault - Smart Contract-Based Educational Equipment Lending Management System

## Goal
Xây dựng, kiểm thử và tài liệu hóa **EduVault** - hệ thống quản lý mượn trả thiết bị học tập sử dụng React + TypeScript, Python FastAPI, **MySQL** (lưu trữ quan hệ) và Smart Contract Solidity trên Local Hardhat EVM (ghi nhận trạng thái bất biến, tiền cọc mô phỏng và nhật ký kiểm toán).

---

## Current Phase
Phase 6B: Nâng cấp Trang Trình diễn Tổng quan (Interactive Showcase Dashboard with GSAP Web 3D) & Phase 7: Tích hợp End-to-End

---

## Lộ trình & Checklist Nhiệm vụ Chi tiết

### Phase 0: Khảo sát Môi trường & Hiện trạng
- [x] Task 0.1: Kiểm tra thư mục làm việc, phiên bản công cụ và môi trường hệ thống.
- [x] Task 0.2: Kiểm tra Node.js v24, Python 3.13, pip 26, Git, MySQL.
- [x] Task 0.3: Ghi nhận ma trận tương thích và ràng buộc công nghệ vào `findings.md`.
- **Status:** complete

---

### Phase 1: Phạm vi & Yêu cầu Nghiệp vụ
- [x] Task 1.1: Định nghĩa yêu cầu chức năng (FR) và phi chức năng (NFR).
- [x] Task 1.2: Phân quyền vai trò người dùng (ADMIN vs BORROWER).
- [x] Task 1.3: Xác định 11 quy tắc nghiệp vụ cốt lõi (tiền cọc, duyệt, bàn giao, trả máy, hủy đơn, phạt trễ).
- [x] Task 1.4: Phân định ranh giới On-chain vs Off-chain.
- [x] Task 1.5: Thiết kế sơ bộ State Machine và thực thể MySQL.
- **Status:** complete

---

### Phase 2: Thiết kế Kiến trúc & Đặc tả Kỹ thuật (Tập trung trong `findings.md`)
- [x] Task 2.1: Sơ đồ kiến trúc Mermaid và luồng thành phần (Mục 3 trong `findings.md`).
- [x] Task 2.2: Ranh giới dữ liệu và nguồn dữ liệu chuẩn - Source of Truth (Mục 4 trong `findings.md`).
- [x] Task 2.3: Mô hình ký giao dịch Web2.5 Custodial Relayer / Admin Signer (Mục 5 trong `findings.md`).
- [x] Task 2.4: Tiền cọc mô phỏng & Quy tắc phạt quá hạn rõ ràng (Mục 6 trong `findings.md`).
- [x] Task 2.5: Xử lý cạnh tranh & Chống đặt trùng với MySQL Pessimistic Lock (Mục 7 trong `findings.md`).
- [x] Task 2.6: Xử lý Dual-write & Background Reconciliation Worker (Mục 8 trong `findings.md`).
- [x] Task 2.7: Cấu trúc CSDL MySQL DDL chi tiết 5 bảng (Mục 9 trong `findings.md`).
- [x] Task 2.8: Đặc tả Smart Contract `EquipmentLending.sol` (Mục 10 trong `findings.md`).
- [x] Task 2.9: Danh mục REST API endpoints cốt lõi (Mục 11 trong `findings.md`).
- **Status:** complete

---

### Phase 3: Thiết lập Cấu trúc Thư mục & Môi trường Dự án
- [x] Task 3.1: Khởi tạo cấu trúc dự án (`backend/`, `frontend/`, `contracts/`, `scripts/`, `docs/`, `.gitignore`, `.env.example`).
- [x] Task 3.2: Thiết lập môi trường Smart Contract Hardhat (`contracts/package.json`, `hardhat.config.cjs`, `EquipmentLending.sol` skeleton, compile & minimal test: 2 tests passed).
- [x] Task 3.3: Thiết lập môi trường Backend (`backend/.venv`, `requirements.txt`, Settings, MySQL connection, Health API, CORS, Alembic baseline, Pytest suite: 3 tests passed).
- [x] Task 3.4: Thiết lập môi trường Frontend (`frontend/` React 18 + Vite + TS, Lucide React, Tailwind, Axios client, Health check landing page, `npm run build` passed).
- [x] Task 3.5: Kiểm thử môi trường tích hợp & Kết nối MySQL thực tế (Host `127.0.0.1:3306`, User `root`, DB `equipment_lending_db`: CONNECTED - PASSED).
- **Status:** complete

---

### Phase 4: Triển khai Smart Contract & EVM Testing
- [x] Task 4.1: Hoàn thiện Smart Contract `EquipmentLending.sol` (OpenZeppelin Ownable, Simulated Deposit Accounting, Mutex khóa thiết bị `activeEquipmentLoan`, sự kiện đầy đủ, logic phạt tự động).
- [x] Task 4.2: Xây dựng Hardhat test suite toàn diện (kiểm thử 100% case: Deployment & Ownership, Standard On-time Return, Overdue 10%/50%, Damaged/Lost 100% Forfeit, Cancellation Submitted/Approved, Revert khi Active, Mutex chống đặt trùng, Revert khi trùng Loan ID). **28/28 tests passed.**
- [x] Task 4.3: Viết script deploy contract `scripts/deploy.cjs` và lưu địa chỉ contract sau khi deploy lên Hardhat local node.
- [x] Task 4.4: Export ABI và Contract Address sang backend (`backend/app/core/contracts/`).
- **Status:** complete

---

### Phase 5: Triển khai Backend (FastAPI + MySQL + Web3.py)
- [x] Task 5.1: Xây dựng Model SQLAlchemy hoàn chỉnh (5 bảng: `User`, `Equipment`, `LendingRequest`, `BlockchainTransaction`, `AuditLog`) bao gồm các cột an toàn `failed_login_count`, `locked_until`, `updated_at`.
- [x] Task 5.2: Khởi tạo và chạy Alembic migration để tạo bảng thực tế trên MySQL database `equipment_lending_db`.
- [x] Task 5.3: Triển khai Auth Service: băm mật khẩu `bcrypt`, sinh JWT HS256 (30 phút), kiểm soát đăng nhập sai (khóa 15 phút sau 5 lần sai), cơ chế RBAC với `Depends(require_role)`.
- [x] Task 5.4: Triển khai API quản lý tài khoản: `POST /api/v1/auth/login`, `GET /api/v1/users/me`, `POST /api/v1/admin/users`, `GET /api/v1/admin/users`.
- [x] Task 5.5: Triển khai Equipment CRUD với cơ chế khóa dòng MySQL Pessimistic Lock (`SELECT ... FOR UPDATE`) chống tranh chấp mượn.
- [x] Task 5.6: Triển khai Web3.py Blockchain Service: kết nối Hardhat RPC, ký giao dịch với Custodial Relayer, đọc trạng thái contract, bắt sự kiện và xử lý receipt.
- [x] Task 5.7: Triển khai đầy đủ API vòng đời mượn trả:
  - `POST /api/v1/loans/request` (Sinh viên gửi đơn)
  - `POST /api/v1/loans/{id}/approve` (Admin duyệt + đẩy on-chain)
  - `POST /api/v1/loans/{id}/reject` (Admin từ chối)
  - `POST /api/v1/loans/{id}/handover` (Admin bàn giao + khóa cọc on-chain)
  - `POST /api/v1/loans/{id}/return` (Admin nhận lại máy + tính phạt/cọc on-chain)
  - `POST /api/v1/loans/{id}/cancel` (Hủy đơn + giải phóng Mutex on-chain)
- [x] Task 5.8: Triển khai Background Reconciliation Worker và API `/api/v1/audit/reconcile` tự động đối soát và khôi phục lệch trạng thái giữa MySQL và Smart Contract.
- [x] Task 5.9: Viết script `scripts/seed.py` nạp dữ liệu mẫu ban đầu (1 Admin, 3 Sinh viên, 8 Thiết bị thuộc các danh mục khác nhau).
- [x] Task 5.10: Xây dựng bộ kiểm thử tự động Pytest cho toàn bộ API Backend (56/56 tests passing).
- **Status:** complete

---

### Phase 6: Triển khai Frontend (React + TypeScript + Vite)
- [x] Task 6.1: Cấu hình Axios Client (kèm interceptor tự động gán Bearer Token), Auth Context quản lý trạng thái đăng nhập và Protected Route theo quyền (ADMIN / BORROWER).
- [x] Task 6.2: Xây dựng Layout chuẩn (Header, Navigation, nút chuyển đổi nhanh tài khoản demo Admin/Sinh viên, hiển thị thông tin người dùng).
- [x] Task 6.3: Giao diện Đăng nhập (`/login`) với form chuẩn và 2 nút Quick Fill tài khoản demo.
- [x] Task 6.4: Giao diện Danh mục thiết bị (`/` hoặc `/equipment`): tìm kiếm, bộ lọc theo danh mục và trạng thái, thẻ hiển thị cấu hình, tiền cọc, nút đăng ký mượn.
- [x] Task 6.5: Giao diện Modal/Form đăng ký mượn: chọn ngày bàn giao dự kiến, hạn trả, hiển thị tóm tắt quy định tiền cọc và phạt trễ hạn.
- [x] Task 6.6: Giao diện Sinh viên (`/my-loans`): danh sách đơn mượn cá nhân, Stepper tiến trình mượn trả trực quan, trạng thái tiền cọc, nút hủy đơn khi chưa nhận máy.
- [x] Task 6.7: Giao diện Quản lý kho (`/admin/loans`): bảng điều khiển phân tab (Chờ duyệt, Đang mượn, Đã hoàn tất), modal duyệt đơn, modal xác nhận bàn giao, modal trả máy kèm đánh giá tình trạng và tính phạt tức thì.
- [x] Task 6.8: Giao diện Quản trị kho thiết bị (`/admin/inventory`): thêm thiết bị mới, chuyển trạng thái bảo trì/sẵn sàng.
- [x] Task 6.9: Giao diện Kiểm toán Blockchain (`/audit`): bảng theo dõi block và transaction hash, công cụ đối soát tính toàn vẹn (Verify Loan) so khớp giữa MySQL và Smart Contract, nút kích hoạt đối soát tự động.
- **Status:** complete

---

### Phase 6B: Nâng cấp Trang Trình diễn Tổng quan (Interactive Showcase Dashboard with GSAP Web 3D)
- [ ] Task 6B.1: Cấu hình thư viện GSAP (`gsap`, `@gsap/react`) và khởi tạo component `ShowcasePage.tsx` (tại tuyến đường `/overview` hoặc trang chủ giới thiệu).
- [ ] Task 6B.2: Zone 1 - Hero Section & Khối 3D Vault tương tác theo con trỏ chuột (GSAP Perspective 3D Tilt + Counter số liệu thời gian thực).
- [ ] Task 6B.3: Zone 2 - Visual Pipeline 4 trạm trực quan hóa luồng Web2.5 (MySQL Pessimistic Lock -> FastAPI Relayer ký số -> Smart Contract Mutex -> Quyết toán cọc).
- [ ] Task 6B.4: Zone 3 - Live On-Chain Transaction Terminal (Stream log giao dịch thời gian thực từ Hardhat EVM với hiệu ứng trượt GSAP).
- [ ] Task 6B.5: Zone 4 - Equipment Spotlight & Simulator Playground (Bảng giả lập tương tác kịch bản: trả đúng hạn, trễ hạn phạt 10%-50%, báo mất thu hồi cọc).
- [ ] Task 6B.6: Kiểm toán chất lượng UI/UX theo tiêu chuẩn `/impeccable` (Độ tương phản $\ge 4.5:1$, độ dài dòng $\le 75$ ký tự, không text < 12px, mượt mà 60fps).
- **Status:** pending

---

### Phase 7: Tích hợp End-to-End & Xác minh Nghiệp vụ
- [ ] Task 7.1: Chạy kịch bản luồng mượn trả chuẩn từ A-Z (Sinh viên tạo đơn -> Admin duyệt -> Bàn giao -> Trả đúng hạn -> Hoàn cọc 100%).
- [ ] Task 7.2: Kiểm thử các kịch bản ngoại lệ:
  - Trả máy trễ hạn <= 24h (khấu trừ phạt 10%).
  - Trả máy trễ hạn > 24h (khấu trừ phạt 50%).
  - Báo hỏng thiết bị (khấu trừ 100% cọc vào quỹ trường).
  - Báo mất thiết bị (khấu trừ 100% cọc + khóa tài khoản).
  - Cạnh tranh đặt trùng cùng thiết bị (kiểm tra MySQL lock & Smart Contract Mutex).
  - Hủy đơn khi đã duyệt (kiểm tra giải phóng Mutex on-chain).
- [ ] Task 7.3: Kiểm thử cơ chế phục hồi (Crash Simulation): giả lập server tắt đột ngột khi giao dịch on-chain đã gửi, chạy reconciliation worker kiểm tra khả năng tự đồng bộ MySQL.
- **Status:** pending

---

### Phase 8: Kiểm thử QA & Rà soát Bảo mật
- [ ] Task 8.1: Chạy toàn bộ test suites tự động (Smart Contract Hardhat tests + Backend Pytest).
- [ ] Task 8.2: Rà soát bảo mật: kiểm tra chống lộ private key, kiểm tra phân quyền JWT, kiểm tra bảo vệ brute-force đăng nhập, kiểm tra reentrancy và quyền onlyOwner trên Smart Contract.
- [ ] Task 8.3: Lập báo cáo kết quả kiểm thử QA & Bảo mật chi tiết.
- **Status:** pending

---

### Phase 9: Đóng gói Triển khai & Hướng dẫn Cài đặt
- [ ] Task 9.1: Hoàn thiện file cấu hình mẫu `.env.example` với đầy đủ chú thích tham số.
- [ ] Task 9.2: Viết script khởi chạy một chạm `scripts/start_all.ps1` (chạy song song Hardhat node, FastAPI backend và Vite frontend).
- [ ] Task 9.3: Viết tài liệu hướng dẫn cài đặt từng bước từ clean checkout (`README.md`).
- **Status:** pending

---

### Phase 10: Tài liệu Học thuật & Kịch bản Báo cáo
- [ ] Task 10.1: Soạn thảo bản thuyết minh đồ án tổng hợp bằng Tiếng Việt (Tổng quan đề tài, Kiến trúc hệ thống, Thiết kế CSDL & Smart Contract, Phân tích tính an toàn).
- [ ] Task 10.2: Soạn thảo kịch bản demo 5 bước (5-7 phút) cho buổi báo cáo trước hội đồng.
- [ ] Task 10.3: Tổng hợp bộ 10 câu hỏi phản biện của giảng viên và câu trả lời kỹ thuật chuẩn xác.
- **Status:** pending

---

### Phase 11: Nghiệm thu Cuối cùng
- [ ] Task 11.1: Đối chiếu sản phẩm thực tế với Acceptance Criteria đã cam kết.
- [ ] Task 11.2: Bàn giao toàn bộ source code, cơ sở dữ liệu mẫu và tài liệu đồ án cho người dùng.
- **Status:** pending
