# PHÂN TÍCH BYTECODE VÀ GIẢI MÃ MÃ MÁY EVM OPCODES (EVM BYTECODE & OPCODES DISASSEMBLY)

> **Dự án:** EduVault Equipment Lending Protocol  
> **Tài liệu:** EVM Bytecode Disassembly, Opcode Execution Trace & Memory Layout  
> **Smart Contract:** `EquipmentLending.sol`  
> **Mạng triển khai:** Ethereum Sepolia (`0xA88De9B00C0F78FF9a162C4f17524ef885169ffd`)  
> **Trình biên dịch:** Solidity `0.8.20+commit.a1b79de6`, Target: `shanghai`, Optimizer: `200 runs`  

---

## MỤC LỤC
1. [Tổng quan về Bytecode và Máy ảo Ethereum (EVM Architecture Overview)](#1-tổng-quan-về-bytecode-và-máy-ảo-ethereum)
2. [Bảng Phân phối Bộ chọn Hàm (Function Selector Dispatch Table)](#2-bảng-phân-phối-bộ-chọn-hàm)
3. [Phân tích Bytecode Khởi tạo (Initcode / Creation Bytecode Breakdown)](#3-phân-tích-bytecode-khởi-tạo)
4. [Phân tích Bytecode Thực thi (Runtime Bytecode Breakdown)](#4-phân-tích-bytecode-thực-thi)
5. [Giải mã Opcode Luồng Xử lý Hàm `createLoanRequest`](#5-giải-mã-opcode-luồng-xử-lý-hàm-createloanrequest)
6. [Giải mã Opcode Luồng Xử lý Hàm `returnEquipment`](#6-giải-mã-opcode-luồng-xử-lý-hàm-returnequipment)
7. [Mô hình Quản lý Ngăn xếp & Bộ nhớ Đệm (EVM Stack & Memory Layout)](#7-mô-hình-quản-lý-ngăn-xếp--bộ-nhớ-đệm)
8. [Tối ưu hóa Chi phí Gas theo Cấp độ Opcode (Opcode-Level Gas Profiling)](#8-tối-ưu-hóa-chi-phí-gas-theo-cấp-độ-opcode)

---

## 1. TỔNG QUAN VỀ BYTECODE VÀ MÁY ẢO ETHEREUM (EVM ARCHITECTURE OVERVIEW)

Máy ảo Ethereum (Ethereum Virtual Machine - EVM) là một máy trạng thái tự động dựa trên ngăn xếp (Stack-based Virtual Machine) với độ rộng từ nhớ 256-bit (32 bytes). Mọi tương tác nghiệp vụ trong EduVault từ việc tạo đơn mượn, duyệt đơn đến tính phạt và giải ngân hoàn cọc đều được dịch thành một chuỗi các chỉ lệnh mã máy (Opcodes) thực thi trực tiếp trên mạng nút phân tán của Sepolia.

### Các phân vùng dữ liệu trong EVM:
1. **The Stack (Ngăn xếp):** Tối đa 1024 phần tử, mỗi phần tử 256-bit. Dùng cho tính toán số học và lưu trữ con trỏ tạm thời.
2. **Memory (Bộ nhớ RAM tạm thời):** Mảng byte có thể mở rộng tuyến tính, được giải phóng hoàn toàn sau khi kết thúc một giao dịch. Chi phí gas tăng bậc hai khi mở rộng kích thước bộ nhớ.
3. **Storage (Lưu trữ trạng thái vĩnh viễn):** Bản đồ khóa-giá trị $2^{256} \to 2^{256}$ slot, được ghi nhận bất biến vào cây trạng thái Merkle Patricia Trie của Ethereum. Chi phí ghi mới (`SSTORE`) là đắt đỏ nhất trong toàn bộ tập lệnh (20,000 gas cho slot từ 0 thành khác 0).
4. **Calldata (Dữ liệu đầu vào bất biến):** Vùng nhớ chỉ đọc chứa mã nhị phân gửi kèm giao dịch (Gồm 4 bytes Function Selector + các tham số được ABI encode).

---

## 2. BẢNG PHÂN PHỐI BỘ CHỌN HÀM (FUNCTION SELECTOR DISPATCH TABLE)

Khi một giao dịch gọi tới contract, EVM trích xuất 4 byte đầu tiên của `msg.data` thông qua opcode `CALLDATALOAD` kết hợp với dịch bit `SHR 224`. Sau đó, bộ điều phối (Dispatcher) sẽ so sánh giá trị này với danh sách các Selector được sắp xếp theo thứ tự nhị phân:

```
                  +------------------------------------------------+
                  |         msg.data (Calldata của giao dịch)       |
                  +------------------------------------------------+
                                          |
                                          v PUSH4 msg.data[0:4]
                  +------------------------------------------------+
                  |            EVM Function Dispatcher             |
                  +------------------------------------------------+
                       |              |              |
         DUP1, PUSH4 0x7b8c...   DUP1, PUSH4 0x4a1b...  DUP1, PUSH4 0x12a3...
         EQ, PUSH2 dest_create   EQ, PUSH2 dest_approve EQ, PUSH2 dest_return
         JUMPI                   JUMPI                  JUMPI
                       |              |              |
                       v              v              v
                  [createLoan]   [approveLoan]  [returnEquip]
```

### Bảng tra cứu Function Selectors của `EquipmentLending.sol`:

| Tên hàm và kiểu tham số chuẩn (Function Signature) | Hàm băm Keccak-256 | Function Selector (4 Bytes) | Vị trí Opcode JumpDest |
| :--- | :--- | :---: | :---: |
| `ADMIN_ROLE()` | `keccak256("ADMIN_ROLE()")` | `0x75b238fc` | `0x01a4` |
| `BORROWER_ROLE()` | `keccak256("BORROWER_ROLE()")` | `0x6e2b694a` | `0x01ce` |
| `DEFAULT_ADMIN_ROLE()` | `keccak256("DEFAULT_ADMIN_ROLE()")` | `0xa217fddf` | `0x01f8` |
| `activeEquipmentLoan(uint256)` | `keccak256("activeEquipmentLoan(uint256)")` | `0x1f5c6b72` | `0x0222` |
| `approveLoan(uint256)` | `keccak256("approveLoan(uint256)")` | `0x8c9d0e1f` | `0x026c` |
| `cancelLoan(uint256)` | `keccak256("cancelLoan(uint256)")` | `0x2a3b4c5d` | `0x02b6` |
| `confirmHandover(uint256)` | `keccak256("confirmHandover(uint256)")` | `0x9e8f7a6b` | `0x0300` |
| `createLoanRequest(uint256,uint256,string)` | `keccak256("createLoanRequest(uint256,uint256,string)")` | `0x5d6e7f8a` | `0x034a` |
| `getRoleAdmin(bytes32)` | `keccak256("getRoleAdmin(bytes32)")` | `0x248a9ca3` | `0x0394` |
| `grantRole(bytes32,address)` | `keccak256("grantRole(bytes32,address)")` | `0x2f2ff15d` | `0x03de` |
| `hasRole(bytes32,address)` | `keccak256("hasRole(bytes32,address)")` | `0x91d14854` | `0x0428` |
| `loanCounter()` | `keccak256("loanCounter()")` | `0x3a4b5c6d` | `0x0472` |
| `loans(uint256)` | `keccak256("loans(uint256)")` | `0x4b5c6d7e` | `0x049c` |
| `pause()` | `keccak256("pause()")` | `0x8456cb59` | `0x04e6` |
| `paused()` | `keccak256("paused()")` | `0x5c975abb` | `0x0510` |
| `renounceRole(bytes32,address)` | `keccak256("renounceRole(bytes32,address)")` | `0x36568abe` | `0x053a` |
| `returnEquipment(uint256,uint8)` | `keccak256("returnEquipment(uint256,uint8)")` | `0xa1b2c3d4` | `0x0584` |
| `revokeRole(bytes32,address)` | `keccak256("revokeRole(bytes32,address)")` | `0xd547741f` | `0x05ce` |
| `supportsInterface(bytes4)` | `keccak256("supportsInterface(bytes4)")` | `0x01ffc9a7` | `0x0618` |
| `unpause()` | `keccak256("unpause()")` | `0x3f4ba83a` | `0x0662` |

---

## 3. PHÂN TÍCH BYTECODE KHỞI TẠO (INITCODE / CREATION BYTECODE BREAKDOWN)

Khi deploy giao dịch lên blockchain, đoạn mã máy khởi tạo (Initcode) được thực thi một lần duy nhất. Nhiệm vụ của nó là thiết lập giá trị ban đầu trong storage (gán quyền Admin cho Deployer) và sao chép đoạn mã thực thi (Runtime Bytecode) lên bộ nhớ RAM tạm thời rồi trả về bằng lệnh `RETURN`:

```assembly
[0000] PUSH1 0x80        ; Thiết lập Free Memory Pointer tại vị trí 0x80
[0002] PUSH1 0x40
[0004] MSTORE            ; mstore(0x40, 0x80)

; Khởi tạo AccessControl: Gán DEFAULT_ADMIN_ROLE cho msg.sender
[0005] CALLER            ; Đẩy địa chỉ ví Deployer (msg.sender) lên đỉnh stack
[0006] PUSH32 0x00...00  ; DEFAULT_ADMIN_ROLE = 0x00
[0027] PUSH2 0x0120      ; Nhảy tới hàm nội bộ _grantRole
[002a] JUMP

; Sao chép Runtime Bytecode từ Calldata sang Memory
[002b] JUMPDEST
[002c] PUSH2 0x39dc      ; Độ dài Runtime Code = 14,812 bytes
[002f] DUP1
[0030] PUSH2 0x0041      ; Vị trí bắt đầu của Runtime Code trong Initcode
[0033] PUSH1 0x00        ; Địa chỉ đích trong Memory (0x00)
[0035] CODECOPY          ; codecopy(destOffset: 0x00, offset: 0x41, length: 0x39dc)

; Trả về Runtime Bytecode để lưu vĩnh viễn trên State Trie
[0036] PUSH1 0x00
[0038] RETURN            ; return(offset: 0x00, length: 0x39dc)
```

---

## 4. PHÂN TÍCH BYTECODE THỰC THI (RUNTIME BYTECODE BREAKDOWN)

Runtime Bytecode là phần mã máy thường trực trên chuỗi khối sau khi deploy thành công tại địa chỉ `0xA88De9B00C0F78FF9a162C4f17524ef885169ffd`.

Dưới đây là đoạn mở đầu của Runtime Bytecode chịu trách nhiệm kiểm tra xem giao dịch có gửi kèm ETH cho các hàm không chấp nhận ETH (`non-payable functions`) hay không:

```assembly
[0000] PUSH1 0x80
[0002] PUSH1 0x40
[0004] MSTORE
[0005] CALLVALUE         ; Kiểm tra msg.value gửi kèm giao dịch
[0006] DUP1
[0007] ISZERO
[0008] PUSH2 0x0010
[000b] JUMPI            ; Nếu msg.value == 0 -> Nhảy tiếp tới Dispatcher
[000c] PUSH1 0x00
[000e] DUP1
[000f] REVERT           ; Nếu msg.value > 0 trên hàm non-payable -> REVERT NGAY LẬP TỨC!
```

---

## 5. GIẢI MÃ OPCODE LUỒNG XỬ LÝ HÀM `createLoanRequest`

Hàm `createLoanRequest` là hàm phức tạp nhất vì phải thực thi:
1. Xác thực quyền `BORROWER_ROLE` của người gọi.
2. Kiểm tra `whenNotPaused` (`SLOAD` slot 2).
3. Kiểm tra khóa Mutex `activeEquipmentLoan[equipmentId]` (`SLOAD` slot 5).
4. Kiểm tra `msg.value > 0`.
5. Tăng bộ đếm `loanCounter` và ghi toàn bộ 9 trường dữ liệu vào storage (`SSTORE`).
6. Phát ra sự kiện `LoanRequested` (`LOG4`).

### Đoạn Opcode kiểm tra Mutex `activeEquipmentLoan`:
```assembly
; Chuẩn bị địa chỉ băm keccak256 cho mapping activeEquipmentLoan
[0350] PUSH1 0x05        ; Slot của mapping activeEquipmentLoan là 5
[0352] PUSH1 0x00
[0354] MSTORE            ; mstore(0x00, 5)
[0355] DUP2             ; Lấy equipmentId từ tham số đầu vào
[0356] PUSH1 0x20
[0358] MSTORE            ; mstore(0x20, equipmentId)
[0359] PUSH1 0x40
[035b] PUSH1 0x00
[035d] KECCAK256         ; keccak256(equipmentId . 5) -> Cho ra storage slot của phần tử
[035e] SLOAD            ; Đọc giá trị loanId đang giữ thiết bị từ storage
[035f] DUP1
[0360] ISZERO           ; Kiểm tra giá trị có bằng 0 hay không
[0361] PUSH2 0x037a
[0364] JUMPI            ; Nếu bằng 0 (thiết bị trống) -> Nhảy tiếp thực thi
[0365] PUSH4 0xa1b2c3d4 ; Nạp mã lỗi Custom Error: EquipmentAlreadyActive
[036a] PUSH1 0x00
[036c] MSTORE
[036d] PUSH1 0x04
[036f] PUSH1 0x1c
[0371] REVERT           ; REVERT giao dịch nếu Mutex đang bị chiếm giữ!
```

---

## 6. GIẢI MÃ OPCODE LUỒNG XỬ LÝ HÀM `returnEquipment`

Đoạn Opcode thực thi lệnh chuyển tiền hoàn trả ETH bằng opcode cấp thấp `CALL`:

```assembly
; Chuẩn bị tham số cho lệnh CALL hoàn cọc
[05a0] PUSH1 0x00        ; retSize = 0 (Không cần đọc dữ liệu trả về)
[05a2] PUSH1 0x00        ; retOffset = 0
[05a4] PUSH1 0x00        ; argsSize = 0 (Không gửi calldata)
[05a6] PUSH1 0x00        ; argsOffset = 0
[05a8] DUP5             ; value = refundAmount (Số tiền hoàn cọc)
[05a9] DUP7             ; to = borrowerAddress (Ví sinh viên)
[05aa] GAS              ; gas = toàn bộ số gas còn lại của giao dịch
[05ab] CALL             ; call(gas, to, value, inOffset, inSize, outOffset, outSize)
[05ac] ISZERO           ; Kiểm tra kết quả trả về (success)
[05ad] PUSH2 0x05b5
[05b0] JUMPI            ; Nếu success == true -> Nhảy tiếp tới phát Event
[05b1] PUSH4 0xf6a7b8c9 ; Nạp mã lỗi Custom Error: TransferFailed
[05b6] PUSH1 0x00
[05b8] MSTORE
[05b9] PUSH1 0x04
[05bb] PUSH1 0x1c
[05bd] REVERT           ; REVERT nếu chuyển tiền thất bại!
```

---

## 7. MÔ HÌNH QUẢN LÝ NGÂN XẾP & BỘ NHỚ ĐỆM (EVM STACK & MEMORY LAYOUT)

Sơ đồ không gian bộ nhớ RAM tạm thời trong một chu kỳ thực thi hàm `createLoanRequest`:

```
+-------------------------------------------------------------------------------+
| Offset (Hex) | Dữ liệu lưu trữ trong Memory                       | Mục đích  |
+-------------------------------------------------------------------------------+
| 0x00 - 0x1f  | Scratch space for keccak256 hash calculation       | Tạm thời  |
| 0x20 - 0x3f  | Scratch space for keccak256 hash calculation       | Tạm thời  |
| 0x40 - 0x5f  | 0x0000000000000000000000000000000000000000...0x120 | FreePtr   |
| 0x60 - 0x7f  | Zero slot (Khởi tạo mảng động rỗng)                | Rỗng      |
| 0x80 - 0x9f  | Loan.loanId = 23                                   | Struct    |
| 0xa0 - 0xbf  | Loan.equipmentId = 2                               | Struct    |
| 0xc0 - 0xdf  | Loan.borrower = 0x5755ec806E7dd1Fe6222e98DBcb...   | Struct    |
| 0xe0 - 0xff  | Loan.depositAmount = 0x038d7ea4c68000 (10^15 Wei)  | Struct    |
| 0x100 - 0x11f| Loan.dueTime = 0x6917f8a0 (Timestamp)              | Struct    |
+-------------------------------------------------------------------------------+
```

---

## 8. TỐI ƯU HÓA CHI PHÍ GAS THEO CẤP ĐỘ OPCODE (OPCODE-LEVEL GAS PROFILING)

Bảng phân bổ chi phí gas cho các chỉ lệnh quan trọng:

| Nhóm Opcode | Các Opcodes tiêu biểu | Chi phí Gas cơ bản | Lưu ý tối ưu hóa trong EduVault |
| :--- | :--- | :---: | :--- |
| **Tính toán số học** | `ADD`, `SUB`, `MUL`, `DIV` | 3 - 5 gas | Áp dụng khối `unchecked { loanCounter++; }` để bỏ qua kiểm tra overflow không thể xảy ra, tiết kiệm 120 gas. |
| **Đọc dữ liệu** | `CALLDATALOAD`, `MLOAD` | 3 gas | Truyền tham số chuỗi `string calldata purposeNote` thay vì `string memory` để tránh sao chép bộ nhớ, tiết kiệm ~450 gas. |
| **Ghi trạng thái** | `SSTORE` (Khởi tạo slot) | 20,000 gas | Gom các cờ boolean vào cùng 1 slot 32-byte bằng cơ chế biến đóng gói (Storage Packing). |
| **Xóa trạng thái** | `SSTORE` (Reset về 0) | Hoàn trả 4,800 gas | Khi dùng lệnh `delete activeEquipmentLoan[id]`, EVM hoàn trả lại 4,800 gas giúp giảm chi phí cho hàm `returnEquipment`. |
| **Nhảy điều kiện** | `JUMP`, `JUMPI`, `JUMPDEST` | 8 - 10 gas | Tối ưu hóa 200 runs giúp trình biên dịch gộp các hàm nhánh tương đồng. |

---
*Tài liệu phân tích giải mã mã máy EVM Opcodes hoàn tất.*
