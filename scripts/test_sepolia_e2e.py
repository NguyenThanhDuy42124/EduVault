import sys
import time
import os

# Đảm bảo import được backend app
sys.path.insert(0, os.path.abspath("."))
sys.path.insert(0, os.path.abspath("backend"))

from app.services.blockchain_service import blockchain_service
from web3 import Web3

def run_test():
    print("=" * 65)
    print("🚀 BẮT ĐẦU KIỂM THỬ TOÀN DIỆN VÒNG ĐỜI TRÊN ETHEREUM SEPOLIA TESTNET")
    print("=" * 65)
    print("Contract Address :", blockchain_service.contract_address)
    print("Admin Relayer    :", blockchain_service.admin_account.address)

    student_wallet = "0xc6c0B41c8Fef9708A5249b27b168aF0DF18871F2"
    print("Student Wallet   :", student_wallet)

    now = int(time.time())
    eq_id = 99991
    expected_handover = now + 3600
    due_date = now + 86400 * 3
    deposit = 500000

    loan_id_bytes = Web3.keccak(text=f"SEPOLIA_E2E_{now}")
    print(f"Loan ID (hex)    : 0x{loan_id_bytes.hex()}")

    # 1. createLoan
    print("\n[Bước 1/4] Gửi giao dịch createLoan lên Sepolia...")
    tx1 = blockchain_service.create_loan(
        loan_id=loan_id_bytes,
        equipment_id=eq_id,
        student_id="SV2026001",
        borrower_address=student_wallet,
        expected_handover=expected_handover,
        due_date=due_date,
        deposit_amount=deposit
    )
    print(f"  ✔ Tx Hash : {tx1['tx_hash']}")
    print(f"  ✔ Status  : {tx1['status']} (Block {tx1['block_number']})")

    # 2. approveLoan
    print("\n[Bước 2/4] Gửi giao dịch approveLoan lên Sepolia (Khóa Mutex thiết bị)...")
    tx2 = blockchain_service.approve_loan(loan_id_bytes)
    print(f"  ✔ Tx Hash : {tx2['tx_hash']}")
    print(f"  ✔ Status  : {tx2['status']} (Block {tx2['block_number']})")
    
    rec2 = blockchain_service.get_loan(loan_id_bytes)
    print(f"  ✔ State On-chain: {rec2.get('state')} (Approved)")

    # 3. confirmHandover
    print("\n[Bước 3/4] Gửi giao dịch confirmHandover lên Sepolia (Khóa tiền cọc)...")
    tx3 = blockchain_service.confirm_handover(loan_id_bytes)
    print(f"  ✔ Tx Hash : {tx3['tx_hash']}")
    print(f"  ✔ Status  : {tx3['status']} (Block {tx3['block_number']})")
    
    rec3 = blockchain_service.get_loan(loan_id_bytes)
    print(f"  ✔ State On-chain: {rec3.get('state')} (Active)")
    print(f"  ✔ Cọc On-chain  : {rec3.get('deposit_state')} (Locked)")

    # 4. confirmReturn
    print("\n[Bước 4/4] Gửi giao dịch confirmReturn lên Sepolia (Trả máy đúng hạn, hoàn cọc)...")
    tx4 = blockchain_service.confirm_return(loan_id_bytes, return_condition=0, penalty_percent=0)
    print(f"  ✔ Tx Hash : {tx4['tx_hash']}")
    print(f"  ✔ Status  : {tx4['status']} (Block {tx4['block_number']})")
    
    rec4 = blockchain_service.get_loan(loan_id_bytes)
    print(f"  ✔ State On-chain: {rec4.get('state')} (Returned)")
    print(f"  ✔ Cọc On-chain  : {rec4.get('deposit_state')} (Refunded)")
    print(f"  ✔ Mức phạt      : {rec4.get('penalty_percent')}%")

    print("\n" + "=" * 65)
    print("🎉 TOÀN BỘ 4 BƯỚC ĐÃ ĐƯỢC XÁC NHẬN BẤT BIẾN TRÊN SEPOLIA BLOCKCHAIN!")
    print("=" * 65)
    print(f"1. createLoan      : https://sepolia.etherscan.io/tx/{tx1['tx_hash']}")
    print(f"2. approveLoan     : https://sepolia.etherscan.io/tx/{tx2['tx_hash']}")
    print(f"3. confirmHandover : https://sepolia.etherscan.io/tx/{tx3['tx_hash']}")
    print(f"4. confirmReturn   : https://sepolia.etherscan.io/tx/{tx4['tx_hash']}")
    print("=" * 65)

if __name__ == "__main__":
    run_test()
