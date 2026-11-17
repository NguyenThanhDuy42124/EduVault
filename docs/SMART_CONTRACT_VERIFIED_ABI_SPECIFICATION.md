# ĐẶC TẢ GIAO DIỆN NHỊ PHÂN ỨNG DỤNG SMART CONTRACT (APPLICATION BINARY INTERFACE - ABI SPECIFICATION)

> **Hợp đồng thông minh:** `EquipmentLending.sol`  
> **Địa chỉ triển khai (Ethereum Sepolia):** `0xA88De9B00C0F78FF9a162C4f17524ef885169ffd`  
> **Phiên bản ABI:** v2.5.0 Full Interface Specification  
> **Tương thích:** Ethers.js v6, Web3.py v6, Viem, Wagmi, Hardhat  

---

## MỤC LỤC
1. [Tổng quan về Giao diện ABI trong EVM](#1-tổng-quan-về-giao-diện-abi-trong-evm)
2. [Giao diện Đọc hiểu Dành cho Con người (Human-Readable ABI)](#2-giao-diện-đọc-hiểu-dành-cho-con-người)
3. [Đặc tả Chi tiết Danh mục Hàm Đọc (View & Pure Functions)](#3-đặc-tả-chi-tiết-danh-mục-hàm-đọc)
4. [Đặc tả Chi tiết Danh mục Hàm Ghi Trạng thái (State-Changing Functions)](#4-đặc-tả-chi-tiết-danh-mục-hàm-ghi-trạng-thái)
5. [Đặc tả Toàn bộ Cấu trúc Sự kiện (Events ABI)](#5-đặc-tả-toàn-bộ-cấu-trúc-sự-kiện)
6. [Đặc tả Danh mục Mã Lỗi Tùy chỉnh (Custom Errors ABI)](#6-đặc-tả-danh-mục-mã-lỗi-tùy-chỉnh)
7. [Tệp JSON ABI Hoàn chỉnh (Complete JSON ABI Artifact)](#7-tệp-json-abi-hoàn-chỉnh)

---

## 1. TỔNG QUAN VỀ GIAO DIỆN ABI TRONG EVM

Giao diện Nhị phân Ứng dụng (Application Binary Interface - ABI) là cầu nối chuẩn hóa giữa thế giới mã máy cấp thấp của Máy ảo Ethereum (EVM Bytecode) và các ngôn ngữ lập trình bậc cao ở tầng ứng dụng (JavaScript, TypeScript, Python).

Mỗi hàm trong ABI được định danh bởi một đối tượng JSON gồm:
- `name`: Tên định danh của hàm.
- `type`: `function`, `constructor`, `event`, hoặc `error`.
- `stateMutability`: `view` (chỉ đọc storage), `pure` (không đọc/ghi storage), `nonpayable` (thay đổi trạng thái nhưng không nhận ETH), hoặc `payable` (nhận kèm native ETH).
- `inputs`: Mảng mô tả kiểu dữ liệu và tên của các tham số đầu vào.
- `outputs`: Mảng mô tả kiểu dữ liệu trả về.

---

## 2. GIAO DIỆN ĐỌC HIỂU DÀNH CHO CON NGƯỜI (HUMAN-READABLE ABI)

Định dạng Human-Readable ABI do Ethers.js tiên phong cho phép định nghĩa giao diện tương tác ngắn gọn, dễ kiểm tra đối chiếu:

```solidity
// Các hàm quản trị vai trò AccessControl
function ADMIN_ROLE() view returns (bytes32)
function BORROWER_ROLE() view returns (bytes32)
function DEFAULT_ADMIN_ROLE() view returns (bytes32)
function getRoleAdmin(bytes32 role) view returns (bytes32)
function grantRole(bytes32 role, address account)
function hasRole(bytes32 role, address account) view returns (bool)
function renounceRole(bytes32 role, address callerConfirmation)
function revokeRole(bytes32 role, address account)
function supportsInterface(bytes4 interfaceId) view returns (bool)

// Các hàm nghiệp vụ mượn trả thiết bị EduVault
function activeEquipmentLoan(uint256 equipmentId) view returns (uint256)
function approveLoan(uint256 loanId)
function cancelLoan(uint256 loanId)
function confirmHandover(uint256 loanId)
function createLoanRequest(uint256 equipmentId, uint256 durationSeconds, string purposeNote) payable returns (uint256)
function loanCounter() view returns (uint256)
function loans(uint256 loanId) view returns (uint256 loanId, uint256 equipmentId, address borrower, uint256 depositAmount, uint256 startTime, uint256 dueTime, uint256 returnTime, uint8 state, uint8 condition, string purposeNote)
function returnEquipment(uint256 loanId, uint8 condition)

// Các hàm dừng khẩn cấp Pausable
function pause()
function paused() view returns (bool)
function unpause()

// Định nghĩa sự kiện (Events)
event LoanRequested(uint256 indexed loanId, uint256 indexed equipmentId, address indexed borrower, uint256 deposit, uint256 dueTime)
event LoanApproved(uint256 indexed loanId, address indexed admin)
event LoanHandedOver(uint256 indexed loanId, uint256 startTime, uint256 dueTime)
event EquipmentReturned(uint256 indexed loanId, uint256 returnTime, uint8 condition, uint256 penalty, uint256 refund)
event LoanCancelled(uint256 indexed loanId, address indexed cancelledBy, uint256 refund)
event Paused(address account)
event Unpaused(address account)
event RoleGranted(bytes32 indexed role, address indexed account, address indexed sender)
event RoleRevoked(bytes32 indexed role, address indexed account, address indexed sender)

// Định nghĩa mã lỗi tùy chỉnh (Custom Errors)
error AccessControlBadConfirmation()
error AccessControlUnauthorizedAccount(address account, bytes32 neededRole)
error EnforcedPause()
error ExpectedPause()
error ReentrancyGuardReentrantCall()
error EquipmentAlreadyActive(uint256 equipmentId, uint256 currentLoanId)
error InvalidStateTransition()
error InsufficientDeposit(uint256 sent, uint256 required)
error UnauthorizedCaller()
error TransferFailed()
error InvalidDuration()
```

---

## 3. ĐẶC TẢ CHI TIẾT DANH MỤC HÀM ĐỌC (VIEW & PURE FUNCTIONS)

### 3.1. `activeEquipmentLoan(uint256)`
- **Loại:** `view`
- **Mục đích:** Tra cứu xem một thiết bị vật lý có đang bị khóa bởi đơn mượn nào không.
- **Tham số đầu vào:**
  - `equipmentId` (`uint256`): Mã định danh thiết bị vật lý trong kho.
- **Giá trị trả về:**
  - `loanId` (`uint256`): Mã đơn mượn đang nắm giữ thiết bị (Trả về `0` nếu thiết bị đang sẵn sàng trong kho).

### 3.2. `loans(uint256)`
- **Loại:** `view`
- **Mục đích:** Đọc toàn bộ thông số chi tiết của một hồ sơ đơn mượn trực tiếp từ storage.
- **Tham số đầu vào:**
  - `loanId` (`uint256`): Mã định danh đơn mượn.
- **Giá trị trả về:**
  - `loanId`: uint256
  - `equipmentId`: uint256
  - `borrower`: address
  - `depositAmount`: uint256 (Wei)
  - `startTime`: uint256 (Unix timestamp)
  - `dueTime`: uint256 (Unix timestamp)
  - `returnTime`: uint256 (Unix timestamp)
  - `state`: uint8 (0: Requested, 1: Approved, 2: HandedOver, 3: Returned, 4: Cancelled)
  - `condition`: uint8 (0: GOOD, 1: MINOR_DAMAGE, 2: MAJOR_DAMAGE, 3: LOST)
  - `purposeNote`: string

---

## 4. ĐẶC TẢ CHI TIẾT DANH MỤC HÀM GHI TRẠNG THÁI (STATE-CHANGING FUNCTIONS)

### 4.1. `createLoanRequest(uint256,uint256,string)`
- **Loại:** `payable`
- **Quyền gọi:** Bắt buộc có `BORROWER_ROLE`, hợp đồng chưa bị `paused`.
- **Tham số:**
  - `equipmentId` (`uint256`): Mã thiết bị mượn.
  - `durationSeconds` (`uint256`): Thời gian mượn (giây).
  - `purposeNote` (`string`): Ghi chú lý do mượn.
- **Giá trị gửi kèm:** `msg.value` phải lớn hơn 0 và đúng số tiền ký quỹ.

### 4.2. `approveLoan(uint256)`
- **Loại:** `nonpayable`
- **Quyền gọi:** Bắt buộc có `ADMIN_ROLE`.
- **Tham số:** `loanId` (`uint256`).

### 4.3. `confirmHandover(uint256)`
- **Loại:** `nonpayable`
- **Quyền gọi:** Bắt buộc có `ADMIN_ROLE`.
- **Tham số:** `loanId` (`uint256`).

### 4.4. `returnEquipment(uint256,uint8)`
- **Loại:** `nonpayable`
- **Quyền gọi:** Bắt buộc có `ADMIN_ROLE`.
- **Tham số:**
  - `loanId` (`uint256`): Mã đơn.
  - `condition` (`uint8`): Đánh giá tình trạng (0-3).

---

## 5. TỆP JSON ABI HOÀN CHỈNH (COMPLETE JSON ABI ARTIFACT)

```json
[
  {
    "inputs": [],
    "stateMutability": "nonpayable",
    "type": "constructor"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "equipmentId",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "currentLoanId",
        "type": "uint256"
      }
    ],
    "name": "EquipmentAlreadyActive",
    "type": "error"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "sent",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "required",
        "type": "uint256"
      }
    ],
    "name": "InsufficientDeposit",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "InvalidDuration",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "InvalidStateTransition",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "TransferFailed",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "UnauthorizedCaller",
    "type": "error"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "uint256",
        "name": "loanId",
        "type": "uint256"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "admin",
        "type": "address"
      }
    ],
    "name": "LoanApproved",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "uint256",
        "name": "loanId",
        "type": "uint256"
      },
      {
        "indexed": true,
        "internalType": "uint256",
        "name": "equipmentId",
        "type": "uint256"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "borrower",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "deposit",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "dueTime",
        "type": "uint256"
      }
    ],
    "name": "LoanRequested",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "uint256",
        "name": "loanId",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "startTime",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "dueTime",
        "type": "uint256"
      }
    ],
    "name": "LoanHandedOver",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "uint256",
        "name": "loanId",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "returnTime",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "enum EquipmentLending.EquipmentCondition",
        "name": "condition",
        "type": "uint8"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "penalty",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "refund",
        "type": "uint256"
      }
    ],
    "name": "EquipmentReturned",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "uint256",
        "name": "loanId",
        "type": "uint256"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "cancelledBy",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "refund",
        "type": "uint256"
      }
    ],
    "name": "LoanCancelled",
    "type": "event"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "equipmentId",
        "type": "uint256"
      }
    ],
    "name": "activeEquipmentLoan",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "loanId",
        "type": "uint256"
      }
    ],
    "name": "approveLoan",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "loanId",
        "type": "uint256"
      }
    ],
    "name": "cancelLoan",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "loanId",
        "type": "uint256"
      }
    ],
    "name": "confirmHandover",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "equipmentId",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "durationSeconds",
        "type": "uint256"
      },
      {
        "internalType": "string",
        "name": "purposeNote",
        "type": "string"
      }
    ],
    "name": "createLoanRequest",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "payable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "loanId",
        "type": "uint256"
      },
      {
        "internalType": "enum EquipmentLending.EquipmentCondition",
        "name": "condition",
        "type": "uint8"
      }
    ],
    "name": "returnEquipment",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  }
]
```

---
*Tài liệu đặc tả chi tiết ABI hoàn tất.*
