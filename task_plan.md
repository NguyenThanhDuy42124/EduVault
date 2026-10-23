# Task Plan: Smart Contract-Based Educational Equipment Lending Management System

## Goal
Xây dựng, kiểm thử và tài liệu hóa hệ thống quản lý mượn trả thiết bị học tập sử dụng React + TypeScript, Python FastAPI, **MySQL** (lưu trữ quan hệ) và Smart Contract Solidity trên Local Hardhat EVM (ghi nhận trạng thái bất biến, tiền cọc mô phỏng và nhật ký kiểm toán).

---

## Current Phase
Phase 3: Thiết lập Cấu trúc Thư mục & Môi trường Dự án (ĐÃ HOÀN TẤT VÀ KIỂM THỬ THÀNH CÔNG)

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
- [x] Task 2.1: Sơ đồ kiến trúc Mermaid và luồng thành phần (Mục 2 trong `findings.md`).
- [x] Task 2.2: Ranh giới dữ liệu và nguồn dữ liệu chuẩn - Source of Truth (Mục 3 trong `findings.md`).
- [x] Task 2.3: Mô hình ký giao dịch Web2.5 Custodial Relayer / Admin Signer (Mục 4 trong `findings.md`).
- [x] Task 2.4: Tiền cọc mô phỏng & Quy tắc phạt quá hạn rõ ràng (Mục 5 trong `findings.md`).
- [x] Task 2.5: Xử lý cạnh tranh & Chống đặt trùng với MySQL Pessimistic Lock (Mục 6 trong `findings.md`).
- [x] Task 2.6: Xử lý Dual-write & Background Reconciliation Worker (Mục 7 trong `findings.md`).
- [x] Task 2.7: Cấu trúc CSDL MySQL DDL chi tiết 5 bảng (Mục 8 trong `findings.md`).
- [x] Task 2.8: Đặc tả Smart Contract `EquipmentLending.sol` (Mục 9 trong `findings.md`).
- [x] Task 2.9: Danh mục REST API endpoints cốt lõi (Mục 10 trong `findings.md`).
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
- [ ] Task 4.1: Viết Smart Contract `EquipmentLending.sol` hoàn chỉnh (OpenZeppelin Ownable, Simulated Deposit Accounting).
- [ ] Task 4.2: Viết Hardhat test suite (kiểm thử 100% case: duyệt, bàn giao, trả máy, hủy đơn, phạt quá hạn, từ chối trái phép).
- [ ] Task 4.3: Viết script deploy và seed dữ liệu mẫu trên local EVM.
- [ ] Task 4.4: Export ABI sang backend.
- **Status:** pending

---

### Phase 4: Triển khai Smart Contract & EVM Testing
- [ ] Task 4.1: Viết Smart Contract `EquipmentLending.sol` (OpenZeppelin Ownable, Simulated Deposit).
- [ ] Task 4.2: Viết Hardhat test suite (kiểm thử 100% case: duyệt, bàn giao, trả máy, hủy đơn, phạt quá hạn, từ chối trái phép).
- [ ] Task 4.3: Viết script deploy và seed dữ liệu mẫu trên local EVM.
- [ ] Task 4.4: Export ABI sang backend.
- **Status:** pending

---

### Phase 5: Triển khai Backend (FastAPI + MySQL + Web3.py)
- [ ] Task 5.1: Xây dựng Model SQLAlchemy và Alembic migration trên MySQL.
- [ ] Task 5.2: Triển khai Auth Service (JWT, bcrypt, phân quyền ADMIN / BORROWER).
- [ ] Task 5.3: Triển khai Equipment CRUD với Pessimistic Lock (`SELECT ... FOR UPDATE`).
- [ ] Task 5.4: Triển khai Web3.py Blockchain Service (gọi contract, ký giao dịch, kiểm tra receipt).
- [ ] Task 5.5: Triển khai các API mượn trả (Request, Approve, Handover, Return, Cancel).
- [ ] Task 5.6: Triển khai API kiểm toán và Background Reconciliation Worker.
- [ ] Task 5.7: Viết automated test Pytest cho API backend.
- **Status:** pending

---

### Phase 6: Triển khai Frontend (React + TypeScript + Vite)
- [ ] Task 6.1: Dựng API Client, Auth Context và Protected Route.
- [ ] Task 6.2: Giao diện Đăng nhập & Chuyển đổi vai trò demo.
- [ ] Task 6.3: Giao diện Danh mục thiết bị & Chi tiết.
- [ ] Task 6.4: Giao diện Sinh viên (Form mượn, danh sách thiết bị đang mượn, lịch sử, cọc).
- [ ] Task 6.5: Giao diện Quản lý kho (Duyệt đơn, xác nhận bàn giao, kiểm tra máy khi trả).
- [ ] Task 6.6: Giao diện Tra cứu Blockchain Audit (xem transaction hash, trạng thái xác thực).
- **Status:** pending

---

### Phase 7: Tích hợp End-to-End & Xác minh Nghiệp vụ
- [ ] Task 7.1: Chạy quy trình mẫu mượn trả hoàn chỉnh end-to-end.
- [ ] Task 7.2: Kiểm thử các trường hợp biên (cạnh tranh đặt trùng, hủy đơn, trả quá hạn, phạt hỏng máy).
- [ ] Task 7.3: Kiểm thử cơ chế phục hồi khi node EVM hoặc MySQL gặp gián đoạn.
- **Status:** pending

---

### Phase 8: Kiểm thử QA & Rà soát Bảo mật
- [ ] Task 8.1: Chạy toàn bộ test suites (Contract tests + Backend Pytest).
- [ ] Task 8.2: Rà soát bảo mật Smart Contract & Backend API.
- [ ] Task 8.3: Báo cáo kết quả kiểm thử.
- **Status:** pending

---

### Phase 9: Đóng gói Triển khai & Hướng dẫn Cài đặt
- [ ] Task 9.1: Cấu hình file `.env.example` hoàn chỉnh.
- [ ] Task 9.2: Viết script khởi chạy một chạm (PowerShell / Bash).
- [ ] Task 9.3: Hướng dẫn cài đặt từng bước từ clean checkout.
- **Status:** pending

---

### Phase 10: Tài liệu Học thuật & Kịch bản Báo cáo
- [ ] Task 10.1: Bản thuyết minh đồ án tổng hợp (Tiếng Việt).
- [ ] Task 10.2: Kịch bản demo 5-10 phút cho giảng viên.
- [ ] Task 10.3: Bộ câu hỏi bảo vệ đồ án kèm câu trả lời chuẩn kỹ thuật.
- **Status:** pending

---

### Phase 11: Nghiệm thu Cuối cùng
- [ ] Task 11.1: Đối chiếu sản phẩm thực tế với Acceptance Criteria.
- [ ] Task 11.2: Báo cáo tổng kết dự án.
- **Status:** pending
