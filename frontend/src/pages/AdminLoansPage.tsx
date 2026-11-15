import React, { useEffect, useState, useMemo } from 'react';
import { loanService } from '../services/loanService';
import { Loan, ReturnCondition } from '../types';
import { StatusBadge } from '../components/StatusBadge';
import { TableSkeleton } from '../components/LoadingSkeleton';
import { EmptyState } from '../components/EmptyState';
import { Modal } from '../components/Modal';
import { useWeb3 } from '../context/Web3Context';
import { TARGET_CHAIN_NAME } from '../contracts/contractConfig';
import {
  CheckCircle,
  XCircle,
  PackageCheck,
  RotateCcw,
  Search,
  ShieldAlert,
  Info,
} from 'lucide-react';

export const AdminLoansPage: React.FC = () => {
  const [loans, setLoans] = useState<Loan[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'ALL' | 'PENDING' | 'APPROVED' | 'ACTIVE' | 'FINISHED'>('ALL');
  const [search, setSearch] = useState('');

  const { isConnected, isCorrectNetwork, isAdmin, getContract, parseWeb3Error } = useWeb3();

  // Processing state
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Return Inspection Modal State
  const [returnModalOpen, setReturnModalOpen] = useState(false);
  const [selectedLoan, setSelectedLoan] = useState<Loan | null>(null);
  const [returnCondition, setReturnCondition] = useState<ReturnCondition>('GOOD');
  const [inspectionNotes, setInspectionNotes] = useState('');

  // Reject Modal State
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  const fetchLoans = async () => {
    setLoading(true);
    try {
      const data = await loanService.getAllLoans();
      setLoans(data);
    } catch {
      // Silently handled
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLoans();
  }, []);

  const filteredLoans = useMemo(() => {
    return loans.filter((loan) => {
      let matchTab = true;
      if (tab === 'PENDING') matchTab = loan.status === 'PENDING';
      else if (tab === 'APPROVED') matchTab = loan.status === 'APPROVED';
      else if (tab === 'ACTIVE') matchTab = loan.status === 'ACTIVE';
      else if (tab === 'FINISHED')
        matchTab = ['RETURNED', 'DISPUTED', 'CANCELLED', 'REJECTED'].includes(loan.status);

      const matchSearch =
        loan.id.toString().includes(search) ||
        (loan.user?.full_name && loan.user.full_name.toLowerCase().includes(search.toLowerCase())) ||
        (loan.user?.student_staff_id &&
          loan.user.student_staff_id.toLowerCase().includes(search.toLowerCase())) ||
        (loan.equipment?.name && loan.equipment.name.toLowerCase().includes(search.toLowerCase())) ||
        (loan.equipment?.serial_number &&
          loan.equipment.serial_number.toLowerCase().includes(search.toLowerCase()));

      return matchTab && matchSearch;
    });
  }, [loans, tab, search]);

  const checkWeb3AdminReady = () => {
    if (!isConnected) {
      setActionError('Vui lòng kết nối ví MetaMask của Admin trước khi thực hiện.');
      return false;
    }
    if (!isCorrectNetwork) {
      setActionError(`MetaMask đang sai mạng. Vui lòng chuyển sang ${TARGET_CHAIN_NAME}.`);
      return false;
    }
    if (!isAdmin) {
      setActionError('Ví MetaMask hiện tại chưa được cấp quyền ADMIN_ROLE on-chain.');
      return false;
    }
    return true;
  };

  // Actions
  const handleApprove = async (loan: Loan) => {
    if (!checkWeb3AdminReady()) return;
    if (!loan.on_chain_loan_id) {
      setActionError('Đơn mượn chưa có mã on-chain. Không thể duyệt.');
      return;
    }

    setActionLoading(true);
    setActionError(null);
    try {
      const contract = await getContract(true);
      if (!contract) throw new Error('Không thể kết nối Smart Contract.');

      const tx = await contract.approveLoan(loan.on_chain_loan_id);
      const receipt = await tx.wait();

      await loanService.approveLoan(loan.id, { tx_hash: receipt.hash });
      await fetchLoans();
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { detail?: string } } };
      setActionError(axiosErr.response?.data?.detail || parseWeb3Error(err));
    } finally {
      setActionLoading(false);
    }
  };

  const handleOpenReject = (loan: Loan) => {
    setSelectedLoan(loan);
    setRejectReason('Thiết bị đang có lịch bảo trì định kỳ.');
    setActionError(null);
    setRejectModalOpen(true);
  };

  const handleRejectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLoan) return;

    setActionLoading(true);
    setActionError(null);
    try {
      let txHash: string | undefined = undefined;
      if (selectedLoan.on_chain_loan_id && isConnected && isAdmin) {
        const contract = await getContract(true);
        if (contract) {
          try {
            const reasonStr = rejectReason || 'Quản trị viên từ chối';
            const tx = await contract.cancelLoan(selectedLoan.on_chain_loan_id, reasonStr);
            const receipt = await tx.wait();
            txHash = receipt.hash;
          } catch (contractErr: unknown) {
            console.warn('Lỗi gọi cancelLoan on-chain:', contractErr);
            // Nếu đơn đã hủy từ trước trên blockchain, tiếp tục gửi để đồng bộ cơ sở dữ liệu
          }
        }
      }

      await loanService.rejectLoan(selectedLoan.id, { tx_hash: txHash, reason: rejectReason });
      setRejectModalOpen(false);
      await fetchLoans();
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { detail?: string } } };
      setActionError(axiosErr.response?.data?.detail || parseWeb3Error(err));
    } finally {
      setActionLoading(false);
    }
  };

  const handleHandover = async (loan: Loan) => {
    if (!checkWeb3AdminReady()) return;
    if (!loan.on_chain_loan_id) {
      setActionError('Đơn mượn chưa có mã on-chain. Không thể bàn giao.');
      return;
    }

    setActionLoading(true);
    setActionError(null);
    try {
      const contract = await getContract(true);
      if (!contract) throw new Error('Không thể kết nối Smart Contract.');

      const tx = await contract.confirmHandover(loan.on_chain_loan_id);
      const receipt = await tx.wait();

      await loanService.handoverLoan(loan.id, { tx_hash: receipt.hash });
      await fetchLoans();
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { detail?: string } } };
      setActionError(axiosErr.response?.data?.detail || parseWeb3Error(err));
    } finally {
      setActionLoading(false);
    }
  };

  const handleOpenReturnModal = (loan: Loan) => {
    setSelectedLoan(loan);
    setReturnCondition('GOOD');
    setInspectionNotes('');
    setActionError(null);
    setReturnModalOpen(true);
  };

  const handleReturnSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLoan) return;
    if (!checkWeb3AdminReady()) return;
    if (!selectedLoan.on_chain_loan_id) {
      setActionError('Đơn mượn chưa có mã on-chain. Không thể nghiệm thu trả.');
      return;
    }

    setActionLoading(true);
    setActionError(null);
    try {
      const conditionMap: Record<ReturnCondition, number> = {
        GOOD: 0,
        DAMAGED: 1,
        LOST: 2,
      };
      const conditionNum = conditionMap[returnCondition] ?? 0;

      const contract = await getContract(true);
      if (!contract) throw new Error('Không thể kết nối Smart Contract.');

      const tx = await contract.confirmReturn(selectedLoan.on_chain_loan_id, conditionNum);
      const receipt = await tx.wait();

      await loanService.returnLoan(selectedLoan.id, {
        tx_hash: receipt.hash,
        return_condition: returnCondition,
        admin_notes: inspectionNotes || undefined,
      });

      setReturnModalOpen(false);
      await fetchLoans();
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { detail?: string } } };
      setActionError(axiosErr.response?.data?.detail || parseWeb3Error(err));
    } finally {
      setActionLoading(false);
    }
  };

  const formatDate = (isoString?: string | null) => {
    if (!isoString) return '--';
    const d = new Date(isoString);
    return d.toLocaleString('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
      day: '2-digit',
      month: '2-digit',
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Điều phối & Quản lý Mượn trả
          </h1>
          <p className="text-sm text-slate-600 mt-1 max-w-md leading-relaxed">
            Duyệt đơn, bàn giao và nghiệm thu thiết bị ký trực tiếp qua ví MetaMask Admin.
          </p>
        </div>

        {/* Global Action Error Alert */}
        {actionError && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg flex items-center space-x-2 text-xs text-rose-700">
            <ShieldAlert className="w-4 h-4 flex-shrink-0" />
            <span>{actionError}</span>
          </div>
        )}
      </div>

      {/* Tabs & Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center space-x-1 border border-slate-200 p-1 rounded-xl bg-white shadow-2xs">
          {[
            { id: 'ALL', label: 'Tất cả đơn' },
            { id: 'PENDING', label: 'Chờ duyệt' },
            { id: 'APPROVED', label: 'Đã duyệt (Chờ lấy)' },
            { id: 'ACTIVE', label: 'Đang mượn' },
            { id: 'FINISHED', label: 'Đã hoàn tất / Khác' },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id as any)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                tab === t.id
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm theo MSSV, tên SV, thiết bị..."
            className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-slate-900 shadow-2xs"
          />
        </div>
      </div>

      {/* Loans Table */}
      {loading ? (
        <TableSkeleton rows={5} />
      ) : filteredLoans.length === 0 ? (
        <EmptyState
          title="Không tìm thấy đơn mượn nào"
          description={
            search ? 'Không có đơn nào khớp với từ khóa tìm kiếm.' : 'Chưa có dữ liệu đơn mượn nào ở mục này.'
          }
        />
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase text-[11px] tracking-wider">
                <tr>
                  <th className="py-3 px-4">Đơn #</th>
                  <th className="py-3 px-4">Người mượn</th>
                  <th className="py-3 px-4">Thiết bị</th>
                  <th className="py-3 px-4">Thời gian mượn / Hạn trả</th>
                  <th className="py-3 px-4">Ký quỹ (VND)</th>
                  <th className="py-3 px-4">Trạng thái</th>
                  <th className="py-3 px-4 text-right">Thao tác điều phối</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredLoans.map((loan) => {
                  return (
                    <tr key={loan.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-900">
                        #{loan.id}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-900">
                          {loan.user?.full_name || 'N/A'}
                        </div>
                        <div className="text-slate-500 font-mono text-[11px]">
                          {loan.user?.student_staff_id || 'N/A'}
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-900 max-w-[200px] truncate" title={loan.equipment?.name}>
                          {loan.equipment?.name || 'N/A'}
                        </div>
                        <div className="text-slate-500 font-mono text-[11px]">
                          {loan.equipment?.serial_number || 'N/A'}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 space-y-0.5">
                        <div className="text-slate-600 font-mono text-[11px]">
                          Nhận: {formatDate(loan.expected_handover_date)}
                        </div>
                        <div className="font-mono text-[11px] font-semibold text-slate-900">
                          Hạn: {formatDate(loan.due_date)}
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-bold font-mono text-slate-900">
                          {Number(loan.deposit_amount).toLocaleString('vi-VN')} đ
                        </div>
                        <div className="text-[10px] font-mono text-slate-500">
                          {loan.deposit_status}
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <StatusBadge status={loan.status} />
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end space-x-1.5">
                          {loan.status === 'PENDING' && (
                            <>
                              <button
                                onClick={() => handleApprove(loan)}
                                disabled={actionLoading}
                                className="inline-flex items-center space-x-1 px-2.5 py-1.5 bg-slate-900 text-white font-medium rounded-lg hover:bg-slate-800 transition-colors shadow-2xs disabled:opacity-50"
                                title="Duyệt đơn và kích hoạt Mutex thiết bị qua MetaMask"
                              >
                                <CheckCircle className="w-3.5 h-3.5" />
                                <span>Duyệt</span>
                              </button>
                              <button
                                onClick={() => handleOpenReject(loan)}
                                disabled={actionLoading}
                                className="inline-flex items-center space-x-1 px-2.5 py-1.5 bg-white border border-slate-200 text-slate-700 font-medium rounded-lg hover:bg-slate-50 transition-colors shadow-2xs disabled:opacity-50"
                                title="Từ chối yêu cầu mượn"
                              >
                                <XCircle className="w-3.5 h-3.5 text-rose-500" />
                                <span>Từ chối</span>
                              </button>
                            </>
                          )}

                          {loan.status === 'APPROVED' && (
                            <button
                              onClick={() => handleHandover(loan)}
                              disabled={actionLoading}
                              className="inline-flex items-center space-x-1 px-2.5 py-1.5 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition-colors shadow-2xs disabled:opacity-50"
                              title="Xác nhận bàn giao thiết bị thực tế qua MetaMask"
                            >
                              <PackageCheck className="w-3.5 h-3.5" />
                              <span>Bàn giao</span>
                            </button>
                          )}

                          {loan.status === 'ACTIVE' && (
                            <button
                              onClick={() => handleOpenReturnModal(loan)}
                              disabled={actionLoading}
                              className="inline-flex items-center space-x-1 px-2.5 py-1.5 bg-slate-900 text-white font-medium rounded-lg hover:bg-slate-800 transition-colors shadow-2xs disabled:opacity-50"
                              title="Kiểm định thiết bị và xác nhận thu hồi cọc / hoàn cọc qua MetaMask"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                              <span>Nhận lại</span>
                            </button>
                          )}

                          {['RETURNED', 'DISPUTED', 'CANCELLED', 'REJECTED'].includes(loan.status) && (
                            <span className="text-xs text-slate-400 font-mono">--</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Return Inspection Modal */}
      <Modal
        isOpen={returnModalOpen}
        onClose={() => !actionLoading && setReturnModalOpen(false)}
        title="Nghiệm thu hoàn trả & Quyết toán cọc on-chain"
        subtitle={
          selectedLoan
            ? `Đơn #${selectedLoan.id} - ${selectedLoan.equipment?.name} (${selectedLoan.user?.full_name})`
            : ''
        }
        maxWidth="lg"
      >
        <form onSubmit={handleReturnSubmit} className="space-y-4">
          {actionError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700">
              {actionError}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-2">
              Hiện trạng thiết bị sau kiểm tra
            </label>
            <div className="grid grid-cols-3 gap-2.5">
              {[
                { id: 'GOOD', label: 'Nguyên vẹn', desc: 'Tự động tính phạt 0% đúng hạn hoặc 10%/50% nếu quá hạn' },
                { id: 'DAMAGED', label: 'Hư hại', desc: 'Khấu trừ 100% cọc sửa chữa' },
                { id: 'LOST', label: 'Thất lạc/Mất', desc: 'Thu hồi 100% + khóa tài khoản' },
              ].map((c) => (
                <button
                  type="button"
                  key={c.id}
                  onClick={() => setReturnCondition(c.id as ReturnCondition)}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    returnCondition === c.id
                      ? 'border-slate-900 bg-slate-100 ring-1 ring-slate-900'
                      : 'border-slate-200 bg-slate-50 hover:bg-slate-100'
                  }`}
                >
                  <span className="font-bold text-xs text-slate-900 block">{c.label}</span>
                  <span className="text-xs text-slate-500 block mt-1 leading-tight">
                    {c.desc}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Ghi chú biên bản kiểm tra
            </label>
            <textarea
              rows={2}
              value={inspectionNotes}
              onChange={(e) => setInspectionNotes(e.target.value)}
              placeholder="Nhập tình trạng phụ kiện, cáp nguồn, bề mặt máy..."
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
          </div>

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-600 flex items-start space-x-2">
            <Info className="w-4 h-4 flex-shrink-0 text-slate-700 mt-0.5" />
            <p>
              Smart Contract sẽ tự động tính phạt và hoàn/khấu trừ cọc on-chain. Admin sẽ ký giao dịch trực tiếp qua popup MetaMask.
            </p>
          </div>

          <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setReturnModalOpen(false)}
              disabled={actionLoading}
              className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-xl"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={actionLoading}
              className="px-4 py-2 bg-slate-900 text-white text-xs font-semibold rounded-xl hover:bg-slate-800 transition-colors shadow-sm disabled:opacity-50"
            >
              {actionLoading ? 'Đang ký MetaMask...' : 'Xác nhận ký on-chain'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Reject Modal */}
      <Modal
        isOpen={rejectModalOpen}
        onClose={() => !actionLoading && setRejectModalOpen(false)}
        title="Từ chối yêu cầu mượn"
        subtitle={
          selectedLoan
            ? `Đơn #${selectedLoan.id} - ${selectedLoan.equipment?.name} (${selectedLoan.user?.full_name})`
            : ''
        }
      >
        <form onSubmit={handleRejectSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Lý do từ chối
            </label>
            <textarea
              rows={3}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              required
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
          </div>

          <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setRejectModalOpen(false)}
              disabled={actionLoading}
              className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-xl"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={actionLoading}
              className="px-4 py-2 bg-rose-600 text-white text-xs font-semibold rounded-xl hover:bg-rose-700 transition-colors shadow-sm disabled:opacity-50"
            >
              {actionLoading ? 'Đang xử lý...' : 'Xác nhận từ chối'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
