import React, { useState } from 'react';
import { ethers } from 'ethers';
import { PendingBorrower } from '../../services/adminRoleService';

interface BorrowerRoleSectionProps {
  isAdmin: boolean;
  pendingBorrowers: PendingBorrower[];
  loading: boolean;
  getContract: (withSigner?: boolean) => Promise<ethers.Contract | null>;
  parseWeb3Error: (err: unknown) => string;
  onSuccess: () => void;
}

export const BorrowerRoleSection: React.FC<BorrowerRoleSectionProps> = ({
  isAdmin,
  pendingBorrowers,
  loading,
  getContract,
  parseWeb3Error,
  onSuccess,
}) => {
  const [manualAddress, setManualAddress] = useState('');
  const [processingAddr, setProcessingAddr] = useState<string | null>(null);
  const [actionMsg, setActionMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleRegisterBorrower = async (address: string) => {
    if (!ethers.isAddress(address)) {
      setActionMsg({ type: 'error', text: 'Dia chi vi khong hop le.' });
      return;
    }
    setProcessingAddr(address);
    setActionMsg(null);
    try {
      const contract = await getContract(true);
      if (!contract) throw new Error('Khong the ket noi Smart Contract.');
      const tx = await contract.registerBorrower(ethers.getAddress(address));
      await tx.wait();
      setActionMsg({ type: 'success', text: `Da cap BORROWER_ROLE thanh cong cho vi ${address}` });
      if (manualAddress.toLowerCase() === address.toLowerCase()) {
        setManualAddress('');
      }
      onSuccess();
    } catch (err) {
      setActionMsg({ type: 'error', text: parseWeb3Error(err) });
    } finally {
      setProcessingAddr(null);
    }
  };

  const handleRevokeBorrower = async (address: string) => {
    if (!ethers.isAddress(address)) {
      setActionMsg({ type: 'error', text: 'Dia chi vi khong hop le.' });
      return;
    }
    setProcessingAddr(address);
    setActionMsg(null);
    try {
      const contract = await getContract(true);
      if (!contract) throw new Error('Khong the ket noi Smart Contract.');
      const tx = await contract.revokeBorrower(ethers.getAddress(address));
      await tx.wait();
      setActionMsg({ type: 'success', text: `Da thu hoi BORROWER_ROLE cua vi ${address}` });
      onSuccess();
    } catch (err) {
      setActionMsg({ type: 'error', text: parseWeb3Error(err) });
    } finally {
      setProcessingAddr(null);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
      <div className="border-b border-slate-100 pb-3">
        <h2 className="text-base font-bold text-slate-900">Cap quyen Sinh vien (Borrower Role)</h2>
        <p className="text-xs text-slate-500 mt-1">
          Admin (ADMIN_ROLE) cap quyen BORROWER_ROLE on-chain cho sinh vien da xac minh vi de tao don muon thiet bi.
        </p>
      </div>

      {!isAdmin && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
          Luu y: Chi cac vi so huu ADMIN_ROLE moi co the goi registerBorrower tren Smart Contract.
        </div>
      )}

      {actionMsg && (
        <div
          className={`p-3 rounded-lg text-xs ${
            actionMsg.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : 'bg-rose-50 text-rose-800 border border-rose-200'
          }`}
        >
          {actionMsg.text}
        </div>
      )}

      {/* Manual register form */}
      <div className="flex gap-2">
        <input
          type="text"
          value={manualAddress}
          onChange={(e) => setManualAddress(e.target.value.trim())}
          placeholder="Nhap dia chi vi sinh vien (0x...)"
          disabled={!isAdmin || processingAddr !== null}
          className="flex-1 px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
        />
        <button
          type="button"
          onClick={() => handleRegisterBorrower(manualAddress)}
          disabled={!isAdmin || processingAddr !== null || !manualAddress}
          className="px-4 py-2 bg-slate-900 text-white text-xs font-semibold rounded-lg hover:bg-slate-800 disabled:opacity-50 transition-colors"
        >
          {processingAddr === manualAddress ? 'Dang ky...' : 'Cap quyen on-chain'}
        </button>
      </div>

      {/* Table of pending verified borrowers */}
      <div className="pt-2">
        <h3 className="text-xs font-bold text-slate-800 mb-2">
          Danh sach sinh vien da xac minh vi qua EIP-191 ({pendingBorrowers.length})
        </h3>

        {loading ? (
          <div className="py-6 text-center text-xs text-slate-500">Dang tai danh sach...</div>
        ) : pendingBorrowers.length === 0 ? (
          <div className="py-4 text-center text-xs text-slate-500 bg-slate-50 rounded-lg">
            Tat ca sinh vien da xac minh vi deu da so huu BORROWER_ROLE on-chain.
          </div>
        ) : (
          <div className="overflow-x-auto border border-slate-200 rounded-lg">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                <tr>
                  <th className="py-2.5 px-3">MSSV</th>
                  <th className="py-2.5 px-3">Ho ten</th>
                  <th className="py-2.5 px-3">Dia chi vi</th>
                  <th className="py-2.5 px-3">Trang thai</th>
                  <th className="py-2.5 px-3 text-right">Thao tac</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pendingBorrowers.map((b) => (
                  <tr key={b.id} className="hover:bg-slate-50/50">
                    <td className="py-2.5 px-3 font-semibold text-slate-900">{b.student_staff_id}</td>
                    <td className="py-2.5 px-3 text-slate-800">{b.full_name}</td>
                    <td className="py-2.5 px-3 font-mono text-slate-600" title={b.wallet_address}>
                      {b.wallet_address.slice(0, 8)}...{b.wallet_address.slice(-6)}
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                        Cho cap on-chain
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right space-x-2">
                      <button
                        type="button"
                        onClick={() => handleRegisterBorrower(b.wallet_address)}
                        disabled={!isAdmin || processingAddr !== null}
                        className="px-2.5 py-1 bg-slate-900 text-white text-[11px] font-semibold rounded hover:bg-slate-800 disabled:opacity-50"
                      >
                        {processingAddr === b.wallet_address ? 'Dang xu ly...' : 'Cap BORROWER_ROLE'}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRevokeBorrower(b.wallet_address)}
                        disabled={!isAdmin || processingAddr !== null}
                        className="px-2 py-1 bg-rose-50 text-rose-700 border border-rose-200 text-[11px] font-semibold rounded hover:bg-rose-100 disabled:opacity-50"
                      >
                        Thu hoi
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
