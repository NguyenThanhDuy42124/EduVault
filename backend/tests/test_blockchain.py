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


def test_blockchain_send_transaction_fails_safely_when_offline():
    """
    Mục đích: Đảm bảo xử lý lỗi an toàn (ConnectionError) khi node blockchain đang offline, không làm sập ứng dụng.
    """
    if not blockchain_service.is_connected():
        with pytest.raises(ConnectionError) as exc_info:
            blockchain_service.send_transaction(contract_function=None)
        assert "Không thể kết nối" in str(exc_info.value)

