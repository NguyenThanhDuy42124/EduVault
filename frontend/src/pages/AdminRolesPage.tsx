import React, { useEffect, useState, useCallback } from 'react';
import { useWeb3 } from '../context/Web3Context';
import { adminRoleService, PendingBorrower } from '../services/adminRoleService';
import { authService } from '../services/authService';
import { MultiAdminSection } from './admin/MultiAdminSection';
import { BorrowerRoleSection } from './admin/BorrowerRoleSection';
import { TARGET_CHAIN_NAME } from '../contracts/contractConfig';

export const AdminRolesPage: React.FC = () => {
  const { account, isConnected, isCorrectNetwork, isDeployer, isAdmin, getContract, parseWeb3Error, refreshRoles } =
    useWeb3();

  const [pendingBorrowers, setPendingBorrowers] = useState<PendingBorrower[]>([]);
  const [loadingBorrowers, setLoadingBorrowers] = useState(false);

  // Create off-chain DB account (ADMIN or BORROWER)
  const [newStudentId, setNewStudentId] = useState('');
  const [newFullName, setNewFullName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<'ADMIN' | 'BORROWER'>('ADMIN');
  const [newWallet, setNewWallet] = useState('');
  const [creatingAccount, setCreatingAccount] = useState(false);
  const [createMsg, setCreateMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

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

  const handleCreateDbAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreatingAccount(true);
    setCreateMsg(null);
    try {
      const created = await authService.createUser({
        student_staff_id: newStudentId.trim(),
        full_name: newFullName.trim(),
        email: newEmail.trim().toLowerCase(),
        password: newPassword,
        role: newRole,
        wallet_address: newWallet.trim() || undefined,
      });
      setCreateMsg({
        type: 'success',
        text: `Đã tạo tài khoản ${created.role} (${created.email}) thành công trong CSDL MySQL.`,
      });
      setNewStudentId('');
      setNewFullName('');
      setNewEmail('');
      setNewPassword('');
      setNewWallet('');
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { detail?: string } } };
      setCreateMsg({
        type: 'error',
        text: axiosErr.response?.data?.detail || 'Không thể tạo tài khoản trong CSDL.',
      });
    } finally {
      setCreatingAccount(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Phân quyền Smart Contract</h1>
          <p className="text-sm text-slate-600 mt-1 max-w-xl leading-relaxed">
            Cấp quyền giao dịch trên Smart Contract và quản lý tài khoản quản trị viên / sinh viên.
          </p>
        </div>

        <button
          type="button"
          onClick={handleRefreshAll}
          className="px-3.5 py-1.5 bg-white border border-slate-300 text-slate-700 text-xs font-semibold rounded-lg hover:bg-slate-50 transition-colors self-start md:self-auto"
        >
          Làm mới trạng thái on-chain
        </button>
      </div>

      {/* Role badges overview */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200">
          <span className="text-xs font-medium text-slate-500 block">Ví đang kết nối</span>
          <span className="text-xs font-mono font-bold text-slate-900 truncate block mt-1" title={account || ''}>
            {account ? `${account.slice(0, 10)}...${account.slice(-8)}` : 'Chưa kết nối'}
          </span>
          <span className="text-[11px] text-slate-400 block mt-0.5">Mạng: {TARGET_CHAIN_NAME}</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200">
          <span className="text-xs font-medium text-slate-500 block">Quyền Deployer</span>
          <span
            className={`text-sm font-bold block mt-1 ${
              isDeployer ? 'text-emerald-600' : 'text-slate-400'
            }`}
          >
            {isDeployer ? 'Đã xác nhận (Deployer)' : 'Không phải Deployer'}
          </span>
          <span className="text-[11px] text-slate-400 block mt-0.5">Quản lý danh sách Admin</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200">
          <span className="text-xs font-medium text-slate-500 block">Quyền Admin Phòng Lab</span>
          <span
            className={`text-sm font-bold block mt-1 ${
              isAdmin ? 'text-indigo-600' : 'text-slate-400'
            }`}
          >
            {isAdmin ? 'Đã có quyền Admin' : 'Chưa có quyền Admin'}
          </span>
          <span className="text-[11px] text-slate-400 block mt-0.5">Duyệt, bàn giao & cấp quyền SV</span>
        </div>
      </div>

      {!isConnected && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
          Vui lòng kết nối ví MetaMask trên thanh điều hướng để kiểm tra và thực hiện các thao tác phân quyền.
        </div>
      )}

      {isConnected && !isCorrectNetwork && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800">
          MetaMask đang kết nối sai mạng. Vui lòng chuyển sang mạng {TARGET_CHAIN_NAME} để tiếp tục.
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

      {/* Create Off-Chain Account (ADMIN / BORROWER) */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
        <div className="border-b border-slate-100 pb-3">
          <h2 className="text-base font-bold text-slate-900">
            Tạo tài khoản đăng nhập mới
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Tạo tài khoản trong CSDL (kèm tùy chọn gán ví MetaMask). Nếu cấp vai trò Quản trị viên, cần thêm ví đó vào mục Quản trị viên hệ thống phía trên để duyệt đơn on-chain.
          </p>
        </div>

        {createMsg && (
          <div
            className={`p-3 rounded-lg text-xs ${
              createMsg.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                : 'bg-rose-50 text-rose-800 border border-rose-200'
            }`}
          >
            {createMsg.text}
          </div>
        )}

        <form onSubmit={handleCreateDbAccount} className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Mã cán bộ / MSSV
            </label>
            <input
              type="text"
              required
              minLength={3}
              value={newStudentId}
              onChange={(e) => setNewStudentId(e.target.value)}
              placeholder="ADMIN002 hoặc SV2026010"
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Họ và tên</label>
            <input
              type="text"
              required
              minLength={2}
              value={newFullName}
              onChange={(e) => setNewFullName(e.target.value)}
              placeholder="Nguyễn Văn B"
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Email</label>
            <input
              type="email"
              required
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder="admin2@eduvault.edu.vn"
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Mật khẩu khởi tạo</label>
            <input
              type="password"
              required
              minLength={6}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Tối thiểu 6 ký tự"
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Vai trò CSDL</label>
            <select
              value={newRole}
              onChange={(e) => setNewRole(e.target.value as 'ADMIN' | 'BORROWER')}
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 bg-white"
            >
              <option value="ADMIN">Quản trị viên (ADMIN)</option>
              <option value="BORROWER">Sinh viên (BORROWER)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Địa chỉ ví MetaMask (tùy chọn)
            </label>
            <input
              type="text"
              value={newWallet}
              onChange={(e) => setNewWallet(e.target.value)}
              placeholder="0x..."
              className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
          </div>

          <div className="md:col-span-2 pt-1">
            <button
              type="submit"
              disabled={creatingAccount}
              className="px-4 py-2 bg-slate-900 text-white text-xs font-semibold rounded-lg hover:bg-slate-800 disabled:opacity-50 transition-colors cursor-pointer"
            >
              {creatingAccount ? 'Đang tạo...' : 'Tạo tài khoản trong MySQL'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
