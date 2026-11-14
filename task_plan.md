# Task Plan: EduVault - Smart Contract-Based Educational Equipment Lending Management System

## Goal
Xây dựng, kiểm thử và tài liệu hóa **EduVault** - hệ thống quản lý mượn trả thiết bị học tập sử dụng React + TypeScript, Python FastAPI, **MySQL** (lưu trữ quan hệ) và Smart Contract Solidity trên Local Hardhat EVM (ghi nhận trạng thái bất biến, tiền cọc mô phỏng và nhật ký kiểm toán).

---

## Current Phase
Phase 7A: Hoàn thiện tích hợp MetaMask và tính nhất quán dữ liệu — **ĐÃ HOÀN TẤT (complete)**. Chờ xác nhận của người dùng trước khi chuyển sang **Phase 13: Nâng cấp Smart Contract Pure Web3 & Cơ chế Multi-Admin**.

### Cập nhật rà soát ngày 2026-11-06
- Đã hoàn tất đánh giá lại mã nguồn tại `6076211`, bao gồm tích hợp MetaMask trong `2b2803a`.
- Chi tiết bằng chứng phát hiện cũ: `findings.md`, mục 18.

### Phase 7A: Hoàn thiện tích hợp MetaMask và tính nhất quán dữ liệu
- **Status:** complete
- [x] P1 — Dùng chung một `on_chain_loan_id` giữa giao dịch MetaMask và DB. Backend xác minh receipt thành công, đúng chain/contract/event, người mượn và nội dung đơn; không tin hash do client cung cấp. (`blockchain_service.verify_create_loan_tx`, `loan_service.create_loan_request`)
- [x] P1 — Khi duyệt đơn đã được sinh viên tạo on-chain, chỉ gọi `approveLoan`; không tạo thêm đơn khác. Chống dùng lại transaction cho nhiều đơn. (`loan_service.approve_loan_request`, HTTP 409 khi replay `tx_hash`/`on_chain_loan_id`)
- [x] P1 — Ràng buộc tài khoản sinh viên với ví đã xác minh; có chữ ký EIP-191 liên kết ví với nonce dùng một lần và thời hạn 5 phút. (`POST /api/v1/users/wallet/challenge`, `POST /api/v1/users/wallet/verify`, Alembic `c2d9e4f7a102`)
- [x] P1 — Khi RPC offline hoặc giao dịch thất bại, không ghi nghiệp vụ đã hoàn tất (`HTTP 503`/`502`). Có trạng thái giao dịch `PENDING`/`FAILED`/`CONFIRMED` rõ ràng. (`_ensure_chain_ready_or_http`, `_send_durable_tx`)
- [x] P1 — Lưu tiến trình gửi giao dịch, hỗ trợ tiếp tục an toàn khi chain thành công nhưng DB/API thất bại (crash recovery + `localStorage` client cache); kiểm thử retry idempotent không tạo đơn trùng.
- [x] P1 — Đối soát sự tồn tại của bản ghi, người mượn, thiết bị, tiền cọc, thời gian và mutex; phân biệt `NOT_ON_CHAIN`, `MISSING_ON_CHAIN`, `RPC_OFFLINE`, `MISMATCH`, `SYNCED` và không ghi đè DB từ struct rỗng. (`reconciliation_service.py`)
- [x] P2 — Chốt rõ mô hình hybrid: sinh viên xác minh ví EIP-191 & có thể tự ký `createLoan` MetaMask, admin dùng Relayer (hoặc fallback Relayer nếu SV chưa xác minh ví); mọi thao tác dùng cùng một `on_chain_loan_id`.
- [x] P2 — Đồng bộ ABI/address sang cả frontend và backend khi deploy (`deploy.cjs` + lọc theo `chainId` trong `contractConfig.ts` & `blockchain_service.py`); kiểm tra `chainId` và bytecode hợp đồng (`ensure_ready` / `verifyDeployedContract`) trước khi gửi.
- [x] P2 — Gỡ listener MetaMask khi effect cleanup trong `Web3Context.tsx`; xử lý đổi ví/mạng, từ chối ký (4001), pending permission (-32002), thiếu gas và lỗi revert (`parseWeb3Error`).
- [x] P2 — Bổ sung `/api/v1/blockchain/contract-info` đồng bộ schema với `/status`, bỏ các fallback giả lập ở `AuditPage.tsx` và `ShowcasePage.tsx`.
- [x] P2 — Chốt ý nghĩa `BORROWER_ROLE` (xác minh EIP-191 trong Phase 7A, giữ ổn định ABI; nâng cấp on-chain `BORROWER_ROLE` & bỏ `manual_penalty_percent` để riêng sang Phase 13). Kiểm tra `condition` 0–2, `penalty` 0–100 và chặn miễn phạt `0%` khi đơn quá hạn ở tình trạng `GOOD`.
- [x] P2 — Cài dependency `contracts` & `frontend` bằng `npm ci`; chạy `hardhat compile` & `hardhat test` (28 passing), `pytest` (65 passed), `tsc --noEmit --incremental false` & `vite build` (exit 0), và kiểm thử E2E + multi-account MetaMask trên môi trường Hardhat EVM + MySQL cô lập.
- [x] P2 — Cập nhật `THUYET_MINH_DO_AN_EDUVAULT.md`, `SYSTEM_ANALYSIS_REPORT.md`, `QA_SECURITY_REPORT.md` theo mô hình hiện tại, nói rõ tiền cọc mô phỏng VND, quyền admin, `studentId` on-chain và giới hạn đối soát thủ công `/audit/reconcile`.

**Bằng chứng nghiệm thu Phase 7A:**
- **Smart Contracts (`contracts`):** `npx hardhat test` -> 28 passing.
- **Database Migration:** `alembic upgrade head` -> `c2d9e4f7a102 (head)` (`add wallet verification fields to users`).
- **Backend API (`backend/tests/`):** `.\backend\.venv\Scripts\python.exe -m pytest backend/tests/ -v` -> 65 passed.
- **Frontend (`frontend`):** `npx tsc --noEmit --incremental false` (exit 0) và `npx vite build` (exit 0).
- **Live Hardhat EVM + MySQL E2E (môi trường cô lập `eduvault_phase7a_e2e_tmp`):** `test_e2e_happy_path.py` + `test_e2e_penalties.py` + `test_e2e_concurrency_recovery.py` PASS; kiểm chứng multi-account MetaMask EIP-191 (`personal_sign`, Account #1 `createLoan`, `approveLoan`-only, idempotent retry, replay block 409, offline fail-closed 503) PASS.

### Lỗi đã gặp trong phiên rà soát
| Lỗi | Kết quả / Hướng xử lý |
| --- | --- |
| Frontend TS2307: thiếu `ethers`, `@gsap/react`, `gsap` | Build thất bại tại môi trường hiện tại; chưa cài lại dependency trong phiên đánh giá. |
| `python` trỏ Windows Store alias | Chạy session-catchup bằng `backend/.venv/Scripts/python.exe` thành công; không có báo cáo bổ sung. |

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
- [x] Task 6B.1: Cấu hình thư viện GSAP (gsap, @gsap/react) và khởi tạo component ShowcasePage.tsx (tại tuyến đường /overview).
- [x] Task 6B.2: Zone 1 - Hero Section & Khối 3D Vault tương tác theo con trỏ chuột (GSAP Perspective 3D Tilt + Counter số liệu thời gian thực).
- [x] Task 6B.3: Zone 2 - Visual Pipeline 4 trạm trực quan hóa luồng Web2.5 (MySQL Pessimistic Lock -> FastAPI Relayer ký số -> Smart Contract Mutex -> Quyết toán cọc).
- [x] Task 6B.4: Zone 3 - Live On-Chain Transaction Terminal (Stream log giao dịch thời gian thực từ Hardhat EVM với hiệu ứng trượt GSAP).
- [x] Task 6B.5: Zone 4 - Equipment Spotlight & Simulator Playground (Bảng giả lập tương tác 5 kịch bản: trả đúng hạn, trễ hạn phạt 10%-50%, hỏng/mất thu hồi cọc).
- [x] Task 6B.6: Kiểm toán chất lượng UI/UX (TypeScript 0 lỗi, Vite build 2.90s, GSAP 60fps animations).
- **Status:** complete

---

### Phase 7: Tích hợp End-to-End & Xác minh Nghiệp vụ
- [x] Task 7.1: Chạy kịch bản luồng mượn trả chuẩn từ A-Z (Sinh viên tạo đơn -> Admin duyệt -> Bàn giao -> Trả đúng hạn -> Hoàn cọc 100%).
- [x] Task 7.2: Kiểm thử các kịch bản ngoại lệ:
  - [x] Trả máy trễ hạn <= 24h (khấu trừ phạt 10%).
  - [x] Trả máy trễ hạn > 24h (khấu trừ phạt 50%).
  - [x] Báo hỏng thiết bị (khấu trừ 100% cọc vào quỹ trường).
  - [x] Báo mất thiết bị (khấu trừ 100% cọc).
  - [x] Cạnh tranh đặt trùng cùng thiết bị (kiểm tra MySQL lock & Smart Contract Mutex).
  - [x] Hủy đơn khi đã duyệt (kiểm tra giải phóng Mutex on-chain).
- [x] Task 7.3: Kiểm thử cơ chế phục hồi (Crash Simulation): giả lập server tắt đột ngột khi giao dịch on-chain đã gửi, chạy reconciliation worker kiểm tra khả năng tự đồng bộ MySQL.
- **Status:** complete

---

### Phase 8: Kiểm thử QA & Rà soát Bảo mật
- [x] Task 8.1: Chạy toàn bộ test suites tự động (Smart Contract Hardhat tests + Backend Pytest).
- [x] Task 8.2: Rà soát bảo mật: kiểm tra chống lộ private key, kiểm tra phân quyền JWT, kiểm tra bảo vệ brute-force đăng nhập, kiểm tra reentrancy và quyền onlyOwner trên Smart Contract.
- [x] Task 8.3: Lập báo cáo kết quả kiểm thử QA & Bảo mật chi tiết.
- **Status:** complete

---

### Phase 9: Đóng gói Triển khai & Hướng dẫn Cài đặt
- [x] Task 9.1: Hoàn thiện file cấu hình mẫu .env.example với đầy đủ chú thích tham số (.env.example ở root và backend/.env.example).
- [x] Task 9.2: Viết script khởi chạy một chạm start_all.bat và scripts/start_all.ps1 (chạy song song Hardhat node, FastAPI backend và Vite frontend).
- [x] Task 9.3: Viết tài liệu hướng dẫn cài đặt từng bước từ clean checkout (README.md).
- **Status:** complete

---

### Phase 10: Tài liệu Học thuật & Kịch bản Báo cáo
- [x] Task 10.1: Soạn thảo bản thuyết minh đồ án tổng hợp bằng Tiếng Việt (Tổng quan đề tài, Kiến trúc hệ thống, Thiết kế CSDL & Smart Contract, Phân tích tính an toàn) — Đã xuất bản docs/THUYET_MINH_DO_AN_EDUVAULT.md.
- [x] Task 10.2: Soạn thảo kịch bản demo 5 bước (5-7 phút) cho buổi báo cáo trước hội đồng — Đã xuất bản docs/KICH_BAN_DEMO_HOI_DONG.md.
- [x] Task 10.3: Tổng hợp bộ 10 câu hỏi phản biện của giảng viên và câu trả lời kỹ thuật chuẩn xác — Đã xuất bản docs/BO_CAU_HOI_PHAN_BIEN_HOI_DONG.md.
- **Status:** complete

---

### Phase 11: Nghiệm thu Cuối cùng
- [x] Task 11.1: Đối chiếu sản phẩm thực tế với Acceptance Criteria đã cam kết — Đạt 100% tiêu chí nghiệm thu theo docs/BIEN_BAN_NGHIEM_THU_VA_BAN_GIAO.md.
- [x] Task 11.2: Bàn giao toàn bộ source code, cơ sở dữ liệu mẫu và tài liệu đồ án cho người dùng — Đã xuất bản docs/BIEN_BAN_NGHIEM_THU_VA_BAN_GIAO.md.
- **Status:** complete

---

### Phase 12: Chuyển dịch & Triển khai Lên Mạng Thử nghiệm Công khai (Ethereum Sepolia Testnet Migration)
- [x] Task 12.1: Chuẩn bị Ví Admin, Ví Sinh viên & Faucet Testnet ETH:
  - Tạo ví "EduVault Admin" trên MetaMask và chuyển sang mạng Sepolia.
  - Faucet ETH vào ví EduVault Admin (~0.05 - 0.2 Sepolia ETH) phục vụ deploy và làm Relayer (Đã có 0.22 Sepolia ETH).
  - Chuẩn bị ví Sinh viên riêng biệt trên MetaMask và faucet gas testnet.
  - Trích xuất Private Key của ví EduVault Admin để chuẩn bị nạp vào backend.
- [x] Task 12.2: Biên dịch & Deploy Smart Contract trên Remix IDE:
  - Nạp mã nguồn `EquipmentLending.sol` lên Remix IDE và biên dịch với Solidity 0.8.20.
  - Kết nối Injected Provider - MetaMask bằng tài khoản ví EduVault Admin.
  - Thực hiện Deploy contract lên mạng Sepolia tại `0xA7D286FBE73c3E3589836A0428e2e93c0d177c63`.
  - Ghi nhận địa chỉ Smart Contract mới và Transaction Hash trên Sepolia Etherscan.
- [x] Task 12.3: Cập nhật Cấu hình & Đồng bộ Backend (FastAPI):
  - Cập nhật `backend/.env` (BLOCKCHAIN_RPC_URL, CHAIN_ID=11155111, CONTRACT_ADDRESS, ADMIN_PRIVATE_KEY, ADMIN_WALLET_ADDRESS).
  - Đồng bộ file `backend/app/core/contracts/contract_address.json` và `EquipmentLending.json`.
  - Chạy script kiểm tra kết nối Web3 tới RPC Sepolia và xác nhận số dư ví Admin Relayer (Kết nối thành công 100%).
- [x] Task 12.4: Cập nhật Frontend & Hỗ trợ Chuyển Mạng MetaMask Tự động:
  - Cập nhật `frontend/src/contracts/contract_address.json` với địa chỉ contract và Chain ID 11155111.
  - Nâng cấp hàm `switchOrAddChain` trên Frontend tự động nhận diện và chuyển sang Ethereum Sepolia (Chain ID 0xaa36a7).
  - Cập nhật đường link xem Transaction Hash trỏ trực tiếp đến `https://sepolia.etherscan.io/tx/{hash}`.
  - Build kiểm tra Frontend TypeScript (`npm run build`) đảm bảo 0 lỗi.
- [x] Task 12.5: Kiểm thử Toàn diện E2E trên Sepolia & Xác minh Etherscan:
  - Bắn 0.03 SepoliaETH từ ví Admin sang ví Sinh viên MetaMask (`0xc6c0...871f2`) thành công (Tx: `0x44798129...`).
  - Sinh viên tạo đơn mượn on-chain qua `createLoan` thành công (Tx: `0xda50f48e...`, Block 12132134).
  - Admin duyệt đơn qua Backend Relayer ký trên Sepolia qua `approveLoan` (Tx: `0x4c55ae66...`, Block 12132135).
  - Thực hiện bàn giao `confirmHandover` (Tx: `0xd91da17c...`, Block 12132136) khóa cọc mô phỏng on-chain.
  - Nghiệm thu trả máy `confirmReturn` (Tx: `0x10ba316a...`, Block 12132138) hoàn cọc và giải phóng Mutex on-chain.
  - Toàn bộ 4 biên lai giao dịch được xác minh và hiển thị công khai trên Sepolia Etherscan.
- **Status:** complete

---

### Phase 13: Nâng cấp Smart Contract Pure Web3 & Cơ chế Multi-Admin (Solidity & Hardhat Tests)
> Mục tiêu: Tái cấu trúc contract đạt chuẩn Pure Web3 100%, bổ sung phân quyền Multi-Admin cho nhóm 3 người và tự động hóa quy tắc tính phạt.

- [ ] Task 13.1: **Bổ sung các hàm Multi-Admin và Cấp quyền Sinh viên**
  - Viết hàm `addAdmin(address _newAdmin) external onlyRole(DEFAULT_ADMIN_ROLE)`: Cho phép ví Deployer cấp `ADMIN_ROLE` cho các ví của thành viên nhóm.
  - Viết hàm `removeAdmin(address _admin) external onlyRole(DEFAULT_ADMIN_ROLE)`: Thu hồi quyền Admin nếu cần.
  - Viết hàm `registerBorrower(address _student) external onlyRole(ADMIN_ROLE)`: Cho phép bất kỳ ví nào trong 3 Admin cấp quyền `BORROWER_ROLE` cho sinh viên.
  - Viết hàm `revokeBorrower(address _student) external onlyRole(ADMIN_ROLE)`: Thu hồi quyền mượn thiết bị của sinh viên vi phạm.
  - File: `contracts/contracts/EquipmentLending.sol`

- [ ] Task 13.2: **Thắt chặt Kiểm soát Quyền (Access Control) & Validate Đầu vào trong `createLoan`**
  - Thêm điều kiện bắt buộc ví gọi hàm phải có `BORROWER_ROLE`:
    `require(hasRole(BORROWER_ROLE, msg.sender), "Must have BORROWER_ROLE to create loan");`
  - Thêm validation:
    `require(_equipmentId > 0, "Invalid equipment ID");`
    `require(bytes(_studentId).length > 0, "Student ID cannot be empty");`
  - File: `contracts/contracts/EquipmentLending.sol`

- [ ] Task 13.3: **Chuẩn hóa Tự động Tính Phạt trong `confirmReturn` & Dọn dẹp Code**
  - Loại bỏ tham số `_penaltyPercent` khỏi hàm `confirmReturn`:
    Signature mới: `function confirmReturn(bytes32 _loanId, uint8 _returnCondition) external onlyRole(ADMIN_ROLE)`
  - Tính phạt tự động 100% on-chain:
    - Nếu hỏng/mất (`_returnCondition == 1 || 2`): 100% phạt, cọc `Forfeited`, trạng thái `Disputed`.
    - Nếu tốt (`_returnCondition == 0`):
      - Trả đúng hạn: 0% phạt, cọc `Refunded`, trạng thái `Returned`.
      - Quá hạn $\le$ 24h: 10% phạt, cọc `Refunded`, trạng thái `Returned`.
      - Quá hạn $>$ 24h: 50% phạt, cọc `Refunded`, trạng thái `Returned`.
  - Dọn dẹp dead code trong `cancelLoan` (bỏ check `depositState == Locked` vì đơn chưa Active cọc luôn là None).
  - File: `contracts/contracts/EquipmentLending.sol`

- [ ] Task 13.4: **Cập nhật Toàn diện Bộ Kiểm thử Hardhat (`contracts/test/`)**
  - Điều chỉnh các test case gọi `createLoan` phải cấp `BORROWER_ROLE` trước.
  - Cập nhật test case kiểm tra `addAdmin`, `removeAdmin`, `registerBorrower`.
  - Cập nhật các test case `confirmReturn` theo signature 2 tham số mới.
  - Chạy `npx hardhat test` đảm bảo 100% test cases passed (dự kiến 30+ tests).

- [ ] Task 13.5: **Biên dịch & Deploy Smart Contract Mới Lên Ethereum Sepolia Testnet**
  - Biên dịch contract sạch sẽ: `npx hardhat compile`.
  - Kết nối ví Deployer (Admin 1) trên Remix hoặc Hardhat deploy script, deploy contract mới lên Sepolia.
  - Lưu lại địa chỉ Smart Contract mới và Transaction Hash deploy trên Sepolia Etherscan.

- [ ] Task 13.6: **Đồng bộ Artifacts (ABI & Contract Address) Toàn Hệ thống**
  - Cập nhật file ABI và địa chỉ contract mới vào:
    - `backend/app/core/contracts/EquipmentLending.json`
    - `backend/app/core/contracts/contract_address.json`
    - `frontend/src/contracts/EquipmentLending.json`
    - `frontend/src/contracts/contract_address.json`
  - Cập nhật biến `CONTRACT_ADDRESS` trong `backend/.env` và root `.env`.

- **Status:** pending

---

### Phase 14: Chuyển đổi Backend sang Mô hình Indexer & Receipt Verifier (Loại bỏ Private Key)
> Mục tiêu: Xóa bỏ hoàn toàn Private Key khỏi máy chủ backend, nâng tầm bảo mật hệ thống; backend chuyển thành bộ kiểm chứng biên lai giao dịch và bộ nhớ đệm (Cache/Indexer).

- [ ] Task 14.1: **Gỡ bỏ `ADMIN_PRIVATE_KEY` Khỏi Cấu hình Backend**
  - Xóa biến `ADMIN_PRIVATE_KEY` khỏi `backend/.env`, root `.env` và `backend/app/core/config.py`.
  - Đảm bảo Backend chỉ khởi tạo kết nối Read-Only Web3 RPC (không có ví ký số nội bộ).
  - File: `backend/app/core/config.py`, `backend/.env`

- [ ] Task 14.2: **Tái cấu trúc `BlockchainService` thành Trình Xác thực Biên lai (Receipt Verifier)**
  - Bỏ các hàm gửi transaction (`send_transaction`, `create_loan`, `approve_loan`, v.v.).
  - Viết hàm `verify_transaction_receipt(tx_hash: str, expected_event: str)`:
    - Lấy biên lai qua `web3.eth.get_transaction_receipt(tx_hash)`.
    - Kiểm tra `receipt.status == 1`.
    - Kiểm tra đúng `receipt.to == CONTRACT_ADDRESS`.
    - Giải mã Event log (ví dụ: `LoanCreated`, `LoanApproved`, `HandoverConfirmed`, `LoanReturned`) để kiểm chứng ID đơn mượn và địa chỉ người ký.
  - File: `backend/app/services/blockchain_service.py`

- [ ] Task 14.3: **Chuyển đổi các API Vòng đời Mượn Trả sang Dạng Nhận & Xác thực Tx Hash**
  - Cập nhật các endpoint trong `backend/app/api/v1/loans.py`:
    - `POST /api/v1/loans/request`: Nhận `tx_hash` tạo đơn từ sinh viên, xác minh event `LoanCreated` $\to$ lưu bản ghi MySQL.
    - `POST /api/v1/loans/{id}/approve`: Nhận `tx_hash` duyệt đơn từ ví Admin, xác minh event `LoanApproved` $\to$ đổi trạng thái `APPROVED`.
    - `POST /api/v1/loans/{id}/handover`: Nhận `tx_hash` bàn giao từ ví Admin, xác minh event `HandoverConfirmed` $\to$ đổi trạng thái `ACTIVE`.
    - `POST /api/v1/loans/{id}/return`: Nhận `tx_hash` trả máy từ ví Admin, xác minh event `LoanReturned` $\to$ cập nhật phạt và trạng thái `RETURNED`.
    - `POST /api/v1/loans/{id}/cancel`: Nhận `tx_hash` hủy đơn $\to$ cập nhật trạng thái `CANCELLED`.
  - File: `backend/app/api/v1/loans.py`, `backend/app/services/loan_service.py`

- [ ] Task 14.4: **Thêm API Quản lý Ví Sinh viên & Admin trong CSDL MySQL**
  - Cập nhật bảng `User` hoặc bảng phụ để lưu trữ danh sách `wallet_address` đã xác minh của từng tài khoản.
  - Endpoint `POST /api/v1/users/wallet`: Liên kết ví MetaMask với tài khoản sinh viên/admin đang đăng nhập.
  - Endpoint `GET /api/v1/admin/pending-borrowers`: Danh sách sinh viên chưa được cấp `BORROWER_ROLE` on-chain để Admin dễ duyệt.
  - File: `backend/app/api/v1/users.py`, `backend/app/models/user.py`

- [ ] Task 14.5: **Cập nhật & Chạy Lại Bộ Kiểm thử Pytest Backend**
  - Mock Web3 receipt verifier trong các test cases backend.
  - Chạy `pytest backend/tests` đảm bảo tất cả test cases đều pass với mô hình xác thực receipt mới.

- **Status:** pending

---

### Phase 15: Tái cấu trúc Frontend — Tích hợp Ký số Client-Side MetaMask Toàn diện (Pure Web3)
> Mục tiêu: Chuyển toàn bộ hành vi ký duyệt của cả Admin và Sinh viên trực tiếp lên MetaMask trình duyệt; bổ sung bảng điều khiển phân quyền Multi-Admin cho nhóm.

- [ ] Task 15.1: **Nâng cấp `Web3Context.tsx` Nhận diện Quyền Động On-Chain**
  - Bổ sung hàm đọc trực tiếp từ contract:
    - `isDeployer`: kiểm tra `hasRole(DEFAULT_ADMIN_ROLE, account)`
    - `isAdmin`: kiểm tra `hasRole(ADMIN_ROLE, account)`
    - `isBorrower`: kiểm tra `hasRole(BORROWER_ROLE, account)`
  - Tự động cập nhật trạng thái role mỗi khi người dùng đổi ví trên MetaMask.
  - File: `frontend/src/context/Web3Context.tsx`

- [ ] Task 15.2: **Xây dựng Giao diện Phân quyền Multi-Admin & Quản lý Borrower Role**
  - Tạo component hoặc trang `AdminRolesPage.tsx` (hoặc tab trong `/admin/users`):
    - **Mục 1: Quản trị viên Nhóm (Multi-Admin):**
      - Hiển thị danh sách các ví Admin hiện tại.
      - Form nhập địa chỉ ví của thành viên nhóm 2 và 3 $\to$ Nút "Cấp quyền Admin" gọi `contract.addAdmin(address)` qua MetaMask popup.
      - Nút "Thu hồi quyền Admin" gọi `contract.removeAdmin(address)`.
    - **Mục 2: Cấp quyền Sinh viên (Borrower Role):**
      - Danh sách sinh viên đăng ký ví $\to$ Nút "Kích hoạt quyền mượn On-chain" gọi `contract.registerBorrower(address)` qua MetaMask popup.
  - File: `frontend/src/pages/AdminRolesPage.tsx`, `frontend/src/components/Navigation.tsx`

- [ ] Task 15.3: **Cập nhật Trang Quản lý Đơn Mượn Admin (`AdminLoansPage.tsx`) Ký Trực tiếp qua MetaMask**
  - Nút **Duyệt đơn (Approve)**:
    - Gọi `const tx = await contract.approveLoan(loanIdBytes); await tx.wait();` $\to$ Popup MetaMask bật lên để Admin bấm Confirm.
    - Sau khi tx mined $\to$ gửi `tx.hash` sang API `/loans/{id}/approve` để đồng bộ DB.
  - Nút **Bàn giao (Handover)**:
    - Gọi `const tx = await contract.confirmHandover(loanIdBytes); await tx.wait();` $\to$ Popup MetaMask bật lên.
    - Đồng bộ `tx.hash` sang backend.
  - Nút **Nghiệm thu Trả máy (Return)**:
    - Gọi `const tx = await contract.confirmReturn(loanIdBytes, returnCondition); await tx.wait();` $\to$ Popup MetaMask bật lên.
    - Đồng bộ `tx.hash` sang backend.
  - File: `frontend/src/pages/AdminLoansPage.tsx`

- [ ] Task 15.4: **Cập nhật Trang Sinh viên (`EquipmentPage.tsx` & `MyLoansPage.tsx`)**
  - Kiểm tra điều kiện ví: Nếu sinh viên chưa có `BORROWER_ROLE` on-chain $\to$ hiển thị nút cảnh báo và hướng dẫn gửi yêu cầu cấp role tới Admin.
  - Khi đã có quyền $\to$ bấm "Đăng ký mượn" $\to$ MetaMask popup ký `createLoan()` $\to$ gửi `tx.hash` sang backend lưu đơn.
  - Cho phép sinh viên tự hủy đơn qua MetaMask popup gọi `cancelLoan()`.
  - File: `frontend/src/pages/EquipmentPage.tsx`, `frontend/src/pages/MyLoansPage.tsx`

- [ ] Task 15.5: **Build Kiểm thử Frontend TypeScript (`npm run build`)**
  - Đảm bảo 0 lỗi TypeScript, 0 lỗi bundle build.

- **Status:** pending

---

### Phase 16: Kiểm thử Tích hợp Đa Người Dùng (Multi-User E2E Testing trên Sepolia)
> Mục tiêu: Kiểm chứng thực tế toàn bộ kịch bản cộng tác giữa 3 ví Admin của nhóm và ví Sinh viên trên mạng Ethereum Sepolia thật.

- [ ] Task 16.1: **Phân bổ Gas SepoliaETH cho 3 Ví Admin và Ví Sinh viên**
  - Đảm bảo Ví 1 (Deployer), Ví 2 (Admin 2), Ví 3 (Admin 3) và Ví Sinh viên đều có đủ $\ge$ 0.02 SepETH để ký giao dịch.

- [ ] Task 16.2: **Ví Deployer (Admin 1) Phân Quyền Admin On-Chain cho 2 Bạn Cùng Nhóm**
  - Admin 1 kết nối web, mở tab Phân quyền Multi-Admin.
  - Nhập địa chỉ ví của Bạn 2 và Bạn 3 $\to$ Ký MetaMask xác nhận `addAdmin`.
  - Tra cứu sự kiện trên Sepolia Etherscan xác nhận cả 3 ví đều sở hữu `ADMIN_ROLE`.

- [ ] Task 16.3: **Cấp quyền `BORROWER_ROLE` cho Ví Sinh viên**
  - Admin 2 hoặc Admin 3 dùng ví của mình đăng nhập web $\to$ Cấp quyền mượn on-chain cho ví sinh viên qua popup MetaMask.

- [ ] Task 16.4: **Thực hiện Trọn vẹn Chu trình Mượn Trả Liên Ví (Cross-Wallet E2E)**
  - Sinh viên dùng ví riêng ký tạo đơn `createLoan`.
  - Admin 2 dùng ví riêng duyệt đơn `approveLoan` qua popup MetaMask.
  - Admin 3 dùng ví riêng bàn giao `confirmHandover` qua popup MetaMask.
  - Admin 1 dùng ví riêng nghiệm thu trả máy `confirmReturn` qua popup MetaMask.
  - Xác nhận DB MySQL tự động đồng bộ trạng thái chính xác sau mỗi giao dịch.

- [ ] Task 16.5: **Thu thập Bằng chứng Giao dịch & Cập nhật Tài liệu Báo cáo Đồ án**
  - Tổng hợp bảng tra cứu Tx Hash Etherscan chứng minh:
    - Giao dịch phân quyền Multi-Admin (Deployer phong Admin cho thành viên).
    - Giao dịch sinh viên tạo đơn.
    - Giao dịch thành viên 2 duyệt đơn.
    - Giao dịch thành viên 3 bàn giao.
    - Giao dịch trả máy và tự động quyết toán cọc.
  - Cập nhật thuyết minh đồ án và kịch bản demo hội đồng với kiến trúc Pure Web3 100%.

- **Status:** pending


