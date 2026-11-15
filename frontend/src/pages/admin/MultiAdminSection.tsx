import React, { useState } from 'react';
import { ethers } from 'ethers';

interface MultiAdminSectionProps {
  isDeployer: boolean;
  account: string | null;
  getContract: (withSigner?: boolean) => Promise<ethers.Contract | null>;
  parseWeb3Error: (err: unknown) => string;
  onSuccess: () => void;
}

export const MultiAdminSection: React.FC<MultiAdminSectionProps> = ({
  isDeployer,
  getContract,
  parseWeb3Error,
  onSuccess,
}) => {
  const [adminAddress, setAdminAddress] = useState('');
  const [loading, setLoading] = useState(false);
  const [actionMsg, setActionMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleAddAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminAddress || !ethers.isAddress(adminAddress)) {
      setActionMsg({ type: 'error', text: 'Dia chi vi Ethereum khong hop le.' });
      return;
    }
    setLoading(true);
    setActionMsg(null);
    try {
      const contract = await getContract(true);
      if (!contract) throw new Error('Khong the ket noi Smart Contract.');
      const tx = await contract.addAdmin(ethers.getAddress(adminAddress));
      await tx.wait();
      setActionMsg({ type: 'success', text: `Da cap quyen ADMIN_ROLE thanh cong cho vi ${adminAddress}` });
      setAdminAddress('');
      onSuccess();
    } catch (err) {
      setActionMsg({ type: 'error', text: parseWeb3Error(err) });
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveAdmin = async () => {
    if (!adminAddress || !ethers.isAddress(adminAddress)) {
      setActionMsg({ type: 'error', text: 'Dia chi vi Ethereum khong hop le.' });
      return;
    }
    setLoading(true);
    setActionMsg(null);
    try {
      const contract = await getContract(true);
      if (!contract) throw new Error('Khong the ket noi Smart Contract.');
      const tx = await contract.removeAdmin(ethers.getAddress(adminAddress));
      await tx.wait();
      setActionMsg({ type: 'success', text: `Da thu hoi quyen ADMIN_ROLE cua vi ${adminAddress}` });
      setAdminAddress('');
      onSuccess();
    } catch (err) {
      setActionMsg({ type: 'error', text: parseWeb3Error(err) });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
      <div className="border-b border-slate-100 pb-3">
        <h2 className="text-base font-bold text-slate-900">Quan tri vien Nhom (Multi-Admin)</h2>
        <p className="text-xs text-slate-500 mt-1">
          Deployer (DEFAULT_ADMIN_ROLE) cap quyen ADMIN_ROLE cho cac thanh vien trong nhom de cung duyet don.
        </p>
      </div>

      {!isDeployer && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
          Luu y: Chi vi Deployer (DEFAULT_ADMIN_ROLE) moi co quyen them hoac thu hoi ADMIN_ROLE tren Smart Contract.
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

      <form onSubmit={handleAddAdmin} className="space-y-3">
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Dia chi vi Ethereum thanh vien (0x...)
          </label>
          <input
            type="text"
            value={adminAddress}
            onChange={(e) => setAdminAddress(e.target.value.trim())}
            placeholder="0x..."
            disabled={!isDeployer || loading}
            className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 disabled:bg-slate-50"
          />
        </div>

        <div className="flex items-center space-x-3 pt-1">
          <button
            type="submit"
            disabled={!isDeployer || loading}
            className="px-4 py-2 bg-slate-900 text-white text-xs font-semibold rounded-lg hover:bg-slate-800 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Dang xu ly...' : 'Cap quyen Admin (addAdmin)'}
          </button>

          <button
            type="button"
            onClick={handleRemoveAdmin}
            disabled={!isDeployer || loading}
            className="px-4 py-2 bg-rose-50 text-rose-700 border border-rose-200 text-xs font-semibold rounded-lg hover:bg-rose-100 disabled:opacity-50 transition-colors"
          >
            Thu hoi quyen Admin (removeAdmin)
          </button>
        </div>
      </form>
    </div>
  );
};
