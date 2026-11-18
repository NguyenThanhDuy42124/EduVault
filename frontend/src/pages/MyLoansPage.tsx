import React, { useEffect, useMemo, useState } from 'react';
import { loanService } from '../services/loanService';
import { Loan } from '../types';
import { StatusBadge } from '../components/StatusBadge';
import { TableSkeleton } from '../components/LoadingSkeleton';
import { EmptyState } from '../components/EmptyState';
import { Modal } from '../components/Modal';
import { LoanVerifyPanel } from '../components/LoanVerifyPanel';
import { useWeb3 } from '../context/Web3Context';
import {
  ClipboardList,
  AlertTriangle,
  XCircle,
  ShieldCheck,
} from 'lucide-react';

export const MyLoansPage: React.FC = () => {
  const [loans, setLoans] = useState<Loan[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'ALL' | 'IN_PROGRESS' | 'FINISHED'>('ALL');
  const [verifyLoanId, setVerifyLoanId] = useState<number | null>(null);

  const { isConnected, getContract, parseWeb3Error } = useWeb3();

  // Cancel Modal State
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [selectedLoan, setSelectedLoan] = useState<Loan | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelling, setCancelling] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const fetchLoans = async () => {
    setLoading(true);
    try {
      const data = await loanService.getMyLoans();
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

  const handleOpenCancel = (loan: Loan) => {
    setSelectedLoan(loan);
    setCancelReason('Sinh viên thay đổi kế hoạch học tập');
    setActionError(null);
    setCancelModalOpen(true);
  };

  const handleCancelSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLoan) return;

    setCancelling(true);
    setActionError(null);
    try {
      let txHash: string | undefined = undefined;
      if (selectedLoan.on_chain_loan_id && isConnected) {
        const contract = await getContract(true);
        if (contract) {
          try {
            const reasonStr = cancelReason || 'Sinh viên hủy đơn mượn';
            const tx = await contract.cancelLoan(selectedLoan.on_chain_loan_id, reasonStr);
            const receipt = await tx.wait();
            txHash = receipt.hash;
          } catch (contractErr: unknown) {
            console.warn('Lỗi gọi cancelLoan on-chain:', contractErr);
          }
        }
      }

      await loanService.cancelLoan(selectedLoan.id, { tx_hash: txHash, reason: cancelReason });
      setCancelModalOpen(false);
      fetchLoans();
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { detail?: string } } };
      setActionError(axiosErr.response?.data?.detail || parseWeb3Error(err));
    } finally {
      setCancelling(false);
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

  const filteredLoans = useMemo(() => {
    if (tab === 'ALL') return loans;
    if (tab === 'IN_PROGRESS') {
      return loans.filter((l) => ['PENDING', 'APPROVED', 'ACTIVE'].includes(l.status));
    }
    return loans.filter((l) => ['RETURNED', 'DISPUTED', 'CANCELLED', 'REJECTED'].includes(l.status));
  }, [loans, tab]);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-slate-200/80">
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Đơn mượn của tôi</h1>

        <div className="flex items-center space-x-2 self-start md:self-auto">
          <span className="text-xs text-slate-500 font-medium">Tổng số đơn:</span>
          <span className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-900">
            {loans.length}
          </span>
        </div>
      </div>

      {/* Filter Tabs */}
      {!loading && loans.length > 0 && (
        <div className="flex flex-wrap items-center gap-1 border border-slate-200 p-1 rounded-xl bg-white w-fit shadow-2xs">
          {[
            { id: 'ALL', label: 'Tất cả đơn' },
            { id: 'IN_PROGRESS', label: 'Đang xử lý / Đang mượn' },
            { id: 'FINISHED', label: 'Đã hoàn tất / Khác' },
          ].map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id as 'ALL' | 'IN_PROGRESS' | 'FINISHED')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                tab === item.id
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <TableSkeleton rows={4} />
      ) : loans.length === 0 ? (
        <EmptyState
          icon={<ClipboardList className="w-8 h-8" />}
          title="Bạn chưa có đơn mượn thiết bị nào"
          description="Khám phá danh mục thiết bị thực hành và gửi đơn đăng ký mượn ngay hôm nay."
          actionText="Đến danh mục thiết bị"
          onAction={() => (window.location.href = '/equipment')}
        />
      ) : filteredLoans.length === 0 ? (
        <EmptyState
          icon={<ClipboardList className="w-8 h-8" />}
          title="Không có đơn nào trong mục này"
          description="Chọn tab khác để xem các đơn mượn của bạn."
        />
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase text-[11px] tracking-wider">
                <tr>
                  <th className="py-3 px-4">Đơn #</th>
                  <th className="py-3 px-4">Thiết bị</th>
                  <th className="py-3 px-4">Thời gian nhận / Hạn trả</th>
                  <th className="py-3 px-4">Tiền cọc cần đóng</th>
                  <th className="py-3 px-4">Trạng thái</th>
                  <th className="py-3 px-4 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredLoans.map((loan) => {
                  const isCanCancel = loan.status === 'PENDING' || loan.status === 'APPROVED';
                  const depositVND = Number(loan.deposit_amount).toLocaleString('vi-VN');
                  const effectiveDepositStatus = ['CANCELLED', 'REJECTED'].includes(loan.status)
                    ? 'REFUNDED'
                    : loan.deposit_status;

                  return (
                    <tr key={loan.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-900 whitespace-nowrap">
                        #{loan.id}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-900 max-w-[240px] truncate" title={loan.equipment?.name}>
                          {loan.equipment?.name || `Thiết bị #${loan.equipment_id}`}
                        </div>
                        <div className="text-slate-500 font-mono text-[11px]">
                          {loan.equipment?.serial_number || 'N/A'} • Gửi {formatDate(loan.request_date)}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 space-y-0.5 whitespace-nowrap">
                        <div className="text-slate-600 font-mono text-[11px]">
                          Nhận: {formatDate(loan.expected_handover_date)}
                        </div>
                        <div
                          className={`font-mono text-[11px] font-semibold ${
                            loan.is_overdue ? 'text-rose-600' : 'text-slate-900'
                          }`}
                        >
                          Hạn trả: {formatDate(loan.due_date)}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="font-mono font-bold text-slate-900">{depositVND} đ</div>
                        <div className="mt-0.5">
                          <StatusBadge status={effectiveDepositStatus} type="deposit" size="sm" />
                        </div>
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="flex flex-col items-start gap-1">
                          <StatusBadge status={loan.status} />
                          {loan.is_overdue && (
                            <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-rose-100 text-rose-800">
                              <AlertTriangle className="w-3 h-3" />
                              <span>Quá hạn</span>
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center justify-end gap-1.5">
                          {loan.on_chain_loan_id && (
                            <button
                              type="button"
                              onClick={() => setVerifyLoanId(loan.id)}
                              className="inline-flex items-center space-x-1 px-2.5 py-1.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg font-semibold hover:bg-indigo-100 transition-colors cursor-pointer"
                              title="Kiểm tra đơn này trên Blockchain"
                            >
                              <ShieldCheck className="w-3.5 h-3.5" />
                              <span>Đối soát</span>
                            </button>
                          )}
                          {isCanCancel && (
                            <button
                              type="button"
                              onClick={() => handleOpenCancel(loan)}
                              className="inline-flex items-center space-x-1 px-2.5 py-1.5 text-rose-600 hover:bg-rose-50 rounded-lg border border-rose-200 font-semibold transition-colors cursor-pointer"
                            >
                              <XCircle className="w-3.5 h-3.5" />
                              <span>Hủy</span>
                            </button>
                          )}
                          {!loan.on_chain_loan_id && !isCanCancel && (
                            <span className="text-slate-600 font-mono text-xs">Chưa lên chain</span>
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

      {/* Cancel Loan Confirmation Modal */}
      <Modal
        isOpen={cancelModalOpen}
        onClose={() => !cancelling && setCancelModalOpen(false)}
        title="Xác nhận hủy đơn mượn"
        subtitle={selectedLoan ? `Đơn mượn #${selectedLoan.id} - ${selectedLoan.equipment?.name}` : ''}
        maxWidth="md"
      >
        <form onSubmit={handleCancelSubmit} className="space-y-4">
          {actionError && (
            <div role="alert" className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700">
              {actionError}
            </div>
          )}

          {selectedLoan?.on_chain_loan_id && (
            <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-600">
              Đơn này đã được lưu trên Blockchain (<code>{selectedLoan.on_chain_loan_id.slice(0, 12)}...</code>). Khi hủy, ví MetaMask sẽ mở yêu cầu xác nhận hủy đơn.
            </div>
          )}

          <div>
            <label htmlFor="cancel-reason" className="block text-xs font-semibold text-slate-700 mb-1">
              Lý do hủy đơn
            </label>
            <textarea
              id="cancel-reason"
              rows={2}
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              required
              className="w-full px-3 py-2 text-xs text-slate-900 border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-slate-900"
            />
          </div>

          <div className="flex justify-end space-x-2 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setCancelModalOpen(false)}
              disabled={cancelling}
              className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-lg cursor-pointer transition-colors"
            >
              Quay lại
            </button>
            <button
              type="submit"
              disabled={cancelling}
              className="px-4 py-2 bg-rose-600 text-white text-xs font-semibold rounded-lg hover:bg-rose-700 transition-colors shadow-xs disabled:opacity-50 cursor-pointer"
            >
              {cancelling ? 'Đang xử lý...' : 'Xác nhận hủy'}
            </button>
          </div>
        </form>
      </Modal>

      <LoanVerifyPanel loanId={verifyLoanId} onClose={() => setVerifyLoanId(null)} />
    </div>
  );
};
