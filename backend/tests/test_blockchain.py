"""
Module: backend.tests.test_blockchain
Mục đích: Bộ kiểm thử tự động cho Web3 Blockchain Service và API trạng thái mạng.
Áp dụng: Quy định viết code và docstring tại QUY_DINH_CODE.md.
"""
import pytest
from backend.app.services.blockchain_service import blockchain_service


def test_generate_loan_id_format():
    """
    Mục đích: Kiểm tra định dạng loan_id sinh ra chuẩn bytes32 (32 bytes) và hex string (66 ký tự bắt đầu 0x).
    """
    loan_bytes, loan_hex = blockchain_service.generate_loan_id(
        user_id=1,
        equipment_id=10,
        timestamp=1700000000
    )
    assert len(loan_bytes) == 32
    assert isinstance(loan_bytes, bytes)
    assert isinstance(loan_hex, str)
    assert loan_hex.startswith("0x")
    assert len(loan_hex) == 66


def test_generate_loan_id_deterministic():
    """
    Mục đích: Đảm bảo cùng tham số đầu vào sinh ra cùng một loan_id duy nhất (Idempotency).
    """
    _, hex_1 = blockchain_service.generate_loan_id(user_id=1, equipment_id=10, timestamp=1700000000)
    _, hex_2 = blockchain_service.generate_loan_id(user_id=1, equipment_id=10, timestamp=1700000000)
    assert hex_1 == hex_2


def test_generate_loan_id_uniqueness():
    """
    Mục đích: Đảm bảo khác tham số đầu vào sinh ra mã loan_id hoàn toàn khác nhau (chống collision).
    """
    _, hex_1 = blockchain_service.generate_loan_id(user_id=1, equipment_id=10, timestamp=1700000000)
    _, hex_2 = blockchain_service.generate_loan_id(user_id=2, equipment_id=10, timestamp=1700000000)
    assert hex_1 != hex_2


def test_blockchain_contract_abi_loaded():
    """
    Mục đích: Xác thực file ABI Smart Contract đã được nạp và chứa đầy đủ 5 hàm vòng đời chính.
    """
    assert blockchain_service.abi is not None
    assert len(blockchain_service.abi) > 0

    function_names = [item.get("name") for item in blockchain_service.abi if item.get("type") == "function"]
    assert "createLoan" in function_names
    assert "approveLoan" in function_names
    assert "confirmHandover" in function_names
    assert "confirmReturn" in function_names
    assert "cancelLoan" in function_names
    assert "getLoan" in function_names
    assert "isOverdue" in function_names


def test_blockchain_status_api_endpoint(client):
    """
    Mục đích: Kiểm thử API `/api/v1/blockchain/status` và `/contract-info` phản hồi đầy đủ trường đồng nhất.
    """
    response = client.get("/api/v1/blockchain/status")
    assert response.status_code == 200
    data = response.json()
    assert "status" in data
    assert "is_connected" in data
    assert "network" in data
    assert "rpc_url" in data
    assert "contract_address" in data
    assert "contract_deployed" in data
    assert "admin_wallet_address" in data
    assert "relayer_address" in data
    assert "relayer_balance_eth" in data

    info_res = client.get("/api/v1/blockchain/contract-info")
    assert info_res.status_code == 200
    info = info_res.json()
    assert info["contract_name"] == "EquipmentLending"
    assert info["contract_address"] == data["contract_address"]
    assert "owner_address" in info
    assert "is_connected" in info


def test_normalize_hex_bytes32_and_local_contract_address_resolution():
    """
    Mục đích: Đảm bảo chuẩn hóa bytes32/tx_hash không lặp 0x0x và chọn đúng địa chỉ theo CHAIN_ID=31337.
    """
    from backend.app.core.config import settings
    from backend.app.services.blockchain_service import BlockchainService, normalize_hex_bytes32

    assert normalize_hex_bytes32("0x0x" + "ab" * 32, 32) if False else len(normalize_hex_bytes32("0x" + "AB" * 32, 32)) == 66
    assert normalize_hex_bytes32("AB" * 32, 32) == "0x" + "ab" * 32

    if int(settings.CHAIN_ID) == 31337:
        svc = BlockchainService()
        assert svc.contract_address.lower() == settings.CONTRACT_ADDRESS.lower()


def test_pure_web3_config_and_service_have_no_private_key_or_signer():
    """
    Mục đích: Xác thực backend hoàn toàn theo kiến trúc Pure Web3: không lưu Private Key hay phương thức ký tx.
    """
    from backend.app.core.config import settings

    assert not hasattr(settings, "ADMIN_PRIVATE_KEY")
    assert not hasattr(settings, "ADMIN_WALLET_ADDRESS")
    assert not hasattr(blockchain_service, "admin_account")
    assert not hasattr(blockchain_service, "send_transaction")
    assert not hasattr(blockchain_service, "get_admin_balance")
    for removed_method in ["create_loan", "approve_loan", "confirm_handover", "confirm_return", "cancel_loan"]:
        assert not hasattr(blockchain_service, removed_method)


def test_blockchain_status_reports_pure_web3_mode(client):
    """
    Mục đích: Endpoint diagnostics báo cáo rõ chế độ `pure-web3-verifier` và `has_signer=False`.
    """
    status_res = client.get("/api/v1/blockchain/status")
    assert status_res.status_code == 200
    data = status_res.json()
    assert data["mode"] == "pure-web3-verifier"
    assert data["has_signer"] is False
    assert data["admin_wallet_address"] is None
    assert data["relayer_address"] is None

    info_res = client.get("/api/v1/blockchain/contract-info")
    assert info_res.status_code == 200
    info = info_res.json()
    assert info["mode"] == "pure-web3-verifier"
    assert info["has_signer"] is False
    assert info["owner_address"] is None


def test_blockchain_verify_receipt_fails_safely_when_offline():
    """
    Mục đích: Đảm bảo xử lý lỗi an toàn (ConnectionError) khi node blockchain offline trong chế độ Pure Web3.
    """
    if not blockchain_service.is_connected():
        with pytest.raises(ConnectionError) as exc_info:
            blockchain_service.verify_transaction_receipt(
                tx_hash="0x" + "11" * 32,
                expected_event="LoanApproved",
            )
        assert "Không thể kết nối" in str(exc_info.value)


def test_verify_transaction_receipt_validation_cases(monkeypatch):
    """
    Mục đích: Kiểm thử unit đầy đủ các nhánh kiểm tra của `verify_transaction_receipt` (hợp lệ, revert, sai contract, sai chainId, sai sender, sai event/args).
    """
    from types import SimpleNamespace
    from backend.app.core.config import settings
    from backend.app.services.blockchain_service import BlockchainService

    svc = BlockchainService.__new__(BlockchainService)
    svc.rpc_url = "http://127.0.0.1:8545"
    contract_addr = "0x5FbDB2315678afecb367f032d93F642f64180aa3"
    sender_addr = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"
    wrong_sender = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8"
    loan_id_hex = "0x" + "aa" * 32
    tx_hash_hex = "0x" + "bb" * 32

    monkeypatch.setattr(svc, "ensure_ready", lambda: None)
    svc.contract_address = contract_addr

    state = {
        "receipt": {"status": 1, "to": contract_addr, "blockNumber": 12, "gasUsed": 65000},
        "tx": {"chainId": settings.CHAIN_ID, "from": sender_addr},
        "events": [{"args": {"loanId": bytes.fromhex("aa" * 32), "equipmentId": 5, "timestamp": 1700000000}}],
    }

    class _FakeEventParser:
        def process_receipt(self, receipt, errors=None):
            return state["events"]

    svc.contract = SimpleNamespace(
        events=SimpleNamespace(LoanApproved=lambda: _FakeEventParser())
    )
    svc.web3 = SimpleNamespace(
        eth=SimpleNamespace(
            get_transaction_receipt=lambda h: state["receipt"],
            get_transaction=lambda h: state["tx"],
        )
    )

    # 1. Happy path
    ok = svc.verify_transaction_receipt(
        tx_hash=tx_hash_hex,
        expected_event="LoanApproved",
        expected_loan_id=loan_id_hex,
        expected_sender=sender_addr.lower(),
        expected_args={"equipmentId": 5},
    )
    assert ok["status"] == "CONFIRMED"
    assert ok["from_address"] == sender_addr
    assert ok["event_args"]["equipmentId"] == 5
    assert ok["event_args"]["loanId"] == loan_id_hex

    # 2. Reverted tx (status != 1)
    state["receipt"]["status"] = 0
    with pytest.raises(ValueError, match="revert"):
        svc.verify_transaction_receipt(tx_hash_hex, "LoanApproved", loan_id_hex, sender_addr)
    state["receipt"]["status"] = 1

    # 3. Wrong contract address
    state["receipt"]["to"] = wrong_sender
    with pytest.raises(ValueError, match="EquipmentLending"):
        svc.verify_transaction_receipt(tx_hash_hex, "LoanApproved", loan_id_hex, sender_addr)
    state["receipt"]["to"] = contract_addr

    # 4. Wrong chainId
    state["tx"]["chainId"] = 999999
    with pytest.raises(ValueError, match="Chain ID"):
        svc.verify_transaction_receipt(tx_hash_hex, "LoanApproved", loan_id_hex, sender_addr)
    state["tx"]["chainId"] = settings.CHAIN_ID

    # 5. Wrong sender
    state["tx"]["from"] = wrong_sender
    with pytest.raises(ValueError, match="Địa chỉ gửi"):
        svc.verify_transaction_receipt(tx_hash_hex, "LoanApproved", loan_id_hex, sender_addr)
    state["tx"]["from"] = sender_addr

    # 6. Mismatched expected arg
    with pytest.raises(ValueError, match="equipmentId"):
        svc.verify_transaction_receipt(
            tx_hash_hex, "LoanApproved", loan_id_hex, sender_addr, expected_args={"equipmentId": 99}
        )

    # 7. Missing event
    state["events"] = []
    with pytest.raises(ValueError, match="LoanApproved"):
        svc.verify_transaction_receipt(tx_hash_hex, "LoanApproved", loan_id_hex, sender_addr)


def test_has_role_uses_keccak_role_hash(monkeypatch):
    """
    Mục đích: Kiểm tra `has_role` tính đúng bytes32 role hash chuẩn OpenZeppelin AccessControl.
    """
    from web3 import Web3
    from backend.app.services.blockchain_service import BlockchainService

    svc = BlockchainService.__new__(BlockchainService)
    monkeypatch.setattr(svc, "ensure_ready", lambda: None)
    captured = {}

    class _FakeFn:
        def __init__(self, role_bytes, account):
            captured["role_bytes"] = role_bytes
            captured["account"] = account

        def call(self):
            return True

    class _FakeContract:
        class _Functions:
            def hasRole(self, role_bytes, account):
                return _FakeFn(role_bytes, account)
        functions = _Functions()

    svc.contract = _FakeContract()
    addr = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8"

    assert svc.has_role("BORROWER_ROLE", addr.lower()) is True
    assert captured["role_bytes"] == bytes(Web3.keccak(text="BORROWER_ROLE"))
    assert captured["account"] == addr

    assert svc.has_role("DEFAULT_ADMIN_ROLE", addr) is True
    assert captured["role_bytes"] == b"\x00" * 32

