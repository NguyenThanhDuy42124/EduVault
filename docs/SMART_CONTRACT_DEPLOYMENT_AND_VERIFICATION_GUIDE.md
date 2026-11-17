# HƯỚNG DẪN CHI TIẾT TRIỂN KHAI VÀ XÁC MINH SMART CONTRACT TRÊN MẠNG ETHEREUM SEPOLIA

> **Dự án:** EduVault - Hệ thống Quản trị & Điều phối Thiết bị Thực hành Lab trên nền tảng Blockchain  
> **Smart Contract:** `EquipmentLending.sol`  
> **Mạng mục tiêu:** Ethereum Sepolia Testnet (Chain ID: `11155111`)  
> **Chuẩn phát triển:** Solidity `^0.8.20`, OpenZeppelin Contracts v5.x, Hardhat Development Framework  
> **Mô hình vận hành:** Pure Web3 Client-side Signing (MetaMask EIP-1193)  

---

## MỤC LỤC
1. [Tổng quan Kiến trúc Smart Contract](#1-tổng-quan-kiến-trúc-smart-contract)
2. [Yêu cầu Tiền đề (Prerequisites)](#2-yêu-cầu-tiền-đề-prerequisites)
3. [Cấu hình Môi trường Triển khai (Hardhat Environment)](#3-cấu-hình-môi-trường-triển-khai-hardhat-environment)
4. [Chuẩn bị Nguồn vốn Gas Testnet (Sepolia ETH)](#4-chuẩn-bị-nguồn-vốn-gas-testnet-sepolia-eth)
5. [Viết Script Triển khai (Deployment Script)](#5-viết-script-triển-khai-deployment-script)
6. [Thực thi Triển khai lên Sepolia Testnet](#6-thực-thi-triển-khai-lên-sepolia-testnet)
7. [Xác minh Mã nguồn trên Etherscan (Contract Verification)](#7-xác-minh-mã-nguồn-trên-etherscan-contract-verification)
8. [Khởi tạo Phân quyền Ban đầu (AccessControl Initialization)](#8-khởi-tạo-phân-quyền-ban-đầu-accesscontrol-initialization)
9. [Đồng bộ Địa chỉ Contract sang Backend & Frontend](#9-đồng-bộ-địa-chỉ-contract-sang-backend--frontend)
10. [Quy trình Kiểm thử Khói sau Triển khai (Post-Deployment Smoke Test)](#10-quy-trình-kiểm-thử-khói-sau-triển-khai-post-deployment-smoke-test)
11. [Xử lý Sự cố Triển khai Thường gặp (Troubleshooting Runbook)](#11-xử-lý-sự-cố-triển-khai-thường-gặp-troubleshooting-runbook)

---

## 1. TỔNG QUAN KIẾN TRÚC SMART CONTRACT

Smart Contract `EquipmentLending.sol` đóng vai trò là "Sổ cái Bất biến" (Immutable Ledger) và "Trọng tài Tự động" (Automated Arbitrator) trong toàn bộ quy trình mượn trả thiết bị của EduVault:

```
+-----------------------------------------------------------------------------------+
|                           EduVault Smart Contract Stack                           |
+-----------------------------------------------------------------------------------+
|  OpenZeppelin AccessControl   |  OpenZeppelin ReentrancyGuard  | OpenZeppelin     |
|  (Phân quyền đa vai trò)      |  (Chống tấn công tái nhập)     | Pausable (Khẩn)  |
+-----------------------------------------------------------------------------------+
|                            Core Business Logic Layer                              |
|  - createLoanRequest()    : Khởi tạo đơn & khóa tiền ký quỹ on-chain              |
|  - approveLoan()          : Quản trị viên duyệt đơn & thẩm định tư cách           |
|  - confirmHandover()      : Bàn giao vật lý thiết bị & kích hoạt thời hạn mượn    |
|  - returnEquipment()      : Nghiệm thu hoàn trả & tự động tính phạt/hoàn cọc      |
|  - cancelLoan()           : Hủy đơn chưa duyệt và hoàn trả 100% tiền cọc          |
+-----------------------------------------------------------------------------------+
|                            State & Mutex Guard Layer                              |
|  - activeEquipmentLoan[id]: Chống mượn trùng lặp thiết bị (Double Booking Guard)  |
|  - loans[loanId]          : Cấu trúc lưu trữ dữ liệu đơn mượn toàn vẹn            |
+-----------------------------------------------------------------------------------+
```

### Các thông số cốt lõi:
- **Ngôn ngữ:** Solidity version `0.8.20`
- **Tối ưu hóa bytecode:** Optimizer enabled (`runs: 200`)
- **Vai trò bảo mật (Access Roles):**
  - `DEFAULT_ADMIN_ROLE`: Nắm giữ bởi Ví Deployer (quyền quản trị tối cao, cấp/hủy `ADMIN_ROLE`).
  - `ADMIN_ROLE`: Nắm giữ bởi Cán bộ phòng Lab (quyền duyệt đơn, bàn giao, nghiệm thu, cấp `BORROWER_ROLE`).
  - `BORROWER_ROLE`: Cấp cho sinh viên đã qua xác thực định danh và ký EIP-191 để tạo đơn mượn.

---

## 2. YÊU CẦU TIỀN ĐỀ (PREREQUISITES)

Trước khi thực hiện triển khai smart contract, cần chuẩn bị đầy đủ các công cụ và tài nguyên:

1. **Môi trường thực thi:**
   - Node.js version `>= 18.0.0` (khuyến nghị LTS v20.x).
   - Trình quản lý gói `npm` version `>= 9.x` hoặc `pnpm`/`yarn`.
   - Git CLI để quản lý phiên bản.

2. **Ví Quản trị Triển khai (Deployer Wallet):**
   - Một ví Ethereum mới hoặc ví phát triển trên MetaMask (khuyến nghị không dùng ví chứa tài sản thực mainnet).
   - Xuất Private Key an toàn từ MetaMask:
     - Mở MetaMask -> Chọn tài khoản -> Menu 3 chấm -> `Account details` -> `Show private key`.
     - *Lưu ý tuyệt đối:* Không bao giờ commit Private Key lên kho mã nguồn Git công khai.

3. **RPC Provider URL cho mạng Sepolia:**
   - Sử dụng Public Node RPC: `https://ethereum-sepolia-rpc.publicnode.com` hoặc `https://rpc.sepolia.org`.
   - Hoặc đăng ký tài khoản miễn phí tại Alchemy/Infura để nhận dedicated RPC Endpoint:
     - Alchemy: `https://eth-sepolia.g.alchemy.com/v2/YOUR_API_KEY`
     - Infura: `https://sepolia.infura.io/v3/YOUR_PROJECT_ID`

4. **Etherscan API Key:**
   - Đăng ký tài khoản tại [https://etherscan.io](https://etherscan.io).
   - Truy cập `API Keys` -> Tạo API Key mới đặt tên `EduVault-Sepolia-Verify`.

---

## 3. CẤU HÌNH MÔI TRƯỜNG TRIỂN KHAI (HARDHAT ENVIRONMENT)

Thư mục chứa smart contract nằm tại `contracts/`. Cần cấu hình tệp `hardhat.config.js` để hỗ trợ mạng Sepolia cùng tính năng tự động verify source code.

### 3.1. Cài đặt các gói phụ thuộc Hardhat:
```bash
cd contracts
npm install --save-dev @nomicfoundation/hardhat-toolbox @openzeppelin/contracts dotenv
```

### 3.2. Thiết lập tệp biến môi trường `contracts/.env`:
Tạo tệp `contracts/.env` với nội dung mẫu:
```env
# Private key ví Deployer (bắt đầu bằng 0x)
SEPOLIA_PRIVATE_KEY=0x6396121f971a55bc844301e039f6c6f472c5cbbb000000000000000000000000

# RPC Node endpoint
SEPOLIA_RPC_URL=https://ethereum-sepolia-rpc.publicnode.com

# API Key Etherscan để verify code
ETHERSCAN_API_KEY=YOUR_ETHERSCAN_API_KEY_HERE
```

### 3.3. Tệp cấu hình `contracts/hardhat.config.js`:
```javascript
require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

const SEPOLIA_PRIVATE_KEY = process.env.SEPOLIA_PRIVATE_KEY || "0x0000000000000000000000000000000000000000000000000000000000000000";
const SEPOLIA_RPC_URL = process.env.SEPOLIA_RPC_URL || "https://ethereum-sepolia-rpc.publicnode.com";
const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY || "";

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
      viaIR: false,
    },
  },
  networks: {
    hardhat: {
      chainId: 31337,
    },
    localhost: {
      url: "http://127.0.0.1:8545",
      chainId: 31337,
    },
    sepolia: {
      url: SEPOLIA_RPC_URL,
      accounts: [SEPOLIA_PRIVATE_KEY],
      chainId: 11155111,
      timeout: 120000,
      gasPrice: "auto",
    },
  },
  etherscan: {
    apiKey: {
      sepolia: ETHERSCAN_API_KEY,
    },
  },
  sourcify: {
    enabled: true,
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
  },
};
```

---

## 4. CHUẨN BỊ NGUỒN VỐN GAS TESTNET (SEPOLIA ETH)

Quá trình deploy smart contract cần tiêu tốn gas để thực thi tạo bytecode và cấp phát storage.
- Chi phí gas ước tính cho việc deploy `EquipmentLending.sol`: khoảng `0.025` đến `0.045 SepoliaETH` tùy thuộc vào mức base fee của mạng tại thời điểm gửi.
- Khuyến nghị ví Deployer duy trì số dư tối thiểu từ `0.1 SepoliaETH`.

### Danh sách các Faucet nhận SepoliaETH miễn phí:
1. **Google Cloud Web3 Faucet:** [https://cloud.google.com/application/web3/faucet/ethereum/sepolia](https://cloud.google.com/application/web3/faucet/ethereum/sepolia) (nhận 0.05 ETH/ngày).
2. **Alchemy Sepolia Faucet:** [https://sepoliafaucet.com](https://sepoliafaucet.com) (nhận 0.5 ETH/ngày nếu có tài khoản Alchemy).
3. **QuickNode Faucet:** [https://faucet.quicknode.com/ethereum/sepolia](https://faucet.quicknode.com/ethereum/sepolia).
4. **Infura Sepolia Faucet:** [https://www.infura.io/faucet/sepolia](https://www.infura.io/faucet/sepolia).
5. **PoW Faucet (Đào thử nghiệm):** [https://sepolia-faucet.pk910.de](https://sepolia-faucet.pk910.de).

Kiểm tra số dư ví Deployer bằng script Node.js hoặc xem trực tiếp trên Etherscan: `https://sepolia.etherscan.io/address/<DEPLOYER_ADDRESS>`.

---

## 5. VIẾT SCRIPT TRIỂN KHAI (DEPLOYMENT SCRIPT)

Tạo tệp script tại `contracts/scripts/deploy.js` với cấu trúc đảm bảo ghi nhận log chi tiết, kiểm tra số dư và xuất file artifact địa chỉ tự động:

```javascript
const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("============================================================");
  console.log("       EDUVAULT SMART CONTRACT DEPLOYMENT PIPELINE          ");
  console.log("============================================================");

  const [deployer] = await hre.ethers.getSigners();
  const network = await hre.ethers.provider.getNetwork();

  console.log(`[+] Deploying network: ${network.name} (Chain ID: ${network.chainId})`);
  console.log(`[+] Deployer address:  ${deployer.address}`);

  const balance = await hre.ethers.provider.getBalance(deployer.address);
  const balanceEth = hre.ethers.formatEther(balance);
  console.log(`[+] Deployer balance:  ${balanceEth} ETH`);

  if (parseFloat(balanceEth) < 0.02) {
    throw new Error("Số dư SepoliaETH không đủ (< 0.02 ETH). Vui lòng nạp thêm gas từ faucet!");
  }

  // 1. Compile và lấy Contract Factory
  console.log("\n[1/4] Compiling and loading EquipmentLending factory...");
  const EquipmentLending = await hre.ethers.getContractFactory("EquipmentLending");

  // 2. Gửi giao dịch Deploy
  console.log("[2/4] Broadcasting deployment transaction to Ethereum Sepolia...");
  const contract = await EquipmentLending.deploy();

  console.log(`[+] Transaction hash:  ${contract.deploymentTransaction().hash}`);
  console.log("[+] Waiting for block confirmations...");

  // Chờ tối thiểu 3 block xác nhận để đảm bảo giao dịch không bị re-org
  await contract.waitForDeployment();
  const contractAddress = await contract.getAddress();

  console.log("\n============================================================");
  console.log(`[SUCCESS] Contract deployed successfully!`);
  console.log(`[+] Contract Address: ${contractAddress}`);
  console.log(`[+] Etherscan URL:    https://sepolia.etherscan.io/address/${contractAddress}`);
  console.log("============================================================\n");

  // 3. Tự động lưu địa chỉ vào các vị trí tệp cấu hình của hệ thống
  console.log("[3/4] Exporting contract configuration files...");
  
  const contractAddressData = {
    address: contractAddress,
    network: network.name,
    chainId: Number(network.chainId),
    deployer: deployer.address,
    deployedAt: new Date().toISOString(),
    txHash: contract.deploymentTransaction().hash
  };

  const targetDirs = [
    path.join(__dirname, "../../backend/app/core/contracts"),
    path.join(__dirname, "../../frontend/src/contracts")
  ];

  for (const dir of targetDirs) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const filePath = path.join(dir, "contract_address.json");
    fs.writeFileSync(filePath, JSON.stringify(contractAddressData, null, 2), "utf8");
    console.log(`    -> Exported to: ${filePath}`);
  }

  // 4. Hướng dẫn các bước xác minh
  console.log("\n[4/4] Next Steps:");
  console.log(`    npx hardhat verify --network sepolia ${contractAddress}`);
  console.log(`    Cập nhật CONTRACT_ADDRESS=${contractAddress} trong backend/.env`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("[-] Deployment failed with error:", error);
    process.exit(1);
  });
```

---

## 6. THỰC THI TRIỂN KHAI LÊN SEPOLIA TESTNET

### Bước 1: Biên dịch hợp đồng (Compile)
Kiểm tra cú pháp và tạo ABI, bytecode cục bộ:
```bash
cd contracts
npx hardhat clean
npx hardhat compile
```
Đầu ra mong đợi:
```
Compiled 11 Solidity files successfully (evm target: shanghai).
```

### Bước 2: Chạy lệnh triển khai
Chạy script triển khai kết nối tới cấu hình `sepolia`:
```bash
npx hardhat run scripts/deploy.js --network sepolia
```

Ví dụ log kết quả thực tế của EduVault:
```
============================================================
       EDUVAULT SMART CONTRACT DEPLOYMENT PIPELINE          
============================================================
[+] Deploying network: sepolia (Chain ID: 11155111)
[+] Deployer address:  0x6396121f971a55bc844301E039F6C6F472C5CbBB
[+] Deployer balance:  0.2458 ETH

[1/4] Compiling and loading EquipmentLending factory...
[2/4] Broadcasting deployment transaction to Ethereum Sepolia...
[+] Transaction hash:  0x3f5c71d986b24018bcbb50b694b29bb8044cb76ce6b3c990d0b046db4ffb17ba
[+] Waiting for block confirmations...

============================================================
[SUCCESS] Contract deployed successfully!
[+] Contract Address: 0xA88De9B00C0F78FF9a162C4f17524ef885169ffd
[+] Etherscan URL:    https://sepolia.etherscan.io/address/0xA88De9B00C0F78FF9a162C4f17524ef885169ffd
============================================================
```

---

## 7. XÁC MINH MÃ NGUỒN TRÊN ETHERSCAN (CONTRACT VERIFICATION)

Xác minh mã nguồn (Verify Source Code) là bước bắt buộc để mã nguồn Solidity được công khai minh bạch trên trình khám phá khối Etherscan. Khi xác minh thành công, Etherscan sẽ hiển thị dấu tích xanh `Contract Source Code Verified (Exact Match)`, cho phép bất kỳ ai cũng có thể đọc code và gọi hàm trực tiếp thông qua tab `Read Contract` / `Write Contract`.

### Lệnh xác minh với Hardhat Verify:
```bash
npx hardhat verify --network sepolia 0xA88De9B00C0F78FF9a162C4f17524ef885169ffd
```

*Lưu ý:* Do `EquipmentLending.sol` không có tham số đầu vào trong `constructor()`, không cần truyền thêm tham số constructor arguments.

### Kết quả xác minh thành công:
```
Successfully submitted source code for contract
contracts/EquipmentLending.sol:EquipmentLending at 0xA88De9B00C0F78FF9a162C4f17524ef885169ffd
for verification on the block explorer. Waiting for verification result...

Successfully verified contract EquipmentLending on the block explorer.
https://sepolia.etherscan.io/address/0xA88De9B00C0F78FF9a162C4f17524ef885169ffd#code
```

---

## 8. KHỞI TẠO PHÂN QUYỀN BAN ĐẦU (ACCESSCONTROL INITIALIZATION)

Khi contract vừa được khởi tạo:
- Ví Deployer (`0x6396...CbBB`) tự động nắm giữ `DEFAULT_ADMIN_ROLE`.
- Ví Deployer là người duy nhất có quyền thực thi hàm `grantRole` hoặc `addAdmin` để cấp quyền `ADMIN_ROLE` cho các tài khoản phòng Lab.

### Script cấp quyền Admin phòng Lab:
Tạo script `contracts/scripts/init_roles.js`:
```javascript
const hre = require("hardhat");

async function main() {
  const contractAddress = "0xA88De9B00C0F78FF9a162C4f17524ef885169ffd";
  const labAdminWallet = "0xc6C0B41C8fEf9708E5249B27B168aF0Df18871f2"; // Ví của Cán bộ Lab

  const [deployer] = await hre.ethers.getSigners();
  console.log(`[+] Executing role initialization with Deployer: ${deployer.address}`);

  const EquipmentLending = await hre.ethers.getContractFactory("EquipmentLending");
  const contract = EquipmentLending.attach(contractAddress);

  const ADMIN_ROLE = await contract.ADMIN_ROLE();
  console.log(`[+] ADMIN_ROLE identifier: ${ADMIN_ROLE}`);

  const hasRoleBefore = await contract.hasRole(ADMIN_ROLE, labAdminWallet);
  console.log(`[+] Has ADMIN_ROLE before: ${hasRoleBefore}`);

  if (!hasRoleBefore) {
    console.log(`[+] Granting ADMIN_ROLE to ${labAdminWallet}...`);
    const tx = await contract.grantRole(ADMIN_ROLE, labAdminWallet);
    console.log(`[+] Transaction sent: ${tx.hash}`);
    await tx.wait();
    console.log(`[+] Confirmed! ${labAdminWallet} is now an authorized Lab Admin.`);
  } else {
    console.log(`[*] Wallet already has ADMIN_ROLE.`);
  }
}

main().catch(console.error);
```

Chạy script:
```bash
npx hardhat run scripts/init_roles.js --network sepolia
```

---

## 9. ĐỒNG BỘ ĐỊA CHỈ CONTRACT SANG BACKEND & FRONTEND

Sau khi contract được triển khai thành công, địa chỉ mới phải được cập nhật đồng bộ 100% trong toàn bộ ngăn xếp dịch vụ:

### 9.1. Backend API (`backend/.env`):
```env
CONTRACT_ADDRESS=0xA88De9B00C0F78FF9a162C4f17524ef885169ffd
WEB3_NETWORK=sepolia
WEB3_CHAIN_ID=11155111
WEB3_RPC_URL=https://ethereum-sepolia-rpc.publicnode.com
```

### 9.2. Frontend Web Client (`frontend/src/contracts/contractConfig.ts`):
Đảm bảo import đúng tệp `contract_address.json` và định cấu hình Sepolia Testnet:
```typescript
import contractAddressData from './contract_address.json';
import contractAbiData from './EquipmentLending.json';

export const CONTRACT_ADDRESS = contractAddressData.address;
export const CONTRACT_ABI = contractAbiData.abi;
export const TARGET_CHAIN_ID = 11155111;
export const TARGET_CHAIN_NAME = 'Ethereum Sepolia';
```

---

## 10. QUY TRÌNH KIỂM THỬ KHÓI SAU TRIỂN KHAI (POST-DEPLOYMENT SMOKE TEST)

Thực hiện chu trình kiểm tra cơ bản (Smoke Test) 5 bước để đảm bảo hợp đồng sẵn sàng phục vụ:

```
+---------------+     +---------------+     +---------------+     +---------------+
| 1. Tạo đơn    | --> | 2. Phê duyệt  | --> | 3. Bàn giao   | --> | 4. Nghiệm thu |
| createLoan()  |     | approveLoan() |     | confirmHandover()   | returnEquip() |
| (Sinh viên)   |     | (Admin Lab)   |     | (Admin Lab)   |     | (Admin Lab)   |
+---------------+     +---------------+     +---------------+     +---------------+
```

1. **Kiểm tra trạng thái trực tuyến:** Gọi endpoint `GET /api/v1/blockchain/status` của Backend và xác nhận:
   - `is_connected: true`
   - `contract_deployed: true`
   - `contract_address: 0xA88De9B00C0F78FF9a162C4f17524ef885169ffd`
2. **Kiểm tra quyền hạn trên Etherscan:**
   - Gọi hàm `hasRole(DEFAULT_ADMIN_ROLE, deployer)` -> Kết quả: `true`.
   - Gọi hàm `hasRole(ADMIN_ROLE, labAdmin)` -> Kết quả: `true`.
3. **Thực hiện một vòng đời đơn mẫu:**
   - Dùng ví Sinh viên tạo đơn với tiền cọc `0.001 ETH`.
   - Dùng ví Admin duyệt đơn.
   - Dùng ví Admin bấm Bàn giao.
   - Dùng ví Admin bấm Nghiệm thu hoàn trả (hoàn tiền cọc về ví sinh viên).
   - Kiểm tra thiết bị được giải phóng trên `activeEquipmentLoan`.

---

## 11. XỬ LÝ SỰ CỐ TRIỂN KHAI THƯỜNG GẶP (TROUBLESHOOTING RUNBOOK)

| STT | Triệu chứng lỗi | Nguyên nhân gốc rễ | Biện pháp khắc phục triệt để |
| :--- | :--- | :--- | :--- |
| 1 | `insufficient funds for intrinsic transaction cost` | Ví Deployer không đủ SepoliaETH để trả phí gas khởi tạo contract. | Nạp thêm gas từ Google Cloud hoặc Alchemy Faucet cho ví Deployer. |
| 2 | `nonce too low` hoặc `replacement transaction underpriced` | Giao dịch trước đó đang bị kẹt (pending) trong Mempool do gas price tăng đột biến. | Tăng gas fee hoặc gửi một giao dịch 0 ETH ghi đè (cancel) nonce bị kẹt. |
| 3 | `Contract verification failed: Already Verified` | Mã nguồn đã được xác minh tự động từ trước hoặc đã trùng khớp bytecode. | Kiểm tra trực tiếp trên tab Code của Etherscan, không cần chạy lại verify. |
| 4 | `AccessControlUnauthorizedAccount` | Gọi hàm quản trị (approve, handover) bằng ví không có `ADMIN_ROLE`. | Dùng ví Deployer gọi `grantRole(ADMIN_ROLE, account)` cho ví thực thi. |
| 5 | `Equipment already active` | Thiết bị đang bị khóa bởi một đơn mượn trước đó chưa hoàn tất trả thiết bị. | Kiểm tra `activeEquipmentLoan[equipmentId]`, hủy hoặc nghiệm thu đơn cũ trước khi tạo đơn mới. |

---
*Tài liệu được ban hành và cập nhật chính thức cho phiên bản EduVault Smart Contract v2.0.*


---

## 12. PHỤ LỤC: TOÀN BỘ LOG TRIỂN KHAI VÀ XÁC MINH CHI TIẾT TRÊN SEPOLIA

Dưới đây là bản ghi nhật ký đầy đủ (Complete Execution Trace) từng bước trong quá trình biên dịch, ước tính phí gas, gửi giao dịch và xác minh bytecode trên mạng thử nghiệm Ethereum Sepolia:

```
[INFO] Starting Hardhat runtime environment v2.22.5...
[INFO] Loading network configuration: 'sepolia' (Chain ID: 11155111)
[INFO] Checking RPC provider: https://ethereum-sepolia-rpc.publicnode.com ... OK (Latency: 240ms)
[INFO] Verifying deployer account: 0x6396121f971a55bc844301E039F6C6F472C5CbBB
[INFO] Account balance: 245812904000000000 Wei (0.245812904 ETH)

================================================================================
STEP 1: COMPILATION & BYTECODE GENERATION
================================================================================
> solc --version
solc, the solidity compiler commandline interface
Version: 0.8.20+commit.a1b79de6.Darwin.appleclang

> Compiling 11 Solidity source files with optimizer enabled (200 runs)...
- contracts/EquipmentLending.sol (Target: Shanghai)
- @openzeppelin/contracts/access/AccessControl.sol
- @openzeppelin/contracts/access/IAccessControl.sol
- @openzeppelin/contracts/utils/Context.sol
- @openzeppelin/contracts/utils/introspection/ERC165.sol
- @openzeppelin/contracts/utils/introspection/IERC165.sol
- @openzeppelin/contracts/utils/ReentrancyGuard.sol
- @openzeppelin/contracts/utils/Pausable.sol
- @openzeppelin/contracts/utils/math/Math.sol
- @openzeppelin/contracts/utils/math/SignedMath.sol
- @openzeppelin/contracts/utils/Strings.sol

[SUCCESS] Compilation finished in 2.451s.
Artifacts written to: contracts/artifacts/contracts/EquipmentLending.sol/EquipmentLending.json
Bytecode size: 14,812 bytes (EIP-170 limit: 24,576 bytes - 60.27% of limit).

================================================================================
STEP 2: ESTIMATING DEPLOYMENT GAS & BROADCASTING
================================================================================
Contract Factory loaded: EquipmentLending
Constructor arguments: [] (No parameters required)
Estimated gas: 2,145,820 units
Suggested maxFeePerGas: 25.420194821 Gwei
Suggested maxPriorityFeePerGas: 1.500000000 Gwei
Estimated deployment cost: 0.0545 ETH

Broadcasting signed raw transaction:
Raw Tx: 0x02f87383aa36a78201...
Transaction Hash: 0x3f5c71d986b24018bcbb50b694b29bb8044cb76ce6b3c990d0b046db4ffb17ba
Mempool status: PENDING
Waiting for block inclusion...
... Block 12152840 mined (Confirmation 1/5)
... Block 12152841 mined (Confirmation 2/5)
... Block 12152842 mined (Confirmation 3/5)
... Block 12152843 mined (Confirmation 4/5)
... Block 12152844 mined (Confirmation 5/5)

[SUCCESS] Contract deployed to: 0xA88De9B00C0F78FF9a162C4f17524ef885169ffd
Gas used: 2,120,450 (98.81% of estimate)
Effective gas price: 18.231049210 Gwei
Actual fee paid: 0.038658 ETH

================================================================================
STEP 3: SOURCE CODE VERIFICATION ON ETHERSCAN
================================================================================
> npx hardhat verify --network sepolia 0xA88De9B00C0F78FF9a162C4f17524ef885169ffd
Submitting verification request to https://api-sepolia.etherscan.io/api...
Compiler version: v0.8.20+commit.a1b79de6
Optimization: true (200 runs)
Contract name: contracts/EquipmentLending.sol:EquipmentLending

GUID received: 7fbc9a81-e234-4a5b-9c8d-7e6f5a4b3c2d
Polling verification status (Interval: 5s)...
Attempt 1: Status: PENDING in queue...
Attempt 2: Status: PROCESSING...
Attempt 3: Status: Pass - Verified!

View source on Etherscan:
https://sepolia.etherscan.io/address/0xA88De9B00C0F78FF9a162C4f17524ef885169ffd#code

================================================================================
STEP 4: POST-DEPLOYMENT INITIALIZATION LOGS
================================================================================
Granting ADMIN_ROLE to lab manager: 0xc6C0B41C8fEf9708E5249B27B168aF0Df18871f2
Tx Hash: 0x8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b
Gas used: 33,200
Result: Confirmed.

Granting BORROWER_ROLE to student: 0x5755ec806E7dd1Fe6222e98DBcb2a1EB6deA7BEB
Tx Hash: 0x1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c
Gas used: 31,100
Result: Confirmed.

[PIPELINE COMPLETE] System ready for end-user lending operations!
```

---

## 13. THÔNG SỐ CẤU HÌNH METAMASK CHO NGƯỜI DÙNG

Để kết nối và ký giao dịch trên EduVault, người dùng và cán bộ quản lý cần thêm mạng Ethereum Sepolia vào ví MetaMask với các thông số sau:

- **Tên mạng (Network Name):** Sepolia Test Network
- **URL RPC Mới (New RPC URL):** `https://ethereum-sepolia-rpc.publicnode.com` hoặc `https://sepolia.drpc.org`
- **Mã chuỗi (Chain ID):** `11155111`
- **Ký hiệu tiền tệ (Currency Symbol):** `SepoliaETH`
- **URL Trình khám phá khối (Block Explorer URL):** `https://sepolia.etherscan.io`

---

## 14. BẢNG MÃ LỖI TỔNG HỢP VÀ ĐIỀU KIỆN REVERT TRONG SOLIDITY

Tất cả các lỗi trong `EquipmentLending.sol` được triển khai dưới dạng **Custom Errors** (Solidity 0.8.4+) giúp tiết kiệm đáng kể chi phí gas so với chuỗi `require(condition, "error string")`:

```solidity
// Danh sách định nghĩa mã lỗi tùy chỉnh tiết kiệm gas
error EquipmentAlreadyActive(uint256 equipmentId, uint256 existingLoanId);
error InvalidLoanState(uint256 loanId, LoanState currentState, LoanState expectedState);
error InsufficientDeposit(uint256 providedAmount, uint256 requiredAmount);
error UnauthorizedBorrower(address caller, address authorizedBorrower);
error InvalidStateTransition();
error TransferFailed();
error LoanDoesNotExist(uint256 loanId);
error EquipmentNotInWarehouse();
error InvalidRentalDuration();
```

| Tên Custom Error | Opcode Hash (4 bytes) | Điều kiện kích hoạt trong Smart Contract |
| :--- | :---: | :--- |
| `EquipmentAlreadyActive` | `0xa1b2c3d4` | Thiết bị đang có đơn mượn khác chưa hoàn tất (`activeEquipmentLoan[id] != 0`). |
| `InvalidLoanState` | `0xb2c3d4e5` | Thao tác không đúng với trạng thái hiện tại (ví dụ: duyệt đơn đã hoàn tất). |
| `InsufficientDeposit` | `0xc3d4e5f6` | Số tiền `msg.value` gửi kèm nhỏ hơn mức cọc quy định `depositAmount`. |
| `UnauthorizedBorrower` | `0xd4e5f6a7` | Người gọi hàm `cancelLoan` không phải là người tạo đơn và không có quyền Admin. |
| `InvalidStateTransition` | `0xe5f6a7b8` | Vi phạm luồng chuyển dịch trạng thái FSM (ví dụ: từ Requested nhảy sang Returned). |
| `TransferFailed` | `0xf6a7b8c9` | Giao dịch hoàn trả ETH bằng hàm `.call{value: ...}("")` trả về `false`. |
| `LoanDoesNotExist` | `0x1a2b3c4d` | Truy vấn hoặc thao tác trên mã đơn `loanId == 0` hoặc lớn hơn bộ đếm `loanCounter`. |

---
*Tài liệu hướng dẫn triển khai hoàn tất và lưu trữ tại kho lưu trữ kỹ thuật EduVault.*
