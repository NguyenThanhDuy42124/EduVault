import React, { useEffect, useState, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
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
} from 'lucide-react';

export const EquipmentPage: React.FC = () => {
  const { role } = useAuth();
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
      // Handled silently
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
      const matchSearch =
        item.name.toLowerCase().includes(search.toLowerCase()) ||
        item.serial_number.toLowerCase().includes(search.toLowerCase()) ||
        (item.specifications && item.specifications.toLowerCase().includes(search.toLowerCase()));

      const matchCategory = selectedCategory === 'ALL' || item.category === selectedCategory;
      const matchStatus = selectedStatus === 'ALL' || item.status === selectedStatus;

      return matchSearch && matchCategory && matchStatus;
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

  const handleBorrowSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEquipment) return;

    if (new Date(dueDate) <= new Date(expectedHandover)) {
      setActionError('Hạn trả thiết bị phải sau thời gian dự kiến nhận.');
      return;
    }

    setSubmitting(true);
    setActionError(null);
    try {
      await loanService.requestLoan({
        equipment_id: selectedEquipment.id,
        expected_handover_date: new Date(expectedHandover).toISOString(),
        due_date: new Date(dueDate).toISOString(),
        admin_notes: notes.trim() || undefined,
      });

      setActionSuccess(
        'Đã gửi đơn mượn thành công! Đơn đang ở trạng thái Chờ duyệt. Bạn có thể theo dõi trong mục "Đơn mượn của tôi".'
      );
      fetchEquipment();
      setTimeout(() => {
        setBorrowModalOpen(false);
      }, 2000);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { detail?: string } } };
      setActionError(
        axiosErr.response?.data?.detail || 'Không thể tạo đơn mượn. Vui lòng thử lại.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-200/80">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Danh mục thiết bị</h1>
          <p className="text-xs text-slate-500 mt-1">
            Tra cứu thiết bị thực hành sẵn có, cấu hình kỹ thuật và mức ký quỹ mô phỏng bảo toàn trên Blockchain
          </p>
        </div>

        {/* Global Summary Badge */}
        <div className="flex items-center space-x-3 text-xs">
          <div className="px-3 py-1.5 bg-white border border-slate-200/80 rounded-xl shadow-sm flex items-center space-x-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span className="text-slate-600 font-medium">
              Sẵn sàng:{' '}
              <strong className="text-slate-900">
                {equipmentList.filter((e) => e.status === 'AVAILABLE').length}
              </strong>
            </span>
          </div>
          <div className="px-3 py-1.5 bg-white border border-slate-200/80 rounded-xl shadow-sm flex items-center space-x-2">
            <span className="w-2 h-2 rounded-full bg-indigo-500" />
            <span className="text-slate-600 font-medium">
              Tổng số:{' '}
              <strong className="text-slate-900">{equipmentList.length}</strong>
            </span>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-sm">
        {/* Search Input */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm theo tên máy, serial (ví dụ: DELL-XPS, CAM-SONY)..."
            className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-200 rounded-xl bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
          />
        </div>

        {/* Category Chips */}
        <div className="flex items-center space-x-1 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-colors ${
                selectedCategory === cat
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              {cat === 'ALL' ? 'Tất cả loại' : cat}
            </button>
          ))}
        </div>

        {/* Status Dropdown */}
        <div className="flex items-center space-x-1.5 border-l border-slate-200 pl-3">
          <SlidersHorizontal className="w-3.5 h-3.5 text-slate-400" />
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredItems.map((item) => {
            const isAvailable = item.status === 'AVAILABLE';
            const depositVND = Number(item.deposit_amount).toLocaleString('vi-VN');

            return (
              <div
                key={item.id}
                className="bg-white rounded-2xl border border-slate-200/80 hover:border-slate-300 p-5 shadow-sm transition-all flex flex-col justify-between group"
              >
                <div>
                  {/* Top Bar: Category & Status */}
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <span className="text-[10px] font-semibold tracking-wider text-slate-500 uppercase bg-slate-100 px-2.5 py-0.5 rounded-md font-mono">
                      {item.category}
                    </span>
                    <StatusBadge status={item.status} />
                  </div>

                  {/* Device Header */}
                  <h3 className="text-base font-bold text-slate-900 group-hover:text-indigo-600 transition-colors tracking-tight line-clamp-1">
                    {item.name}
                  </h3>
                  <p className="text-[11px] text-slate-500 font-mono mt-0.5">
                    Serial: {item.serial_number}
                  </p>

                  {/* Specifications */}
                  <div className="mt-3.5 p-3 rounded-xl bg-slate-50 border border-slate-100 text-xs text-slate-600 line-clamp-2 leading-relaxed">
                    {item.specifications || 'Không có mô tả thông số kỹ thuật đặc thù.'}
                  </div>
                </div>

                {/* Bottom Details & Action */}
                <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-slate-500 font-medium block">
                      Ký quỹ mô phỏng
                    </span>
                    <span className="text-sm font-bold text-slate-900 font-mono">
                      {depositVND} đ
                    </span>
                  </div>

                  {role === 'BORROWER' ? (
                    <button
                      onClick={() => handleOpenBorrowModal(item)}
                      disabled={!isAvailable}
                      className={`px-3.5 py-1.5 text-xs font-semibold rounded-xl transition-all shadow-sm active:scale-[0.98] ${
                        isAvailable
                          ? 'bg-slate-900 text-white hover:bg-slate-800'
                          : 'bg-slate-100 text-slate-400 cursor-not-allowed shadow-none'
                      }`}
                    >
                      {isAvailable ? 'Đăng ký mượn' : 'Không khả dụng'}
                    </button>
                  ) : (
                    <span className="text-[11px] font-medium text-slate-500 bg-slate-100 px-2.5 py-1 rounded-lg">
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
            <h4 className="text-base font-bold text-slate-900">Gửi yêu cầu mượn thành công!</h4>
            <p className="text-xs text-slate-600 max-w-sm mx-auto">{actionSuccess}</p>
          </div>
        ) : (
          <form onSubmit={handleBorrowSubmit} className="space-y-4">
            {actionError && (
              <div className="p-3 bg-rose-50 border border-rose-200/80 rounded-xl flex items-start space-x-2 text-xs text-rose-700">
                <ShieldAlert className="w-4 h-4 flex-shrink-0 mt-0.5 text-rose-600" />
                <span>{actionError}</span>
              </div>
            )}

            {/* Dates row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Ngày nhận dự kiến
                </label>
                <div className="relative">
                  <Calendar className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  <input
                    type="datetime-local"
                    value={expectedHandover}
                    onChange={(e) => setExpectedHandover(e.target.value)}
                    required
                    className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-xl bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Hạn chót trả lại máy
                </label>
                <div className="relative">
                  <Calendar className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  <input
                    type="datetime-local"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    required
                    className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-xl bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Mục đích sử dụng / Ghi chú đề xuất
              </label>
              <div className="relative">
                <FileText className="w-4 h-4 absolute left-3 top-2.5 text-slate-400 pointer-events-none" />
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Ví dụ: Phục vụ đồ án tốt nghiệp, bài tập lớn môn Lập trình Mạng..."
                  className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-xl bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            {/* Simulated Deposit & Penalty Rules Summary */}
            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80 text-[11px] text-slate-600 space-y-2">
              <div className="flex items-center justify-between font-semibold text-slate-900 border-b border-slate-200/60 pb-1.5">
                <span>Số tiền ký quỹ mô phỏng:</span>
                <span className="font-mono text-indigo-700 text-xs">
                  {selectedEquipment ? Number(selectedEquipment.deposit_amount).toLocaleString('vi-VN') : 0} VNĐ
                </span>
              </div>
              <div className="flex items-start space-x-1.5 text-slate-500">
                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-indigo-500" />
                <p>
                  Tiền cọc mô phỏng được khóa tự động trên Smart Contract khi nhận bàn giao máy.
                  Hoàn trả 100% khi trả máy đúng hạn và nguyên vẹn. Trễ &le; 24h phạt 10%, trễ &gt; 24h phạt 50%.
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="pt-3 border-t border-slate-100 flex items-center justify-end space-x-2">
              <button
                type="button"
                onClick={() => setBorrowModalOpen(false)}
                disabled={submitting}
                className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
              >
                Hủy bỏ
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-2 bg-slate-900 text-white text-xs font-semibold rounded-xl hover:bg-slate-800 transition-colors shadow-sm active:scale-[0.98] disabled:opacity-50"
              >
                {submitting ? 'Đang gửi...' : 'Xác nhận đăng ký mượn'}
              </button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
};
