"""
Module: scripts.test_phase16_multi_user_e2e
Muc dich: Kiem thu tich hop da nguoi dung Multi-Admin va Sinh vien (Phase 16 Cross-Wallet E2E).
Kich ban:
  1. Khoi tao 4 vi rieng biet (Deployer, Admin 2, Admin 3, Sinh vien).
  2. Deployer goi addAdmin cap quyen ADMIN_ROLE cho Admin 2 va Admin 3.
  3. Admin 2 goi registerBorrower cap quyen BORROWER_ROLE cho Sinh vien.
  4. Sinh vien tu ky giao dich createLoan tren on-chain.
  5. Admin 2 tu ky giao dich approveLoan (khoa Mutex thiet bi).
  6. Admin 3 tu ky giao dich confirmHandover (khoa tien coc).
  7. Admin 1 (Deployer) tu ky giao dich confirmReturn (tra may dung han, hoan coc).
  8. Xac minh toan ven: Receipt Verifier, doi soat on-chain, giai phong Mutex.
Ap dung: Quy dinh viet code va docstring tai QUY_DINH_CODE.md, khong su dung icon.
"""
import os
import sys
import time
from typing import Dict, Any
from web3 import Web3
from eth_account import Account

sys.path.insert(0, os.path.abspath("."))
sys.path.insert(0, os.path.abspath("backend"))

from backend.app.core.config import settings
from backend.app.services.blockchain_service import (
    blockchain_service,
    normalize_hex_bytes32,
    ZERO_BYTES32_HEX
)


class MultiUserE2ETestRunner:
    """
    Trinh thuc thi kiem thu chu trinh da vi lien nguoi dung tren Smart Contract.
    """

    def __init__(self, w3: Web3, contract, deployer_acct, admin2_acct, admin3_acct, student_acct):
        self.w3 = w3
        self.contract = contract
        self.deployer = deployer_acct
        self.admin2 = admin2_acct
        self.admin3 = admin3_acct
        self.student = student_acct
        self.admin_role = Web3.keccak(text="ADMIN_ROLE")
        self.borrower_role = Web3.keccak(text="BORROWER_ROLE")

    def _send_tx(self, sender_acct, func_call) -> Dict[str, Any]:
        """
        Ky va gui giao dich voi tai khoan chi dinh, cho receipt mined.
        """
        nonce = self.w3.eth.get_transaction_count(sender_acct.address)
        chain_id = self.w3.eth.chain_id
        tx = func_call.build_transaction({
            "from": sender_acct.address,
            "nonce": nonce,
            "chainId": chain_id,
            "gas": 400000,
            "gasPrice": self.w3.eth.gas_price
        })
        signed = sender_acct.sign_transaction(tx)
        tx_hash = self.w3.eth.send_raw_transaction(signed.raw_transaction)
        receipt = self.w3.eth.wait_for_transaction_receipt(tx_hash, timeout=60)
        assert receipt["status"] == 1, f"Giao dich {tx_hash.hex()} bi revert!"
        return {
            "tx_hash": tx_hash.hex(),
            "block_number": receipt["blockNumber"],
            "gas_used": receipt["gasUsed"],
            "receipt": receipt
        }

    def run_step_1_add_admins(self):
        """
        Buoc 1: Deployer cap ADMIN_ROLE cho Admin 2 va Admin 3.
        """
        print("[Buoc 1/6] Deployer phan quyen Multi-Admin on-chain...")
        res2 = self._send_tx(self.deployer, self.contract.functions.addAdmin(self.admin2.address))
        print(f"  - Cap ADMIN_ROLE cho Admin 2: {self.admin2.address}")
        print(f"    Tx Hash: {res2['tx_hash']} (Block {res2['block_number']})")

        res3 = self._send_tx(self.deployer, self.contract.functions.addAdmin(self.admin3.address))
        print(f"  - Cap ADMIN_ROLE cho Admin 3: {self.admin3.address}")
        print(f"    Tx Hash: {res3['tx_hash']} (Block {res3['block_number']})")

        assert self.contract.functions.hasRole(self.admin_role, self.admin2.address).call() is True
        assert self.contract.functions.hasRole(self.admin_role, self.admin3.address).call() is True
        print("  -> Xac nhan: Ca Admin 2 va Admin 3 da co ADMIN_ROLE on-chain.")

    def run_step_2_register_borrower(self):
        """
        Buoc 2: Admin 2 cap BORROWER_ROLE cho Sinh vien.
        """
        print("\n[Buoc 2/6] Admin 2 cap quyen BORROWER_ROLE cho Sinh vien...")
        res = self._send_tx(self.admin2, self.contract.functions.registerBorrower(self.student.address))
        print(f"  - Sinh vien: {self.student.address}")
        print(f"    Tx Hash: {res['tx_hash']} (Block {res['block_number']})")

        assert self.contract.functions.hasRole(self.borrower_role, self.student.address).call() is True
        print("  -> Xac nhan: Sinh vien da co BORROWER_ROLE on-chain.")

    def run_step_3_student_create_loan(self, equipment_id: int, student_id: str, deposit: int):
        """
        Buoc 3: Sinh vien ky tao don createLoan on-chain.
        """
        print("\n[Buoc 3/6] Sinh vien ky createLoan tren vi cua minh...")
        now = int(time.time())
        loan_id_bytes = Web3.keccak(text=f"CROSS_WALLET_LOAN_{now}")
        loan_id_hex = normalize_hex_bytes32(loan_id_bytes, 32)
        expected_handover = now + 3600
        due_date = now + 86400 * 3

        res = self._send_tx(
            self.student,
            self.contract.functions.createLoan(
                loan_id_bytes,
                equipment_id,
                student_id,
                self.student.address,
                expected_handover,
                due_date,
                deposit
            )
        )
        print(f"  - Loan ID  : {loan_id_hex}")
        print(f"  - Signer   : {self.student.address}")
        print(f"    Tx Hash  : {res['tx_hash']} (Block {res['block_number']})")

        rec = self.contract.functions.getLoan(loan_id_bytes).call()
        assert rec[10] == 0, f"Trang thai on-chain phai la Submitted (0), nhan {rec[10]}"
        print("  -> Xac nhan: Don o trang thai Submitted (0).")
        return {
            "loan_id_bytes": loan_id_bytes,
            "loan_id_hex": loan_id_hex,
            "tx_hash": res["tx_hash"],
            "expected_handover": expected_handover,
            "due_date": due_date
        }

    def run_step_4_admin2_approve(self, loan_id_bytes: bytes, equipment_id: int):
        """
        Buoc 4: Admin 2 ky approveLoan (khoa Mutex thiet bi).
        """
        print("\n[Buoc 4/6] Admin 2 ky approveLoan tren vi cua minh...")
        res = self._send_tx(self.admin2, self.contract.functions.approveLoan(loan_id_bytes))
        print(f"  - Signer   : {self.admin2.address} (Admin 2)")
        print(f"    Tx Hash  : {res['tx_hash']} (Block {res['block_number']})")

        rec = self.contract.functions.getLoan(loan_id_bytes).call()
        assert rec[10] == 1, f"Trang thai phai la Approved (1), nhan {rec[10]}"

        active_mutex = self.contract.functions.activeEquipmentLoan(equipment_id).call()
        assert active_mutex == loan_id_bytes, "Mutex thiet bi chua khoa dung loan_id"
        print("  -> Xac nhan: Don o trang thai Approved (1) va Mutex thiet bi da duoc khoa.")
        return res

    def run_step_5_admin3_handover(self, loan_id_bytes: bytes):
        """
        Buoc 5: Admin 3 ky confirmHandover (khoa tien coc).
        """
        print("\n[Buoc 5/6] Admin 3 ky confirmHandover tren vi cua minh...")
        res = self._send_tx(self.admin3, self.contract.functions.confirmHandover(loan_id_bytes))
        print(f"  - Signer   : {self.admin3.address} (Admin 3)")
        print(f"    Tx Hash  : {res['tx_hash']} (Block {res['block_number']})")

        rec = self.contract.functions.getLoan(loan_id_bytes).call()
        assert rec[10] == 2, f"Trang thai phai la Active (2), nhan {rec[10]}"
        assert rec[11] == 1, f"Trang thai coc phai la Locked (1), nhan {rec[11]}"
        print("  -> Xac nhan: Don o trang thai Active (2) va Tien coc da duoc khoa on-chain.")
        return res

    def run_step_6_deployer_return(self, loan_id_bytes: bytes, equipment_id: int):
        """
        Buoc 6: Admin 1 (Deployer) ky confirmReturn dung han (0% penalty, giai phong Mutex).
        """
        print("\n[Buoc 6/6] Admin 1 (Deployer) ky confirmReturn tren vi cua minh...")
        res = self._send_tx(self.deployer, self.contract.functions.confirmReturn(loan_id_bytes, 0))
        print(f"  - Signer   : {self.deployer.address} (Admin 1 / Deployer)")
        print(f"    Tx Hash  : {res['tx_hash']} (Block {res['block_number']})")

        rec = self.contract.functions.getLoan(loan_id_bytes).call()
        assert rec[10] == 3, f"Trang thai phai la Returned (3), nhan {rec[10]}"
        assert rec[11] == 2, f"Trang thai coc phai la Refunded (2), nhan {rec[11]}"
        assert rec[12] == 0, f"Muc phat phai la 0%, nhan {rec[12]}"

        active_mutex = self.contract.functions.activeEquipmentLoan(equipment_id).call()
        assert normalize_hex_bytes32(active_mutex, 32) == ZERO_BYTES32_HEX, "Mutex thiet bi chua duoc giai phong!"
        print("  -> Xac nhan: Don Returned (3), Tien coc Refunded (2), Muc phat 0%, Mutex giai phong.")
        return res


def run_multi_user_e2e():
    """
    Diem khoi chay kiem thu Multi-User E2E.
    """
    print("=" * 75)
    print("EDUVAULT - KIEM THU TICH HOP DA NGUOI DUNG (PHASE 16 MULTI-USER E2E)")
    print("Kien truc Pure Web3: Ky so Client-Side rieng biet cho tung vai tro")
    print("=" * 75)

    w3 = blockchain_service.web3
    if not w3.is_connected():
        print("[-] RPC khong ket noi duoc. Kiem tra BLOCKCHAIN_RPC_URL.")
        sys.exit(1)

    print(f"Connected RPC : {settings.BLOCKCHAIN_RPC_URL}")
    print(f"Chain ID      : {w3.eth.chain_id}")

    # Su dung cac account Hardhat co san neu dang o local, hoac sinh key testnet
    deployer_pk = os.environ.get("DEPLOYER_PRIVATE_KEY", "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80")
    admin2_pk = os.environ.get("ADMIN2_PRIVATE_KEY", "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d")
    admin3_pk = os.environ.get("ADMIN3_PRIVATE_KEY", "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a")
    student_pk = os.environ.get("STUDENT_PRIVATE_KEY", "0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6")

    deployer = Account.from_key(deployer_pk)
    admin2 = Account.from_key(admin2_pk)
    admin3 = Account.from_key(admin3_pk)
    student = Account.from_key(student_pk)

    print(f"Deployer (Admin 1) : {deployer.address}")
    print(f"Admin 2            : {admin2.address}")
    print(f"Admin 3            : {admin3.address}")
    print(f"Student (Borrower) : {student.address}")
    print("-" * 75)

    contract = blockchain_service.contract
    assert contract is not None, "Contract instance chua duoc khoi tao!"

    runner = MultiUserE2ETestRunner(w3, contract, deployer, admin2, admin3, student)

    equipment_id = int(time.time()) % 100000 + 1000
    deposit_amount = 500000

    runner.run_step_1_add_admins()
    runner.run_step_2_register_borrower()
    loan_info = runner.run_step_3_student_create_loan(equipment_id, "SV2026001", deposit_amount)
    runner.run_step_4_admin2_approve(loan_info["loan_id_bytes"], equipment_id)
    runner.run_step_5_admin3_handover(loan_info["loan_id_bytes"])
    runner.run_step_6_deployer_return(loan_info["loan_id_bytes"], equipment_id)

    print("\n" + "=" * 75)
    print("KET QUA: TOAN BO CHU TRINH LIEN VI (MULTI-USER E2E) THANH CONG 100%!")
    print("=" * 75)


if __name__ == "__main__":
    run_multi_user_e2e()

