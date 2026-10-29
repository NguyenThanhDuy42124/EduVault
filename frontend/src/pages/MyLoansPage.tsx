import React, { useEffect, useState } from 'react';
import { loanService } from '../services/loanService';
import { Loan } from '../types';
import { StatusBadge } from '../components/StatusBadge';
import { TableSkeleton } from '../components/LoadingSkeleton';
import { EmptyState } from '../components/EmptyState';
import { Modal } from '../components/Modal';
import {
  ClipboardList,
  AlertTriangle,
  XCircle,
} from 'lucide-react';

export const MyLoansPage: React.FC = () => {
  const [loans, setLoans] = useState<Loan[]>([]);
  const [loading, setLoading] = useState(true);

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
      await loanService.cancelLoan(selectedLoan.id, { reason: cancelReason });
      setCancelModalOpen(false);
      fetchLoans();
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { detail?: string } } };
      setActionError(axiosErr.response?.data?.detail || 'Không thể hủy đơn mượn.');
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
      year: 'numeric',
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-200/80">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Đơn mượn của tôi</h1>
          <p className="text-xs text-slate-500 mt-1">
            Theo dõi tiến trình xét duyệt, trạng thái bàn giao thực tế và minh chứng tiền cọc on-chain
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <span className="text-xs text-slate-500 font-medium">Tổng số đơn:</span>
          <span className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-900">
            {loans.length}
          </span>
        </div>
      </div>

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
      ) : (
        <div className="space-y-4">
          {loans.map((loan) => {
            const isCanCancel = loan.status === 'PENDING' || loan.status === 'APPROVED';
            const depositVND = Number(loan.deposit_amount).toLocaleString('vi-VN');

            // Stepper progress index
            // 0: PENDING, 1: APPROVED, 2: ACTIVE, 3: RETURNED/DISPUTED/CANCELLED
            let stepIndex = 0;
            if (loan.status === 'APPROVED') stepIndex = 1;
            else if (loan.status === 'ACTIVE') stepIndex = 2;
            else if (['RETURNED', 'DISPUTED', 'CANCELLED', 'REJECTED'].includes(loan.status))
              stepIndex = 3;

            return (
              <div
                key={loan.id}
                className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5 space-y-4 transition-all hover:border-slate-300"
              >
                {/* Top Row: Device Name, Serial, Status */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center space-x-2">
                      <h3 className="text-base font-bold text-slate-900 tracking-tight">
                        {loan.equipment?.name || `Thiết bị #${loan.equipment_id}`}
                      </h3>
                      <span className="text-xs text-slate-400 font-mono">
                        ({loan.equipment?.serial_number || 'N/A'})
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Đơn mượn #{loan.id} • Gửi ngày {formatDate(loan.request_date)}
                    </p>
                  </div>

                  <div className="flex items-center space-x-2">
                    {loan.is_overdue && (
                      <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 animate-pulse">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        <span>QUÁ HẠN</span>
                      </span>
                    )}
                    <StatusBadge status={loan.status} />
                  </div>
                </div>

                {/* Progress Stepper (Visual Lifecycle) */}
                <div className="py-2">
                  <div className="grid grid-cols-4 gap-2 text-center text-[11px] font-medium text-slate-600">
                    <div className={stepIndex >= 0 ? 'text-indigo-600 font-bold' : 'text-slate-400'}>
                      1. Gửi yêu cầu
                    </div>
                    <div className={stepIndex >= 1 ? 'text-indigo-600 font-bold' : 'text-slate-400'}>
                      2. Duyệt đơn
                    </div>
                    <div className={stepIndex >= 2 ? 'text-indigo-600 font-bold' : 'text-slate-400'}>
                      3. Bàn giao & Dùng
                    </div>
                    <div className={stepIndex >= 3 ? 'text-indigo-600 font-bold' : 'text-slate-400'}>
                      4. Hoàn tất
                    </div>
                  </div>
                  <div className="w-full bg-slate-100 h-1.5 rounded-full mt-2 overflow-hidden flex">
                    <div
                      className={`h-full bg-indigo-600 transition-all duration-300 ${
                        stepIndex === 0
                          ? 'w-1/4'
                          : stepIndex === 1
                            ? 'w-2/4'
                            : stepIndex === 2
                              ? 'w-3/4'
                              : 'w-full'
                      }`}
                    />
                  </div>
                </div>

                {/* Details Bento Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2 text-xs">
                  <div className="p-3 bg-slate-50/70 rounded-xl border border-slate-100">
                    <span className="text-slate-500 text-[10px] uppercase font-semibold block">
                      Dự kiến nhận
                    </span>
                    <span className="text-slate-900 font-medium mt-0.5 block">
                      {formatDate(loan.expected_handover_date)}
                    </span>
                  </div>

                  <div className="p-3 bg-slate-50/70 rounded-xl border border-slate-100">
                    <span className="text-slate-500 text-[10px] uppercase font-semibold block">
                      Hạn chót trả lại
                    </span>
                    <span
                      className={`font-medium mt-0.5 block ${
                        loan.is_overdue ? 'text-rose-600 font-bold' : 'text-slate-900'
                      }`}
                    >
                      {formatDate(loan.due_date)}
                    </span>
                  </div>

                  <div className="p-3 bg-slate-50/70 rounded-xl border border-slate-100">
                    <span className="text-slate-500 text-[10px] uppercase font-semibold block">
                      Ký quỹ mô phỏng
                    </span>
                    <div className="flex items-center space-x-1.5 mt-0.5">
                      <span className="font-mono font-bold text-slate-900">{depositVND} đ</span>
                      <StatusBadge status={loan.deposit_status} size="sm" />
                    </div>
                  </div>

                  <div className="p-3 bg-slate-50/70 rounded-xl border border-slate-100">
                    <span className="text-slate-500 text-[10px] uppercase font-semibold block">
                      Mã Blockchain
                    </span>
                    {loan.on_chain_loan_id ? (
                      <span className="font-mono text-indigo-600 text-[11px] truncate block mt-0.5" title={loan.on_chain_loan_id}>
                        {loan.on_chain_loan_id.substring(0, 16)}...
                      </span>
                    ) : (
                      <span className="text-slate-400 text-[11px] block mt-0.5">
                        Chưa cấp (Chờ duyệt)
                      </span>
                    )}
                  </div>
                </div>

                {/* Bottom Row / Cancel Action */}
                {isCanCancel && (
                  <div className="pt-2 flex justify-end">
                    <button
                      onClick={() => handleOpenCancel(loan)}
                      className="inline-flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 rounded-xl border border-rose-200 transition-colors"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      <span>Hủy yêu cầu mượn</span>
                    </button>
                  </div>
                )}
              </div>
            );
          })}
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
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700">
              {actionError}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Lý do hủy đơn
            </label>
            <textarea
              rows={2}
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              required
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setCancelModalOpen(false)}
              disabled={cancelling}
              className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-xl"
            >
              Quay lại
            </button>
            <button
              type="submit"
              disabled={cancelling}
              className="px-4 py-2 bg-rose-600 text-white text-xs font-semibold rounded-xl hover:bg-rose-700 transition-colors shadow-sm disabled:opacity-50"
            >
              {cancelling ? 'Đang xử lý...' : 'Xác nhận hủy'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
