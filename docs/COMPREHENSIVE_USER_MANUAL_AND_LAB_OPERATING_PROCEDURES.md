# CẨM NANG HƯỚNG DẪN SỬ DỤNG VÀ QUY TRÌNH VẬN HÀNH TIÊU CHUẨN PHÒNG THÍ NGHIỆM (COMPREHENSIVE USER MANUAL & LAB OPERATING PROCEDURES)

> **Hệ thống:** Nền tảng Quản trị & Điều phối Thiết bị Thực hành EduVault  
> **Áp dụng cho:** Trung tâm Máy tính & Phòng Thí nghiệm Phần cứng / IoT / Nhúng  
> **Đối tượng người dùng:** Cán bộ Quản lý Phòng Lab (Admin), Giảng viên Hướng dẫn, Sinh viên Thực hành (Borrower)  
> **Cơ chế xác thực & Ký số:** Ví MetaMask Web3 (EIP-1193, EIP-191) trên mạng Ethereum Sepolia  

---

## MỤC LỤC
1. [Giới thiệu Chung về Hệ thống EduVault](#1-giới-thiệu-chung-về-hệ-thống-eduvault)
2. [Hướng dẫn Cài đặt & Chuẩn bị Ví MetaMask Web3](#2-hướng-dẫn-cài-đặt--chuẩn-bị-ví-metamask-web3)
3. [Quy trình Dành cho Sinh viên (Student Borrower SOP)](#3-quy-trình-dành-cho-sinh-viên)
   - 3.1. Đăng ký tài khoản & Xác minh quyền sở hữu ví EIP-191
   - 3.2. Tra cứu danh mục & Lựa chọn thiết bị phù hợp
   - 3.3. Tạo đơn mượn & Ký quỹ an toàn bằng MetaMask
   - 3.4. Nhận bàn giao thiết bị vật lý tại phòng Lab
   - 3.5. Trả thiết bị, nghiệm thu & Nhận tiền hoàn cọc tức thì
   - 3.6. Xử lý trường hợp hủy đơn hoặc đổi ý trước khi nhận máy
4. [Quy trình Dành cho Cán bộ Quản lý Phòng Lab (Lab Administrator SOP)](#4-quy-trình-dành-cho-cán-bộ-quản-lý-phòng-lab)
   - 4.1. Đăng nhập hệ thống quản trị & Thẩm định ví Admin
   - 4.2. Cấp quyền mượn thiết bị (BORROWER_ROLE) cho sinh viên
   - 4.3. Thẩm định hồ sơ mượn & Phê duyệt đơn on-chain
   - 4.4. Kiểm tra ngoại quan vật lý & Bàn giao thiết bị
   - 4.5. Nghiệm thu hoàn trả & Đánh giá phân loại mức độ tổn hại
   - 4.6. Quản trị danh mục kho máy & Cập nhật trạng thái bảo trì
5. [Quy trình Dành cho Quản trị viên Cấp cao (Deployer / Root Admin SOP)](#5-quy-trình-dành-cho-quản-trị-viên-cấp-cao)
   - 5.1. Cấp và thu hồi quyền Admin phòng Lab (ADMIN_ROLE)
   - 5.2. Tạm dừng hoạt động khẩn cấp (Emergency Circuit Breaker)
   - 5.3. Trích xuất dữ liệu phục vụ đối soát tài chính
6. [Sổ tay Quy chuẩn Đánh giá Tình trạng Thiết bị (Condition Assessment Matrix)](#6-sổ-tay-quy-chuẩn-đánh-giá-tình-trạng-thiết-bị)
7. [Quy trình Giải quyết Khiếu nại và Tranh chấp (Dispute Resolution Protocol)](#7-quy-trình-giải-quyết-khiếu-nại-và-tranh-chấp)
8. [Bộ Câu hỏi Thường gặp (Frequently Asked Questions - FAQ)](#8-bộ-câu-hỏi-thường-gặp)

---

## 1. GIỚI THIỆU CHUNG VỀ HỆ THỐNG EDUVAULT

EduVault là nền tảng quản trị và cho mượn trang thiết bị thực hành công nghệ cao (Laptop đồ họa, Máy đo xung số, Kính hiển vi điện tử, Kit vi điều khiển ARM/ESP32) đầu tiên tại Việt Nam ứng dụng công nghệ **Hợp đồng thông minh (Smart Contract)** trên mạng lưới Ethereum.

### Ưu điểm vượt trội của EduVault:
- **Minh bạch tài chính 100%:** Tiền ký quỹ của sinh viên được khóa trong Hợp đồng thông minh, không ai có thể tự ý chiếm đoạt hay rút ruột quỹ.
- **Tất toán hoàn cọc tức thì (Zero Delay):** Ngay khi cán bộ phòng Lab bấm nghiệm thu trả máy trên giao diện, Smart Contract tự động giải ngân chuyển hoàn tiền cọc về ví MetaMask của sinh viên trong vòng chưa đầy 15 giây.
- **Chống mượn trùng lặp vật lý:** Khóa Mutex on-chain bảo đảm một thiết bị không bao giờ bị phân bổ cho hai người cùng lúc.
- **Chống chối bỏ (Non-repudiation):** Mọi hành động duyệt, giao máy và hoàn trả đều được ký số bằng khóa riêng của từng cá nhân, lưu vết vĩnh viễn trên sổ cái blockchain.

---

## 2. HƯỚNG DẪN CÀI ĐẶT & CHUẨN BỊ VÍ METAMASK WEB3

Để tương tác với EduVault, người dùng cần có tiện ích mở rộng ví điện tử MetaMask:

### Bước 1: Cài đặt tiện ích mở rộng MetaMask
- Truy cập trang chủ chính thức: [https://metamask.io/download](https://metamask.io/download).
- Cài đặt cho trình duyệt Chrome, Edge, Brave hoặc Firefox.
- Bấm **Create a new wallet**, thiết lập mật khẩu mạnh và lưu trữ 12 từ khóa khôi phục (Secret Recovery Phrase) vào nơi bí mật, an toàn.

### Bước 2: Chuyển sang mạng Ethereum Sepolia Testnet
1. Mở tiện ích MetaMask trên thanh công cụ trình duyệt.
2. Bấm vào biểu tượng chọn mạng ở góc trên cùng bên trái (Mặc định là `Ethereum Mainnet`).
3. Bật tùy chọn **Show test networks** trong mục Cài đặt nếu chưa thấy.
4. Chọn mạng **Sepolia**.

### Bước 3: Nhận tiền phí thử nghiệm (SepoliaETH Faucet)
- Vì toàn bộ thao tác ký quỹ và duyệt đơn đều diễn ra trên blockchain thực tế, bạn cần một lượng nhỏ SepoliaETH để làm tiền ký quỹ và trả phí gas.
- Nhận gas miễn phí tại: [https://cloud.google.com/application/web3/faucet/ethereum/sepolia](https://cloud.google.com/application/web3/faucet/ethereum/sepolia) (nhập địa chỉ ví của bạn để nhận 0.05 SepoliaETH mỗi ngày).

---

## 3. QUY TRÌNH DÀNH CHO SINH VIÊN (STUDENT BORROWER SOP)

```
+-----------------------------------------------------------------------------------+
|                        HÀNH TRÌNH MƯỢN THIẾT BỊ CỦA SINH VIÊN                     |
+-----------------------------------------------------------------------------------+
  (1) Đăng ký & Ký EIP-191  -->  (2) Chọn máy & Ký quỹ MetaMask  --> (3) Chờ duyệt
             ^                                                              |
             |                                                              v
  (6) Nhận lại tiền cọc    <--   (5) Trả máy tại phòng Lab       <--  (4) Nhận máy Lab
```

### 3.1. Đăng ký tài khoản & Xác minh quyền sở hữu ví EIP-191
1. Truy cập cổng dịch vụ sinh viên: [http://localhost:5173/register](http://localhost:5173/register).
2. Điền đầy đủ thông tin: Họ tên, Mã số sinh viên (MSSV), Email trường và Mật khẩu.
3. Sau khi đăng nhập thành công, hệ thống sẽ hiển thị thanh thông báo:  
   *`"Tài khoản chưa liên kết ví MetaMask. Vui lòng kết nối và xác minh ví."`*
4. Bấm nút **Kết nối ví** ở góc trên bên phải thanh menu:
   - Cửa sổ MetaMask xuất hiện: Bấm **Connect**.
   - Bấm tiếp nút **Xác minh quyền sở hữu ví (Ký EIP-191)**.
   - MetaMask hiển thị thông điệp ký số không tốn phí gas (Personal Sign Challenge):
     ```
     EduVault Authentication Challenge:
     Address: 0x5755ec806E7dd1Fe6222e98DBcb2a1EB6deA7BEB
     Nonce: eduvault-auth-4f9a-8b2c-1234567890ab
     ```
   - Bấm **Sign (Ký)**. Chấm tròn trạng thái ví chuyển sang màu xanh lá cây `● Đã xác minh ví`.

### 3.2. Tra cứu danh mục & Lựa chọn thiết bị phù hợp
1. Bấm vào tab **Thiết bị** trên thanh điều hướng.
2. Sử dụng thanh tìm kiếm hoặc bộ lọc danh mục (Laptop, Thiết bị đo, Kính hiển vi, Kit nhúng).
3. Mỗi thẻ thiết bị hiển thị rõ:
   - Tên thiết bị và mã định danh tài sản.
   - Cấu hình phần cứng chi tiết.
   - Trạng thái hiện tại: `Sẵn sàng` (màu xanh lá) hoặc `Đang mượn` (màu cam).
   - Số tiền ký quỹ quy định (Ví dụ: `800.000 đ` ~ `0.001 ETH`).

### 3.3. Tạo đơn mượn & Ký quỹ an toàn bằng MetaMask
1. Bấm nút **Đăng ký mượn** trên thiết bị mong muốn.
2. Hộp thoại (Modal) đăng ký xuất hiện:
   - Chọn ngày nhận máy dự kiến (Ví dụ: 08:00 sáng mai).
   - Chọn ngày hẹn trả máy (Ví dụ: 17:00 ba ngày sau).
   - Nhập ghi chú mục đích sử dụng (Ví dụ: *"Mượn làm bài tập lớn môn Hệ điều hành"*).
3. Bấm nút **Ký quỹ & Gửi đơn mượn**:
   - Cửa sổ MetaMask tự động bật lên yêu cầu phê duyệt giao dịch gửi tiền ký quỹ on-chain:
     - **Hàm tương tác:** `createLoanRequest(equipmentId, duration, note)`
     - **Số tiền thanh toán:** Đúng số ETH ký quỹ (ví dụ: `0.001 SepoliaETH`).
   - Bấm **Confirm**. Chờ 5-10 giây để mạng Sepolia xác nhận giao dịch.
4. Màn hình tự động chuyển sang trang **Xem đơn mượn** với trạng thái: `● Chờ duyệt`.

### 3.4. Nhận bàn giao thiết bị vật lý tại phòng Lab
1. Khi cán bộ phòng Lab phê duyệt đơn, trạng thái chuyển sang: `● Đã duyệt (Chờ lấy máy)`.
2. Sinh viên mang theo Thẻ sinh viên đến trực tiếp phòng Lab thực hành.
3. Cùng cán bộ kiểm tra tình trạng ngoại quan của máy (màn hình, bàn phím, phụ kiện dây sạc).
4. Cán bộ bấm xác nhận bàn giao trên hệ thống. Trạng thái đơn đổi thành `● Đang mượn`.
5. Sinh viên nhận thiết bị về phục vụ học tập.

### 3.5. Trả thiết bị, nghiệm thu & Nhận tiền hoàn cọc tức thì
1. Trước hạn chót quy định, sinh viên mang toàn bộ thiết bị và phụ kiện đến phòng Lab hoàn trả.
2. Cán bộ phòng Lab kiểm tra tình trạng máy:
   - Nếu máy hoạt động tốt, không trầy xước: Admin chọn mức `GOOD`.
3. Cán bộ bấm **Nghiệm thu & Hoàn cọc** và xác nhận trên MetaMask Admin.
4. Ngay khi giao dịch on-chain hoàn tất:
   - Trạng thái đơn chuyển sang: `● Đã hoàn tất`.
   - Tiền ký quỹ $100\%$ tự động chảy ngược về ví MetaMask của sinh viên.
   - Sinh viên có thể mở MetaMask tab Activity để kiểm chứng dòng tiền nhận về.

### 3.6. Xử lý trường hợp hủy đơn hoặc đổi ý trước khi nhận máy
- Trong thời gian đơn ở trạng thái `Chờ duyệt` hoặc `Đã duyệt (Chưa nhận máy)`, nếu sinh viên thay đổi kế hoạch học tập:
  1. Vào mục **Xem đơn mượn** -> Tìm đơn tương ứng -> Bấm nút **Hủy đơn**.
  2. Xác nhận trên MetaMask gọi hàm `cancelLoan(loanId)`.
  3. Tiền ký quỹ được hoàn lại $100\%$ ngay lập tức và thiết bị được giải phóng cho bạn khác mượn.

---

## 4. QUY TRÌNH DÀNH CHO CÁN BỘ QUẢN LÝ PHÒNG LAB (LAB ADMINISTRATOR SOP)

Cán bộ quản lý phòng Lab đóng vai trò là "Người giám hộ tài sản" (Asset Custodian) chịu trách nhiệm vận hành nghiệp vụ mượn trả hằng ngày.

### 4.1. Đăng nhập hệ thống quản trị & Thẩm định ví Admin
1. Đăng nhập bằng tài khoản quản trị viên:
   - Email: `admin@eduvault.edu.vn`
   - Mật khẩu: `admin123456`
2. Kết nối ví MetaMask Admin: `0xc6C0B41C8fEf9708E5249B27B168aF0Df18871f2`.
3. Kiểm tra trên thanh menu trên cùng: Xuất hiện địa chỉ ví kèm số dư ETH và thẻ vai trò màu đen `ADMIN`.

### 4.2. Cấp quyền mượn thiết bị (BORROWER_ROLE) cho sinh viên
1. Bấm vào tab **Phân quyền Web3** trên menu chính.
2. Tại khu vực **Cấp quyền Sinh viên (Borrower Role)**:
   - Danh sách sinh viên đã hoàn thành xác minh ví EIP-191 sẽ hiển thị trong bảng.
   - Với những bạn có trạng thái `Chờ cấp on-chain`: Bấm nút **Cấp BORROWER_ROLE**.
   - Ký giao dịch trên MetaMask gọi hàm `grantRole(BORROWER_ROLE, studentWallet)`.
   - Sau khi hoàn tất, sinh viên có thể bắt đầu tạo đơn mượn.

### 4.3. Thẩm định hồ sơ mượn & Phê duyệt đơn on-chain
1. Vào tab **Điều phối mượn trả**.
2. Chọn tab con **Chờ duyệt** để xem danh sách các đơn mới gửi.
3. Đối soát thông tin:
   - Tên sinh viên, MSSV có trong danh sách lớp thực hành hay không.
   - Thiết bị mượn có phù hợp với tiến độ môn học không.
4. Bấm nút **Duyệt**:
   - Cửa sổ MetaMask bật lên gọi hàm `approveLoan(loanId)`.
   - Bấm **Confirm**. Hệ thống tự động đồng bộ trạng thái đơn sang `APPROVED`.

### 4.4. Kiểm tra ngoại quan vật lý & Bàn giao thiết bị
1. Khi sinh viên đến phòng Lab nhận máy:
   - Tìm đơn tương ứng trong danh sách -> Bấm nút **Bàn giao**.
   - Nhập ghi chú ngoại quan máy (Ví dụ: *"Máy đẹp 99%, đủ sạc Type-C 130W, số serial: CN-0X8P2"*).
   - Ký xác nhận trên MetaMask gọi hàm `confirmHandover(loanId)`.
2. Trực tiếp trao thiết bị cho sinh viên. Đồng hồ đếm ngược thời hạn mượn chính thức được kích hoạt trên blockchain.

### 4.5. Nghiệm thu hoàn trả & Đánh giá phân loại mức độ tổn hại
1. Khi sinh viên mang máy đến trả:
   - Tìm đơn tương ứng trong tab **Đang mượn** -> Bấm nút **Nghiệm thu & Trả máy**.
2. Bật máy, kiểm tra màn hình, bàn phím, cổng kết nối, tem niêm phong.
3. Chọn mức đánh giá khách quan theo bảng chuẩn:
   - `Hoàn hảo (GOOD)`: Thiết bị bình thường -> Phạt 0%, Hoàn cọc 100%.
   - `Hư hại nhẹ (MINOR)`: Trầy xước nhẹ vỏ nhựa -> Phạt 20%.
   - `Hư hại nặng (MAJOR)`: Nứt màn hình, vỡ phím, lỗi sạc -> Phạt 50%.
   - `Mất máy / Hỏng hoàn toàn (LOST)`: Mất thiết bị -> Phạt 100%.
4. Bấm **Xác nhận nghiệm thu**:
   - Ký xác nhận trên MetaMask gọi hàm `returnEquipment(loanId, condition)`.
   - Smart Contract tự động tính toán số tiền phạt và giải ngân tiền hoàn trả về ví sinh viên ngay lập tức.
   - Thiết bị trong kho tự động đổi trạng thái về `AVAILABLE`, sẵn sàng cho lượt mượn kế tiếp.

---

## 5. QUY TRÌNH DÀNH CHO QUẢN TRỊ VIÊN CẤP CAO (DEPLOYER / ROOT ADMIN SOP)

Tài khoản Deployer (Nắm giữ `DEFAULT_ADMIN_ROLE`) là người có thẩm quyền cao nhất trong hệ thống, thường do Trưởng bộ môn hoặc Trưởng phòng Quản trị Thiết bị nắm giữ.

### 5.1. Cấp và thu hồi quyền Admin phòng Lab (ADMIN_ROLE)
- Khi có cán bộ quản lý mới tham gia phụ trách phòng Lab:
  1. Vào trang **Phân quyền Web3** bằng ví Deployer (`0x6396...CbBB`).
  2. Tại mục **Quản trị viên Nhóm (Multi-Admin)**:
     - Nhập địa chỉ ví Ethereum của cán bộ mới.
     - Bấm nút **Cấp quyền Admin (addAdmin)**.
     - Ký giao dịch trên MetaMask gọi `grantRole(ADMIN_ROLE, newAdminAddress)`.
- Khi cán bộ chuyển công tác: Nhập địa chỉ ví và bấm **Thu hồi quyền Admin (removeAdmin)**.

### 5.2. Tạm dừng hoạt động khẩn cấp (Emergency Circuit Breaker)
- Trong trường hợp phát hiện tấn công mạng hoặc có sự cố thiên tai/hỏa hoạn tại phòng Lab:
  1. Sử dụng script Hardhat hoặc giao diện Etherscan gọi hàm `pause()`.
  2. Toàn bộ các thao tác tạo đơn mới và duyệt đơn sẽ bị đóng băng ngay lập tức, tiền cọc của sinh viên vẫn được bảo lưu an toàn 100% trong Smart Contract.
  3. Khi sự cố được khắc phục: Gọi hàm `unpause()` để hệ thống mở lại bình thường.

---

## 6. SỔ TAY QUY CHUẨN ĐÁNH GIÁ TÌNH TRẠNG THIẾT BỊ (CONDITION ASSESSMENT MATRIX)

Để bảo đảm tính công bằng, loại bỏ định kiến cá nhân và chuẩn hóa quy trình nghiệm thu, cán bộ phòng Lab bắt buộc phải áp dụng bảng tiêu chuẩn phân loại sau:

```
+-----------------------------------------------------------------------------------------------+
|                      BẢNG TIÊU CHUẨN ĐÁNH GIÁ TÌNH TRẠNG VẬT LÝ THIẾT BỊ                      |
+-------------------+------------------------------------------+---------------+----------------+
| Cấp độ phân loại  | Dấu hiệu nhận biết ngoại quan & tính năng | Tỷ lệ phạt    | Hướng xử lý cọc|
+-------------------+------------------------------------------+---------------+----------------+
| 0: GOOD           | - Không trầy xước hoặc xước dăm nhẹ < 1cm| 0%            | Hoàn trả 100%  |
|    (Nguyên vẹn)   | - Màn hình sáng đẹp, không điểm chết     |               |                |
|                   | - Đầy đủ sạc cáp phụ kiện đi kèm        |               |                |
+-------------------+------------------------------------------+---------------+----------------+
| 1: MINOR_DAMAGE   | - Vết trầy xước sâu trên vỏ ngoài > 2cm  | 20%           | Khấu trừ 20%   |
|    (Hư hại nhẹ)   | - Mất túi chống sốc hoặc dây buộc phụ kiện|               | Hoàn trả 80%   |
|                   | - Bàn phím bóng mòn nhẹ do sử dụng       |               |                |
+-------------------+------------------------------------------+---------------+----------------+
| 2: MAJOR_DAMAGE   | - Màn hình bị kẻ sọc, nứt kính, chảy mực | 50%           | Khấu trừ 50%   |
|    (Hư hại nặng)  | - Móp méo góc máy do va đập, rơi rớt    |               | Hoàn trả 50%   |
|                   | - Hỏng cổng USB/HDMI, mất củ sạc chính   |               |                |
+-------------------+------------------------------------------+---------------+----------------+
| 3: LOST           | - Sinh viên làm mất thiết bị             | 100%          | Tịch thu 100%  |
|    (Mất mát/Hỏng) | - Máy bị ngấm nước, chập cháy bo mạch    | (Thu toàn bộ) | Hoàn trả 0 đ   |
|                   | - Thiết bị biến dạng hoàn toàn           |               |                |
+-------------------+------------------------------------------+---------------+----------------+
```

---

## 7. QUY TRÌNH GIẢI QUYẾT KHIẾU NẠI VÀ TRANH CHẤP (DISPUTE RESOLUTION PROTOCOL)

1. **Giai đoạn 1: Đối soát Dữ liệu Khách quan On-Chain:**
   - Mọi tranh chấp về thời gian nộp trả hoặc mức tiền phạt đều lấy dữ liệu tại mã băm giao dịch (Tx Hash) trên Etherscan làm căn cứ pháp lý duy nhất.
   - Timestamp của block được đóng bởi mạng lưới thợ đào Ethereum là bằng chứng khách quan, không ai có thể làm giả mạo.

2. **Giai đoạn 2: Trọng tài Ban Quản trị Lab:**
   - Nếu sinh viên cho rằng cán bộ đánh giá mức độ hư hại quá nặng so với thực tế:
     - Sinh viên gửi yêu cầu khiếu nại tới Hội đồng Quản trị Thiết bị Nhà trường kèm mã đơn mượn.
     - Ban Quản trị tiến hành trích xuất hình ảnh chụp lúc bàn giao ban đầu và đối chiếu với máy vật lý hiện tại để đưa ra phán quyết hoàn tiền bổ sung (nếu cán bộ có sai sót).

---

## 8. BỘ CÂU HỎI THƯỜNG GẶP (FREQUENTLY ASKED QUESTIONS - FAQ)

### Q1: Tôi là sinh viên nhưng không có SepoliaETH để ký quỹ thì phải làm sao?
> **Trả lời:** Mạng Sepolia là mạng thử nghiệm miễn phí hoàn toàn. Bạn chỉ cần truy cập Google Cloud Web3 Faucet hoặc Alchemy Faucet, dán địa chỉ ví MetaMask của mình vào là nhận được 0.05 ETH miễn phí mỗi ngày, đủ để thực hiện hàng chục giao dịch mượn thiết bị.

### Q2: Nếu tôi trả máy đúng hạn thì bao lâu tôi nhận lại được tiền cọc?
> **Trả lời:** Ngay lập tức! Hợp đồng thông minh `EquipmentLending` thực hiện lệnh hoàn tiền trong cùng một transaction khi Admin bấm nghiệm thu. Bạn sẽ thấy số dư ví MetaMask nhảy số tăng lên chỉ sau 10 đến 15 giây.

### Q3: Nếu phòng Lab bị mất điện hoặc máy chủ backend bị lỗi thì tiền cọc của tôi có bị mất không?
> **Trả lời:** Tuyệt đối không! Tiền cọc được khóa độc lập trên mạng Ethereum phân tán toàn cầu, không nằm trên máy chủ trường học. Khi hệ thống trường có điện trở lại, dữ liệu trên blockchain vẫn nguyên vẹn 100%.

### Q4: Tôi có thể chuyển nhượng đơn mượn của mình cho bạn khác nhận thay được không?
> **Trả lời:** Không thể. Hệ thống áp dụng quy tắc định danh nghiêm ngặt: Chỉ địa chỉ ví đã ký quỹ và liên kết với MSSV của bạn mới có tư cách nhận bàn giao thiết bị từ cán bộ phòng Lab.

---
*Cẩm nang vận hành được ban hành chính thức theo Quyết định số 2026/QĐ-EDUVAULT.*
