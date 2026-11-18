# Tai Lieu Chuyen Sau: Vai Tro Cua Smart Contract Va Backend Trong He Thong EduVault

Tài liệu này thuyết minh toàn diện và chuyên sâu về vai trò, trách nhiệm và cơ chế phối hợp giữa Hợp đồng thông minh (Smart Contract) và Máy chủ Backend trong hệ thống quản lý mượn trả thiết bị phòng thí nghiệm EduVault.

---

## 1. Tong Quan Kien Truc Ket Hop (Hybrid Architecture: Web2 + Web3)

EduVault được thiết kế theo mô hình kiến trúc kết hợp (Hybrid Architecture) kết hợp giữa Web3 phi tập trung và Web2 truyền thống:
- **Tầng Web3 (Smart Contract):** Đảm nhiệm tính toàn vẹn dữ liệu, tính pháp lý, cam kết tài chính và kiểm toán bất biến.
- **Tầng Web2 (FastAPI + MySQL):** Đảm nhiệm hiệu năng truy vấn, trải nghiệm người dùng tốc độ cao, quản trị kho và kiểm soát truy cập nghiệp vụ.

```
+-------------------------------------------------------------------------+
|                           FRONTEND REACT                                |
|  - Trình duyệt giao diện người dùng, danh mục thiết bị, lịch sử mượn    |
|  - Tích hợp ví MetaMask để ký giao dịch on-chain và ký xác thực EIP-191 |
+-----------------------+-------------------------+-----------------------+
                        |                         |
        (1) Ký giao dịch|                         | (2) Gửi HTTP Request
        qua Web3 Provider                         |     kèm tx_hash & JWT
                        v                         v
+-------------------------------+       +---------------------------------+
|        SMART CONTRACT         |       |         BACKEND FASTAPI         |
|  (EquipmentLending.sol)       |       |  - Thẩm tra biên lai on-chain   |
|  - Mạng Ethereum Sepolia      |       |  - Phòng vệ chống Replay Attack |
|  - Sổ cái bất biến            |<------+  - Quản lý phiên, bảo mật JWT   |
|  - Máy trạng thái mượn trả    | RPC   |  - Khóa bi quan chống race      |
|  - Tự động quyết toán cọc/phạt| Verify|  - Đối soát dữ liệu tự động     |
+-------------------------------+       +----------------+----------------+
                                                         |
                                                         v
                                        +---------------------------------+
                                        |         CSDL QUAN HE MYSQL      |
                                        |  - Lưu trữ danh mục, hình ảnh   |
                                        |  - Tìm kiếm mờ, phân trang      |
                                        |  - Nhật ký kiểm toán audit logs |
                                        +---------------------------------+
```

---

## 2. Vai Tro Cot Loi Cua Smart Contract (EquipmentLending.sol)

Hợp đồng thông minh `EquipmentLending.sol` được triển khai trực tiếp trên mạng thử nghiệm Ethereum Sepolia tại địa chỉ `0xA88De9B00C0F78FF9a162C4f17524ef885169ffd`. Hợp đồng đóng vai trò là **Chân lý tối cao (Single Source of Truth)** của toàn bộ hệ thống.

### 2.1. Sổ Cái Bất Biến (Immutable Ledger)
- Dữ liệu một khi đã được ghi vào Smart Contract thông qua giao dịch blockchain thì không một cá nhân, quản trị viên phòng lab hay nhà phát triển nào có thể sửa đổi hoặc xóa bỏ.
- Mỗi hành động mượn máy, duyệt đơn, bàn giao, trả máy đều để lại dấu vết thời gian (timestamp) và chữ ký mật mã của người thực thi trên mạng blockchain công khai.

### 2.2. Máy Trạng Thái Hữu Hạn On-Chain (On-Chain Finite State Machine)
Smart Contract thực thi nghiêm ngặt vòng đời của một đơn mượn thông qua enum trạng thái:
- `Submitted (0)`: Đơn mượn vừa được sinh viên tạo, tiền cọc được khóa.
- `Approved (1)`: Đơn mượn đã được Quản trị viên duyệt hợp lệ.
- `Active (2)`: Sinh viên đã nhận máy thực tế tại phòng lab.
- `Returned (3)`: Thiết bị đã được trả và nghiệm thu, tiền cọc đã được quyết toán.
- `Cancelled (4)`: Đơn bị hủy bởi sinh viên trước khi duyệt hoặc bị Quản trị viên từ chối, tiền cọc hoàn trả đầy đủ.
- `Disputed (5)`: Đơn có khiếu nại về hư hại hoặc mất mát thiết bị.

Hợp đồng áp dụng các mệnh đề kiểm tra `require` ở cấp độ mã máy (EVM):
- Chỉ cho phép duyệt (`approveLoan`) khi đơn đang ở trạng thái `Submitted`.
- Chỉ cho phép bàn giao (`confirmHandover`) khi đơn đang ở trạng thái `Approved`.
- Chỉ cho phép nghiệm thu trả (`confirmReturn`) khi đơn đang ở trạng thái `Active`.
- Ngăn chặn triệt để mọi hành vi nhảy cóc trạng thái hoặc gian lận quy trình.

### 2.3. Ràng Buộc Tài Chính và Quyết Toán Tiền Cọc Tự Động (Non-Custodial Escrow)
- Khi sinh viên tạo đơn mượn, Smart Contract có thể khóa tiền ký quỹ dưới dạng giá trị số học hoặc token on-chain.
- Khi bàn giao trả máy, hợp đồng tự động áp dụng công thức tính phạt dựa trên:
  * Thời hạn trả thực tế so với thời hạn cam kết (tính phạt trễ hạn theo từng ngày).
  * Tình trạng thiết bị lúc trả: Nguyên vẹn (hoàn 100% cọc), Hư hại nhẹ (khấu trừ một phần cọc), Mất máy/Hư hại hoàn toàn (tịch thu toàn bộ cọc chuyển vào quỹ phòng lab).
- Quy tắc quyết toán được lập trình sẵn bằng toán học trong Smart Contract, loại trừ hoàn toàn yếu tố cảm tính, tranh cãi hay tiêu cực của con người.

### 2.4. Phân Quyền Phi Tập Trung Dựa Trên Vai Trò (Decentralized Access Control)
Hợp đồng tích hợp tiêu chuẩn `AccessControl` của OpenZeppelin v5.0:
- `DEFAULT_ADMIN_ROLE`: Quyền quản trị tối cao, chỉ trao cho ví của người khởi tạo hệ thống (Deployer), có thẩm quyền cấp phát hoặc thu hồi quyền Admin.
- `ADMIN_ROLE`: Trao cho các ví của Quản trị viên phòng thí nghiệm. Chỉ những ví nắm giữ quyền này mới có thể gọi các hàm: `approveLoan`, `confirmHandover`, `confirmReturn`. Nếu một tài khoản thường cố tình gọi, giao dịch sẽ bị EVM đảo ngược (revert) ngay lập tức.

### 2.5. Khả Năng Kiểm Toán Độc Lập Toàn Diện
Bất kỳ ai (sinh viên, giảng viên, thanh tra nhà trường, kiểm toán viên độc lập) đều có thể tra cứu toàn bộ lịch sử hoạt động của hợp đồng trên trình duyệt khối Etherscan mà không cần xin phép hay phụ thuộc vào máy chủ nội bộ.

---

## 3. Vai Tro Cot Loi Cua May Chu Backend (FastAPI + MySQL)

Máy chủ Backend được xây dựng bằng Python 3.11 và framework FastAPI. Trong kiến trúc Pure Web3, Backend **tuyệt đối không nắm giữ khóa riêng tư (Private Key)** của người dùng. Backend đóng vai trò là **Lớp hỗ trợ truy vấn hiệu năng cao và Bộ thẩm tra biên lai giao dịch on-chain**.

### 3.1. Lớp Lưu Trữ và Truy Vấn Tốc Độ Cao (Fast Read & Query Cache Layer)
- Đọc dữ liệu từ blockchain Sepolia có độ trễ lớn (thường mất từ 12 đến 30 giây cho một block và phụ thuộc vào kết nối mạng RPC công cộng).
- Blockchain không hỗ trợ tìm kiếm mờ theo chuỗi (fuzzy search), phân trang, lọc nâng cao theo danh mục hoặc sắp xếp động.
- CSDL MySQL đóng vai trò lưu trữ bản sao dữ liệu mượn trả, hình ảnh thiết bị phòng lab, thông số kỹ thuật chi tiết để phục vụ các yêu cầu HTTP GET từ giao diện người dùng chỉ trong vài phần nghìn giây (millisecond).

### 3.2. Bộ Thẩm Tra Biên Lai Giao Dịch On-Chain (On-Chain Transaction Receipt Verifier)
Khi người dùng ký thành công một giao dịch trên MetaMask, Frontend gửi mã `tx_hash` về cho Backend. Backend sẽ không tin tưởng dữ liệu người dùng gửi lên mà tự động thực hiện quy trình thẩm tra 4 lớp thông qua module [backend/app/services/blockchain_service.py](file:///c:/Users/phucd/OneDrive/Desktop/Blockchain/EduVault/backend/app/services/blockchain_service.py):
1. **Kiểm tra trạng thái thực thi (Status Check):** Gọi RPC `eth_getTransactionReceipt(tx_hash)`. Yêu cầu `receipt.status == 1`. Nếu bằng 0 (giao dịch thất bại trên EVM), từ chối ngay.
2. **Kiểm tra địa chỉ đích (Destination Check):** Kiểm tra `receipt.to` phải trùng khớp với địa chỉ Smart Contract chính thức của trường (`0xA88De9B00C0F78FF9a162C4f17524ef885169ffd`), ngăn chặn giả mạo biên lai từ hợp đồng rác.
3. **Giải mã nhật ký sự kiện (Event Log Decoding):** Dùng ABI để giải mã các sự kiện phát ra từ giao dịch, xác nhận đúng sự kiện tương ứng (`LoanCreated`, `LoanApproved`, `HandoverConfirmed`, `LoanReturned`).
4. **Đối chiếu tham số nghiệp vụ (Arguments Matching):** So khớp các tham số trong event log (`loanId`, `equipmentId`, địa chỉ ví người ký) với dữ liệu trong yêu cầu API. Chỉ khi thỏa mãn cả 4 điều kiện thì Backend mới đồng bộ cập nhật CSDL MySQL.

### 3.3. Cơ Chế Phòng Vệ Chống Tấn Công Phát Lại (Replay Attack Defense)
- Một rủi ro lớn trong hệ thống Web3 là người dùng có thể lấy một mã giao dịch `tx_hash` hợp lệ trong quá khứ và gửi lại nhiều lần để tạo đơn mới hoặc duyệt đơn trái phép.
- Module [backend/app/services/loan_service.py](file:///c:/Users/phucd/OneDrive/Desktop/Blockchain/EduVault/backend/app/services/loan_service.py) thực thi cơ chế kiểm tra Idempotency nghiêm ngặt: Mỗi mã `tx_hash` chỉ được phép ghi nhận một lần duy nhất vào bảng `blockchain_transactions`. Mọi yêu cầu tái sử dụng hash cũ đều bị chặn đứng với mã lỗi HTTP 400.

### 3.4. Cầu Nối Xác Thực Danh Tính Kết Hợp (Hybrid Authentication: Web2 + Web3)
- **Tầng Web2:** Quản lý tài khoản đăng nhập bằng Mã số sinh viên / Cán bộ và mật khẩu được băm bảo mật bằng thuật toán Bcrypt, cấp phát token JWT chuẩn mực. Tích hợp cơ chế khóa tài khoản tạm thời 15 phút nếu nhập sai mật khẩu quá 5 lần để chống tấn công vét cạn (Brute-force).
- **Tầng Web3:** Xác minh quyền sở hữu ví điện tử MetaMask bằng chuẩn chữ ký mật mã EIP-191 (`personal_sign`). Backend sinh chuỗi thử thách ngẫu nhiên (nonce) có thời hạn 5 phút. Khi người dùng ký thành công, Backend phục hồi địa chỉ công khai từ chữ ký để gắn kết vĩnh viễn với tài khoản sinh viên.

### 3.5. Quản Lý Kho và Giải Quyết Xung Đột Đồng Thời (Pessimistic Locking)
- Khi có nhiều sinh viên cùng gửi yêu cầu mượn hoặc nhiều quản trị viên cùng duyệt đơn tại cùng một thời điểm, rất dễ xảy ra hiện tượng xung đột tranh chấp (Race Condition).
- Module [backend/app/services/equipment_service.py](file:///c:/Users/phucd/OneDrive/Desktop/Blockchain/EduVault/backend/app/services/equipment_service.py) sử dụng cơ chế khóa dòng bi quan (Pessimistic Locking) bằng cú pháp SQL `SELECT ... FOR UPDATE` trong giao dịch CSDL, đảm bảo một thiết bị chỉ có thể được bàn giao cho một đơn mượn duy nhất tại một thời điểm.

### 3.6. Tiến Trình Tự Động Đối Soát Và Tự Phục Hồi Dữ Liệu (Reconciliation Worker)
- Trong trường hợp mạng internet bị ngắt đột ngột sau khi giao dịch blockchain đã đào xong nhưng Backend chưa kịp ghi vào MySQL, dữ liệu giữa hai bên sẽ bị lệch pha.
- Module [backend/app/services/reconciliation_service.py](file:///c:/Users/phucd/OneDrive/Desktop/Blockchain/EduVault/backend/app/services/reconciliation_service.py) chạy định kỳ hoặc theo yêu cầu: quét toàn bộ các đơn mượn, so sánh trạng thái trong MySQL với trạng thái thực tế trên Smart Contract Sepolia. Nếu phát hiện sai lệch, tiến trình lấy Smart Contract làm chuẩn mực chân lý để tự động đồng bộ lại MySQL.

---

## 4. Bang Phan Dinh Trach Nhiem Chi Tiet (Responsibility Matrix)

| Tiêu chí | Smart Contract (EquipmentLending.sol) | Máy chủ Backend (FastAPI + MySQL) |
| :--- | :--- | :--- |
| **Nền tảng vận hành** | Ethereum Sepolia EVM (Phi tập trung) | Python 3.11, Uvicorn, MySQL (Máy chủ dịch vụ) |
| **Quyền sở hữu khóa riêng tư** | Không lưu trữ, người dùng tự ký qua MetaMask | Tuyệt đối không nắm giữ khóa riêng tư của người dùng |
| **Chân lý dữ liệu (Source of Truth)** | Chân lý tối cao (Bất biến, không thể sửa đổi) | Lớp bộ nhớ đệm (Cache) và dữ liệu bổ trợ tra cứu |
| **Kiểm soát quy trình mượn trả** | Thực thi máy trạng thái bằng mã lệnh EVM (`require`) | Điều phối nghiệp vụ, chuyển đổi trạng thái giao diện |
| **Bảo vệ tài chính & Tiền cọc** | Khóa ký quỹ, tính phạt trễ hạn và hư hỏng tự động | Lưu trữ mức tiền cọc quy định theo tiền tệ quy ước (VND) |
| **Phân quyền truy cập** | Phân quyền on-chain bằng OpenZeppelin `AccessControl` | Phân quyền API bằng JWT Bearer Token và Role Guard |
| **Truy vấn danh mục & Tìm kiếm** | Hạn chế (chỉ đọc theo ID, không hỗ trợ lọc mờ) | Tối ưu hóa cực cao (Tìm kiếm mờ, phân trang, danh mục) |
| **Phòng vệ gian lận** | Kiểm tra chữ ký mật mã, ngăn chặn gọi hàm sai vai trò | Thẩm tra biên lai giao dịch, chống tấn công Replay Attack |
| **Đối soát & Phục hồi** | Cung cấp dữ liệu gốc để đối chiếu | Tiến hành quét, phát hiện lệch pha và tự sửa chữa CSDL |

---

## 5. So Do Luong Phoi Hop Trong Mot Chu Trinh Muon - Tra Thuc Te

Dưới đây là sơ đồ luồng phối hợp chuẩn mực giữa Sinh viên, MetaMask, Smart Contract, Backend và CSDL MySQL trong một chu trình tạo và duyệt đơn:

```
Sinh vien            MetaMask            Smart Contract            Backend FastAPI            CSDL MySQL
   |                    |                      |                          |                       |
   |---(1) Bấm Đặt mượn->|                      |                          |                       |
   |                    |---(2) eth_sendTx --->|                          |                       |
   |                    |   createLoan()       |                          |                       |
   |                    |                      |-- (3) EVM ghi nhận block |                       |
   |                    |                      |   Phát sự kiện LoanCreated                       |
   |                    |<--(4) Trả về tx_hash -|                          |                       |
   |<--(5) Nhận tx_hash--|                      |                          |                       |
   |                                                                      |                       |
   |---(6) POST /api/v1/loans/request (kèm tx_hash, loan_id, JWT) ------->|                       |
   |                                                                      |---(7) eth_getReceipt->|
   |                                           |<-- Đọc biên lai RPC -----|   (node Sepolia)      |
   |                                           |                          |                       |
   |                                           |---(8) Trả về receipt --->|                       |
   |                                                                      |-- [Thẩm tra 4 lớp]:  |
   |                                                                      |   1. status == 1      |
   |                                                                      |   2. to == CONTRACT   |
   |                                                                      |   3. LoanCreated log  |
   |                                                                      |   4. Khớp loanId      |
   |                                                                      |   5. Chưa từng replay |
   |                                                                      |                       |
   |                                                                      |---(9) Lưu giao dịch-->|
   |                                                                      |   và tạo đơn PENDING  |
   |<--(10) HTTP 201 Created (Đơn mượn đã ghi nhận thành công) -----------|                       |
```

---

## 6. Bo Cau Hoi - Dap Phan Bien Trong Tam Voi Hoi Dong Giảng Vien

### Câu hỏi 1: Tại sao không đưa toàn bộ hệ thống lên Blockchain mà lại cần đến Máy chủ Backend và MySQL?
- **Trả lời:**
  * **Chi phí giao dịch (Gas fee):** Lưu trữ dữ liệu lớn (ảnh chụp thiết bị, mô tả chi tiết, lịch sử thao tác) lên blockchain vô cùng tốn kém và lãng phí tài nguyên mạng.
  * **Độ trễ và Trải nghiệm người dùng:** Mạng blockchain mất từ 12 đến 30 giây để xác nhận một khối. Người dùng không thể chờ hàng chục giây chỉ để xem danh mục thiết bị hoặc tìm kiếm một món đồ. MySQL giúp trang web phản hồi tức thì trong vài mili-giây.
  * **Khả năng truy vấn:** Blockchain không hỗ trợ tìm kiếm mờ theo chuỗi, lọc nhiều điều kiện kết hợp hay phân trang linh hoạt như hệ quản trị cơ sở dữ liệu quan hệ.

### Câu hỏi 2: Tại sao không dùng mỗi Backend truyền thống mà phải đưa Smart Contract vào?
- **Trả lời:**
  * Nếu chỉ dùng Backend truyền thống, toàn bộ dữ liệu nằm trong quyền kiểm soát của máy chủ tập trung. Một Quản trị viên phòng lab có ý đồ xấu hoặc một hacker xâm nhập máy chủ có thể chỉnh sửa nhật ký mượn trả, xóa vết bàn giao máy hoặc can thiệp mức tiền phạt.
  * Smart Contract đóng vai trò là bên thứ ba trung lập và bất biến. Khi thiết bị đã được xác nhận mượn hoặc trả trên Smart Contract, không một ai có thể phủ nhận hay sửa đổi bằng chứng này, bảo vệ quyền lợi tuyệt đối cho sinh viên và nâng cao tính minh bạch cho nhà trường.

### Câu hỏi 3: Nếu máy chủ Backend bị sập hoặc cơ sở dữ liệu MySQL bị mất thì hệ thống có bị mất dữ liệu không?
- **Trả lời:**
  * Toàn bộ lịch sử mượn trả, quyền sở hữu, số tiền ký quỹ và trạng thái các đơn mượn vẫn an toàn 100% trên mạng Ethereum Sepolia.
  * Khi khôi phục lại máy chủ Backend, chỉ cần kích hoạt tiến trình đối soát `reconciliation_service`, hệ thống sẽ đọc lại toàn bộ các sự kiện từ Smart Contract trên blockchain và tái cấu trúc lại toàn bộ cơ sở dữ liệu MySQL một cách chính xác.

### Câu hỏi 4: Backend có thể tự ý duyệt đơn hoặc bàn giao máy thay cho Quản trị viên không?
- **Trả lời:**
  * Hoàn toàn không. Trong kiến trúc Pure Web3, Backend không lưu giữ Private Key của Quản trị viên.
  * Hàm `approveLoan` và `confirmHandover` trên Smart Contract yêu cầu giao dịch phải được ký từ ví có quyền `ADMIN_ROLE`. Backend chỉ đóng vai trò nhận mã giao dịch đã được Quản trị viên ký từ MetaMask để thẩm tra và đồng bộ hiển thị lên giao diện.
