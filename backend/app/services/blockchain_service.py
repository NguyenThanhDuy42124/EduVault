"""
Module: backend.app.services.blockchain_service
Mục đích: Kết nối mạng Blockchain EVM (Hardhat local / Sepolia) theo kiến trúc Pure Web3 Read-Only,
          xác thực biên lai giao dịch MetaMask từ client và truy vấn trạng thái Smart Contract `EquipmentLending`.
Áp dụng: Quy định viết code và docstring tại QUY_DINH_CODE.md.
"""
import json
import os
from typing import Any, Dict, Optional, Tuple, Union
from web3 import Web3
from web3.contract import Contract
from web3.exceptions import TransactionNotFound
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
    Lớp dịch vụ Pure Web3 Read-Only Indexer & Receipt Verifier giao tiếp giữa FastAPI và Smart Contract EVM.
    Đảm nhiệm:
      1. Khởi tạo kết nối Web3 RPC.
      2. Kiểm tra điều kiện sẵn sàng của node RPC và bytecode Smart Contract.
      3. Xác thực biên lai (Receipt, Chain ID, Sender, Event Logs) cho mọi giao dịch MetaMask từ client.
      4. Đọc trạng thái bất biến (View functions, Role on-chain) từ Smart Contract.
    """

    def __init__(self) -> None:
        """
        Mục đích: Khởi tạo kết nối Web3 và nạp thông tin Smart Contract đã deploy (không lưu Private Key).
        """
        self.rpc_url: str = settings.BLOCKCHAIN_RPC_URL
        self.web3: Web3 = Web3(Web3.HTTPProvider(self.rpc_url))
        self.contract: Optional[Contract] = None
        self.contract_address: Optional[str] = None
        self.abi: Optional[list] = None

        self._load_contract_info()

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

    def ensure_ready(self) -> None:
        """
        Mục đích: Kiểm tra pre-flight node RPC online, đúng Chain ID và có bytecode Smart Contract tại `contract_address`.
        Lỗi:
            - ConnectionError: Khi node offline, sai Chain ID hoặc chưa deploy contract tại địa chỉ cấu hình.
            - RuntimeError: Khi chưa khởi tạo contract ABI/address.
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

    @staticmethod
    def _serialize_event_args(args_obj: Any) -> Dict[str, Any]:
        serialized: Dict[str, Any] = {}
        for key, value in dict(args_obj).items():
            if isinstance(value, (bytes, bytearray)):
                serialized[key] = (
                    normalize_hex_bytes32(value, 32)
                    if len(value) == 32
                    else "0x" + bytes(value).hex()
                )
            else:
                serialized[key] = value
        return serialized

    @staticmethod
    def _matches_event_arg(actual_val: Any, expected_val: Any) -> bool:
        if isinstance(expected_val, bool):
            return bool(actual_val) == expected_val
        if isinstance(expected_val, int):
            return int(actual_val) == expected_val
        if isinstance(actual_val, (bytes, bytearray)):
            return normalize_hex_bytes32(actual_val, len(actual_val)) == normalize_hex_bytes32(
                expected_val, len(actual_val)
            )
        if isinstance(expected_val, str) and Web3.is_address(expected_val):
            return str(actual_val).lower() == expected_val.lower()
        return str(actual_val) == str(expected_val)

    def verify_transaction_receipt(
        self,
        tx_hash: str,
        expected_event: str,
        expected_loan_id: Optional[Union[bytes, str]] = None,
        expected_sender: Optional[str] = None,
        expected_args: Optional[Dict[str, Any]] = None,
        wait_timeout: int = 30,
    ) -> Dict[str, Any]:
        """
        Mục đích: Xác thực biên lai giao dịch MetaMask trực tiếp trên node RPC (Pure Web3 Receipt Verifier).
        Kiểm tra:
          1. Giao dịch tồn tại và đã được khai thác thành công (`status == 1`).
          2. Địa chỉ đích `to` khớp với Smart Contract `EquipmentLending` cấu hình.
          3. `chainId` của giao dịch (nếu có) khớp với `settings.CHAIN_ID`.
          4. Địa chỉ người gửi `from` khớp với `expected_sender` (nếu cung cấp).
          5. Biên lai phát sự kiện `expected_event`, khớp `expected_loan_id` và `expected_args`.
        """
        self.ensure_ready()

        tx_hash_hex = normalize_hex_bytes32(tx_hash, 32)
        expected_loan_id_hex = (
            normalize_hex_bytes32(expected_loan_id, 32) if expected_loan_id is not None else None
        )
        expected_sender_checksum = (
            Web3.to_checksum_address(expected_sender) if expected_sender else None
        )

        try:
            receipt = self.web3.eth.get_transaction_receipt(tx_hash_hex)
        except TransactionNotFound:
            try:
                receipt = self.web3.eth.wait_for_transaction_receipt(tx_hash_hex, timeout=wait_timeout)
            except Exception as exc:
                raise ValueError(
                    f"Không tìm thấy giao dịch {tx_hash_hex} trên blockchain hoặc chưa được khai thác."
                ) from exc

        try:
            tx = self.web3.eth.get_transaction(tx_hash_hex)
        except TransactionNotFound as exc:
            raise ValueError(f"Không truy vấn được chi tiết giao dịch {tx_hash_hex}.") from exc

        receipt_status = receipt.get("status") if isinstance(receipt, dict) else getattr(receipt, "status", 0)
        if receipt_status != 1:
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
        if not tx_from:
            raise ValueError(f"Không xác định được địa chỉ người gửi cho giao dịch {tx_hash_hex}.")
        if expected_sender_checksum and str(tx_from).lower() != expected_sender_checksum.lower():
            raise ValueError(
                f"Địa chỉ gửi giao dịch ({tx_from}) không khớp với ví đã xác minh ({expected_sender_checksum})."
            )

        event_factory = getattr(self.contract.events, expected_event, None)
        if event_factory is None:
            raise ValueError(f"Sự kiện {expected_event} không tồn tại trong ABI Smart Contract.")

        events = event_factory().process_receipt(receipt, errors=DISCARD)
        matched_event = None
        if expected_loan_id_hex is not None:
            for ev in events:
                ev_loan_id = ev["args"].get("loanId") if isinstance(ev["args"], dict) else ev["args"]["loanId"]
                if ev_loan_id is not None and normalize_hex_bytes32(ev_loan_id, 32) == expected_loan_id_hex:
                    matched_event = ev
                    break
        elif events:
            matched_event = events[0]

        if not matched_event:
            suffix = f" cho loanId {expected_loan_id_hex}" if expected_loan_id_hex else ""
            raise ValueError(
                f"Biên lai giao dịch {tx_hash_hex} không phát sự kiện {expected_event}{suffix}."
            )

        args = matched_event["args"]
        if expected_args:
            for arg_name, expected_val in expected_args.items():
                if arg_name not in args:
                    raise ValueError(f"Thiếu tham số {arg_name} trong sự kiện {expected_event}.")
                actual_val = args[arg_name]
                if not self._matches_event_arg(actual_val, expected_val):
                    raise ValueError(
                        f"Tham số {arg_name} trong sự kiện {expected_event} không khớp "
                        f"({actual_val} != {expected_val})."
                    )

        block_number = (
            receipt.get("blockNumber")
            if isinstance(receipt, dict)
            else getattr(receipt, "block_number", getattr(receipt, "blockNumber", None))
        )
        gas_used = (
            receipt.get("gasUsed")
            if isinstance(receipt, dict)
            else getattr(receipt, "gas_used", getattr(receipt, "gasUsed", None))
        )

        return {
            "tx_hash": tx_hash_hex,
            "block_number": block_number,
            "gas_used": gas_used,
            "status": "CONFIRMED",
            "from_address": Web3.to_checksum_address(str(tx_from)),
            "to_address": Web3.to_checksum_address(str(receipt_to)),
            "event_name": expected_event,
            "event_args": self._serialize_event_args(args),
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
        Mục đích: Xác thực biên lai giao dịch MetaMask `createLoan` trực tiếp trên RPC (chống giả mạo tx_hash / on_chain_loan_id).
        """
        expected_loan_id_hex = normalize_hex_bytes32(expected_loan_id, 32)
        expected_borrower_checksum = Web3.to_checksum_address(expected_borrower_address)
        expected_sender_checksum = Web3.to_checksum_address(expected_sender_address or expected_borrower_address)

        verified = self.verify_transaction_receipt(
            tx_hash=tx_hash,
            expected_event="LoanCreated",
            expected_loan_id=expected_loan_id_hex,
            expected_sender=expected_sender_checksum,
            expected_args={
                "equipmentId": int(expected_equipment_id),
                "studentId": str(expected_student_id),
                "borrower": expected_borrower_checksum,
                "dueDate": int(expected_due_ts),
                "depositAmount": int(expected_deposit),
            },
        )

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

        verified["on_chain_record"] = on_chain
        return verified

    # =========================================================================
    #                      SMART CONTRACT VIEW FUNCTIONS
    # =========================================================================

    def _to_bytes32(self, loan_id: Union[bytes, str]) -> bytes:
        return Web3.to_bytes(hexstr=normalize_hex_bytes32(loan_id, 32))

    def has_role(self, role_name: str, account_address: str) -> bool:
        """
        Mục đích: Kiểm tra một địa chỉ ví có nắm giữ role AccessControl trên Smart Contract không.
        Tham số:
            - role_name (str): Tên role (`'BORROWER_ROLE'`, `'ADMIN_ROLE'`, `'DEFAULT_ADMIN_ROLE'`).
            - account_address (str): Địa chỉ ví EVM cần kiểm tra.
        Trả về:
            - bool: True nếu địa chỉ ví sở hữu role trên Smart Contract.
        """
        self.ensure_ready()
        checksum_account = Web3.to_checksum_address(account_address)
        role_bytes = (
            b"\x00" * 32
            if role_name == "DEFAULT_ADMIN_ROLE"
            else bytes(Web3.keccak(text=role_name))
        )
        return bool(self.contract.functions.hasRole(role_bytes, checksum_account).call())

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
        self.ensure_ready()

        loan_id_bytes: bytes = self._to_bytes32(loan_id)
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
        self.ensure_ready()
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
        self.ensure_ready()
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
        self.ensure_ready()
        active_loan_bytes: bytes = self.contract.functions.activeEquipmentLoan(equipment_id).call()
        return normalize_hex_bytes32(active_loan_bytes, 32)


# Singleton Instance dùng chung trong toàn bộ Backend
blockchain_service = BlockchainService()

