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
  const [checkingRole, setCheckingRole] = useState(false);
  const [actionMsg, setActionMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleCheckRole = async () => {
    if (!adminAddress || !ethers.isAddress(adminAddress)) {
      setActionMsg({ type: 'error', text: 'Địa chỉ ví Ethereum không hợp lệ.' });
      return;
    }
    setCheckingRole(true);
    setActionMsg(null);
    try {
      const contract = await getContract(false);
      if (!contract) throw new Error('Không thể kết nối Smart Contract.');
      const normalized = ethers.getAddress(adminAddress);
      const adminRoleHash = await contract.ADMIN_ROLE();
      const hasAdmin = Boolean(await contract.hasRole(adminRoleHash, normalized));
      setActionMsg({
        type: hasAdmin ? 'success' : 'error',
        text: hasAdmin
          ? `Ví ${normalized} ĐÃ CÓ quyền ADMIN_ROLE trên Smart Contract.`
          : `Ví ${normalized} CHƯA CÓ quyền ADMIN_ROLE trên Smart Contract.`,
      });
    } catch (err) {
      setActionMsg({ type: 'error', text: parseWeb3Error(err) });
    } finally {
      setCheckingRole(false);
    }
  };

  const handleAddAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminAddress || !ethers.isAddress(adminAddress)) {
      setActionMsg({ type: 'error', text: 'Địa chỉ ví Ethereum không hợp lệ.' });
      return;
    }
    setLoading(true);
    setActionMsg(null);
    try {
      const contract = await getContract(true);
      if (!contract) throw new Error('Không thể kết nối Smart Contract.');
      const tx = await contract.addAdmin(ethers.getAddress(adminAddress));
      await tx.wait();
      setActionMsg({ type: 'success', text: `Đã cấp quyền ADMIN_ROLE thành công cho ví ${adminAddress}` });
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
      setActionMsg({ type: 'error', text: 'Địa chỉ ví Ethereum không hợp lệ.' });
      return;
    }
    setLoading(true);
    setActionMsg(null);
    try {
      const contract = await getContract(true);
      if (!contract) throw new Error('Không thể kết nối Smart Contract.');
      const tx = await contract.removeAdmin(ethers.getAddress(adminAddress));
      await tx.wait();
      setActionMsg({ type: 'success', text: `Đã thu hồi quyền ADMIN_ROLE của ví ${adminAddress}` });
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
        <h2 className="text-base font-bold text-slate-900">Quản trị viên hệ thống</h2>
      </div>

      {!isDeployer && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 space-y-1">
          <p>
            Chỉ ví Deployer gốc mới có quyền thêm hoặc thu hồi quyền quản trị viên trên Smart Contract.
          </p>
          <p className="font-mono text-[11px]">
            Ví Deployer Sepolia hiện tại: 0x6396121f971a55bc844301E039F6C6F472C5CbBB
          </p>
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
            Địa chỉ ví Ethereum thành viên (0x...)
          </label>
          <input
            type="text"
            value={adminAddress}
            onChange={(e) => setAdminAddress(e.target.value.trim())}
            placeholder="0x..."
            disabled={loading}
            className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 disabled:bg-slate-50"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2.5 pt-1">
          <button
            type="submit"
            disabled={!isDeployer || loading || !adminAddress}
            className="px-4 py-2 bg-slate-900 text-white text-xs font-semibold rounded-lg hover:bg-slate-800 disabled:opacity-50 transition-colors cursor-pointer"
          >
            {loading ? 'Đang xử lý...' : 'Cấp quyền Admin (addAdmin)'}
          </button>

          <button
            type="button"
            onClick={handleCheckRole}
            disabled={checkingRole || loading || !adminAddress}
            className="px-3.5 py-2 bg-white text-slate-700 border border-slate-300 text-xs font-semibold rounded-lg hover:bg-slate-50 disabled:opacity-50 transition-colors cursor-pointer"
          >
            {checkingRole ? 'Đang kiểm tra...' : 'Kiểm tra quyền On-chain'}
          </button>

          <button
            type="button"
            onClick={handleRemoveAdmin}
            disabled={!isDeployer || loading || !adminAddress}
            className="px-4 py-2 bg-rose-50 text-rose-700 border border-rose-200 text-xs font-semibold rounded-lg hover:bg-rose-100 disabled:opacity-50 transition-colors cursor-pointer"
          >
            Thu hồi quyền Admin (removeAdmin)
          </button>
        </div>
      </form>
    </div>
  );
};
