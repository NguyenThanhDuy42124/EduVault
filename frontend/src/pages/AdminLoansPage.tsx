import React, { useEffect, useState, useMemo } from 'react';
import { loanService } from '../services/loanService';
import { Loan, ReturnCondition } from '../types';
import { StatusBadge } from '../components/StatusBadge';
import { TableSkeleton } from '../components/LoadingSkeleton';
import { EmptyState } from '../components/EmptyState';
import { Modal } from '../components/Modal';
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

  // Processing state
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Return Inspection Modal State
  const [returnModalOpen, setReturnModalOpen] = useState(false);
  const [selectedLoan, setSelectedLoan] = useState<Loan | null>(null);
  const [returnCondition, setReturnCondition] = useState<ReturnCondition>('GOOD');
  const [manualPenalty, setManualPenalty] = useState<string>('');
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
      // Tab filter
      let matchTab = true;
      if (tab === 'PENDING') matchTab = loan.status === 'PENDING';
      else if (tab === 'APPROVED') matchTab = loan.status === 'APPROVED';
      else if (tab === 'ACTIVE') matchTab = loan.status === 'ACTIVE';
      else if (tab === 'FINISHED')
        matchTab = ['RETURNED', 'DISPUTED', 'CANCELLED', 'REJECTED'].includes(loan.status);

      // Search filter
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

  // Actions
  const handleApprove = async (loanId: number) => {
    setActionLoading(true);
    setActionError(null);
    try {
      await loanService.approveLoan(loanId);
      await fetchLoans();
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { detail?: string } } };
      setActionError(axiosErr.response?.data?.detail || 'Không thể duyệt đơn mượn.');
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
      await loanService.rejectLoan(selectedLoan.id, rejectReason);
      setRejectModalOpen(false);
      await fetchLoans();
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { detail?: string } } };
      setActionError(axiosErr.response?.data?.detail || 'Không thể từ chối đơn mượn.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleHandover = async (loanId: number) => {
    setActionLoading(true);
    setActionError(null);
    try {
      await loanService.handoverLoan(loanId);
      await fetchLoans();
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { detail?: string } } };
      setActionError(axiosErr.response?.data?.detail || 'Không thể xác nhận bàn giao.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleOpenReturnModal = (loan: Loan) => {
    setSelectedLoan(loan);
    setReturnCondition('GOOD');
    setManualPenalty('');
    setInspectionNotes('');
    setActionError(null);
    setReturnModalOpen(true);
  };

  const handleReturnSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLoan) return;

    setActionLoading(true);
    setActionError(null);
    try {
      const penaltyNum = manualPenalty ? parseInt(manualPenalty, 10) : null;
      await loanService.returnLoan(selectedLoan.id, {
        return_condition: returnCondition,
        manual_penalty_percent: penaltyNum,
        admin_notes: inspectionNotes || undefined,
      });

      setReturnModalOpen(false);
      await fetchLoans();
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { detail?: string } } };
      setActionError(axiosErr.response?.data?.detail || 'Không thể xử lý trả máy.');
    } finally {
      setActionLoading(false);
    }
  };

  const formatDate = (isoString?: string | null) => {
    if (!isoString) return '--';
    return new Date(isoString).toLocaleString('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
      day: '2-digit',
      month: '2-digit',
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-200/80">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Điều phối mượn trả thiết bị
          </h1>
          <p className="text-sm text-slate-600 mt-1 max-w-md leading-relaxed">
            Xét duyệt yêu cầu mượn, bàn giao và nghiệm thu hoàn trả.
          </p>
        </div>

        {/* Global Stats */}
        <div className="flex items-center space-x-2 text-xs">
          <span className="px-3 py-1 bg-amber-50 text-amber-700 border border-amber-200/60 rounded-xl font-semibold">
            Chờ duyệt: {loans.filter((l) => l.status === 'PENDING').length}
          </span>
          <span className="px-3 py-1 bg-indigo-50 text-indigo-700 border border-indigo-200/60 rounded-xl font-semibold">
            Đang mượn: {loans.filter((l) => l.status === 'ACTIVE').length}
          </span>
        </div>
      </div>

      {actionError && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl flex items-center space-x-2 text-xs text-rose-700">
          <ShieldAlert className="w-4 h-4 flex-shrink-0 text-rose-600" />
          <span>{actionError}</span>
        </div>
      )}

      {/* Filter and Tab Bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-slate-200/80 shadow-sm">
        {/* Tab Buttons */}
        <div className="flex items-center space-x-1 overflow-x-auto">
          {[
            { id: 'ALL', label: 'Tất cả đơn' },
            { id: 'PENDING', label: 'Chờ duyệt' },
            { id: 'APPROVED', label: 'Đã duyệt (Chờ lấy)' },
            { id: 'ACTIVE', label: 'Đang mượn' },
            { id: 'FINISHED', label: 'Đã hoàn tất / Khác' },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setTab(item.id as typeof tab)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-xl whitespace-nowrap transition-colors ${
                tab === item.id
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="relative w-full md:w-64">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm theo MSSV, tên SV, thiết bị..."
            className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      </div>

      {/* Loans Table */}
      {loading ? (
        <TableSkeleton rows={5} />
      ) : filteredLoans.length === 0 ? (
        <EmptyState
          title="Không tìm thấy đơn mượn nào"
          description="Hiện tại không có đơn mượn nào phù hợp với bộ lọc đã chọn."
        />
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase text-xs tracking-wider">
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
                  const depositVND = Number(loan.deposit_amount).toLocaleString('vi-VN');

                  return (
                    <tr key={loan.id} className="hover:bg-slate-50/50 transition-colors">
                      {/* ID & Overdue */}
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-900">
                        #{loan.id}
                        {loan.is_overdue && (
                          <span className="block text-xs text-rose-600 font-semibold tracking-wider uppercase mt-0.5">
                            Quá hạn
                          </span>
                        )}
                      </td>

                      {/* User */}
                      <td className="py-3.5 px-4">
                        <span className="font-semibold text-slate-900 block truncate max-w-[160px]">
                          {loan.user?.full_name || 'N/A'}
                        </span>
                        <span className="text-xs text-slate-500 font-mono block">
                          {loan.user?.student_staff_id}
                        </span>
                      </td>

                      {/* Equipment */}
                      <td className="py-3.5 px-4">
                        <span className="font-semibold text-slate-900 block truncate max-w-[180px]">
                          {loan.equipment?.name || 'N/A'}
                        </span>
                        <span className="text-xs text-slate-500 font-mono block">
                          {loan.equipment?.serial_number}
                        </span>
                      </td>

                      {/* Dates */}
                      <td className="py-3.5 px-4">
                        <div className="space-y-0.5">
                          <span className="text-slate-600 block">
                            Nhận: {formatDate(loan.expected_handover_date)}
                          </span>
                          <span
                            className={`block font-medium ${
                              loan.is_overdue ? 'text-rose-600 font-bold' : 'text-slate-900'
                            }`}
                          >
                            Hạn: {formatDate(loan.due_date)}
                          </span>
                        </div>
                      </td>

                      {/* Deposit */}
                      <td className="py-3.5 px-4">
                        <span className="font-mono font-bold text-slate-900 block">
                          {depositVND} đ
                        </span>
                        <span className="text-xs text-slate-500 block">
                          {loan.deposit_status}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4">
                        <StatusBadge status={loan.status} />
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end space-x-1.5">
                          {loan.status === 'PENDING' && (
                            <>
                              <button
                                onClick={() => handleApprove(loan.id)}
                                disabled={actionLoading}
                                className="inline-flex items-center space-x-1 px-2.5 py-1.5 bg-emerald-600 text-white font-medium rounded-lg hover:bg-emerald-700 transition-colors shadow-sm disabled:opacity-50"
                                title="Duyệt đơn và ký khóa Mutex trên Blockchain"
                              >
                                <CheckCircle className="w-3.5 h-3.5" />
                                <span>Duyệt</span>
                              </button>
                              <button
                                onClick={() => handleOpenReject(loan)}
                                disabled={actionLoading}
                                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                                title="Từ chối đơn"
                              >
                                <XCircle className="w-4 h-4" />
                              </button>
                            </>
                          )}

                          {loan.status === 'APPROVED' && (
                            <button
                              onClick={() => handleHandover(loan.id)}
                              disabled={actionLoading}
                              className="inline-flex items-center space-x-1 px-2.5 py-1.5 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition-colors shadow-sm disabled:opacity-50"
                              title="Xác nhận bàn giao thiết bị thực tế cho sinh viên"
                            >
                              <PackageCheck className="w-3.5 h-3.5" />
                              <span>Bàn giao</span>
                            </button>
                          )}

                          {loan.status === 'ACTIVE' && (
                            <button
                              onClick={() => handleOpenReturnModal(loan)}
                              disabled={actionLoading}
                              className="inline-flex items-center space-x-1 px-2.5 py-1.5 bg-slate-900 text-white font-medium rounded-lg hover:bg-slate-800 transition-colors shadow-sm disabled:opacity-50"
                              title="Kiểm định thiết bị và xác nhận thu hồi cọc / hoàn cọc"
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
        title="Nghiệm thu hoàn trả & Quyết toán cọc"
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

          {/* Condition radio cards */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-2">
              Hiện trạng thiết bị sau kiểm tra
            </label>
            <div className="grid grid-cols-3 gap-2.5">
              {[
                { id: 'GOOD', label: 'Nguyên vẹn', desc: 'Hoàn trả cọc 100% (nếu đúng hạn)' },
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

          {/* Penalty Override (Optional) */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Phạt phần trăm cọc tùy chỉnh (Tùy chọn, để trống sẽ tự động áp dụng hợp đồng)
            </label>
            <input
              type="number"
              min="0"
              max="100"
              value={manualPenalty}
              onChange={(e) => setManualPenalty(e.target.value)}
              placeholder="Mặc định: Tự động (0% đúng hạn, 10% trễ <=24h, 50% trễ >24h)"
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
          </div>

          {/* Inspection Notes */}
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

          {/* Smart Contract Automated Settlement Notice */}
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-600 flex items-start space-x-2">
            <Info className="w-4 h-4 flex-shrink-0 text-slate-700 mt-0.5" />
            <p>
              Giao dịch <code>confirmReturn</code> sẽ được Backend Relayer ký và phát lên Smart Contract.
              Khoản cọc mô phỏng sẽ chuyển trạng thái <strong>REFUNDED</strong> hoặc <strong>FORFEITED</strong> và thiết bị được giải phóng Mutex tự động.
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
              {actionLoading ? 'Đang xác nhận on-chain...' : 'Xác nhận hoàn tất đơn'}
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
        maxWidth="md"
      >
        <form onSubmit={handleRejectSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Lý do từ chối
            </label>
            <textarea
              rows={2}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              required
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
              {actionLoading ? 'Đang từ chối...' : 'Xác nhận từ chối'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
