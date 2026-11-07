# KỊCH BẢN TRÌNH DIỄN SẢN PHẨM (DEMO SCRIPT) - HỆ THỐNG EDUVAULT
## KỊCH BẢN 5 BƯỚC THUYẾT TRÌNH TRƯỚC HỘI ĐỒNG ĐÁNH GIÁ (5 - 7 PHÚT)

---

> **Dự án:** EduVault - Hệ thống Quản lý Mượn trả Thiết bị Học tập Đào tạo trên EVM Blockchain  
> **Thời lượng chuẩn:** 05 - 07 phút  
> **Mục tiêu:** Thuyết phục Hội đồng về tính ứng dụng thực tiễn, tính bất biến của Blockchain, khả năng chịu lỗi và tính mượt mà của mô hình Web2.5.  

---

## I. CHECKLIST CHUẨN BỊ TRƯỚC GIỜ BÁO CÁO (PRE-FLIGHT CHECKLIST)

Trước khi bước vào phòng hội đồng ít nhất 15 phút, người thuyết trình cần chuẩn bị sẵn môi trường:

| STT | Thành phần | Lệnh thực thi / Đường dẫn | Trạng thái yêu cầu |
| :-: | :--- | :--- | :--- |
| 1 | **Hardhat Local Node** | Mở Terminal 1: `start_hardhat.bat` (Port 8545) | Đang lắng nghe RPC tại `http://127.0.0.1:8545` |
| 2 | **FastAPI Backend** | Mở Terminal 2: `start_backend.bat` (Port 8000) | Đã kết nối MySQL & Web3 RPC, Docs tại `http://127.0.0.1:8000/docs` |
| 3 | **React Frontend** | Mở Terminal 3: `start_frontend.bat` (Port 5173) | Đang chạy tại `http://localhost:5173` |
| 4 | **Nạp dữ liệu mẫu sạch** | Mở Terminal 4: `seed_data.bat` | Khởi tạo 1 Admin, 3 Sinh viên, 8 Thiết bị mẫu sạch |
| 5 | **Trình duyệt Web** | Mở Google Chrome ở chế độ toàn màn hình (F11) | Mở sẵn 2 tab: Tab 1 là App `http://localhost:5173`, Tab 2 là Swagger API Docs |

> [!TIP]
> **Tài khoản sử dụng trong kịch bản demo:**
> - **Quản trị viên (Admin):** Email: `admin@eduvault.edu.vn` | Mật khẩu: `Admin@123456`
> - **Sinh viên (Borrower):** Email: `sv2026001@eduvault.edu.vn` | Mật khẩu: `Student@123456`  
> *(Giao diện có sẵn nút Quick Fill, không cần gõ bàn phím)*

---

## II. TIMELINE TỔNG THỂ KỊCH BẢN DEMO (5 - 7 PHÚT)

```
0:00        1:15                2:30                    3:45                     5:15             6:30     7:00
|------------|-------------------|-----------------------|------------------------|----------------|--------|
 BƯỚC 1:      BƯỚC 2:             BƯỚC 3:                 BƯỚC 4:                  BƯỚC 5:          TỔNG KẾT &
 Khởi động &  Sinh viên tạo đơn   Admin phê duyệt         Hoàn trả thiết bị &      Kiểm toán On-Chain HỎI ĐÁP
 Showcase 3D  & Stepper theo dõi  & Bàn giao On-Chain     Quyết toán cọc/phạt     & Đối soát DB    HỘI ĐỒNG
```

---

## III. NỘI DUNG CHI TIẾT 5 BƯỚC DEMO TRẢI NGHIỆM

---

### BƯỚC 1: KHỞI ĐỘNG & BẢNG ĐIỀU KHIỂN SHOWCASE 3D (0:00 - 1:15)
- **Mục tiêu:** Gây ấn tượng thị giác mạnh mẽ với Hội đồng, giới thiệu thông điệp cốt lõi và kiến trúc Web2.5.
- **Vị trí màn hình:** Truy cập đường dẫn `http://localhost:5173/overview` (Trang Trình diễn Tổng quan).

#### Thao tác trên màn hình:
1. Rê chuột trên **Khối 3D Vault tương tác** (hiệu ứng xoay góc nhìn Perspective Tilt theo con trỏ chuột).
2. Cuộn nhẹ xuống khu vực **Visual Pipeline 4 trạm** minh họa luồng đi: *MySQL Pessimistic Lock $\to$ FastAPI Relayer $\to$ Smart Contract Mutex $\to$ Quyết toán cọc*.
3. Chỉ tay vào góc phải: **Live On-Chain Transaction Terminal** đang streaming các block và transaction hash thời gian thực từ node Hardhat EVM.

#### Kịch bản lời thoại (Speech Script):
> *"Kính thưa Hội đồng, đây là giao diện Tổng quan của hệ thống **EduVault**. Điểm đặc biệt của EduVault là áp dụng kiến trúc **Hybrid Web2.5**: người dùng được trải nghiệm tốc độ phản hồi tính bằng mili-giây như một ứng dụng Web doanh nghiệp thông thường, nhưng toàn bộ trạng thái pháp lý, cam kết ký quỹ và bằng chứng bàn giao đều được neo chặt vào Smart Contract trên mạng EVM Blockchain.  
> Ngay trên màn hình, Hội đồng có thể quan sát luồng giao dịch trực tiếp được giải mã từ khối Hardhat đang hoạt động ổn định. Bây giờ, em xin phép bắt đầu quy trình nghiệp vụ thực tế."*

---

### BƯỚC 2: TRẢI NGHIỆM SINH VIÊN - ĐĂNG KÝ MƯỢN THIẾT BỊ (1:15 - 2:30)
- **Mục tiêu:** Chứng minh sinh viên thao tác cực kỳ mượt mà, không gặp rào cản phí gas hay cài ví Web3, nắm bắt rõ ràng quy chế cọc và thời hạn.
- **Vị trí màn hình:** Vào trang Đăng nhập (`/login`), sau đó vào Danh mục Thiết bị (`/equipment`).

#### Thao tác trên màn hình:
1. Tại trang Đăng nhập, bấm nút **"Đăng nhập nhanh Sinh viên 1"** (Hệ thống tự điền và cấp Bearer JWT).
2. Chuyển sang trang **Danh mục Thiết bị**: Dùng ô tìm kiếm gõ từ khóa `Oscilloscope` hoặc lọc danh mục `Thiết bị Vi mạch`.
3. Bấm vào nút **"Mượn thiết bị"** trên thẻ máy *Máy hiện sóng số Tektronix TBS1102B-EDU* (Tiền cọc mô phỏng: 2,000,000 VNĐ).
4. Modal mở ra: Chọn ngày nhận máy và ngày hết hạn trả (ví dụ: hạn trả sau 3 ngày). Chỉ rõ cho Hội đồng thấy phần tóm tắt quy định phạt trễ hạn tự động (10% nếu trễ $\le 24$h, 50% nếu trễ $> 24$h).
5. Bấm **"Gửi yêu cầu mượn"**. Hệ thống phản hồi tức thì với thông báo thành công.
6. Chuyển sang trang **Đơn mượn của tôi (`/my-loans`)**: Chỉ vào thanh tiến trình **Stepper 4 bước** đang ở trạng thái `CHỜ DUYỆT (PENDING)`.

#### Kịch bản lời thoại (Speech Script):
> *"Tại phân hệ Sinh viên, em đăng nhập bằng tài khoản nội bộ của nhà trường. Em chọn một chiếc Máy hiện sóng số chuyên dụng và gửi đơn mượn.  
> Xin Hội đồng lưu ý: Sinh viên không hề phải mở ví MetaMask hay trả bất kỳ một đồng phí gas nào. Đơn mượn được khởi tạo ở trạng thái Chờ duyệt trong MySQL. Một nhật ký kiểm toán (Audit Log) đã được ghi lại kèm địa chỉ IP và mã số sinh viên. Đồng thời, sinh viên có thể theo dõi tiến độ qua thanh Stepper trực quan này."*

---

### BƯỚC 3: NGHIỆP VỤ QUẢN TRỊ VIÊN - DUYỆT & BÀN GIAO ON-CHAIN (2:30 - 3:45)
- **Mục tiêu:** Minh họa mô hình Custodial Relayer, cơ chế khóa dòng MySQL Pessimistic Lock và On-Chain Mutex chống đặt trùng.
- **Vị trí màn hình:** Bấm nút chuyển vai trò sang **Quản trị viên (Admin)**, truy cập Quản lý mượn trả (`/admin/loans`).

#### Thao tác trên màn hình:
1. Bấm nút **Quick Switch Account** trên thanh điều hướng sang tài khoản **Admin**.
2. Tại tab **"Chờ duyệt"**, đơn mượn của sinh viên `SV2026001` xuất hiện đầu danh sách.
3. Bấm nút **"Duyệt đơn"**:
   - Backend lập tức thực thi câu lệnh `SELECT ... FOR UPDATE` khóa độc quyền thiết bị trên MySQL.
   - Dịch vụ Relayer tự động sinh mã băm `on_chain_loan_id` (Keccak256) và gửi giao dịch `approveLoan` lên Smart Contract.
   - Thiết bị được gán vào biến Mutex `activeEquipmentLoan[eqId]` trên Blockchain.
   - Giao diện hiển thị huy hiệu `ĐÃ DUYỆT (APPROVED)` kèm **Transaction Hash** màu xanh.
4. Bấm nút **"Xác nhận bàn giao"** (khi sinh viên đến nhận máy tại quầy Lab):
   - Smart Contract kích hoạt hàm `confirmHandover`, chuyển cọc sang trạng thái `LOCKED`.
   - Trạng thái đơn chuyển sang `ĐANG MƯỢN (ACTIVE)`, tình trạng thiết bị chuyển sang `IN_USE`.

#### Kịch bản lời thoại (Speech Script):
> *"Bây giờ em chuyển sang vai trò Cán bộ quản lý kho. Tại màn hình điều phối, em nhìn thấy đơn mượn vừa tạo.  
> Khi em bấm 'Duyệt đơn', hai tầng bảo vệ đã được kích hoạt đồng thời:  
> Thứ nhất: CSDL MySQL khóa dòng bi quan (Pessimistic Lock), ngăn không cho bất kỳ sinh viên nào khác gửi đơn mượn thiết bị này.  
> Thứ hai: Backend Relayer đã ký số và gửi giao dịch lên Smart Contract. Mutex on-chain đã khóa cứng thiết bị này vào mã định danh duy nhất của đơn mượn. Giờ đây, dù có kẻ xấu cố ý gọi trực tiếp vào Smart Contract để mượn chiếc máy này thì EVM cũng sẽ lập tức revert giao dịch.  
> Tiếp theo, khi sinh viên đến quầy nhận máy thực tế, thủ kho bấm 'Xác nhận bàn giao'. Khoản cọc mô phỏng được khóa bất biến trên Blockchain."*

---

### BƯỚC 4: HOÀN TRẢ THIẾT BỊ & QUYẾT TOÁN CỌC TỰ ĐỘNG (3:45 - 5:15)
- **Mục tiêu:** Thể hiện máy trạng thái (State Machine) của Smart Contract tự động tính phạt và hoàn cọc minh bạch, giải phóng Mutex an toàn.
- **Vị trí màn hình:** Trang Quản lý mượn trả (`/admin/loans`), tab **"Đang mượn"**.

#### Thao tác trên màn hình:
1. Tại danh sách đơn đang mượn, bấm nút **"Nhận trả thiết bị"**.
2. Modal thẩm định hiện lên với 3 lựa chọn tình trạng phần cứng:
   - *Tình trạng Tốt (GOOD):* Hoàn cọc 100%, phạt 0%.
   - *Hư hỏng (DAMAGED):* Phạt 100% cọc vào quỹ đền bù, trạng thái DISPUTED.
   - *Làm mất (LOST):* Tịch thu 100% cọc.
3. Chọn kịch bản **Tình trạng Tốt (Trả đúng hạn)** (hoặc giả lập trễ hạn để cho thấy công thức phạt tự động).
4. Bấm **"Xác nhận hoàn tất"**:
   - Backend gọi `confirmReturn` on-chain.
   - Smart Contract giải phóng Mutex (`delete activeEquipmentLoan[eqId]`).
   - Cọc chuyển sang `REFUNDED`, tiền phạt: 0 VNĐ.
   - Thiết bị lập tức tự động đổi trạng thái về `AVAILABLE` (Sẵn sàng cho người tiếp theo mượn).

#### Kịch bản lời thoại (Speech Script):
> *"Sau thời gian mượn thực hành, sinh viên mang máy hiện sóng đến trả. Cán bộ quản lý kiểm tra phần cứng và ghi nhận tình trạng máy Tốt.  
> Khi bấm xác nhận, Smart Contract tự động đối chiếu thời gian trả thực tế với hạn chót lưu trên chuỗi:  
> Vì đúng hạn, Smart Contract tự động quyết toán phạt 0%, giải phóng cọc mô phỏng sang trạng thái Hoàn trả (Refunded). Đồng thời, biến Mutex của thiết bị được giải phóng hoàn toàn trên EVM, đưa thiết bị về trạng thái Sẵn sàng để phục vụ cho các sinh viên tiếp theo.  
> Toàn bộ logic tài chính này do Smart Contract độc lập tính toán và thực thi, không một nhân viên nào có thể gian lận hoặc can thiệp bớt xén."*

---

### BƯỚC 5: MINH CHỨNG BẤT BIẾN & ĐỐI SOÁT TÍNH TOÀN VẸN (5:15 - 6:30)
- **Mục tiêu:** Chứng minh sức mạnh kiểm toán độc lập của Blockchain, giải quyết dứt điểm vấn đề "DBA sửa cơ sở dữ liệu", biểu diễn cơ chế Reconciler tự phục hồi.
- **Vị trí màn hình:** Truy cập trang **Kiểm toán Blockchain (`/audit`)**.

#### Thao tác trên màn hình:
1. Trên thanh điều hướng, bấm vào mục **"Kiểm toán Blockchain"**.
2. Mở rộng chi tiết đơn mượn vừa thực hiện: Chỉ cho Hội đồng xem chuỗi các **Transaction Hash, Block Number, Gas Used** được ghi nhận tuần tự (`APPROVE_LOAN`, `CONFIRM_HANDOVER`, `CONFIRM_RETURN`).
3. Bấm nút **"Xác minh tính toàn vẹn (Verify Loan)"**:
   - Giao diện thực hiện lệnh gọi kép: vừa đọc từ MySQL, vừa gọi hàm `getLoanDetails` từ Smart Contract và đặt hai bảng dữ liệu cạnh nhau.
   - Kết quả trả về: Huy hiệu xanh lá cây **"ĐỒNG BỘ 100% - TOÀN VẸN TUYỆT ĐỐI"**.
4. Giới thiệu nút **"Kích hoạt đối soát tự động (Trigger Reconciliation)"**:
   - Giải thích cho Hội đồng: Nếu kẻ xấu truy cập trực tiếp vào phpMyAdmin hoặc MySQL Workbench sửa trạng thái đơn mượn từ DISPUTED thành RETURNED, thì chỉ cần bấm đối soát, hệ thống sẽ phát hiện ra sự sai lệch ngay lập tức và tự động khôi phục dữ liệu theo chân lý on-chain.

#### Kịch bản lời thoại (Speech Script):
> *"Cuối cùng, em xin chứng minh giá trị cốt lõi nhất của dự án tại màn hình Kiểm toán Blockchain này.  
> Mọi bước đi của thiết bị đều để lại dấu vết mật mã bất biến. Khi em bấm nút 'Xác minh tính toàn vẹn', hệ thống sẽ lấy dữ liệu từ MySQL và dữ liệu từ Smart Contract để so khớp từng byte một: từ trạng thái đơn, trạng thái cọc đến số tiền phạt.  
> Trong trường hợp xấu nhất, nếu một Quản trị viên cơ sở dữ liệu (DBA) cố tình can thiệp vào bảng MySQL để xóa dấu vết thiết bị hư hỏng, cơ chế Background Reconciliation Worker của EduVault sẽ phát hiện ra ngay lập tức vì dữ liệu on-chain là bất biến và không thể sửa đổi. Đây chính là giải pháp bảo vệ tài sản công minh bạch và triệt để nhất."*

---

### TỔNG KẾT & KẾT THÚC DEMO (6:30 - 7:00)

#### Kịch bản lời thoại kết luận:
> *"Kính thưa quý thầy cô trong Hội đồng,  
> Trong 6 phút vừa qua, nhóm em đã trình diễn trọn vẹn vòng đời quản lý mượn trả thiết bị trên EduVault:  
> 1. Trải nghiệm sinh viên nhanh gọn, thân thiện theo chuẩn Web2.  
> 2. Tính an toàn bảo vệ hai tầng chống đặt trùng bằng Pessimistic Lock & On-Chain Mutex.  
> 3. Quyết toán cọc và phạt trễ hạn tự động, bất biến thông qua Smart Contract.  
> 4. Khả năng kiểm toán độc lập và tự phục hồi dữ liệu khi có sự cố.  
> Toàn bộ hệ thống đã được kiểm thử với 92 ca kiểm thử tự động đạt 100% tỷ lệ thành công.  
> Nhóm em xin chân thành cảm ơn sự lắng nghe của Hội đồng và rất mong nhận được những câu hỏi phản biện, góp ý quý báu của quý thầy cô!"*

---

## IV. BẢN KẾ HOẠCH DỰ PHÒNG SỰ CỐ TẠI HỘI ĐỒNG (BACKUP & CONTINGENCY PLAN)

| Tình huống rủi ro | Dấu hiệu nhận biết | Phương án xử lý tức thì |
| :--- | :--- | :--- |
| **Frontend không kết nối được Backend** | Thông báo lỗi đỏ "Network Error" hoặc không tải được danh mục | 1. Mở Terminal Backend kiểm tra xem process có bị dừng không.<br>2. Nếu tắt, chạy nhanh lệnh: `start_backend.bat`.<br>3. Mở tab Swagger `/docs` để chứng minh API vẫn hoạt động. |
| **Hardhat node bị treo hoặc hết nonce** | Bấm duyệt đơn hiện thông báo timeout hoặc nonce mismatch | 1. Tắt terminal Hardhat cũ, chạy lại `start_hardhat.bat`.<br>2. Chạy nhanh `deploy_contract.bat` để cập nhật lại contract address.<br>3. Khởi động lại backend để nhận địa chỉ mới. |
| **Dữ liệu bị lỗi do test trước đó** | Thiết bị báo đã được mượn hết, không còn máy AVAILABLE | Chạy file `seed_data.bat` trong 3 giây: Cơ sở dữ liệu sẽ tự động được làm sạch và nạp lại 8 thiết bị hoàn toàn mới. |
| **Hội đồng yêu cầu chứng minh mã nguồn Smart Contract thực tế** | Thầy cô hỏi: "Logic phạt quá hạn viết ở đâu?" | Mở file `contracts/contracts/EquipmentLending.sol`, cuộn đến hàm `confirmReturn` (dòng 120-145) để chỉ rõ phép so sánh `block.timestamp > loan.dueDate` và logic tính phạt. |

---
*Tài liệu hướng dẫn thực hành báo cáo đồ án tốt nghiệp - EduVault 2026.*
