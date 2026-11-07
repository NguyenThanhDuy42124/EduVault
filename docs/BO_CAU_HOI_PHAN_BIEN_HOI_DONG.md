# BỘ CÂU HỎI PHẢN BIỆN HỘI ĐỒNG & ĐÁP ÁN KỸ THUẬT CHUẨN XÁC
## TÀI LIỆU ÔN LUYỆN BẢO VỆ ĐỒ ÁN TỐT NGHIỆP: HỆ THỐNG EDUVAULT

---

> **Dự án:** EduVault - Smart Contract-Based Educational Equipment Lending Management System  
> **Bộ câu hỏi:** 10 câu hỏi then chốt chuyên sâu về Kiến trúc phần mềm, Blockchain, An toàn thông tin và Cơ sở dữ liệu.  
> **Đối tượng sử dụng:** Sinh viên bảo vệ đồ án tốt nghiệp trước Hội đồng Khoa học & Giảng viên phản biện.  

---

## DANH MỤC 10 CÂU HỎI PHẢN BIỆN TRỌNG TÂM

1. [Câu hỏi 1: Tại sao phải dùng Blockchain mà không dùng CSDL quan hệ thuần túy?](#câu-hỏi-1-tại-sao-phải-dùng-blockchain-mà-không-dùng-csdl-quan-hệ-thuần-túy)
2. [Câu hỏi 2: Xử lý vấn đề bất đồng bộ Dual-Write và Server Crash như thế nào?](#câu-hỏi-2-xử-lý-vấn-đề-bất-đồng-bộ-dual-write-và-server-crash-như-thế-nào)
3. [Câu hỏi 3: Tại sao lại chọn Ký quỹ mô phỏng (Simulated Deposit) thay vì Native Token?](#câu-hỏi-3-tại-sao-lại-chọn-ký-quỹ-mô-phỏng-simulated-deposit-thay-vì-native-token)
4. [Câu hỏi 4: Cơ chế chống tranh chấp đồng thời (Race Condition) và Đặt trùng (Double-Borrowing)?](#câu-hỏi-4-cơ-chế-chống-tranh-chấp-đồng-thời-race-condition-và-đặt-trùng-double-borrowing)
5. [Câu hỏi 5: Nếu kẻ xấu gọi trực tiếp vào Smart Contract thì hệ thống phòng vệ ra sao?](#câu-hỏi-5-nếu-kẻ-xấu-gọi-trực-tiếp-vào-smart-contract-thì-hệ-thống-phòng-vệ-ra-sao)
6. [Câu hỏi 6: Quản trị và bảo vệ Private Key của Custodial Relayer như thế nào?](#câu-hỏi-6-quản-trị-và-bảo-vệ-private-key-của-custodial-relayer-như-thế-nào)
7. [Câu hỏi 7: Bài toán chi phí Gas và Khả năng mở rộng (Scalability) khi triển khai thực tế?](#câu-hỏi-7-bài-toán-chi-phí-gas-và-khả-năng-mở-rộng-scalability-khi-triển-khai-thực-tế)
8. [Câu hỏi 8: Bảo vệ dữ liệu cá nhân sinh viên (PII/GDPR) trên sổ cái công khai như thế nào?](#câu-hỏi-8-bảo-vệ-dữ-liệu-cá-nhân-sinh-viên-piigdpr-trên-sổ-cái-công-khai-như-thế-nào)
9. [Câu hỏi 9: Khả năng nâng cấp Smart Contract (Upgradeability) khi trường đổi quy chế?](#câu-hỏi-9-khả-năng-nâng-cấp-smart-contract-upgradeability-khi-trường-đổi-quy-chế)
10. [Câu hỏi 10: Minh chứng thực nghiệm về Kiểm thử (QA Testing) và Rà soát Bảo mật?](#câu-hỏi-10-minh-chứng-thực-nghiệm-về-kiểm-thử-qa-testing-và-rà-soát-bảo-mật)

---

### CÂU HỎI 1: TẠI SAO PHẢI DÙNG BLOCKCHAIN MÀ KHÔNG DÙNG CSDL QUAN HỆ THUẦN TÚY?
**Giảng viên hỏi:**
> *"Bài toán mượn trả thiết bị học tập là nghiệp vụ nội bộ của một trường đại học. Một cơ sở dữ liệu quan hệ như MySQL hay PostgreSQL với mô hình phân quyền RBAC chặt chẽ và ghi log audit đầy đủ hoàn toàn có thể đáp ứng tốt, nhanh hơn và không tốn phí gas. Việc các em đưa Blockchain và Smart Contract vào liệu có phải là 'dùng dao mổ trâu để giết gà' hay theo trào lưu công nghệ?"*

**Câu trả lời kỹ thuật chuẩn xác:**
> *"Kính thưa Thầy/Cô, nhóm em đã cân nhắc rất kỹ bài toán này khi thiết kế kiến trúc. Điểm yếu chí tử của CSDL quan hệ truyền thống tập trung nằm ở khái niệm **Quyền lực tối cao của Quản trị viên (DBA / Single Point of Trust)**:  
> 1. **Nguy cơ chỉnh sửa nhật ký (Data Tampering):** Trong một hệ thống tập trung, bất kỳ ai có quyền root database hoặc quyền admin cấp cao đều có thể chạy câu lệnh `UPDATE` hoặc `DELETE` trực tiếp vào bảng cơ sở dữ liệu để sửa đổi ngày giờ trả máy, xóa vết phạt hoặc thay đổi trạng thái hư hỏng của thiết bị mà không để lại bất kỳ dấu vết nào. Bảng `audit_logs` trong MySQL cũng chỉ là một bảng dữ liệu, hoàn toàn có thể bị xóa bằng một câu lệnh SQL.  
> 2. **Giải quyết tranh chấp và phân xử minh bạch:** Khi xảy ra hư hỏng thiết bị trị giá hàng chục triệu đồng hoặc khiếu nại về tiền cọc, sinh viên và nhà trường thường rơi vào thế đối đầu thiếu niềm tin. Với Smart Contract trên Blockchain:  
>    - Trạng thái bàn giao, thời hạn trả máy và cam kết cọc được ghi nhận bằng **mã băm mật mã (Cryptographic Hash)** trên sổ cái phân tán.  
>    - Sau khi giao dịch đã được đưa vào block, không một ai — kể cả Ban Giám hiệu, Trưởng khoa hay Quản trị viên hệ thống — có thể đơn phương sửa đổi được lịch sử.  
>    - Logic tính phạt quá hạn (10% nếu $\le 24$h, 50% nếu $> 24$h) được thực thi độc lập bởi mã bytecode bất biến của hợp đồng, đảm bảo tính công bằng và chống tiêu cực.  
> 3. Do đó, EduVault không thay thế hoàn toàn MySQL, mà kết hợp theo mô hình **Hybrid Web2.5**: MySQL lưu trữ dữ liệu nghiệp vụ để phục vụ giao diện tốc độ cao, còn Blockchain đóng vai trò là **Tòa trọng tài kỹ thuật số bất biến (Immutable Arbiter)** để bảo vệ tính toàn vẹn và chống chối bỏ."*

---

### CÂU HỎI 2: XỬ LÝ VẤN ĐỀ BẤT ĐỒNG BỘ DUAL-WRITE VÀ SERVER CRASH NHƯ THẾ NÀO?
**Giảng viên hỏi:**
> *"Trong kiến trúc Web2.5 của các em, dữ liệu vừa phải ghi vào MySQL vừa phải gửi giao dịch lên Smart Contract (bài toán Dual-write). Nếu giao dịch gửi lên EVM đã đào thành công nhưng máy chủ FastAPI bị mất điện hoặc crash ngay trước khi kịp ghi vào MySQL, hệ thống sẽ bị lệch trạng thái (Split-Brain). Nhóm đã giải quyết vấn đề này như thế nào?"*

**Câu trả lời kỹ thuật chuẩn xác:**
> *"Kính thưa Thầy/Cô, đây là bài toán kinh điển trong các hệ thống phân tán hybrid. Nhóm em giải quyết triệt để thông qua 2 cơ chế phối hợp:  
> 1. **Idempotent Unique Key (`on_chain_loan_id`):**  
>    Thay vì để Smart Contract tự tăng ID ngẫu nhiên, mã băm định danh của đơn mượn được sinh ra từ đầu bằng thuật toán mật mã:  
>    $$\text{on\_chain\_loan\_id} = \text{keccak256}(\text{abi.encodePacked}(\text{userId}, \text{equipmentId}, \text{createdAtTimestamp}))$$  
>    Mã này là duy nhất và tất định. Khi retry gửi lại giao dịch, Smart Contract sẽ nhận diện được ID này và không bao giờ tạo ra đơn mượn trùng lặp.  
> 2. **Cơ chế Tự phục hồi dữ liệu (Background Reconciliation Worker):**  
>    - Nhóm đã xây dựng một tiến trình chạy ngầm độc lập (Worker) và cung cấp endpoint `/api/v1/audit/reconcile`.  
>    - Khi server khởi động lại sau crash, Worker sẽ quét toàn bộ các đơn mượn có trạng thái nghi vấn. Worker gọi trực tiếp hàm `getLoanDetails(loanId)` trên Smart Contract để lấy **Sự thật gốc (Ground Truth)**.  
>    - Nếu Smart Contract báo đơn đã ở trạng thái `Active` mà MySQL vẫn đang lưu `APPROVED`, hệ thống sẽ tự động cập nhật MySQL lên `ACTIVE`, đồng thời ghi một dòng nhật ký kiểm toán với hành động `RECONCILIATION_AUTO_HEAL`.  
>    - Kịch bản này đã được nhóm viết mã kiểm thử thực tế và vượt qua thành công trong file `scripts/test_e2e_concurrency_recovery.py`."*

---

### CÂU HỎI 3: TẠI SAO LẠI CHỌN KÝ QUỸ MÔ PHỎNG (SIMULATED DEPOSIT) THAY VÌ NATIVE TOKEN?
**Giảng viên hỏi:**
> *"Tại sao trong Smart Contract nhóm lại dùng Kế toán ký quỹ mô phỏng (Simulated Deposit Accounting) mà không bắt buộc sinh viên nạp tiền ETH hoặc chuyển token ERC-20 thật vào hợp đồng để giữ cọc?"*

**Câu trả lời kỹ thuật chuẩn xác:**
> *"Kính thưa Thầy/Cô, quyết định sử dụng Ký quỹ mô phỏng xuất phát từ 3 lý do kỹ thuật và thực tiễn cốt lõi:  
> 1. **Triệt tiêu hoàn toàn rủi ro bảo mật Reentrancy Attack:**  
>    Khi một Smart Contract nắm giữ native token và có hàm rút tiền (`call.value` hoặc `transfer`), hợp đồng sẽ đối mặt với nguy cơ tấn công tái nhập (Reentrancy) — nguyên nhân gây ra vụ hack The DAO lịch sử. Bằng cách mô phỏng kế toán trên biến số trạng thái (`depositStatus`: `Pending` $\to$ `Locked` $\to$ `Refunded`/`Forfeited`), hợp đồng hoàn toàn không cần gọi ra các địa chỉ bên ngoài, do đó miễn nhiễm $100\%$ với Reentrancy.  
> 2. **Rào cản pháp lý và trải nghiệm người dùng (UX Friction):**  
>    Tại Việt Nam, tiền mã hóa chưa được công nhận là phương tiện thanh toán pháp quy. Việc yêu cầu sinh viên phải mua tiền điện tử thật để mượn một chiếc máy hàn hay laptop trong trường là hoàn toàn không khả thi và vi phạm quy chế tài chính của nhà trường.  
> 3. **Tính chất cam kết pháp lý vẫn được bảo toàn nguyên vẹn:**  
>    Smart Contract vẫn thực hiện đầy đủ logic nghiệp vụ tài chính: ghi nhận chính xác giá trị cọc quy đổi ra VNĐ, tính toán số tiền phạt trễ hạn theo tỷ lệ phần trăm toán học, và phán quyết tịch thu hoặc hoàn cọc. Bằng chứng này được dùng làm cơ sở pháp lý để bộ phận kế toán của trường hoàn trả tiền mặt hoặc trừ vào học phí của sinh viên một cách minh bạch."*

---

### CÂU HỎI 4: CƠ CHẾ CHỐNG TRANH CHẤP ĐỒNG THỜI (RACE CONDITION) VÀ ĐẶT TRÙNG (DOUBLE-BORROWING)?
**Giảng viên hỏi:**
> *"Giả sử trong kho chỉ còn đúng 1 chiếc kính VR Oculus duy nhất. Đúng 12h trưa, hai sinh viên cùng lúc bấm mượn, hoặc hai thủ kho cùng lúc mở giao diện duyệt đơn cho hai người khác nhau. Hệ thống của em xử lý chống đặt trùng (Double-Booking) như thế nào ở cả hai tầng?"*

**Câu trả lời kỹ thuật chuẩn xác:**
> *"Kính thưa Thầy/Cô, hệ thống EduVault thiết lập cơ chế bảo vệ hai tầng độc lập (Defense-in-Depth):  
> 1. **Tầng 1 - MySQL Pessimistic Locking (`SELECT ... FOR UPDATE`):**  
>    Tại Backend FastAPI, khi yêu cầu mượn hoặc duyệt đơn được xử lý, mã nguồn thực thi câu lệnh:  
>    `db.query(Equipment).filter(Equipment.id == id).with_for_update().first()`  
>    Câu lệnh này kích hoạt cơ chế khóa dòng độc quyền (Exclusive Row Lock) của MySQL InnoDB:  
>    - Request thứ nhất đến sẽ chiếm giữ khóa dòng.  
>    - Request thứ hai đến cùng tích tắc buộc phải chờ (blocking) cho đến khi transaction thứ nhất hoàn tất.  
>    - Khi transaction 1 chuyển trạng thái máy thành `RESERVED` và commit, transaction 2 mới được đọc dữ liệu mới; lúc này hệ thống kiểm tra thấy máy không còn `AVAILABLE` và lập tức trả về mã lỗi `HTTP 409 Conflict`.  
> 2. **Tầng 2 - Smart Contract Mutex Mapping (`activeEquipmentLoan`):**  
>    Nếu kẻ tấn công tìm cách vượt qua API Backend để gửi thẳng hai giao dịch lên Blockchain, Smart Contract có một biến trạng thái độc quyền:  
>    `mapping(uint256 => bytes32) public activeEquipmentLoan;`  
>    Trong hàm `approveLoan`, hợp đồng yêu cầu tiên quyết:  
>    `require(activeEquipmentLoan[equipmentId] == bytes32(0), "Equipment already reserved or in use");`  
>    Giao dịch đầu tiên được đào sẽ gán `activeEquipmentLoan[equipmentId] = loanId`. Giao dịch thứ hai cố tình duyệt cho thiết bị đó sẽ lập tức bị EVM Revert và hoàn tác toàn bộ thay đổi.  
> Nhờ cơ chế phòng thủ kép này, nguy cơ đặt trùng thiết bị là hoàn toàn bằng $0$."*

---

### CÂU HỎI 5: NẾU KẺ XẤU GỌI TRỰC TIẾP VÀO SMART CONTRACT THÌ HỆ THỐNG PHÒNG VỆ RA SAO?
**Giảng viên hỏi:**
> *"Nếu một sinh viên IT giỏi dùng Web3 script hoặc Remix IDE để kết nối trực tiếp vào địa chỉ Smart Contract trên blockchain rồi gọi hàm `approveLoan` hoặc `confirmReturn` (tự duyệt đơn và tự xóa phạt cho mình), hệ thống có bị hack không?"*

**Câu trả lời kỹ thuật chuẩn xác:**
> *"Kính thưa Thầy/Cô, hợp đồng hoàn toàn an toàn trước kịch bản này nhờ hệ thống phân quyền mật mã **OpenZeppelin AccessControl**:  
> 1. Trong hợp đồng `EquipmentLending.sol`, các hàm nhạy cảm thay đổi trạng thái pháp lý (`approveLoan`, `confirmHandover`, `confirmReturn`, `cancelLoan`) đều được gắn modifier nghiêm ngặt:  
>    `onlyRole(ADMIN_ROLE)`  
> 2. Khi kẻ xấu gọi trực tiếp vào hàm từ địa chỉ ví cá nhân của họ, hàm nội tại `_checkRole(ADMIN_ROLE, msg.sender)` của OpenZeppelin sẽ kiểm tra xem địa chỉ ví `msg.sender` có nằm trong danh sách được cấp quyền hay không.  
> 3. Vì địa chỉ ví của sinh viên không sở hữu `ADMIN_ROLE`, máy ảo EVM sẽ ngay lập tức kích hoạt chỉ thị `REVERT` kèm thông báo lỗi:  
>    `AccessControlUnauthorizedAccount(account, neededRole)`  
> 4. Giao dịch bị từ chối hoàn toàn, trạng thái hợp đồng không thay đổi, và kẻ tấn công sẽ mất toàn bộ phí gas đã trả cho node mà không đạt được mục đích. Kịch bản này đã được nhóm kiểm thử tự động trong bộ test Hardhat với kết quả 100% Revert thành công."*

---

### CÂU HỎI 6: QUẢN TRỊ VÀ BẢO VỆ PRIVATE KEY CỦA CUSTODIAL RELAYER NHƯ THẾ NÀO?
**Giảng viên hỏi:**
> *"Trong mô hình Custodial Relayer, Backend nắm giữ Private Key để ký giao dịch thay cho người dùng. Nếu hacker xâm nhập được vào máy chủ Backend và đánh cắp Private Key này thì sao? Nhóm giải quyết bài toán an toàn khóa bí mật này ra sao?"*

**Câu trả lời kỹ thuật chuẩn xác:**
> *"Kính thưa Thầy/Cô, việc bảo vệ Private Key của Relayer được nhóm triển khai theo các cấp độ sau:  
> 1. **Triển khai ở môi trường hiện tại (Local / Staging):**  
>    - Private Key tuyệt đối không được hardcode trong mã nguồn mà được cô lập trong biến môi trường `.env` được bảo vệ bởi `.gitignore`.  
>    - Nhóm đã xây dựng script tự động `scripts/audit_security.py` quét toàn bộ 59 file mã nguồn của dự án và xác nhận 100% không có bất kỳ private key hay mật khẩu nào bị lộ trong Git repository.  
> 2. **Giải pháp kiến trúc khi đưa vào môi trường Production thực tế:**  
>    - **Sử dụng Cloud KMS / HSM (Hardware Security Module):** Backend không lưu trực tiếp chuỗi Private Key trong bộ nhớ hay file text. Thay vào đó, backend sử dụng dịch vụ đám mây chuyên dụng như *AWS KMS* hoặc *Google Cloud KMS*, nơi Private Key được niêm phong trong chip phần cứng FIPS 140-2. Backend chỉ gửi dữ liệu thô sang KMS để yêu cầu ký số và nhận lại chữ ký mật mã.  
>    - **Nguyên tắc phân quyền tối thiểu (Least Privilege):** Ví Relayer chỉ được cấp đúng quyền `ADMIN_ROLE` để duyệt mượn trả thiết bị, không nắm giữ quyền `DEFAULT_ADMIN_ROLE` (quyền đổi chủ hợp đồng). Nếu phát hiện nghi vấn lộ ví, tài khoản quản trị tối cao của Nhà trường có thể gọi hàm `revokeRole` để tước quyền ví Relayer cũ và cấp quyền cho một ví Relayer mới trong vòng 1 block mà không cần triển khai lại hợp đồng."*

---

### CÂU HỎI 7: BÀI TOÁN CHI PHÍ GAS VÀ KHẢ NĂNG MỞ RỘNG (SCALABILITY) KHI TRIỂN KHAI THỰC TẾ?
**Giảng viên hỏi:**
> *"Nếu trường có 20,000 sinh viên và hàng ngàn lượt mượn trả mỗi ngày, nếu chạy trên Ethereum thì phí gas sẽ rất đắt và mạng lưới sẽ bị nghẽn (Block time ~12 giây). Nhóm định hướng giải quyết bài toán này như thế nào?"*

**Câu trả lời kỹ thuật chuẩn xác:**
> *"Kính thưa Thầy/Cô, việc triển khai một ứng dụng quản lý tài sản nội bộ trực tiếp lên Ethereum Layer 1 là không phù hợp về mặt kinh tế. Nhóm đã định hướng 2 phương án mở rộng tối ưu:  
> 1. **Triển khai trên mạng Layer 2 Rollups (Arbitrum One, Optimism, Base hoặc Polygon PoS):**  
>    - Các mạng này hoàn toàn tương thích với EVM (EVM-Equivalent), nghĩa là Smart Contract `EquipmentLending.sol` của nhóm có thể deploy trực tiếp mà không cần sửa một dòng code nào.  
>    - Phí gas trên Layer 2 cực kỳ thấp (chỉ khoảng $0.001 - $0.005 USD mỗi giao dịch), và thời gian xác nhận khối chỉ từ 1 đến 2 giây.  
> 2. **Triển khai trên mạng Private EVM / Consortium Blockchain của Ngành Giáo dục:**  
>    - Nhà trường cùng các trường đại học đối tác có thể liên minh thiết lập mạng riêng dựa trên công nghệ mã nguồn mở như *Hyperledger Besu* hoặc *Polygon Edge*.  
>    - Mạng này sử dụng cơ chế đồng thuận Proof of Authority (PoA) do các trường đại học làm Validator.  
>    - Chi phí gas có thể được thiết lập về **Zero-Gas (Phí gas = 0)** hoặc thanh toán định kỳ theo hạn mức phân bổ nội bộ, giải quyết triệt để cả bài toán chi phí lẫn tốc độ xử lý."*

---

### CÂU HỎI 8: BẢO VỆ DỮ LIỆU CÁ NHÂN SINH VIÊN (PII/GDPR) TRÊN SỔ CÁI CÔNG KHAI NHƯ THẾ NÀO?
**Giảng viên hỏi:**
> *"Blockchain có đặc tính là dữ liệu công khai và không thể xóa bỏ. Nếu đưa thông tin sinh viên lên Blockchain thì sẽ vi phạm các quy định về quyền riêng tư (như GDPR - Quyền được lãng quên / Xóa dữ liệu). Nhóm đã thiết kế cấu trúc dữ liệu như thế nào để đảm bảo không vi phạm?"*

**Câu trả lời kỹ thuật chuẩn xác:**
> *"Kính thưa Thầy/Cô, đây là nguyên tắc thiết kế tối quan trọng mà nhóm đã tuân thủ ngay từ giai đoạn đặc tả kiến trúc:  
> 1. **Nguyên tắc Tách biệt Định danh Cá nhân (Zero-PII On-Chain):**  
>    - Hợp đồng thông minh `EquipmentLending.sol` **tuyệt đối không lưu trữ bất kỳ thông tin định danh cá nhân (PII)** nào của sinh viên như: Họ và tên, Mã số sinh viên, Địa chỉ Email, Số điện thoại hay Số CCCD.  
> 2. **Định danh Ẩn danh (Pseudonymous Mapping):**  
>    - Trên Blockchain, một đơn mượn chỉ lưu:  
>      `uint256 userId` và mã định danh giao dịch `bytes32 loanId`.  
>    - Một người bên ngoài khi xem thông tin trên Blockchain chỉ thấy một con số nguyên vô nghĩa (ví dụ `userId = 3`). Chỉ có cơ sở dữ liệu nội bộ MySQL được bảo vệ bởi tường lửa của nhà trường mới có bảng đối chiếu `userId = 3` là sinh viên nào.  
> 3. **Tuân thủ Quyền được lãng quên (Right to be Forgotten):**  
>    - Khi sinh viên tốt nghiệp hoặc yêu cầu xóa dữ liệu cá nhân theo quy định GDPR, nhà trường hoàn toàn có thể xóa hoặc ẩn thông tin cá nhân trong bảng `users` tại MySQL.  
>    - Bản ghi trên Blockchain lúc này trở thành dữ liệu hoàn toàn vô danh, không còn khả năng liên kết ngược lại với cá nhân đó, đảm bảo 100% tính tuân thủ pháp lý."*

---

### CÂU HỎI 9: KHẢ NĂNG NÂNG CẤP SMART CONTRACT (UPGRADEABILITY) KHI TRƯỜNG ĐỔI QUY CHẾ?
**Giảng viên hỏi:**
> *"Giả sử năm học tới, trường thay đổi quy chế: Trễ hạn dưới 24h không phạt 10% nữa mà phạt 20%, hoặc bổ sung thêm quy định cấm mượn thiết bị mới nếu chưa trả máy cũ. Vì Smart Contract là bất biến, làm sao các em cập nhật được logic này mà không làm mất dữ liệu lịch sử mượn trả cũ?"*

**Câu trả lời kỹ thuật chuẩn xác:**
> *"Kính thưa Thầy/Cô, để xử lý bài toán thay đổi quy chế nghiệp vụ, nhóm đề xuất 2 giải pháp kỹ thuật theo lộ trình:  
> 1. **Giải pháp hiện tại (Cấu hình tham số qua Admin Function):**  
>    - Trong hợp đồng, các biến số quy định có thể được thiết kế dưới dạng biến trạng thái có thể cập nhật thông qua hàm có quyền quản trị: ví dụ hàm `setPenaltyRate(uint8 tier1, uint8 tier2) onlyRole(ADMIN_ROLE)`. Quản trị viên có thể đổi tỷ lệ phạt từ 10% sang 20% mà không cần deploy lại hợp đồng.  
> 2. **Giải pháp dài hạn (Mô hình Proxy Contract Pattern - ERC-1967 UUPS):**  
>    - Hệ thống có thể chuyển đổi sang mô hình **Proxy Pattern (Universal Upgradeable Proxy Standard - UUPS)** của OpenZeppelin.  
>    - Trong mô hình này, người dùng và Backend luôn tương tác với một địa chỉ cố định gọi là **Proxy Contract** (nơi lưu trữ toàn bộ dữ liệu trạng thái mượn trả).  
>    - Proxy sẽ ủy quyền lời gọi (`delegatecall`) sang một **Implementation Contract** chứa mã logic xử lý.  
>    - Khi nhà trường ban hành quy chế mới, lập tức deploy một Implementation Contract mới và cập nhật con trỏ địa chỉ trong Proxy. Dữ liệu mượn trả cũ vẫn được giữ nguyên vẹn 100% trong khi logic nghiệp vụ mới lập tức có hiệu lực."*

---

### CÂU HỎI 10: MINH CHỨNG THỰC NGHIỆM VỀ KIỂM THỬ (QA TESTING) VÀ RÀ SOÁT BẢO MẬT?
**Giảng viên hỏi:**
> *"Những lời giải thích vừa rồi là về mặt lý thuyết. Nhóm có số liệu thực nghiệm cụ thể nào chứng minh rằng toàn bộ hệ thống từ Smart Contract đến Backend đã được kiểm thử đầy đủ và không tồn tại các lỗ hổng bảo mật nghiêm trọng không?"*

**Câu trả lời kỹ thuật chuẩn xác:**
> *"Kính thưa Thầy/Cô, nhóm em đã xây dựng một bộ kiểm thử tự động toàn diện và thực thi rà soát an ninh độc lập với kết quả cụ thể như sau:  
> 1. **Ma trận Kiểm thử Tự động (QA Matrix) đạt 100% PASS (92/92 tests):**  
>    - **Tầng Smart Contract (28/28 tests passed):** Chạy trên Hardhat framework kiểm tra toàn diện 100% các ca: Vòng đời chuẩn, phạt trễ hạn 10% và 50%, hỏng hóc/mất mát tịch thu cọc 100%, bảo vệ quyền `AccessControl`, và cơ chế Mutex chống đặt trùng.  
>    - **Tầng Backend REST API (56/56 tests passed):** Chạy trên Pytest kiểm thử toàn bộ 7 cụm router: Mã hóa mật khẩu bcrypt, phát hành token JWT HS256, khóa tài khoản chống brute-force, cơ chế khóa dòng MySQL Pessimistic Lock và tạo hash Keccak256 idempotent.  
>    - **Tầng Tích hợp E2E (8/8 scenarios passed):** Chạy kiểm thử tự động toàn trình bao gồm Happy Path, 4 kịch bản ngoại lệ phạt cọc, và kịch bản sập nguồn tự phục hồi dữ liệu qua Reconciler.  
> 2. **Kết quả Rà soát Bảo mật (Security Audit Script):**  
>    - Script `scripts/audit_security.py` đã quét an toàn toàn bộ 59 file mã nguồn của dự án: Không có private key nào bị hardcode.  
>    - Kiểm thử tấn công dò mật khẩu (Brute-Force): Nhập sai 5 lần liên tiếp lập tức bị khóa tài khoản 15 phút với mã lỗi `HTTP 423 Locked`.  
>    - Kiểm thử phân quyền RBAC: Tài khoản sinh viên cố tình gọi các endpoint quản trị `/audit/logs` hoặc `/admin/users` đều bị từ chối với mã lỗi `HTTP 403 Forbidden`.  
> Toàn bộ kết quả thực nghiệm chi tiết đã được nhóm lưu lại đầy đủ trong tài liệu `docs/QA_SECURITY_REPORT.md` để Hội đồng tiện thẩm định."*

---
*Tài liệu được biên soạn phục vụ công tác bảo vệ đồ án tốt nghiệp - Nhóm tác giả EduVault 2026.*
