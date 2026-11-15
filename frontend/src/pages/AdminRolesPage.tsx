import React, { useEffect, useState, useCallback } from 'react';
import { useWeb3 } from '../context/Web3Context';
import { adminRoleService, PendingBorrower } from '../services/adminRoleService';
import { MultiAdminSection } from './admin/MultiAdminSection';
import { BorrowerRoleSection } from './admin/BorrowerRoleSection';
import { TARGET_CHAIN_NAME } from '../contracts/contractConfig';

export const AdminRolesPage: React.FC = () => {
  const { account, isConnected, isCorrectNetwork, isDeployer, isAdmin, getContract, parseWeb3Error, refreshRoles } =
    useWeb3();

  const [pendingBorrowers, setPendingBorrowers] = useState<PendingBorrower[]>([]);
  const [loadingBorrowers, setLoadingBorrowers] = useState(false);

  const fetchPending = useCallback(async () => {
    setLoadingBorrowers(true);
    try {
      const data = await adminRoleService.getPendingBorrowers();
      setPendingBorrowers(data);
    } catch {
      // Ignore error
    } finally {
      setLoadingBorrowers(false);
    }
  }, []);

  useEffect(() => {
    fetchPending();
  }, [fetchPending]);

  const handleRefreshAll = () => {
    refreshRoles();
    fetchPending();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Phan quyen Smart Contract</h1>
          <p className="text-sm text-slate-600 mt-1 max-w-xl leading-relaxed">
            Quan ly vai tro Multi-Admin cho nhom du an va cap quyen BORROWER_ROLE on-chain cho sinh vien.
          </p>
        </div>

        <button
          type="button"
          onClick={handleRefreshAll}
          className="px-3.5 py-1.5 bg-white border border-slate-300 text-slate-700 text-xs font-semibold rounded-lg hover:bg-slate-50 transition-colors self-start md:self-auto"
        >
          Lam moi trang thai on-chain
        </button>
      </div>

      {/* Role badges overview */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200">
          <span className="text-xs font-medium text-slate-500 block">Vi dang ket noi</span>
          <span className="text-xs font-mono font-bold text-slate-900 truncate block mt-1" title={account || ''}>
            {account ? `${account.slice(0, 10)}...${account.slice(-8)}` : 'Chua ket noi'}
          </span>
          <span className="text-[11px] text-slate-400 block mt-0.5">Mang: {TARGET_CHAIN_NAME}</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200">
          <span className="text-xs font-medium text-slate-500 block">Quyen Deployer (Owner)</span>
          <span
            className={`text-sm font-bold block mt-1 ${
              isDeployer ? 'text-emerald-600' : 'text-slate-400'
            }`}
          >
            {isDeployer ? 'DA XAC NHAN (DEFAULT_ADMIN_ROLE)' : 'Khong phai Deployer'}
          </span>
          <span className="text-[11px] text-slate-400 block mt-0.5">Quan ly danh sach Admin</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200">
          <span className="text-xs font-medium text-slate-500 block">Quyen Admin Phong Lab</span>
          <span
            className={`text-sm font-bold block mt-1 ${
              isAdmin ? 'text-indigo-600' : 'text-slate-400'
            }`}
          >
            {isAdmin ? 'DA XAC NHAN (ADMIN_ROLE)' : 'Chua co ADMIN_ROLE'}
          </span>
          <span className="text-[11px] text-slate-400 block mt-0.5">Duyet, ban giao & cap quyen SV</span>
        </div>
      </div>

      {!isConnected && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
          Vui long ket noi vi MetaMask tren thanh dieu huong de kiem tra va thuc hien cac thao tac phan quyen.
        </div>
      )}

      {isConnected && !isCorrectNetwork && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800">
          MetaMask dang ket noi sai mang. Vui long chuyen sang mang {TARGET_CHAIN_NAME} de tiep tuc.
        </div>
      )}

      <MultiAdminSection
        isDeployer={isDeployer}
        account={account}
        getContract={getContract}
        parseWeb3Error={parseWeb3Error}
        onSuccess={handleRefreshAll}
      />

      <BorrowerRoleSection
        isAdmin={isAdmin}
        pendingBorrowers={pendingBorrowers}
        loading={loadingBorrowers}
        getContract={getContract}
        parseWeb3Error={parseWeb3Error}
        onSuccess={handleRefreshAll}
      />
    </div>
  );
};
