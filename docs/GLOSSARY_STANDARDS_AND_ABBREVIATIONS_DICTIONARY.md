# TỪ ĐIỂN THUẬT NGỮ CHUYÊN NGÀNH VÀ QUY CHUẨN KỸ THUẬT QUỐC TẾ (GLOSSARY, STANDARDS & ABBREVIATIONS DICTIONARY)

> **Dự án:** EduVault - Decentralized Educational Equipment Lending System  
> **Tài liệu:** Comprehensive Technical Lexicon & Domain Terminology Dictionary  
> **Lĩnh vực bao hàm:** Công nghệ Chuỗi khối (Blockchain), Hợp đồng thông minh (Smart Contract), Mật mã học (Cryptography), Kỹ thuật Phần mềm (Software Engineering) & Vận hành Phòng Thí nghiệm (Lab Operations)  

---

## MỤC LỤC
1. [Thuật ngữ Công nghệ Chuỗi khối & Mạng Phân tán (Blockchain & DLT)](#1-thuật-ngữ-công-nghệ-chuỗi-khối--mạng-phân-tán)
2. [Thuật ngữ Hợp đồng Thông minh & Máy ảo EVM (Smart Contracts & EVM)](#2-thuật-ngữ-hợp-đồng-thông-minh--máy-ảo-evm)
3. [Thuật ngữ Mật mã học & Tiêu chuẩn Ký số (Cryptography & EIP Standards)](#3-thuật-ngữ-mật-mã-học--tiêu-chuẩn-ký-số)
4. [Thuật ngữ Kỹ thuật Phần mềm & Kiến trúc Hệ thống (Software Engineering)](#4-thuật-ngữ-kỹ-thuật-phần-mềm--kiến-trúc-hệ-thống)
5. [Thuật ngữ Nghiệp vụ Quản trị Phòng Lab (Lab & Asset Management)](#5-thuật-ngữ-nghiệp-vụ-quản-trị-phòng-lab)
6. [Bảng Tra cứu Từ viết tắt Toàn diện (Comprehensive Acronyms Table)](#6-bảng-tra-cứu-từ-viết-tắt-toàn-diện)

---

## 1. THUẬT NGỮ CÔNG NGHỆ CHUỖI KHỐI & MẠNG PHÂN TÁN (BLOCKCHAIN & DLT)

- **Blockchain (Chuỗi khối):** Cơ sở dữ liệu phân tán dạng chuỗi các khối liên kết mật mã, trong đó mỗi khối chứa mã băm (hash) của khối đứng trước, dấu thời gian và dữ liệu giao dịch.
- **Ethereum:** Nền tảng điện toán phân tán mã nguồn mở, cho phép thực thi các hợp đồng thông minh Turing-complete thông qua máy ảo EVM.
- **Sepolia Testnet:** Mạng thử nghiệm chính thức của Ethereum hoạt động theo cơ chế đồng thuận Proof-of-Stake (PoS), sử dụng mã chuỗi `11155111` cho phép các nhà phát triển thử nghiệm ứng dụng mà không tiêu tốn tài sản thật.
- **Node (Nút mạng):** Một máy tính chạy phần mềm máy khách Ethereum (như Geth, Nethermind), lưu trữ bản sao sổ cái và xác minh các giao dịch độc lập.
- **RPC (Remote Procedure Call - Gọi thủ tục từ xa):** Giao thức cho phép các chương trình bên ngoài (như Backend hoặc trình duyệt) liên lạc và truy vấn dữ liệu từ nút mạng blockchain thông qua định dạng JSON-RPC.
- **Gas:** Đơn vị đo lường năng lực tính toán và lưu trữ cần thiết để thực thi một chỉ lệnh trên mạng Ethereum.
- **Gas Price / Base Fee:** Số tiền phí tính bằng Gwei mà người dùng sẵn sàng chi trả cho mỗi đơn vị gas tiêu thụ.
- **Gwei (Gigawei):** Đơn vị tiền tệ của Ethereum, tương đương với $10^{-9}$ ETH ($1 \text{ ETH} = 10^9 \text{ Gwei} = 10^{18} \text{ Wei}$).
- **Wei:** Đơn vị nhỏ nhất và nguyên tố nhất của Ethereum ($1 \text{ ETH} = 10^{18} \text{ Wei}$). Toàn bộ các phép tính trong Smart Contract của EduVault đều được thực hiện theo đơn vị Wei để đảm bảo độ chính xác tuyệt đối.
- **Mempool (Memory Pool):** Vùng đệm bộ nhớ của các nút mạng chứa các giao dịch hợp lệ đang chờ thợ đào đóng gói vào khối mới.
- **Block Confirmation (Xác nhận khối):** Số lượng khối mới được đào thêm sau khối chứa giao dịch của bạn. Càng nhiều xác nhận thì khả năng giao dịch bị đảo ngược càng tiến về 0.
- **Reorganization (Reorg):** Hiện tượng chuỗi khối bị phân nhánh ngắn hạn khi hai thợ đào cùng tìm thấy khối hợp lệ tại cùng thời điểm, sau đó mạng lưới sẽ chọn nhánh dài nhất và hoàn tác các giao dịch ở nhánh ngắn hơn.
- **Consensus Mechanism (Cơ chế đồng thuận):** Thuật toán bảo đảm tất cả các nút mạng thống nhất về trạng thái duy nhất của sổ cái (ví dụ: Proof-of-Work, Proof-of-Stake).

---

## 2. THUẬT NGỮ HỢP ĐỒNG THÔNG MINH & MÁY ẢO EVM (SMART CONTRACTS & EVM)

- **Smart Contract (Hợp đồng thông minh):** Chương trình máy tính tự thực thi chứa các điều khoản thỏa thuận được ghi trực tiếp vào các dòng mã lệnh trên blockchain.
- **Solidity:** Ngôn ngữ lập trình hướng đối tượng, bậc cao dùng để phát triển các hợp đồng thông minh trên nền tảng máy ảo Ethereum.
- **EVM (Ethereum Virtual Machine - Máy ảo Ethereum):** Máy trạng thái 256-bit ảo hóa đóng vai trò là môi trường thực thi cho tất cả các hợp đồng thông minh.
- **Bytecode:** Mã máy nhị phân mà trình biên dịch Solidity (solc) tạo ra để EVM có thể đọc và thực thi.
- **Opcode (Mã thao tác):** Các chỉ lệnh cơ bản nhất của máy ảo EVM (ví dụ: `PUSH`, `POP`, `ADD`, `SSTORE`, `SLOAD`, `CALL`).
- **ABI (Application Binary Interface):** Giao diện nhị phân định nghĩa cấu trúc hàm, kiểu tham số và sự kiện ở định dạng JSON để ứng dụng bên ngoài (Frontend, Backend) có thể tương tác với smart contract.
- **Storage:** Vùng lưu trữ trạng thái vĩnh viễn và đắt đỏ nhất trên EVM, giữ lại giá trị xuyên suốt giữa các lần gọi hàm.
- **Memory:** Vùng nhớ RAM tạm thời của EVM, bị xóa sạch sau khi kết thúc giao dịch.
- **Calldata:** Vùng nhớ chỉ đọc chứa các tham số đầu vào được gửi kèm trong giao dịch gọi hàm.
- **Reentrancy Attack (Tấn công tái nhập):** Lỗ hổng bảo mật nghiêm trọng xảy ra khi hợp đồng nạn nhân thực hiện cuộc gọi gửi tiền ra ngoài trước khi cập nhật số dư nội bộ, cho phép kẻ tấn công đệ quy rút cạn tiền.
- **ReentrancyGuard:** Mẫu thiết kế khóa cờ nhị phân (Mutex Lock) do OpenZeppelin phát triển nhằm ngăn chặn triệt để tấn công tái nhập.
- **Pausable:** Cơ chế đóng băng khẩn cấp các chức năng của hợp đồng thông minh khi phát hiện dấu hiệu bất thường.
- **AccessControl:** Cơ chế phân quyền dựa trên vai trò (RBAC) sử dụng mã băm Keccak-256 để định danh từng quyền hạn (`ADMIN_ROLE`, `BORROWER_ROLE`).
- **Function Selector:** 4 byte đầu tiên của mã băm Keccak-256 của chữ ký hàm, dùng để điều hướng thực thi trong EVM.
- **Event Log:** Cơ chế ghi nhận thông tin chi phí thấp vào tệp nhật ký của khối, cho phép ứng dụng bên ngoài lắng nghe sự thay đổi trạng thái mà không cần đọc storage.

---

## 3. THUẬT NGỮ MẬT MÃ HỌC & TIÊU CHUẨN KÝ SỐ (CRYPTOGRAPHY & EIP STANDARDS)

- **Public Key (Khóa công khai):** Khóa mật mã được sinh ra từ khóa bí mật, dùng để tạo địa chỉ ví và kiểm tra chữ ký số.
- **Private Key (Khóa bí mật):** Chuỗi 256-bit bí mật duy nhất dùng để tạo chữ ký số phê duyệt giao dịch. Ai nắm giữ khóa bí mật sẽ nắm toàn quyền kiểm soát tài sản trong ví.
- **MetaMask:** Tiện ích mở rộng trình duyệt và ứng dụng di động đóng vai trò là ví điện tử phi lưu ký (Non-custodial Wallet) và cổng kết nối Web3.
- **ECDSA (Elliptic Curve Digital Signature Algorithm):** Giải thuật chữ ký số đường cong elip trên đường cong `secp256k1` được Ethereum sử dụng để ký giao dịch.
- **Keccak-256:** Hàm băm mật mã chuẩn SHA-3 tạo ra chuỗi băm 32 bytes (256 bits) cố định từ bất kỳ chuỗi dữ liệu đầu vào nào.
- **EIP (Ethereum Improvement Proposal):** Đề xuất cải tiến kỹ thuật cho hệ sinh thái Ethereum.
- **EIP-1193:** Chuẩn giao diện JavaScript Ethereum Provider API kết nối trình duyệt với ví (ví dụ: `window.ethereum.request`).
- **EIP-191:** Chuẩn định dạng dữ liệu ký có tiền tố (`\x19Ethereum Signed Message:\n`), ngăn chặn việc chữ ký dùng cho việc đăng nhập bị lợi dụng để phát tán giao dịch tài chính độc hại.
- **EIP-712:** Chuẩn ký dữ liệu có cấu trúc (Typed Structured Data), cho phép người dùng đọc hiểu rõ nội dung hợp đồng trước khi bấm ký trên ví điện tử.
- **EIP-1559:** Cơ chế định giá phí giao dịch gồm Base Fee bị đốt và Priority Fee thưởng cho thợ đào, giúp phí gas trở nên dễ dự đoán hơn.
- **Nonce (Number used once):**
  - Trong giao dịch Ethereum: Số thứ tự giao dịch của một tài khoản, tăng dần từ 0 để chống tấn công phát lại.
  - Trong xác thực EIP-191: Chuỗi ngẫu nhiên do máy chủ tạo ra để bảo đảm mỗi phiên ký là duy nhất.
- **Signature Recovery (`ecrecover`):** Quá trình toán học trích xuất địa chỉ ví công khai từ bản băm thông điệp và ba thành phần chữ ký $(r, s, v)$.

---

## 4. THUẬT NGỮ KỸ THUẬT PHẦN MỀM & KIẾN TRÚC HỆ THỐNG (SOFTWARE ENGINEERING)

- **Pure Web3 Architecture:** Mô hình kiến trúc trong đó toàn bộ giao dịch on-chain đều được ký trực tiếp từ ví người dùng; máy chủ backend không nắm giữ khóa bí mật mà chỉ đóng vai trò thẩm tra (Verifier).
- **Hybrid Web2.5:** Mô hình kết hợp giữa cơ sở dữ liệu truyền thống Web2 (cho tốc độ cao, giao diện mượt) và sổ cái blockchain Web3 (cho tính bất biến tài chính).
- **FastAPI:** Khung ứng dụng web hiện đại, hiệu năng cao viết bằng Python 3.11, hỗ trợ bất đồng bộ native (ASGI) và tự động sinh tài liệu OpenAPI/Swagger.
- **SQLAlchemy:** Thư viện lập trình ánh xạ quan hệ thực thể (ORM - Object Relational Mapping) mạnh mẽ nhất cho Python.
- **Alembic:** Công cụ quản lý di chuyển phiên bản cơ sở dữ liệu (Database Migrations) cho SQLAlchemy.
- **React 18:** Thư viện JavaScript mã nguồn mở dùng để xây dựng giao diện người dùng dựa trên thành phần (Components).
- **Vite:** Công cụ đóng gói ứng dụng frontend thế hệ mới với cơ chế Hot Module Replacement (HMR) siêu tốc.
- **Tailwind CSS:** Khung CSS hướng tiện ích (Utility-first CSS Framework) giúp thiết kế giao diện hiện đại và responsive nhanh chóng.
- **Ethers.js v6:** Thư viện JavaScript/TypeScript toàn diện dùng để tương tác với mạng lưới Ethereum và Smart Contracts.
- **JWT (JSON Web Token):** Tiêu chuẩn mở (RFC 7519) định nghĩa phương thức nhỏ gọn và độc lập để truyền tải thông tin an toàn giữa các bên dưới dạng đối tượng JSON.
- **CORS (Cross-Origin Resource Sharing):** Cơ chế bảo mật của trình duyệt ngăn chặn các trang web độc hại gửi yêu cầu tới API khác miền.
- **Pydantic:** Thư viện xác thực dữ liệu và quản trị thiết lập bằng Python dựa trên gợi ý kiểu dữ liệu (Type Hints).
- **Hardhat:** Môi trường phát triển linh hoạt cho các chuyên gia phát triển Ethereum, hỗ trợ biên dịch, kiểm thử tự động và gỡ lỗi smart contract.

---

## 5. THUẬT NGỮ NGHIỆP VỤ QUẢN TRỊ PHÒNG LAB (LAB & ASSET MANAGEMENT)

- **Escrow (Ký quỹ bảo lãnh):** Thỏa thuận tài chính trong đó bên thứ ba độc lập (ở đây là Hợp đồng thông minh) giữ tiền ký quỹ cho đến khi các điều kiện hoàn trả thiết bị được đáp ứng đầy đủ.
- **Loan State (Trạng thái đơn mượn):** Vòng đời 5 pha của hồ sơ: `Requested` (Chờ duyệt), `Approved` (Đã duyệt), `HandedOver` (Đang mượn), `Returned` (Đã hoàn tất), `Cancelled` (Đã hủy).
- **Equipment Mutex Lock:** Cơ chế khóa độc quyền phần cứng: Một thiết bị có ID vật lý cụ thể chỉ có thể được gắn với tối đa một đơn mượn tích cực tại một thời điểm.
- **Handover (Bàn giao thiết bị):** Thủ tục vật lý cán bộ phòng Lab trao tài sản cho sinh viên sau khi kiểm tra ngoại quan và ký giao dịch on-chain.
- **Settlement (Tất toán tài chính):** Quá trình Smart Contract tự động tính toán tỷ lệ khấu trừ phạt và giải ngân tiền hoàn trả về ví sinh viên khi trả máy.
- **Basis Points (bps):** Đơn vị đo lường tỷ lệ phần trăm trong tài chính, trong đó $100 \text{ bps} = 1\%$ và $10,000 \text{ bps} = 100\%$. Được dùng để tính tiền phạt không sai số số thập phân.
- **Non-repudiation (Tính chống chối bỏ):** Khả năng bảo đảm một bên tham gia giao dịch không thể phủ nhận tính xác thực của chữ ký hay hành động mà họ đã thực hiện.

---

## 6. BẢNG TRA CỨU TỪ VIẾT TẮT TOÀN DIỆN (COMPREHENSIVE ACRONYMS TABLE)

| Viết tắt | Tên tiếng Anh đầy đủ | Ý nghĩa nghiệp vụ trong EduVault |
| :--- | :--- | :--- |
| **ABI** | Application Binary Interface | Giao diện nhị phân mô tả hàm và sự kiện của Smart Contract |
| **API** | Application Programming Interface | Giao diện lập trình kết nối Frontend và Backend |
| **BPS** | Basis Points | Đơn vị phần vạn ($1/10000$) dùng tính tỷ lệ phạt tiền cọc |
| **CEI** | Checks-Effects-Interactions | Mẫu thiết kế phòng vệ chống tấn công Reentrancy |
| **CRUD** | Create, Read, Update, Delete | Bốn thao tác cơ bản trên cơ sở dữ liệu |
| **DDL** | Data Definition Language | Tập lệnh định nghĩa cấu trúc bảng trong MySQL |
| **DML** | Data Manipulation Language | Tập lệnh thao tác dữ liệu (Insert, Update, Delete) |
| **DRP** | Disaster Recovery Plan | Kế hoạch khôi phục hệ thống sau sự cố thảm họa |
| **ECDSA** | Elliptic Curve Digital Signature Algorithm | Thuật toán ký số đường cong elip của Ethereum |
| **EIP** | Ethereum Improvement Proposal | Đề xuất tiêu chuẩn kỹ thuật trên hệ sinh thái Ethereum |
| **ETH** | Ether | Đơn vị tiền tệ chính của mạng Ethereum |
| **EVM** | Ethereum Virtual Machine | Máy ảo thực thi mã bytecode của Smart Contract |
| **FSM** | Finite State Machine | Máy trạng thái hữu hạn điều khiển vòng đời đơn mượn |
| **HMR** | Hot Module Replacement | Tính năng cập nhật giao diện tức thì của Vite |
| **JWT** | JSON Web Token | Mã định danh phiên xác thực người dùng |
| **MSSV** | Mã Số Sinh Viên | Mã định danh duy nhất của người học |
| **MTTA** | Mean Time to Acknowledge | Thời gian phản hồi trung bình khi phát hiện sự cố |
| **MTTR** | Mean Time to Recover | Thời gian phục hồi trung bình của hệ thống |
| **ORM** | Object-Relational Mapping | Kỹ thuật ánh xạ bảng cơ sở dữ liệu thành đối tượng Python |
| **PoS** | Proof-of-Stake | Cơ chế đồng thuận dựa trên bằng chứng cổ phần |
| **RBAC** | Role-Based Access Control | Mô hình kiểm soát truy cập phân quyền theo vai trò |
| **REST** | Representational State Transfer | Phong cách kiến trúc thiết kế dịch vụ web |
| **RPC** | Remote Procedure Call | Giao thức gọi hàm từ xa kết nối tới Node blockchain |
| **SLA** | Service Level Agreement | Cam kết mức độ chất lượng và độ sẵn sàng dịch vụ |
| **SOP** | Standard Operating Procedure | Quy trình vận hành tiêu chuẩn trong phòng Lab |
| **SWC** | Smart Contract Weakness Classification | Hệ thống phân loại lỗ hổng bảo mật hợp đồng thông minh |
| **UAT** | User Acceptance Testing | Kiểm thử chấp nhận người dùng thực tế |
| **UUID** | Universally Unique Identifier | Chuỗi định danh ngẫu nhiên duy nhất toàn cầu |
| **VNĐ** | Việt Nam Đồng | Đơn vị tiền tệ pháp định niêm yết giá trị cọc |
| **WSS** | WebSocket Secure | Giao thức truyền dữ liệu hai chiều thời gian thực |

---
*Từ điển quy chuẩn kỹ thuật và thuật ngữ chuyên ngành EduVault đã được hoàn tất biên soạn.*
