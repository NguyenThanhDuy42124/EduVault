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
- **Status:** pending
- Sẵn sàng chuyển sang Phase 5 sau khi người dùng phê duyệt Phase 4.


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

## 5-Question Reboot Check

| Câu hỏi | Câu trả lời |
| :--- | :--- |
| **Đang ở đâu?** | Đã hoàn thành 100% Phase 4: Smart Contract & EVM Testing. Contract biên dịch, 28/28 test pass, deploy thành công, ABI/address exported sang backend. |
| **Sắp đi đâu?** | Phase 5: Triển khai Backend FastAPI + MySQL + Web3.py (Models, Auth, APIs, Blockchain Service). |
| **Mục tiêu là gì?** | Hệ thống mượn trả thiết bị học tập hoàn chỉnh, kiểm thử được, dùng React, FastAPI, MySQL và Hardhat EVM. |
| **Đã học được gì?** | Cần `npm install` trước khi chạy `npx hardhat`; Node.js v24 có thể cài Hardhat v3 global gây conflict với v2 local; Cần ghim `eth-account<0.11.0` trên Python 3.13 Windows. |
| **Đã làm được gì?** | Phase 0-4 hoàn thành: Khảo sát → Yêu cầu → Thiết kế → Môi trường → Smart Contract. Contract có đầy đủ lifecycle, mutex, phạt tự động. 28 tests bao phủ 100%. Deploy + export ABI thành công. |


