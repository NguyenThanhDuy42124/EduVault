import re

path = 'frontend/src/pages/EquipmentPage.tsx'
with open(path, 'r', encoding='utf-8') as f:
    text = f.read()

# 1. Thêm import useWeb3
text = text.replace(
    "import { useAuth } from '../context/AuthContext';",
    "import { useAuth } from '../context/AuthContext';\nimport { useWeb3 } from '../context/Web3Context';"
)

# 2. Thêm hooks
text = text.replace(
    "  const { role } = useAuth();",
    "  const { role, user } = useAuth();\n  const { isConnected, isCorrectNetwork, connectWallet, switchNetwork, getContract } = useWeb3();\n  const [web3StatusMsg, setWeb3StatusMsg] = useState<string | null>(null);"
)

# 3. Ký MetaMask trực tiếp trong handleBorrowSubmit
old_submit = """    setSubmitting(true);
    setActionError(null);
    try {
      await loanService.requestLoan({
        equipment_id: selectedEquipment.id,
        expected_handover_date: new Date(expectedHandover).toISOString(),
        due_date: new Date(dueDate).toISOString(),
        admin_notes: notes.trim() || undefined,
      });

      setActionSuccess(
        'Đã gửi đơn mượn thành công! Đơn đang ở trạng thái Chờ duyệt. Bạn có thể theo dõi trong mục "Đơn mượn của tôi".'
      );"""

new_submit = """    setSubmitting(true);
    setActionError(null);
    setWeb3StatusMsg(null);
    try {
      let clientTxHash: string | undefined = undefined;
      if (isConnected && isCorrectNetwork) {
        setWeb3StatusMsg('Vui lòng bấm Xác nhận (Confirm) trên popup ví MetaMask...');
        const contract = await getContract(true);
        if (contract) {
          const mockLoanId = '0x' + Array.from(crypto.getRandomValues(new Uint8Array(32)))
            .map(b => b.toString(16).padStart(2, '0')).join('');
          const startTs = Math.floor(new Date(expectedHandover).getTime() / 1000);
          const dueTs = Math.floor(new Date(dueDate).getTime() / 1000);
          const depositNum = Number(selectedEquipment.deposit_amount) || 0;

          const tx = await contract.createLoan(
            mockLoanId,
            selectedEquipment.id,
            user?.student_staff_id || 'SV2026001',
            '0x0000000000000000000000000000000000000000',
            startTs,
            dueTs,
            depositNum
          );
          setWeb3StatusMsg('Giao dịch đang được đào trên block...');
          const receipt = await tx.wait();
          clientTxHash = receipt.hash;
        }
      }

      setWeb3StatusMsg('Đang lưu thông tin đơn mượn vào hệ thống...');
      await loanService.requestLoan({
        equipment_id: selectedEquipment.id,
        expected_handover_date: new Date(expectedHandover).toISOString(),
        due_date: new Date(dueDate).toISOString(),
        admin_notes: notes.trim() || undefined,
      });

      setActionSuccess(
        clientTxHash
          ? `Gửi đơn & Ký on-chain thành công qua MetaMask! Mã Tx: ${clientTxHash.slice(0, 10)}...`
          : 'Đã gửi đơn mượn thành công! Đơn đang ở trạng thái Chờ duyệt. Bạn có thể theo dõi trong mục "Đơn mượn của tôi".'
      );"""

text = text.replace(old_submit, new_submit)

# 4. Hiển thị thông báo MetaMask trong Modal
old_modal_note = """            {selectedEquipment && (
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg space-y-2">"""

new_modal_note = """            {/* Trạng thái kết nối ví MetaMask */}
            <div className={`p-3 rounded-lg border text-xs flex items-center justify-between ${
              isConnected
                ? isCorrectNetwork
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  : 'bg-amber-50 border-amber-200 text-amber-800'
                : 'bg-orange-50 border-orange-200 text-orange-800'
            }`}>
              <div className="flex items-center space-x-2">
                <span className="font-semibold">Trạng thái Web3:</span>
                <span>
                  {isConnected
                    ? isCorrectNetwork
                      ? 'Đã kết nối MetaMask (Sẵn sàng ký On-chain)'
                      : 'Sai mạng (Vui lòng chuyển sang Hardhat 31337)'
                    : 'Chưa kết nối ví (Sẽ gửi qua Relayer mặc định)'}
                </span>
              </div>
              {!isConnected && (
                <button
                  type="button"
                  onClick={connectWallet}
                  className="px-2.5 py-1 bg-orange-600 text-white rounded font-semibold text-[11px] hover:bg-orange-700 cursor-pointer"
                >
                  Kết nối ví
                </button>
              )}
              {isConnected && !isCorrectNetwork && (
                <button
                  type="button"
                  onClick={switchNetwork}
                  className="px-2.5 py-1 bg-amber-600 text-white rounded font-semibold text-[11px] hover:bg-amber-700 cursor-pointer"
                >
                  Đổi mạng
                </button>
              )}
            </div>

            {web3StatusMsg && (
              <div className="p-2.5 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-800 animate-pulse">
                {web3StatusMsg}
              </div>
            )}

            {selectedEquipment && (
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg space-y-2">"""

text = text.replace(old_modal_note, new_modal_note)

with open(path, 'w', encoding='utf-8') as f:
    f.write(text)
print('SUCCESS_UPDATED_EQUIPMENT_PAGE')

