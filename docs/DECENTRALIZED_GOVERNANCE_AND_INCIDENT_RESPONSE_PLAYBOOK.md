# SỔ TAY QUẢN TRỊ PHI TẬP TRUNG VÀ QUY TRÌNH ỨNG PHÓ SỰ CỐ KHẨN CẤP (DECENTRALIZED GOVERNANCE & INCIDENT RESPONSE PLAYBOOK)

> **Dự án:** EduVault Autonomous Protocol  
> **Tài liệu:** Incident Response SOP, Disaster Recovery & Multi-Sig Governance Transition  
> **Smart Contract:** `0xA88De9B00C0F78FF9a162C4f17524ef885169ffd`  
> **Cấp độ an ninh:** High Availability / Zero Financial Loss Guarantee  

---

## MỤC LỤC
1. [Khung Phân loại Cấp độ Sự cố (Incident Severity Classification Framework)](#1-khung-phân-loại-cấp-độ-sự-cố)
2. [Quy trình Dừng Khẩn cấp Hệ thống (Emergency Circuit Breaker Procedure)](#2-quy-trình-dừng-khẩn-cấp-hệ-thống)
3. [Kịch bản Ứng phó Khi Lộ Khóa Bí mật Admin (Compromised Admin Key Playbook)](#3-kịch-bản-ứng-phó-khi-lộ-khóa-bí-mật-admin)
4. [Kịch bản Ứng phó Sự cố Mạng Ethereum Sepolia (Network Congestion & Reorg)](#4-kịch-bản-ứng-phó-sự-cố-mạng-ethereum-sepolia)
5. [Quy trình Chuyển giao Quyền Quản trị sang Gnosis Safe Multi-Sig](#5-quy-trình-chuyển-giao-quyền-quản-trị-sang-gnosis-safe-multi-sig)
6. [Kế hoạch Khôi phục Sau Thảm họa Dữ liệu (Disaster Recovery Plan - DRP)](#6-kế-hoạch-khôi-phục-sau-thảm-họa-dữ-liệu)
7. [Cam kết Chất lượng Dịch vụ (Service Level Agreement - SLA)](#7-cam-kết-chất-lượng-dịch-vụ)

---

## 1. KHUNG PHÂN LOẠI CẤP ĐỘ SỰ CỐ (INCIDENT SEVERITY CLASSIFICATION FRAMEWORK)

Mọi biến cố kỹ thuật phát sinh trong quá trình vận hành EduVault được phân thành 4 cấp độ nghiêm ngặt:

| Cấp độ | Tên mức độ | Định nghĩa sự cố | Thời gian phản hồi tối đa (MTTA) | Thời gian khắc phục tối đa (MTTR) |
| :---: | :--- | :--- | :---: | :---: |
| **SEV-1** | **Nguy cấp (Critical)** | Phát hiện lỗ hổng Smart Contract có nguy cơ làm thất thoát tiền cọc; Private Key Deployer bị lộ; Smart Contract bị tấn công Reentrancy. | **< 15 phút** | **< 1 giờ** |
| **SEV-2** | **Nghiêm trọng (Major)** | Public RPC Node Sepolia mất kết nối hoàn toàn; Backend API bị sập không thể đồng bộ trạng thái; Quản trị viên không thể duyệt đơn. | **< 30 phút** | **< 4 giờ** |
| **SEV-3** | **Trung bình (Moderate)** | Lỗi giao diện Frontend hiển thị sai số dư; Chữ ký EIP-191 bị lỗi xác thực trên một số phiên bản ví; Độ trễ đọc node > 5 block. | **< 2 giờ** | **< 12 giờ** |
| **SEV-4** | **Nhẹ (Minor)** | Sai lệch chính tả tài liệu hướng dẫn; Biểu đồ kiểm toán tải chậm; Lỗi hiển thị ảnh đại diện thiết bị. | **< 24 giờ** | **< 48 giờ** |

---

## 2. QUY TRÌNH DỪNG KHẨN CẤP HỆ THỐNG (EMERGENCY CIRCUIT BREAKER PROCEDURE)

Khi kích hoạt sự cố **SEV-1**, Đội phản ứng nhanh (Emergency Response Team) có thẩm quyền lập tức kích hoạt cơ chế `Pausable` trên Smart Contract để bảo toàn tài sản người dùng.

### Bước 1: Gửi giao dịch kích hoạt dừng khẩn cấp
Sử dụng script Hardhat với khóa của Deployer:
```bash
npx hardhat run scripts/emergency_pause.js --network sepolia
```
Nội dung script `emergency_pause.js`:
```javascript
const hre = require("hardhat");

async function main() {
  const contractAddress = "0xA88De9B00C0F78FF9a162C4f17524ef885169ffd";
  const [deployer] = await hre.ethers.getSigners();
  console.log(`[ALERT] Executing EMERGENCY PAUSE with account: ${deployer.address}`);

  const contract = await hre.ethers.getContractAt("EquipmentLending", contractAddress, deployer);
  const tx = await contract.pause({ gasPrice: ethers.parseUnits("50", "gwei") });
  console.log(`[+] Emergency tx sent: ${tx.hash}`);
  await tx.wait(1);
  console.log("[LOCKED] Smart Contract has been successfully PAUSED!");
}

main().catch(console.error);
```

### Bước 2: Hiệu ứng đóng băng tức thì
- Toàn bộ các hàm `createLoanRequest`, `approveLoan`, `confirmHandover`, `returnEquipment`, `cancelLoan` bị chặn đứng bằng modifier `whenNotPaused`.
- Kẻ tấn công không thể tiếp tục gửi bất kỳ giao dịch rút tiền nào.
- Toàn bộ số dư ETH ký quỹ được giữ nguyên vẹn trong hợp đồng.

---

## 3. KỊCH BẢN ỨNG PHÓ KHI LỘ KHÓA BÍ MẬT ADMIN (COMPROMISED ADMIN KEY PLAYBOOK)

Trong trường hợp một cán bộ quản lý phòng Lab nghi ngờ máy tính cá nhân bị dính mã độc hoặc Private Key ví MetaMask bị xâm phạm:

```
[Phát hiện nghi vấn lộ Key]
            |
            v
[1. Báo động khẩn cấp tới Deployer]
            |
            v
[2. Deployer gọi hàm revokeRole(ADMIN_ROLE, compromisedWallet)]
            |
            v
[3. Quyền Admin của ví bị hủy bỏ ngay trong block kế tiếp]
            |
            v
[4. Kẻ tấn công cầm Private Key không còn bất kỳ quyền hạn nào trên Smart Contract]
            |
            v
[5. Tạo ví MetaMask mới cho Cán bộ Lab và cấp lại quyền]
```

### Script thu hồi quyền Admin tức thì:
```javascript
const tx = await contract.connect(deployer).revokeRole(ADMIN_ROLE, compromisedWalletAddress);
await tx.wait();
```

---

## 4. KỊCH BẢN ỨNG PHÓ SỰ CỐ MẠNG ETHEREUM SEPOLIA (NETWORK CONGESTION & REORG)

Trong trường hợp mạng thử nghiệm Sepolia bị tắc nghẽn gas hoặc RPC công cộng `ethereum-sepolia-rpc.publicnode.com` bị quá tải:

### 4.1. Chuyển đổi dự phòng RPC Node (Failover RPC Strategy):
Hệ thống Backend FastAPI tự động chuyển đổi qua danh sách 3 RPC dự phòng theo thứ tự ưu tiên:
1. Primary: `https://ethereum-sepolia-rpc.publicnode.com`
2. Secondary: `https://rpc.sepolia.org`
3. Tertiary: `https://sepolia.drpc.org`

### 4.2. Xử lý phân nhánh chuỗi (Block Reorganization Handling):
Để phòng ngừa hiện tượng đảo ngược khối (Deep Reorg), Backend không bao giờ đánh dấu giao dịch là `FINALIZED` ở block 1, mà thực thi cơ chế chờ tối thiểu **3 block confirmations** trước khi ghi nhận hoàn tất vào database.

---

## 5. QUY TRÌNH CHUYỂN GIAO QUYỀN QUẢN TRỊ SANG GNOSIS SAFE MULTI-SIG

Để loại bỏ hoàn toàn điểm nghẽn "Khóa đơn lẻ" (Single Point of Failure), quy trình chuyển giao quyền sang ví đa chữ ký Safe (Gnosis Safe) được quy định như sau:

1. **Khởi tạo ví Safe 2-of-3 trên Sepolia:**
   - Người ký 1: Đại diện Ban Giám Hiệu (`0x111...`)
   - Người ký 2: Trưởng Phòng Quản Trị Thiết Bị (`0x222...`)
   - Người ký 3: Trưởng Khoa Công Nghệ Thông Tin (`0x333...`)
2. **Chuyển giao quyền sở hữu tối cao:**
   - Deployer gọi `grantRole(DEFAULT_ADMIN_ROLE, safeAddress)`.
   - Safe xác nhận nhận quyền.
   - Deployer gọi `renounceRole(DEFAULT_ADMIN_ROLE, deployer.address)`.
3. **Kết quả:** Mọi quyết định thêm bớt Admin hay tạm dừng hợp đồng đều bắt buộc phải có sự đồng thuận của tối thiểu 2 trong 3 thành viên Ban lãnh đạo.

---

## 6. KẾ HOẠCH KHÔI PHỤC SAU THẢM HỌA DỮ LIỆU (DISASTER RECOVERY PLAN - DRP)

Trong kịch bản xấu nhất máy chủ vật lý chứa MySQL bị hư hại phần cứng hoàn toàn:

```
[Máy chủ MySQL bị phá hủy]
            |
            v
[1. Khởi tạo Database MySQL mới từ file DDL rỗng]
            |
            v
[2. Kích hoạt dịch vụ Blockchain Re-Index Service của EduVault]
            |
            v
[3. Quét toàn bộ Event Logs trên Sepolia từ Block #12152840 đến nay:
    - Quét sự kiện RoleGranted -> Tái tạo danh sách Admin & Borrower
    - Quét sự kiện LoanRequested -> Tái tạo danh sách Đơn mượn
    - Quét sự kiện LoanApproved / HandedOver / Returned -> Tái tạo trạng thái]
            |
            v
[4. Cơ sở dữ liệu MySQL được phục hồi nguyên vẹn 100% từ Blockchain!]
```

Đây chính là sức mạnh tối thượng của kiến trúc Web3: **Dữ liệu trên chuỗi khối là bản sao lưu bất tử (Immortal Backup).**

---

## 7. CAM KẾT CHẤT LƯỢNG DỊCH VỤ (SERVICE LEVEL AGREEMENT - SLA)

Hệ thống EduVault cam kết các chỉ số hiệu năng vận hành:
- **Độ sẵn sàng hệ thống (System Uptime):** $\ge 99.9\%$ thời gian vận hành trong năm học.
- **Tính toàn vẹn quỹ ký quỹ (Escrow Integrity):** $100.000\%$ (Sai lệch tài chính bằng $0$).
- **Thời gian xử lý hoàn cọc (Refund Latency):** $\le 15 \text{ giây}$ tính từ thời điểm cán bộ ký nghiệm thu.
- **Tốc độ tra cứu thông tin thiết bị:** $\le 150\text{ms}$ cho mỗi truy vấn tìm kiếm.

---
*Sổ tay quản trị và ứng phó sự cố khẩn cấp đã được ban hành chính thức.*
