"""
Module: backend.app.services.blockchain_service
Mục đích: Kết nối mạng Blockchain EVM (Hardhat local / Sepolia), ký giao dịch Custodial Relayer,
          xác thực biên lai giao dịch MetaMask từ client và tương tác Smart Contract `EquipmentLending`.
Áp dụng: Quy định viết code và docstring tại QUY_DINH_CODE.md.
"""
import json
import os
from decimal import Decimal
from typing import Any, Callable, Dict, Optional, Tuple, Union
from eth_account import Account
from eth_account.signers.local import LocalAccount
from web3 import Web3
from web3.contract import Contract
from web3.exceptions import ContractLogicError, TransactionNotFound
from web3.logs import DISCARD
from backend.app.core.config import Settings, settings

# Đường dẫn tới thư mục chứa ABI và Contract Address
CONTRACTS_DIR: str = os.path.join(os.path.dirname(os.path.dirname(__file__)), "core", "contracts")
ARTIFACT_PATH: str = os.path.join(CONTRACTS_DIR, "EquipmentLending.json")
ADDRESS_PATH: str = os.path.join(CONTRACTS_DIR, "contract_address.json")
ZERO_BYTES32_HEX: str = "0x" + ("0" * 64)


def normalize_hex_bytes32(value: Union[bytes, bytearray, str], expected_bytes_len: int = 32) -> str:
    """
    Mục đích: Chuẩn hóa dữ liệu bytes/HexBytes/str thành chuỗi hex có đúng một tiền tố `0x` chữ thường.
    Tham số:
        - value (Union[bytes, bytearray, str]): Giá trị bytes32 hoặc chuỗi hex cần chuẩn hóa.
        - expected_bytes_len (int): Độ dài byte kỳ vọng (mặc định 32 bytes = 64 ký tự hex).
    Trả về:
        - str: Chuỗi hex chuẩn dạng `0x...` dài `2 + expected_bytes_len * 2` ký tự.
    Lỗi:
        - ValueError: Nếu độ dài hoặc ký tự hex không hợp lệ.
    """
    if isinstance(value, (bytes, bytearray)):
        raw_hex = value.hex()
        hex_body = raw_hex[2:] if raw_hex.startswith(("0x", "0X")) else raw_hex
    elif isinstance(value, str):
        stripped = value.strip()
        hex_body = stripped[2:] if stripped.startswith(("0x", "0X")) else stripped
    else:
        raise ValueError(f"Kiểu dữ liệu hex không được hỗ trợ: {type(value).__name__}")

    hex_body = hex_body.lower()
    expected_chars = expected_bytes_len * 2
    if len(hex_body) != expected_chars:
        raise ValueError(f"Chuỗi hex phải dài {expected_chars} ký tự (nhận {len(hex_body)}).")
    try:
        int(hex_body, 16)
    except ValueError as exc:
        raise ValueError("Chuỗi hex chứa ký tự không hợp lệ.") from exc
    return f"0x{hex_body}"


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
        Mục đích: Nạp ABI từ file artifacts và chọn địa chỉ Smart Contract khớp với `settings.CHAIN_ID`.
        Thứ tự ưu tiên:
          1. Biến môi trường `CONTRACT_ADDRESS` (nếu override hoặc khác giá trị mặc định local).
          2. `contract_address.json` nếu `chainId` trong artifact khớp với `settings.CHAIN_ID`.
          3. Fallback về `settings.CONTRACT_ADDRESS`.
        """
        try:
            default_local_addr = Settings.model_fields["CONTRACT_ADDRESS"].default
            env_override = os.environ.get("CONTRACT_ADDRESS")
            address_from_json: Optional[str] = None
            chain_from_json: Optional[int] = None

            if os.path.exists(ARTIFACT_PATH):
                with open(ARTIFACT_PATH, "r", encoding="utf-8") as f:
                    artifact_data = json.load(f)
                    self.abi = artifact_data.get("abi", [])

            if os.path.exists(ADDRESS_PATH):
                with open(ADDRESS_PATH, "r", encoding="utf-8") as f:
                    address_data = json.load(f)
                    address_from_json = address_data.get("EquipmentLending")
                    raw_chain = address_data.get("chainId")
                    if raw_chain is not None and str(raw_chain).strip():
                        try:
                            chain_from_json = int(str(raw_chain).strip())
                        except ValueError:
                            chain_from_json = None

            has_explicit_env = bool(env_override and env_override.strip())
            is_non_default_setting = (
                bool(settings.CONTRACT_ADDRESS)
                and default_local_addr is not None
                and settings.CONTRACT_ADDRESS.lower() != default_local_addr.lower()
            )

            if has_explicit_env or is_non_default_setting:
                self.contract_address = settings.CONTRACT_ADDRESS
            elif chain_from_json is not None and int(chain_from_json) == int(settings.CHAIN_ID) and address_from_json:
                self.contract_address = address_from_json
            else:
                self.contract_address = settings.CONTRACT_ADDRESS or address_from_json

            if self.contract_address and self.abi and self.web3:
                checksum_address = Web3.to_checksum_address(self.contract_address)
                self.contract_address = checksum_address
                self.contract = self.web3.eth.contract(address=checksum_address, abi=self.abi)
        except Exception:
            self.contract = None

    def reload_contract(self, contract_address: Optional[str] = None) -> None:
        """
        Mục đích: Khởi tạo lại instance `self.contract` khi địa chỉ contract hoặc RPC thay đổi.
        """
        if contract_address:
            self.contract_address = Web3.to_checksum_address(contract_address)
        if self.contract_address and self.abi and self.web3:
            self.contract = self.web3.eth.contract(
                address=Web3.to_checksum_address(self.contract_address),
                abi=self.abi,
            )

    def ensure_ready(self, require_admin: bool = False) -> None:
        """
        Mục đích: Kiểm tra pre-flight node RPC online, đúng Chain ID và có bytecode Smart Contract tại `contract_address`.
        Lỗi:
            - ConnectionError: Khi node offline, sai Chain ID hoặc chưa deploy contract tại địa chỉ cấu hình.
            - RuntimeError: Khi chưa khởi tạo contract ABI/address.
            - ValueError: Khi yêu cầu ví Admin Relayer nhưng chưa cấu hình.
        """
        if not self.is_connected():
            raise ConnectionError(f"Không thể kết nối tới node Blockchain tại {self.rpc_url}.")
        if not self.contract or not self.contract_address:
            raise RuntimeError("Smart contract chưa được khởi tạo.")

        chain_id = self.get_chain_id()
        if chain_id != int(settings.CHAIN_ID):
            raise ConnectionError(
                f"Sai mạng Blockchain: RPC đang ở Chain ID {chain_id}, cấu hình hệ thống yêu cầu {settings.CHAIN_ID}."
            )

        code = self.web3.eth.get_code(Web3.to_checksum_address(self.contract_address))
        if not code or code in (b"", b"\x00"):
            raise ConnectionError(
                f"Không tìm thấy bytecode Smart Contract tại {self.contract_address} trên Chain ID {chain_id}."
            )

        if require_admin and not self.admin_account:
            raise ValueError("Chưa cấu hình tài khoản Admin Relayer (ADMIN_PRIVATE_KEY).")

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
        return bytes(loan_id_bytes), normalize_hex_bytes32(loan_id_bytes, 32)

    def send_transaction(
        self,
        contract_function: Any,
        value_wei: int = 0,
        on_broadcast: Optional[Callable[[str, str, Optional[str]], None]] = None,
        on_failed: Optional[Callable[[str, Optional[int], Optional[int], str], None]] = None,
    ) -> Dict[str, Any]:
        """
        Mục đích: Đóng gói, mô phỏng gas, ký bằng ví Admin Relayer, phát sóng giao dịch on-chain và chờ biên lai xác nhận.
        Tham số:
            - contract_function (Any): Đối tượng ContractFunction từ web3.py.
            - value_wei (int): Lượng ETH gửi kèm theo (mặc định 0).
            - on_broadcast (Callable): Callback lưu bản ghi `PENDING` ngay sau khi phát sóng `tx_hash`.
            - on_failed (Callable): Callback cập nhật trạng thái `FAILED` nếu receipt có `status == 0`.
        Trả về:
            - Dict[str, Any]: Biên lai giao dịch (`tx_hash`, `block_number`, `gas_used`, `status`, `from_address`, `to_address`).
        Lỗi:
            - ConnectionError: Khi node offline, sai Chain ID hoặc contract chưa deploy.
            - ValueError: Khi tài khoản Admin chưa được cấu hình.
            - RuntimeError: Khi pre-flight hoặc giao dịch on-chain bị Revert.
        """
        self.ensure_ready(require_admin=True)

        admin_address: str = self.admin_account.address
        nonce: int = self.web3.eth.get_transaction_count(admin_address, "pending")
        chain_id: int = self.web3.eth.chain_id

        # 1. Mô phỏng & ước tính Gas an toàn (chặn sớm nếu hợp đồng revert)
        try:
            estimated_gas: int = contract_function.estimate_gas({"from": admin_address, "value": value_wei})
            gas_limit: int = int(estimated_gas * 1.2)
        except ContractLogicError as exc:
            raise RuntimeError(f"Giao dịch bị Smart Contract từ chối khi mô phỏng: {exc}") from exc
        except Exception as exc:
            msg = str(exc)
            if "revert" in msg.lower():
                raise RuntimeError(f"Giao dịch bị Smart Contract từ chối khi mô phỏng: {msg}") from exc
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

        # 4. Gửi Raw Transaction lên mạng và chuẩn hóa tx_hash (1 tiền tố 0x)
        raw_tx = getattr(signed_tx, "raw_transaction", getattr(signed_tx, "rawTransaction", None))
        tx_hash_bytes = self.web3.eth.send_raw_transaction(raw_tx)
        tx_hash_hex: str = normalize_hex_bytes32(tx_hash_bytes, 32)

        if on_broadcast is not None:
            on_broadcast(tx_hash_hex, admin_address, self.contract_address)

        # 5. Chờ xác nhận biên lai giao dịch (Receipt)
        receipt = self.web3.eth.wait_for_transaction_receipt(tx_hash_bytes, timeout=120)
        block_number = getattr(receipt, "block_number", getattr(receipt, "blockNumber", None))
        gas_used = getattr(receipt, "gas_used", getattr(receipt, "gasUsed", None))

        # 6. Kiểm tra trạng thái thực thi của Transaction
        is_success: bool = (receipt.status == 1)
        if not is_success:
            reason = f"Giao dịch Blockchain {tx_hash_hex} bị Revert (Status 0)."
            if on_failed is not None:
                on_failed(tx_hash_hex, block_number, gas_used, reason)
            raise RuntimeError(reason)

        return {
            "tx_hash": tx_hash_hex,
            "block_number": block_number,
            "gas_used": gas_used,
            "status": "CONFIRMED",
            "from_address": admin_address,
            "to_address": Web3.to_checksum_address(str(receipt.to)) if receipt.to else self.contract_address
        }

    def verify_create_loan_tx(
        self,
        tx_hash: str,
        expected_loan_id: Union[bytes, str],
        expected_equipment_id: int,
        expected_student_id: str,
        expected_borrower_address: str,
        expected_handover_ts: int,
        expected_due_ts: int,
        expected_deposit: int,
        expected_sender_address: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Mục đích: Xác thực biên lai giao dịch MetaMask `createLoan` trực tiếp trên RPC (chống giả mạo client_tx_hash / on_chain_loan_id).
        """
        self.ensure_ready(require_admin=False)

        tx_hash_hex = normalize_hex_bytes32(tx_hash, 32)
        expected_loan_id_hex = normalize_hex_bytes32(expected_loan_id, 32)
        expected_borrower_checksum = Web3.to_checksum_address(expected_borrower_address)
        expected_sender_checksum = Web3.to_checksum_address(expected_sender_address or expected_borrower_address)

        try:
            receipt = self.web3.eth.get_transaction_receipt(tx_hash_hex)
        except TransactionNotFound:
            try:
                receipt = self.web3.eth.wait_for_transaction_receipt(tx_hash_hex, timeout=30)
            except Exception as exc:
                raise ValueError(f"Không tìm thấy giao dịch {tx_hash_hex} trên blockchain hoặc chưa được khai thác.") from exc

        try:
            tx = self.web3.eth.get_transaction(tx_hash_hex)
        except TransactionNotFound as exc:
            raise ValueError(f"Không truy vấn được chi tiết giao dịch {tx_hash_hex}.") from exc

        if getattr(receipt, "status", 0) != 1:
            raise ValueError(f"Giao dịch {tx_hash_hex} đã bị revert on-chain (status != 1).")

        receipt_to = receipt.get("to") if isinstance(receipt, dict) else getattr(receipt, "to", None)
        if not receipt_to or str(receipt_to).lower() != str(self.contract_address).lower():
            raise ValueError("Giao dịch không tương tác với địa chỉ Smart Contract EquipmentLending hiện hành.")

        tx_chain_id = tx.get("chainId") if isinstance(tx, dict) else getattr(tx, "chainId", None)
        if tx_chain_id is not None and int(tx_chain_id) != int(settings.CHAIN_ID):
            raise ValueError(
                f"Giao dịch thuộc Chain ID {tx_chain_id}, không khớp mạng cấu hình ({settings.CHAIN_ID})."
            )

        tx_from = tx.get("from") if isinstance(tx, dict) else getattr(tx, "from", None)
        if not tx_from or str(tx_from).lower() != expected_sender_checksum.lower():
            raise ValueError(
                f"Địa chỉ gửi giao dịch ({tx_from}) không khớp với ví đã xác minh ({expected_sender_checksum})."
            )

        events = self.contract.events.LoanCreated().process_receipt(receipt, errors=DISCARD)
        matched_event = None
        for ev in events:
            ev_loan_id = normalize_hex_bytes32(ev["args"]["loanId"], 32)
            if ev_loan_id == expected_loan_id_hex:
                matched_event = ev
                break

        if not matched_event:
            raise ValueError(
                f"Biên lai giao dịch {tx_hash_hex} không phát sự kiện LoanCreated cho loanId {expected_loan_id_hex}."
            )

        args = matched_event["args"]
        if int(args["equipmentId"]) != int(expected_equipment_id):
            raise ValueError("equipmentId trong sự kiện LoanCreated không khớp đơn mượn.")
        if str(args["studentId"]) != str(expected_student_id):
            raise ValueError("studentId trong sự kiện LoanCreated không khớp tài khoản người mượn.")
        if str(args["borrower"]).lower() != expected_borrower_checksum.lower():
            raise ValueError("Địa chỉ borrower trong sự kiện LoanCreated không khớp ví đã xác minh.")
        if int(args["dueDate"]) != int(expected_due_ts):
            raise ValueError("dueDate trong sự kiện LoanCreated không khớp thời hạn trả đã gửi.")
        if int(args["depositAmount"]) != int(expected_deposit):
            raise ValueError("depositAmount trong sự kiện LoanCreated không khớp tiền cọc thiết bị.")

        on_chain = self.get_loan(expected_loan_id_hex)
        if on_chain["loan_id"] == ZERO_BYTES32_HEX or int(on_chain["request_time"]) == 0:
            raise ValueError("Bản ghi đơn mượn không tồn tại trên Smart Contract sau giao dịch.")
        if (
            on_chain["loan_id"] != expected_loan_id_hex
            or int(on_chain["equipment_id"]) != int(expected_equipment_id)
            or str(on_chain["student_id"]) != str(expected_student_id)
            or str(on_chain["borrower"]).lower() != expected_borrower_checksum.lower()
            or int(on_chain["expected_handover"]) != int(expected_handover_ts)
            or int(on_chain["due_date"]) != int(expected_due_ts)
            or int(on_chain["deposit_amount"]) != int(expected_deposit)
        ):
            raise ValueError("Dữ liệu on-chain của đơn mượn không khớp với thông số gửi lên API.")

        return {
            "tx_hash": tx_hash_hex,
            "block_number": getattr(receipt, "block_number", getattr(receipt, "blockNumber", None)),
            "gas_used": getattr(receipt, "gas_used", getattr(receipt, "gasUsed", None)),
            "status": "CONFIRMED",
            "from_address": Web3.to_checksum_address(str(tx_from)),
            "to_address": Web3.to_checksum_address(str(receipt_to)),
            "on_chain_record": on_chain,
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
        self.ensure_ready(require_admin=False)

        loan_id_bytes: bytes = Web3.to_bytes(hexstr=normalize_hex_bytes32(loan_id, 32)) if isinstance(loan_id, str) else loan_id
        record = self.contract.functions.getLoan(loan_id_bytes).call()

        return {
            "loan_id": normalize_hex_bytes32(record[0], 32),
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
            - ConnectionError / RuntimeError: Nếu node offline hoặc chưa deploy contract.
        Tác dụng phụ:
            - Đọc on-chain (call).
        """
        self.ensure_ready(require_admin=False)
        loan_id_bytes: bytes = self._to_bytes32(loan_id)
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
            - ConnectionError / RuntimeError: Nếu node offline hoặc chưa deploy contract.
        Tác dụng phụ:
            - Đọc on-chain (call).
        """
        self.ensure_ready(require_admin=False)
        loan_id_bytes: bytes = self._to_bytes32(loan_id)
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
            - ConnectionError / RuntimeError: Khi node offline, sai mạng hoặc chưa deploy contract.
        """
        self.ensure_ready(require_admin=False)
        active_loan_bytes: bytes = self.contract.functions.activeEquipmentLoan(equipment_id).call()
        return normalize_hex_bytes32(active_loan_bytes, 32)

    # =========================================================================
    #                   SMART CONTRACT LIFECYCLE TRANSACTIONS
    # =========================================================================

    def _to_bytes32(self, loan_id: Union[bytes, str]) -> bytes:
        return Web3.to_bytes(hexstr=normalize_hex_bytes32(loan_id, 32))

    def create_loan(
        self,
        loan_id: Union[bytes, str],
        equipment_id: int,
        student_id: str,
        borrower_address: Optional[str],
        expected_handover: int,
        due_date: int,
        deposit_amount: int,
        on_broadcast: Optional[Callable[[str, str, Optional[str]], None]] = None,
        on_failed: Optional[Callable[[str, Optional[int], Optional[int], str], None]] = None,
    ) -> Dict[str, Any]:
        """
        Mục đích: Gửi transaction gọi hàm `createLoan` trên Smart Contract qua ví Admin Relayer.
        """
        self.ensure_ready(require_admin=True)
        checksum_borrower = Web3.to_checksum_address(borrower_address) if borrower_address else self.admin_account.address
        func = self.contract.functions.createLoan(
            self._to_bytes32(loan_id),
            equipment_id,
            student_id,
            checksum_borrower,
            expected_handover,
            due_date,
            deposit_amount
        )
        return self.send_transaction(func, on_broadcast=on_broadcast, on_failed=on_failed)

    def approve_loan(
        self,
        loan_id: Union[bytes, str],
        on_broadcast: Optional[Callable[[str, str, Optional[str]], None]] = None,
        on_failed: Optional[Callable[[str, Optional[int], Optional[int], str], None]] = None,
    ) -> Dict[str, Any]:
        """
        Mục đích: Gửi transaction gọi hàm `approveLoan` trên Smart Contract (khóa Mutex thiết bị).
        """
        self.ensure_ready(require_admin=True)
        func = self.contract.functions.approveLoan(self._to_bytes32(loan_id))
        return self.send_transaction(func, on_broadcast=on_broadcast, on_failed=on_failed)

    def confirm_handover(
        self,
        loan_id: Union[bytes, str],
        on_broadcast: Optional[Callable[[str, str, Optional[str]], None]] = None,
        on_failed: Optional[Callable[[str, Optional[int], Optional[int], str], None]] = None,
    ) -> Dict[str, Any]:
        """
        Mục đích: Gửi transaction gọi hàm `confirmHandover` trên Smart Contract (khóa tiền cọc mô phỏng).
        """
        self.ensure_ready(require_admin=True)
        func = self.contract.functions.confirmHandover(self._to_bytes32(loan_id))
        return self.send_transaction(func, on_broadcast=on_broadcast, on_failed=on_failed)

    def confirm_return(
        self,
        loan_id: Union[bytes, str],
        return_condition: int,
        penalty_percent: int = 0,
        on_broadcast: Optional[Callable[[str, str, Optional[str]], None]] = None,
        on_failed: Optional[Callable[[str, Optional[int], Optional[int], str], None]] = None,
    ) -> Dict[str, Any]:
        """
        Mục đích: Gửi transaction gọi hàm `confirmReturn` trên Smart Contract (tính phạt và giải phóng Mutex).
        """
        self.ensure_ready(require_admin=True)
        func = self.contract.functions.confirmReturn(self._to_bytes32(loan_id), return_condition, penalty_percent)
        return self.send_transaction(func, on_broadcast=on_broadcast, on_failed=on_failed)

    def cancel_loan(
        self,
        loan_id: Union[bytes, str],
        reason: str = "Borrower cancelled",
        on_broadcast: Optional[Callable[[str, str, Optional[str]], None]] = None,
        on_failed: Optional[Callable[[str, Optional[int], Optional[int], str], None]] = None,
    ) -> Dict[str, Any]:
        """
        Mục đích: Gửi transaction gọi hàm `cancelLoan` trên Smart Contract (hủy đơn và giải phóng Mutex nếu có).
        """
        self.ensure_ready(require_admin=True)
        func = self.contract.functions.cancelLoan(self._to_bytes32(loan_id), reason)
        return self.send_transaction(func, on_broadcast=on_broadcast, on_failed=on_failed)


# Singleton Instance dùng chung trong toàn bộ Backend
blockchain_service = BlockchainService()

