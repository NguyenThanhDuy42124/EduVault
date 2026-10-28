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


@router.get(
    "/status",
    status_code=status.HTTP_200_OK,
    summary="Kiểm tra trạng thái kết nối Blockchain EVM",
    description="Truy vấn thông số mạng Hardhat local: RPC URL, Chain ID, Contract Address, Block Number và ví Relayer."
)
def get_blockchain_status() -> Dict[str, Any]:
    """
    Mục đích: Cung cấp thông tin chẩn đoán kết nối mạng Web3 cho hệ thống và Dashboard kiểm toán.
    Trả về:
        - Dict[str, Any]: Trạng thái kết nối, thông tin mạng và số dư ví Admin.
    Lỗi:
        - Không.
    Tác dụng phụ:
        - Đọc thông số qua JSON-RPC.
    """
    is_online: bool = blockchain_service.is_connected()
    return {
        "status": "online" if is_online else "offline",
        "rpc_url": settings.BLOCKCHAIN_RPC_URL,
        "chain_id": blockchain_service.get_chain_id(),
        "contract_address": blockchain_service.contract_address,
        "latest_block": blockchain_service.get_block_number(),
        "admin_wallet_address": blockchain_service.admin_account.address if blockchain_service.admin_account else None,
        "admin_balance_eth": str(blockchain_service.get_admin_balance()),
    }

