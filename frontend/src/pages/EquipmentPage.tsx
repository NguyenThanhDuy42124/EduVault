import React, { useEffect, useState, useMemo } from 'react';
import { ethers } from 'ethers';
import { useAuth } from '../context/AuthContext';
import { useWeb3 } from '../context/Web3Context';
import { TARGET_CHAIN_ID, TARGET_CHAIN_NAME } from '../contracts/contractConfig';
import { authService } from '../services/authService';
import { equipmentService } from '../services/equipmentService';
import { loanService } from '../services/loanService';
import { Equipment } from '../types';
import { StatusBadge } from '../components/StatusBadge';
import { Modal } from '../components/Modal';
import { CardSkeleton } from '../components/LoadingSkeleton';
import { EmptyState } from '../components/EmptyState';
import {
  Search,
  CheckCircle2,
  Calendar,
  AlertCircle,
  FileText,
  ShieldAlert,
  SlidersHorizontal,
  Laptop,
  Tablet,
  Tv,
  Activity,
  Cpu,
  Package,
} from 'lucide-react';

export const EquipmentPage: React.FC = () => {
  const { role, user, refreshProfile } = useAuth();
  const {
    account,
    isConnected,
    isCorrectNetwork,
    connectWallet,
    switchNetwork,
    getContract,
    signMessage,
    verifyDeployedContract,
    parseWeb3Error,
  } = useWeb3();
  const [web3StatusMsg, setWeb3StatusMsg] = useState<string | null>(null);
  const [verifyingWallet, setVerifyingWallet] = useState(false);
  const [equipmentList, setEquipmentList] = useState<Equipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');

  // Borrow Modal State
  const [borrowModalOpen, setBorrowModalOpen] = useState(false);
  const [selectedEquipment, setSelectedEquipment] = useState<Equipment | null>(null);
  const [expectedHandover, setExpectedHandover] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const fetchEquipment = async () => {
    setLoading(true);
    try {
      const data = await equipmentService.getAll();
      setEquipmentList(data);
    } catch {
      // Handled gracefully
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEquipment();
  }, []);

  // Compute Categories
  const categories = useMemo(() => {
    const set = new Set(equipmentList.map((item) => item.category));
    return ['ALL', ...Array.from(set)];
  }, [equipmentList]);

  // Filter items
  const filteredItems = useMemo(() => {
    return equipmentList.filter((item) => {
      const matchesSearch =
        item.name.toLowerCase().includes(search.toLowerCase()) ||
        item.serial_number.toLowerCase().includes(search.toLowerCase()) ||
        (item.specifications && item.specifications.toLowerCase().includes(search.toLowerCase()));

      const matchesCat = selectedCategory === 'ALL' || item.category === selectedCategory;
      const matchesStat = selectedStatus === 'ALL' || item.status === selectedStatus;

      return matchesSearch && matchesCat && matchesStat;
    });
  }, [equipmentList, search, selectedCategory, selectedStatus]);

  const handleOpenBorrowModal = (item: Equipment) => {
    setSelectedEquipment(item);
    setActionError(null);
    setActionSuccess(null);

    // Default dates: tomorrow at 08:00, due in 3 days at 17:00
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(8, 0, 0, 0);

    const due = new Date();
    due.setDate(due.getDate() + 4);
    due.setHours(17, 0, 0, 0);

    const formatForInput = (d: Date) => {
      const pad = (n: number) => (n < 10 ? '0' + n : n);
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    };

    setExpectedHandover(formatForInput(tomorrow));
    setDueDate(formatForInput(due));
    setNotes('');
    setBorrowModalOpen(true);
  };

  const isWalletVerifiedMatching = Boolean(
    isConnected &&
      account &&
      user?.wallet_verified &&
      user?.wallet_address &&
      user.wallet_address.toLowerCase() === account.toLowerCase()
  );

  const isWalletBoundToDifferentAccount = Boolean(
    isConnected &&
      account &&
      user?.wallet_verified &&
      user?.wallet_address &&
      user.wallet_address.toLowerCase() !== account.toLowerCase()
  );

  const pendingDraftKey =
    user && selectedEquipment ? `eduvault_pending_loan_${user.id}_${selectedEquipment.id}` : null;
  const hasPendingMinedTx = useMemo(() => {
    if (!pendingDraftKey) return false;
    try {
      return Boolean(localStorage.getItem(pendingDraftKey));
    } catch {
      return false;
    }
  }, [pendingDraftKey, actionError, actionSuccess, borrowModalOpen]);

  const handleVerifyWallet = async () => {
    if (!account) {
      setActionError('Vui lòng kết nối ví MetaMask trước.');
      return;
    }
    setVerifyingWallet(true);
    setActionError(null);
    setWeb3StatusMsg('Đang lấy thử thách xác minh ví (EIP-191)...');
    try {
      const challenge = await authService.requestWalletChallenge(account);
      setWeb3StatusMsg('Vui lòng ký thông điệp xác nhận chủ sở hữu ví trên MetaMask (không tốn phí gas)...');
      const signature = await signMessage(challenge.message);
      await authService.verifyWalletSignature(account, signature);
      await refreshProfile();
      setWeb3StatusMsg(null);
    } catch (err: unknown) {
      setWeb3StatusMsg(null);
      const axiosErr = err as { response?: { data?: { detail?: string } } };
      setActionError(axiosErr.response?.data?.detail || parseWeb3Error(err));
    } finally {
      setVerifyingWallet(false);
    }
  };

  const handleBorrowSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEquipment || !user) return;

    if (new Date(dueDate) <= new Date(expectedHandover)) {
      setActionError('Hạn trả thiết bị phải sau thời gian dự kiến nhận.');
      return;
    }

    setSubmitting(true);
    setActionError(null);
    setWeb3StatusMsg(null);

    const draftStorageKey = `eduvault_pending_loan_${user.id}_${selectedEquipment.id}`;

    try {
      let clientTxHash: string | undefined = undefined;
      let clientLoanId: string | undefined = undefined;
      let handoverIso = new Date(expectedHandover).toISOString();
      let dueIso = new Date(dueDate).toISOString();

      // 1. Kiểm tra nếu đã có tx MetaMask được đào thành công cho thiết bị này nhưng API lần trước thất bại -> Resume idempotent
      const rawDraft = localStorage.getItem(draftStorageKey);
      if (rawDraft) {
        try {
          const parsed = JSON.parse(rawDraft) as {
            clientLoanId?: string;
            clientTxHash?: string;
            expectedHandoverIso?: string;
            dueDateIso?: string;
          };
          if (parsed.clientLoanId && parsed.clientTxHash && parsed.expectedHandoverIso && parsed.dueDateIso) {
            clientLoanId = parsed.clientLoanId;
            clientTxHash = parsed.clientTxHash;
            handoverIso = parsed.expectedHandoverIso;
            dueIso = parsed.dueDateIso;
            setWeb3StatusMsg(`Phát hiện giao dịch đã xác nhận (${clientTxHash.slice(0, 10)}...), đang đồng bộ lại vào hệ thống...`);
          }
        } catch {
          localStorage.removeItem(draftStorageKey);
        }
      }

      // 2. Nếu chưa có giao dịch đã đào và ví MetaMask đang kết nối -> Ký trực tiếp qua MetaMask
      if (!clientTxHash && isConnected) {
        if (!isCorrectNetwork) {
          setActionError(`MetaMask đang sai mạng. Vui lòng chuyển sang ${TARGET_CHAIN_NAME} (Chain ID ${TARGET_CHAIN_ID}).`);
          setSubmitting(false);
          return;
        }
        if (!account || !user.wallet_verified || !user.wallet_address || user.wallet_address.toLowerCase() !== account.toLowerCase()) {
          setActionError('Vui lòng bấm "Liên kết & Xác minh ví MetaMask" khớp với tài khoản hiện tại trước khi ký giao dịch on-chain.');
          setSubmitting(false);
          return;
        }

        const deployCheck = await verifyDeployedContract();
        if (!deployCheck.ok) {
          setActionError(deployCheck.error || 'Smart Contract chưa sẵn sàng trên mạng hiện tại.');
          setSubmitting(false);
          return;
        }

        const contract = await getContract(true);
        if (!contract) {
          setActionError('Không thể khởi tạo Smart Contract. Vui lòng kiểm tra cấu hình mạng và địa chỉ contract.');
          setSubmitting(false);
          return;
        }

        setWeb3StatusMsg('Vui lòng bấm Xác nhận (Confirm) trên popup ví MetaMask...');
        const newLoanId =
          '0x' +
          Array.from(crypto.getRandomValues(new Uint8Array(32)))
            .map((b) => b.toString(16).padStart(2, '0'))
            .join('');
        const startTs = Math.floor(new Date(handoverIso).getTime() / 1000);
        const dueTs = Math.floor(new Date(dueIso).getTime() / 1000);
        const depositNum = Math.round(Number(selectedEquipment.deposit_amount)) || 0;

        const tx = await contract.createLoan(
          newLoanId,
          selectedEquipment.id,
          user.student_staff_id,
          ethers.getAddress(account),
          startTs,
          dueTs,
          depositNum
        );
        setWeb3StatusMsg('Giao dịch đang được xác nhận trên block...');
        const receipt = await tx.wait();
        if (!receipt || receipt.status !== 1) {
          throw new Error('Giao dịch trên Smart Contract đã bị revert (status = 0).');
        }
        clientTxHash = receipt.hash;
        clientLoanId = newLoanId;

        localStorage.setItem(
          draftStorageKey,
          JSON.stringify({
            clientLoanId,
            clientTxHash,
            expectedHandoverIso: handoverIso,
            dueDateIso: dueIso,
            wallet: account,
          })
        );
      }

      setWeb3StatusMsg('Đang xác thực biên lai và lưu đơn mượn vào hệ thống...');
      await loanService.requestLoan({
        equipment_id: selectedEquipment.id,
        expected_handover_date: handoverIso,
        due_date: dueIso,
        admin_notes: notes.trim() || undefined,
        on_chain_loan_id: clientLoanId,
        client_tx_hash: clientTxHash,
      });

      localStorage.removeItem(draftStorageKey);
      setActionSuccess(
        clientTxHash
          ? `Gửi đơn & Ký on-chain thành công qua MetaMask! Mã Tx: ${clientTxHash.slice(0, 10)}...`
          : 'Đã gửi đơn mượn thành công! Đơn đang ở trạng thái Chờ duyệt (Admin Relayer sẽ đồng bộ khi duyệt).'
      );
      fetchEquipment();
      setTimeout(() => {
        setBorrowModalOpen(false);
      }, 2000);
    } catch (err: unknown) {
      console.error('Error submitting loan:', err);
      const axiosErr = err as { response?: { status?: number; data?: { detail?: string } } };
      if (axiosErr.response?.status && [400, 409].includes(axiosErr.response.status)) {
        // Nếu API từ chối vĩnh viễn do dữ liệu/replay, dọn draft cũ nếu có
        const detail = axiosErr.response.data?.detail || '';
        if (detail.includes('không hợp lệ') || detail.includes('đã được sử dụng')) {
          localStorage.removeItem(draftStorageKey);
        }
      }
      const errMsg = axiosErr.response?.data?.detail || parseWeb3Error(err);
      setActionError(errMsg);
    } finally {
      setWeb3StatusMsg(null);
      setSubmitting(false);
    }
  };

  const renderCategoryIcon = (category: string) => {
    switch (category) {
      case 'LAPTOP':
        return <Laptop className="w-10 h-10 text-slate-300" />;
      case 'TABLET':
        return <Tablet className="w-10 h-10 text-slate-300" />;
      case 'PROJECTOR':
        return <Tv className="w-10 h-10 text-slate-300" />;
      case 'LAB_TOOL':
        return <Activity className="w-10 h-10 text-slate-300" />;
      case 'EMBEDDED_KIT':
        return <Cpu className="w-10 h-10 text-slate-300" />;
      default:
        return <Package className="w-10 h-10 text-slate-300" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Danh mục thiết bị</h1>
          <p className="text-sm text-slate-600 mt-1 max-w-md leading-relaxed">
            Tra cứu cấu hình thiết bị và mức ký quỹ bảo toàn trên Blockchain.
          </p>
        </div>

        {/* Global Summary Badges */}
        <div className="flex items-center space-x-3 text-xs">
          <div className="px-3.5 py-2 bg-white border border-slate-200 rounded-lg shadow-xs flex items-center space-x-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span className="text-slate-600 font-medium">
              Sẵn sàng:{' '}
              <strong className="text-slate-900 font-semibold">
                {equipmentList.filter((e) => e.status === 'AVAILABLE').length}
              </strong>
            </span>
          </div>
          <div className="px-3.5 py-2 bg-white border border-slate-200 rounded-lg shadow-xs flex items-center space-x-2">
            <span className="w-2 h-2 rounded-full bg-indigo-500" />
            <span className="text-slate-600 font-medium">
              Tổng số:{' '}
              <strong className="text-slate-900 font-semibold">{equipmentList.length}</strong>
            </span>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-white p-3 rounded-xl border border-slate-200 shadow-xs">
        {/* Search Input */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm theo tên máy, mã serial..."
            className="w-full pl-9 pr-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 border border-slate-200 rounded-lg bg-slate-50/60 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-slate-900 transition-colors"
          />
        </div>

        {/* Category Chips */}
        <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                selectedCategory === cat
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              {cat === 'ALL' ? 'Tất cả loại' : cat}
            </button>
          ))}
        </div>

        {/* Status Dropdown */}
        <div className="flex items-center space-x-1.5 border-l border-slate-200 pl-3">
          <SlidersHorizontal className="w-4 h-4 text-slate-500" />
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            aria-label="Lọc theo trạng thái"
            className="text-xs font-medium text-slate-700 bg-transparent border-none focus:outline-none focus:ring-0 cursor-pointer"
          >
            <option value="ALL">Tất cả trạng thái</option>
            <option value="AVAILABLE">Sẵn sàng</option>
            <option value="RESERVED">Đã giữ chỗ</option>
            <option value="IN_USE">Đang sử dụng</option>
            <option value="MAINTENANCE">Bảo trì</option>
          </select>
        </div>
      </div>

      {/* Equipment Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </div>
      ) : filteredItems.length === 0 ? (
        <EmptyState
          title="Không tìm thấy thiết bị phù hợp"
          description="Hãy thử thay đổi từ khóa tìm kiếm hoặc bỏ chọn các bộ lọc trạng thái để xem đầy đủ danh mục."
          actionText="Xóa bộ lọc tìm kiếm"
          onAction={() => {
            setSearch('');
            setSelectedCategory('ALL');
            setSelectedStatus('ALL');
          }}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredItems.map((item) => {
            const isAvailable = item.status === 'AVAILABLE';
            const depositVND = Number(item.deposit_amount).toLocaleString('vi-VN');

            return (
              <div
                key={item.id}
                className="bg-white rounded-xl border border-slate-200 hover:border-slate-300 shadow-xs transition-all flex flex-col justify-between group overflow-hidden"
              >
                <div>
                  {/* Product Image Frame */}
                  <div className="relative w-full aspect-[16/10] bg-slate-100 flex items-center justify-center overflow-hidden border-b border-slate-100">
                    {item.image_url ? (
                      <img
                        src={item.image_url}
                        alt={item.name}
                        loading="lazy"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                          const fb = e.currentTarget.parentElement?.querySelector(
                            '.img-fallback'
                          ) as HTMLElement | null;
                          if (fb) fb.style.display = 'flex';
                        }}
                        className="w-full h-full object-cover"
                      />
                    ) : null}
                    <div
                      className={`img-fallback w-full h-full flex flex-col items-center justify-center bg-slate-50 ${
                        item.image_url ? 'hidden' : 'flex'
                      }`}
                    >
                      {renderCategoryIcon(item.category)}
                    </div>
                  </div>

                  {/* Card Content Body */}
                  <div className="p-5">
                    {/* Category & Status Bar */}
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider font-mono">
                        {item.category}
                      </span>
                      <StatusBadge status={item.status} />
                    </div>

                    <h2 className="text-base font-bold text-slate-900 group-hover:text-slate-700 transition-colors tracking-tight line-clamp-1">
                      {item.name}
                    </h2>
                    <p className="text-xs font-mono font-medium text-slate-600 mt-1">
                      Serial: {item.serial_number}
                    </p>

                    {/* Specifications */}
                    <p className="mt-3 text-xs text-slate-600 line-clamp-2 leading-relaxed">
                      {item.specifications || 'Không có mô tả thông số kỹ thuật đặc thù.'}
                    </p>
                  </div>
                </div>

                {/* Bottom Details & Action */}
                <div className="px-5 pb-5 pt-3 border-t border-slate-100 flex items-center justify-between mt-auto">
                  <div>
                    <span className="text-xs font-medium text-slate-600 block">
                      Ký quỹ mô phỏng
                    </span>
                    <span className="text-base font-bold text-slate-900 font-mono">
                      {depositVND} đ
                    </span>
                  </div>

                  {role === 'BORROWER' ? (
                    <button
                      onClick={() => handleOpenBorrowModal(item)}
                      disabled={!isAvailable}
                      className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all shadow-xs active:scale-[0.98] cursor-pointer ${
                        isAvailable
                          ? 'bg-slate-900 text-white hover:bg-slate-800'
                          : 'bg-slate-100 text-slate-400 cursor-not-allowed shadow-none'
                      }`}
                    >
                      {isAvailable ? 'Đăng ký mượn' : 'Không khả dụng'}
                    </button>
                  ) : (
                    <span className="text-xs font-medium text-slate-600 bg-slate-100 px-3 py-1.5 rounded-md">
                      Quản lý kho
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Borrow Request Modal */}
      <Modal
        isOpen={borrowModalOpen}
        onClose={() => !submitting && setBorrowModalOpen(false)}
        title="Đăng ký mượn thiết bị học tập"
        subtitle={selectedEquipment ? `${selectedEquipment.name} (${selectedEquipment.serial_number})` : ''}
        maxWidth="lg"
      >
        {actionSuccess ? (
          <div className="py-6 text-center space-y-3">
            <CheckCircle2 className="w-12 h-12 text-emerald-600 mx-auto" />
            <h3 className="text-base font-bold text-slate-900">Gửi yêu cầu mượn thành công!</h3>
            <p className="text-xs text-slate-600 max-w-sm mx-auto">{actionSuccess}</p>
          </div>
        ) : (
          <form onSubmit={handleBorrowSubmit} className="space-y-4">
            {actionError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg flex items-start space-x-2 text-xs text-rose-700">
                <ShieldAlert className="w-4 h-4 flex-shrink-0 mt-0.5 text-rose-600" />
                <span>{actionError}</span>
              </div>
            )}

            {/* Trạng thái kết nối ví MetaMask & Xác minh quyền sở hữu */}
            <div className={`p-3 rounded-lg border text-xs flex items-center justify-between gap-2 ${
              isConnected
                ? !isCorrectNetwork
                  ? 'bg-amber-50 border-amber-200 text-amber-800'
                  : isWalletVerifiedMatching
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  : 'bg-amber-50 border-amber-200 text-amber-800'
                : 'bg-orange-50 border-orange-200 text-orange-800'
            }`}>
              <div className="flex flex-col space-y-0.5">
                <div className="flex items-center space-x-2">
                  <span className="font-semibold">Trạng thái Web3:</span>
                  <span>
                    {isConnected
                      ? !isCorrectNetwork
                        ? `Sai mạng (Chuyển sang ${TARGET_CHAIN_NAME} - ID ${TARGET_CHAIN_ID})`
                        : isWalletVerifiedMatching
                        ? 'Đã xác minh ví MetaMask (Sẵn sàng ký On-chain)'
                        : isWalletBoundToDifferentAccount
                        ? `Ví MetaMask khác với ví đã liên kết (${user?.wallet_address?.slice(0, 8)}...)`
                        : 'Ví MetaMask chưa xác minh chữ ký EIP-191'
                      : 'Chưa kết nối ví (Sẽ gửi qua Custodial Relayer khi Admin duyệt)'}
                  </span>
                </div>
                {hasPendingMinedTx && (
                  <span className="text-[11px] font-medium text-indigo-700">
                    Đang có giao dịch MetaMask đã xác nhận chờ đồng bộ API — bấm Gửi để tiếp tục mà không ký lại.
                  </span>
                )}
              </div>
              {!isConnected && (
                <button
                  type="button"
                  onClick={connectWallet}
                  className="px-2.5 py-1 bg-orange-600 text-white rounded font-semibold text-[11px] hover:bg-orange-700 cursor-pointer shrink-0"
                >
                  Kết nối ví
                </button>
              )}
              {isConnected && !isCorrectNetwork && (
                <button
                  type="button"
                  onClick={switchNetwork}
                  className="px-2.5 py-1 bg-amber-600 text-white rounded font-semibold text-[11px] hover:bg-amber-700 cursor-pointer shrink-0"
                >
                  Đổi mạng ({TARGET_CHAIN_ID})
                </button>
              )}
              {isConnected && isCorrectNetwork && !isWalletVerifiedMatching && (
                <button
                  type="button"
                  onClick={handleVerifyWallet}
                  disabled={verifyingWallet}
                  className="px-2.5 py-1 bg-indigo-600 text-white rounded font-semibold text-[11px] hover:bg-indigo-700 cursor-pointer disabled:opacity-50 shrink-0"
                >
                  {verifyingWallet ? 'Đang ký...' : 'Xác minh ví'}
                </button>
              )}
            </div>

            {web3StatusMsg && (
              <div className="p-2.5 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-800 animate-pulse">
                {web3StatusMsg}
              </div>
            )}

            {selectedEquipment && (
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-600 font-medium">Mức tiền ký quỹ quy định:</span>
                  <span className="font-mono font-bold text-slate-900">
                    {Number(selectedEquipment.deposit_amount).toLocaleString('vi-VN')} đ
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-600 font-medium">Mô hình ký giao dịch:</span>
                  <span className="text-slate-800 font-semibold bg-slate-100 px-2.5 py-0.5 rounded text-xs font-mono">
                    Hybrid Web2.5 ({isConnected ? 'MetaMask SV + Relayer' : 'Admin Relayer'})
                  </span>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Thời gian nhận máy dự kiến <span className="text-rose-500">*</span>
                </label>
                <div className="relative rounded-lg shadow-xs">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Calendar className="w-4 h-4" />
                  </div>
                  <input
                    type="datetime-local"
                    value={expectedHandover}
                    onChange={(e) => setExpectedHandover(e.target.value)}
                    required
                    className="block w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Hạn trả thiết bị quy định <span className="text-rose-500">*</span>
                </label>
                <div className="relative rounded-lg shadow-xs">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Calendar className="w-4 h-4" />
                  </div>
                  <input
                    type="datetime-local"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    required
                    className="block w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Ghi chú mục đích sử dụng / Đề xuất thêm
              </label>
              <div className="relative rounded-lg shadow-xs">
                <div className="absolute top-2.5 left-3 pointer-events-none text-slate-400">
                  <FileText className="w-4 h-4" />
                </div>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  placeholder="Ví dụ: Dùng thực hành môn Hệ nhúng, cần mượn thêm dây nạp ST-Link..."
                  className="block w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 resize-none"
                />
              </div>
            </div>

            <div className="p-3 bg-amber-50/70 border border-amber-200/80 rounded-lg flex items-start space-x-2 text-xs text-amber-900">
              <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <span>
                Lưu ý: Sau khi gửi, đơn mượn sẽ ở trạng thái Chờ duyệt. Khi Quản trị viên bàn giao thiết bị, trạng thái ký quỹ sẽ tự động khóa trên Smart Contract.
              </span>
            </div>

            <div className="flex justify-end space-x-2.5 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setBorrowModalOpen(false)}
                disabled={submitting}
                className="px-4 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-5 py-2 rounded-lg text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 transition-all shadow-xs cursor-pointer disabled:opacity-50"
              >
                {submitting ? 'Đang gửi...' : 'Xác nhận gửi đơn mượn'}
              </button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
};
export default EquipmentPage;
