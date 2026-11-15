"""
Module: backend.app.api.v1.blockchain
Mục đích: Router cung cấp các thông tin chẩn đoán trạng thái mạng Blockchain và Smart Contract.
Áp dụng: Quy định viết code và docstring tại QUY_DINH_CODE.md.
"""
from typing import Any, Dict
from fastapi import APIRouter, status
from backend.app.core.config import settings
from backend.app.services.blockchain_service import blockchain_service

router = APIRouter(prefix="/blockchain", tags=["Blockchain Diagnostics"])


def _resolve_network_name(chain_id: int) -> str:
    if chain_id == 11155111:
        return "sepolia"
    if chain_id == 31337:
        return "hardhat-local"
    return f"chain-{chain_id}"


def _is_contract_deployed() -> bool:
    try:
        blockchain_service.ensure_ready()
        return True
    except Exception:
        return False


@router.get(
    "/status",
    status_code=status.HTTP_200_OK,
    summary="Kiểm tra trạng thái kết nối Blockchain EVM",
    description="Truy vấn thông số mạng EVM hiện hành ở chế độ Pure Web3 Read-Only: RPC URL, Chain ID, Contract Address và Block Number."
)
def get_blockchain_status() -> Dict[str, Any]:
    """
    Mục đích: Cung cấp thông tin chẩn đoán kết nối mạng Web3 cho hệ thống và Dashboard kiểm toán.
    """
    is_online: bool = blockchain_service.is_connected()
    live_chain_id = blockchain_service.get_chain_id()
    effective_chain_id = live_chain_id or settings.CHAIN_ID
    return {
        "status": "online" if is_online else "offline",
        "mode": "pure-web3-verifier",
        "has_signer": False,
        "is_connected": is_online,
        "network": _resolve_network_name(int(effective_chain_id)),
        "rpc_url": settings.BLOCKCHAIN_RPC_URL,
        "chain_id": live_chain_id,
        "expected_chain_id": settings.CHAIN_ID,
        "contract_address": blockchain_service.contract_address,
        "contract_deployed": _is_contract_deployed(),
        "latest_block": blockchain_service.get_block_number(),
        "admin_wallet_address": None,
        "admin_balance_eth": "0.00",
        "relayer_address": None,
        "relayer_balance_eth": "0.00",
    }


@router.get(
    "/contract-info",
    status_code=status.HTTP_200_OK,
    summary="Lấy chi tiết thông tin Smart Contract",
    description="Trả về địa chỉ contract, tên contract, chainId và trạng thái triển khai (Pure Web3 Read-Only)."
)
def get_contract_info() -> Dict[str, Any]:
    """
    Mục đích: Cung cấp thông tin chi tiết Smart Contract phục vụ trang kiểm toán AuditPage và Showcase.
    """
    is_online: bool = blockchain_service.is_connected()
    live_chain_id = blockchain_service.get_chain_id()
    effective_chain_id = live_chain_id or settings.CHAIN_ID
    return {
        "contract_name": "EquipmentLending",
        "mode": "pure-web3-verifier",
        "has_signer": False,
        "contract_address": blockchain_service.contract_address,
        "chain_id": effective_chain_id,
        "network": _resolve_network_name(int(effective_chain_id)),
        "admin_wallet_address": None,
        "owner_address": None,
        "relayer_address": None,
        "relayer_balance_eth": "0.00",
        "admin_balance_eth": "0.00",
        "latest_block": blockchain_service.get_block_number(),
        "contract_deployed": _is_contract_deployed(),
        "is_connected": is_online,
    }

