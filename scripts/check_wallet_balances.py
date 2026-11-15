"""
Module: scripts.check_wallet_balances
Muc dich: Kiem tra so du ETH/SepETH va quyen han on-chain (DEFAULT_ADMIN_ROLE, ADMIN_ROLE, BORROWER_ROLE)
cua cac vi thanh vien trong he thong EduVault.
Ap dung: Quy dinh viet code va docstring tai QUY_DINH_CODE.md, khong su dung icon.
"""
import os
import sys
from web3 import Web3

sys.path.insert(0, os.path.abspath("."))
sys.path.insert(0, os.path.abspath("backend"))

from backend.app.core.config import settings
from backend.app.services.blockchain_service import blockchain_service


DEFAULT_WALLETS = [
    {
        "role_label": "Deployer / Admin 1",
        "address": "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
        "note": "Hardhat Account #0 (Deployer contract)"
    },
    {
        "role_label": "Admin 2 (Thanh vien nhom)",
        "address": "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
        "note": "Hardhat Account #1"
    },
    {
        "role_label": "Admin 3 (Thanh vien nhom)",
        "address": "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
        "note": "Hardhat Account #2"
    },
    {
        "role_label": "Sinh vien (Nguoi muon)",
        "address": "0x90F79bf6EB2c4f870365E785982E1f101E93b906",
        "note": "Hardhat Account #3"
    }
]


def check_balances(custom_wallets=None):
    """
    Kiem tra so du va quyen han cua danh sach vi.
    """
    wallets = custom_wallets or DEFAULT_WALLETS
    w3 = blockchain_service.web3
    contract = blockchain_service.contract

    print("=" * 75)
    print("EDUVAULT - KIEM TRA SO DU VA PHAN QUYEN VI MULTI-WALLET")
    print("=" * 75)
    print(f"RPC URL          : {settings.BLOCKCHAIN_RPC_URL}")
    print(f"Contract Address : {blockchain_service.contract_address}")
    print(f"Network Chain ID : {settings.CHAIN_ID}")
    print("-" * 75)

    default_admin_role = b"\x00" * 32
    admin_role = Web3.keccak(text="ADMIN_ROLE")
    borrower_role = Web3.keccak(text="BORROWER_ROLE")

    for item in wallets:
        addr = Web3.to_checksum_address(item["address"])
        role_label = item["role_label"]
        note = item.get("note", "")

        try:
            balance_wei = w3.eth.get_balance(addr)
            balance_eth = w3.from_wei(balance_wei, "ether")
        except Exception as exc:
            balance_eth = f"Loi doc so du: {exc}"

        has_default_admin = False
        has_admin = False
        has_borrower = False

        if contract:
            try:
                has_default_admin = contract.functions.hasRole(default_admin_role, addr).call()
                has_admin = contract.functions.hasRole(admin_role, addr).call()
                has_borrower = contract.functions.hasRole(borrower_role, addr).call()
            except Exception as exc:
                print(f"[!] Loi doc role cua {addr}: {exc}")

        print(f"Vai tro     : {role_label}")
        print(f"Dia chi vi  : {addr}")
        print(f"Chu thich   : {note}")
        print(f"So du       : {balance_eth} ETH")
        print(f"Deployer    : {'CO' if has_default_admin else 'KHONG'}")
        print(f"ADMIN_ROLE  : {'CO' if has_admin else 'KHONG'}")
        print(f"BORROWER    : {'CO' if has_borrower else 'KHONG'}")
        print("-" * 75)


if __name__ == "__main__":
    check_balances()
