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
- **Status:** pending
- Sẵn sàng chuyển sang Phase 4 sau khi người dùng phê duyệt Phase 3.

---

## Bảng Kết quả Kiểm thử Thực tế (Phase 3 Verification Matrix)

| Hạng mục kiểm thử | Lệnh thực thi thực tế | Kết quả mong đợi | Kết quả thực tế | Trạng thái |
| :--- | :--- | :--- | :--- | :--- |
| **Smart Contract Build & Test** | `npx hardhat test` | Biên dịch 0.8.24, pass test khởi tạo | 2 passing (840ms) | **PASS** |
| **Frontend Production Build** | `cd frontend; npm run build` | TypeScript pass, Vite bundle thành công | built in 3.75s, 0 error | **PASS** |
| **Backend Health & Startup API** | `pytest backend/tests/test_health.py` | Pass 3 test root, health và db health | 3 passed (1.28s) | **PASS** |
| **MySQL Server Connectivity** | `python scripts/test_db_connection.py` | Kết nối thành công tới 127.0.0.1:3306 | `{'status': 'connected', 'database': 'equipment_lending_db'}` | **PASS** |
| **Git Baseline & Ignore** | `git status -s` | Không theo dõi .venv, node_modules, .env | Chỉ thấy các source file chuẩn | **PASS** |

---

## 5-Question Reboot Check

| Câu hỏi | Câu trả lời |
| :--- | :--- |
| **Đang ở đâu?** | Đã hoàn thành 100% Phase 3: Project Structure & Environment Verification. Cả 3 thành phần Backend, Frontend, Smart Contract đều đã build và pass kiểm thử. |
| **Sắp đi đâu?** | Phase 4: Triển khai toàn bộ logic nghiệp vụ Smart Contract `EquipmentLending.sol` và Hardhat test suite chi tiết. |
| **Mục tiêu là gì?** | Hệ thống mượn trả thiết bị học tập hoàn chỉnh, kiểm thử được, dùng React, FastAPI, MySQL và Hardhat EVM. |
| **Đã học được gì?** | Cần ghim `eth-account<0.11.0` trên Python 3.13 Windows để tránh thiếu C compiler; MySQL trên Windows cần dùng `127.0.0.1` để tránh nghẽn IPv6 `localhost`. |
| **Đã làm được gì?** | Khởi tạo xong toàn bộ nền móng dự án; MySQL kết nối thành công; Smart contract test pass; Frontend build pass; Backend health test pass. |

---

## 5-Question Reboot Check

| Câu hỏi | Câu trả lời |
| :--- | :--- |
| **Đang ở đâu?** | Đã hoàn thành 100% Phase 2. Toàn bộ thiết kế kiến trúc, CSDL MySQL, Smart Contract, API, quy tắc phạt và đồng bộ được tập trung đầy đủ trong `findings.md`. |
| **Sắp đi đâu?** | Phase 3: Khởi tạo cấu trúc dự án (`backend`, `frontend`, `contracts`, `.env.example`, script test kết nối MySQL). |
| **Mục tiêu là gì?** | Hệ thống mượn trả thiết bị học tập hoàn chỉnh, kiểm thử được, dùng React, FastAPI, MySQL và Hardhat EVM. |
| **Đã học được gì?** | Giữ mọi tài liệu thiết kế tập trung trong 3 file chính (`findings.md`, `task_plan.md`, `progress.md`) giúp dự án gọn gàng, liền mạch và dễ theo dõi. |
| **Đã làm được gì?** | Hoàn thành và đồng bộ tuyệt đối cả 3 file kế hoạch; giải quyết dứt điểm 5 vấn đề kiến trúc quan trọng. |
