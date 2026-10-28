"""
Module: backend.app.services.blockchain_service
Mục đích: Kết nối mạng Blockchain EVM (Hardhat local), ký giao dịch Custodial Relayer và tương tác Smart Contract `EquipmentLending`.
Áp dụng: Quy định viết code và docstring tại QUY_DINH_CODE.md.
"""
import json
import os
from decimal import Decimal
from typing import Any, Dict, Optional, Tuple, Union
from eth_account import Account
from eth_account.signers.local import LocalAccount
from web3 import Web3
from web3.contract import Contract
from backend.app.core.config import settings

# Đường dẫn tới thư mục chứa ABI và Contract Address
CONTRACTS_DIR: str = os.path.join(os.path.dirname(os.path.dirname(__file__)), "core", "contracts")
ARTIFACT_PATH: str = os.path.join(CONTRACTS_DIR, "EquipmentLending.json")
ADDRESS_PATH: str = os.path.join(CONTRACTS_DIR, "contract_address.json")


class BlockchainService:
    """
    Lớp dịch vụ trung gian (Web2.5 Custodial Relayer) giao tiếp giữa FastAPI và Smart Contract EVM.
    Đảm nhiệm:
      1. Khởi tạo kết nối Web3 RPC.
      2. Ký giao dịch tự động bằng Private Key của Admin Relayer.
      3. Thực thi và đợi xác nhận (Wait for Receipt) các giao dịch on-chain.
      4. Đọc trạng thái bất biến (View functions) từ Smart Contract.
    """

    def __init__(self) -> None:
        """
        Mục đích: Khởi tạo kết nối Web3 và nạp thông tin Smart Contract đã deploy.
        """
        self.rpc_url: str = settings.BLOCKCHAIN_RPC_URL
        self.web3: Web3 = Web3(Web3.HTTPProvider(self.rpc_url))
        self.admin_account: Optional[LocalAccount] = None
        self.contract: Optional[Contract] = None
        self.contract_address: Optional[str] = None
        self.abi: Optional[list] = None

        self._load_admin_wallet()
        self._load_contract_info()

    def _load_admin_wallet(self) -> None:
        """
        Mục đích: Nạp ví Admin Relayer từ cấu hình bảo mật.
        """
        try:
            if settings.ADMIN_PRIVATE_KEY:
                self.admin_account = Account.from_key(settings.ADMIN_PRIVATE_KEY)
        except Exception:
            self.admin_account = None

    def _load_contract_info(self) -> None:
        """
        Mục đích: Nạp ABI và địa chỉ Smart Contract từ file artifacts đã xuất ở Phase 4.
        """
        try:
            if os.path.exists(ARTIFACT_PATH):
                with open(ARTIFACT_PATH, "r", encoding="utf-8") as f:
                    artifact_data = json.load(f)
                    self.abi = artifact_data.get("abi", [])
                    # Ưu tiên địa chỉ trong artifact hoặc settings
                    self.contract_address = artifact_data.get("address", settings.CONTRACT_ADDRESS)

            if os.path.exists(ADDRESS_PATH) and not self.contract_address:
                with open(ADDRESS_PATH, "r", encoding="utf-8") as f:
                    address_data = json.load(f)
                    self.contract_address = address_data.get("EquipmentLending", settings.CONTRACT_ADDRESS)

            if self.contract_address and self.abi and self.web3:
                checksum_address = Web3.to_checksum_address(self.contract_address)
                self.contract = self.web3.eth.contract(address=checksum_address, abi=self.abi)
        except Exception:
            self.contract = None

    def is_connected(self) -> bool:
        """
        Mục đích: Kiểm tra trạng thái sẵn sàng của node Blockchain RPC.
        Trả về:
            - bool: True nếu node đang online và phản hồi, False nếu mất kết nối.
        Lỗi:
            - Không.
        Tác dụng phụ:
            - Gửi 1 RPC ping tới node.
        """
        try:
            return bool(self.web3 and self.web3.is_connected())
        except Exception:
            return False

    def get_chain_id(self) -> Optional[int]:
        """
        Mục đích: Lấy mã mạng Chain ID hiện tại của node blockchain.
        Trả về:
            - Optional[int]: Mã Chain ID (ví dụ: 31337 cho Hardhat) hoặc None nếu mất kết nối.
        Lỗi:
            - Không.
        Tác dụng phụ:
            - Gọi RPC `eth_chainId`.
        """
        try:
            return self.web3.eth.chain_id if self.is_connected() else None
        except Exception:
            return None

    def get_block_number(self) -> Optional[int]:
        """
        Mục đích: Lấy số hiệu block mới nhất vừa được đào trên mạng.
        Trả về:
            - Optional[int]: Số block hiện tại hoặc None nếu offline.
        Lỗi:
            - Không.
        Tác dụng phụ:
            - Gọi RPC `eth_blockNumber`.
        """
        try:
            return self.web3.eth.block_number if self.is_connected() else None
        except Exception:
            return None

    def get_admin_balance(self) -> Decimal:
        """
        Mục đích: Truy vấn số dư ví Admin Relayer tính theo đơn vị ETH.
        Trả về:
            - Decimal: Số dư ETH khả dụng để trả phí gas.
        Lỗi:
            - Không (trả về Decimal('0.00') nếu offline).
        Tác dụng phụ:
            - Gọi RPC `eth_getBalance`.
        """
        try:
            if not self.is_connected() or not self.admin_account:
                return Decimal("0.00")
            balance_wei: int = self.web3.eth.get_balance(self.admin_account.address)
            balance_eth: Decimal = Decimal(str(Web3.from_wei(balance_wei, "ether")))
            return balance_eth
        except Exception:
            return Decimal("0.00")

    def generate_loan_id(
        self,
        user_id: int,
        equipment_id: int,
        timestamp: int
    ) -> Tuple[bytes, str]:
        """
        Mục đích: Tạo mã định danh đơn mượn on-chain duy nhất (bytes32) sử dụng thuật toán Keccak256.
        Tham số:
            - user_id (int): Khóa chính ID người mượn.
            - equipment_id (int): Khóa chính ID thiết bị.
            - timestamp (int): Mốc thời gian Unix epoch khi tạo yêu cầu.
        Trả về:
            - Tuple[bytes, str]: Tuple gồm `(bytes32, chuỗi_hex_0x...)` có độ dài chuẩn 66 ký tự.
        Lỗi:
            - Không.
        Tác dụng phụ:
            - Thực hiện băm offline, không tương tác mạng.
        """
        loan_id_bytes: bytes = Web3.solidity_keccak(
            ["uint256", "uint256", "uint256"],
            [user_id, equipment_id, timestamp]
        )
        return loan_id_bytes, loan_id_bytes.hex()

    def send_transaction(self, contract_function: Any, value_wei: int = 0) -> Dict[str, Any]:
        """
        Mục đích: Đóng gói, ước tính gas, ký bằng ví Admin Relayer, phát sóng giao dịch on-chain và chờ biên lai xác nhận.
        Tham số:
            - contract_function (Any): Đối tượng ContractFunction từ web3.py (ví dụ: contract.functions.createLoan(...)).
            - value_wei (int): Lượng ETH gửi kèm theo (mặc định 0).
        Trả về:
            - Dict[str, Any]: Bản ghi chi tiết biên lai giao dịch (tx_hash, block_number, gas_used, status).
        Lỗi:
            - ConnectionError: Khi không thể kết nối tới node Blockchain.
            - ValueError: Khi tài khoản Admin chưa được cấu hình.
            - RuntimeError: Khi giao dịch bị Revert on-chain (status == 0).
        Tác dụng phụ:
            - Tăng nonce ví Admin, trừ gas fee, thay đổi state trên Smart Contract và tạo block mới.
        """
        if not self.is_connected():
            raise ConnectionError(f"Không thể kết nối tới node Blockchain tại {self.rpc_url}.")

        if not self.admin_account:
            raise ValueError("Chưa cấu hình tài khoản Admin Relayer (ADMIN_PRIVATE_KEY).")

        admin_address: str = self.admin_account.address
        nonce: int = self.web3.eth.get_transaction_count(admin_address, "pending")
        chain_id: int = self.web3.eth.chain_id

        # 1. Ước tính Gas an toàn
        try:
            estimated_gas: int = contract_function.estimate_gas({"from": admin_address, "value": value_wei})
            gas_limit: int = int(estimated_gas * 1.2)  # Buffer 20%
        except Exception:
            gas_limit = 500000

        gas_price: int = self.web3.eth.gas_price

        # 2. Xây dựng Transaction
        tx_params = contract_function.build_transaction({
            "from": admin_address,
            "nonce": nonce,
            "gas": gas_limit,
            "gasPrice": gas_price,
            "value": value_wei,
            "chainId": chain_id
        })

        # 3. Ký giao dịch cục bộ với Private Key
        signed_tx = self.web3.eth.account.sign_transaction(tx_params, private_key=self.admin_account.key)

        # 4. Gửi Raw Transaction lên mạng
        tx_hash_bytes = self.web3.eth.send_raw_transaction(signed_tx.rawTransaction)
        tx_hash_hex: str = tx_hash_bytes.hex()

        # 5. Chờ xác nhận biên lai giao dịch (Receipt)
        receipt = self.web3.eth.wait_for_transaction_receipt(tx_hash_bytes, timeout=120)

        # 6. Kiểm tra trạng thái thực thi của Transaction
        is_success: bool = (receipt.status == 1)
        if not is_success:
            raise RuntimeError(f"Giao dịch Blockchain {tx_hash_hex} bị Revert (Status 0).")

        return {
            "tx_hash": tx_hash_hex,
            "block_number": receipt.blockNumber,
            "gas_used": receipt.gasUsed,
            "status": "CONFIRMED" if is_success else "FAILED",
            "from_address": admin_address,
            "to_address": str(receipt.to)
        }

    # =========================================================================
    #                      SMART CONTRACT VIEW FUNCTIONS
    # =========================================================================

    def get_loan(self, loan_id: Union[bytes, str]) -> Dict[str, Any]:
        """
        Mục đích: Đọc trực tiếp bản ghi LoanRecord từ Smart Contract.
        Tham số:
            - loan_id (Union[bytes, str]): ID đơn mượn (dạng bytes32 hoặc hex string 0x...).
        Trả về:
            - Dict[str, Any]: Dictionary ánh xạ các trường của LoanRecord.
        Lỗi:
            - RuntimeError: Nếu contract chưa được nạp hoặc node offline.
        Tác dụng phụ:
            - Đọc dữ liệu on-chain (call), không tốn gas.
        """
        if not self.contract:
            raise RuntimeError("Smart contract chưa được khởi tạo.")

        loan_id_bytes: bytes = Web3.to_bytes(hexstr=loan_id) if isinstance(loan_id, str) else loan_id
        record = self.contract.functions.getLoan(loan_id_bytes).call()

        return {
            "loan_id": record[0].hex() if isinstance(record[0], bytes) else record[0],
            "equipment_id": record[1],
            "borrower": record[2],
            "student_id": record[3],
            "request_time": record[4],
            "expected_handover": record[5],
            "due_date": record[6],
            "actual_handover": record[7],
            "actual_return": record[8],
            "deposit_amount": record[9],
            "state": record[10],
            "deposit_state": record[11],
            "penalty_percent": record[12]
        }

    def is_overdue(self, loan_id: Union[bytes, str]) -> bool:
        """
        Mục đích: Kiểm tra đơn mượn có bị quá hạn theo block timestamp hiện tại hay không.
        Tham số:
            - loan_id (Union[bytes, str]): ID đơn mượn.
        Trả về:
            - bool: True nếu đơn đang Active và block timestamp > dueDate.
        Lỗi:
            - RuntimeError: Nếu node offline.
        Tác dụng phụ:
            - Đọc on-chain (call).
        """
        if not self.contract:
            raise RuntimeError("Smart contract chưa được khởi tạo.")
        loan_id_bytes: bytes = Web3.to_bytes(hexstr=loan_id) if isinstance(loan_id, str) else loan_id
        return bool(self.contract.functions.isOverdue(loan_id_bytes).call())

    def calculate_penalty(self, loan_id: Union[bytes, str], return_condition: int) -> Dict[str, Any]:
        """
        Mục đích: Dự tính trước mức phạt và trạng thái cọc trên Smart Contract trước khi chốt trả máy.
        Tham số:
            - loan_id (Union[bytes, str]): ID đơn mượn.
            - return_condition (int): 0=GOOD, 1=DAMAGED, 2=LOST.
        Trả về:
            - Dict[str, Any]: {'penalty_percent': int, 'deposit_state': int, 'next_state': int}.
        Lỗi:
            - RuntimeError: Nếu node offline.
        Tác dụng phụ:
            - Đọc on-chain (call).
        """
        if not self.contract:
            raise RuntimeError("Smart contract chưa được khởi tạo.")
        loan_id_bytes: bytes = Web3.to_bytes(hexstr=loan_id) if isinstance(loan_id, str) else loan_id
        penalty, dep_state, next_state = self.contract.functions.calculatePenalty(loan_id_bytes, return_condition).call()
        return {
            "penalty_percent": penalty,
            "deposit_state": dep_state,
            "next_state": next_state
        }

    def get_active_equipment_loan(self, equipment_id: int) -> str:
        """
        Mục đích: Kiểm tra khóa Mutex on-chain xem thiết bị có đang bị giữ bởi đơn mượn nào không.
        Tham số:
            - equipment_id (int): Khóa chính ID thiết bị.
        Trả về:
            - str: Chuỗi hex của loan_id đang khóa thiết bị (hoặc chuỗi '0x00...00' nếu không bị khóa).
        Lỗi:
            - Không.
        Tác dụng phụ:
            - Đọc on-chain (call).
        """
        if not self.contract:
            return "0x" + "0" * 64
        try:
            active_loan_bytes: bytes = self.contract.functions.activeEquipmentLoan(equipment_id).call()
            return active_loan_bytes.hex()
        except Exception:
            return "0x" + "0" * 64

    # =========================================================================
    #                   SMART CONTRACT LIFECYCLE TRANSACTIONS
    # =========================================================================

    def create_loan(
        self,
        loan_id: bytes,
        equipment_id: int,
        student_id: str,
        borrower_address: str,
        expected_handover: int,
        due_date: int,
        deposit_amount: int
    ) -> Dict[str, Any]:
        """
        Mục đích: Gửi transaction gọi hàm `createLoan` trên Smart Contract.
        """
        if not self.contract:
            raise RuntimeError("Smart contract chưa được khởi tạo.")
        checksum_borrower = Web3.to_checksum_address(borrower_address) if borrower_address else self.admin_account.address
        func = self.contract.functions.createLoan(
            loan_id,
            equipment_id,
            student_id,
            checksum_borrower,
            expected_handover,
            due_date,
            deposit_amount
        )
        return self.send_transaction(func)

    def approve_loan(self, loan_id: bytes) -> Dict[str, Any]:
        """
        Mục đích: Gửi transaction gọi hàm `approveLoan` trên Smart Contract (khóa Mutex thiết bị).
        """
        if not self.contract:
            raise RuntimeError("Smart contract chưa được khởi tạo.")
        func = self.contract.functions.approveLoan(loan_id)
        return self.send_transaction(func)

    def confirm_handover(self, loan_id: bytes) -> Dict[str, Any]:
        """
        Mục đích: Gửi transaction gọi hàm `confirmHandover` trên Smart Contract (khóa tiền cọc mô phỏng).
        """
        if not self.contract:
            raise RuntimeError("Smart contract chưa được khởi tạo.")
        func = self.contract.functions.confirmHandover(loan_id)
        return self.send_transaction(func)

    def confirm_return(
        self,
        loan_id: bytes,
        return_condition: int,
        penalty_percent: int = 0
    ) -> Dict[str, Any]:
        """
        Mục đích: Gửi transaction gọi hàm `confirmReturn` trên Smart Contract (tính phạt và giải phóng Mutex).
        """
        if not self.contract:
            raise RuntimeError("Smart contract chưa được khởi tạo.")
        func = self.contract.functions.confirmReturn(loan_id, return_condition, penalty_percent)
        return self.send_transaction(func)

    def cancel_loan(self, loan_id: bytes, reason: str = "Borrower cancelled") -> Dict[str, Any]:
        """
        Mục đích: Gửi transaction gọi hàm `cancelLoan` trên Smart Contract (hủy đơn và giải phóng Mutex nếu có).
        """
        if not self.contract:
            raise RuntimeError("Smart contract chưa được khởi tạo.")
        func = self.contract.functions.cancelLoan(loan_id, reason)
        return self.send_transaction(func)


# Singleton Instance dùng chung trong toàn bộ Backend
blockchain_service = BlockchainService()

