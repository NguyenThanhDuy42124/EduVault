import React, { useEffect, useState, useMemo } from 'react';
import { equipmentService } from '../services/equipmentService';
import { Equipment, EquipmentCreateRequest, EquipmentUpdateRequest, EquipmentStatus } from '../types';
import { StatusBadge } from '../components/StatusBadge';
import { TableSkeleton } from '../components/LoadingSkeleton';
import { Modal } from '../components/Modal';
import {
  Plus,
  Search,
  Edit2,
  Trash2,
} from 'lucide-react';

export const AdminInventoryPage: React.FC = () => {
  const [equipmentList, setEquipmentList] = useState<Equipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');

  // Add Modal State
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [newSerial, setNewSerial] = useState('');
  const [newName, setNewName] = useState('');
  const [newCategory, setNewCategory] = useState('LAPTOP');
  const [newSpecs, setNewSpecs] = useState('');
  const [newDeposit, setNewDeposit] = useState('500000');

  // Edit Modal State
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Equipment | null>(null);
  const [editStatus, setEditStatus] = useState<EquipmentStatus>('AVAILABLE');
  const [editSpecs, setEditSpecs] = useState('');
  const [editDeposit, setEditDeposit] = useState('0');

  // Action status
  const [submitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const fetchInventory = async () => {
    setLoading(true);
    try {
      const data = await equipmentService.getAll();
      setEquipmentList(data);
    } catch {
      // Silently handled
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInventory();
  }, []);

  const categories = useMemo(() => {
    const set = new Set(equipmentList.map((e) => e.category));
    return ['ALL', ...Array.from(set)];
  }, [equipmentList]);

  const filteredItems = useMemo(() => {
    return equipmentList.filter((item) => {
      const matchSearch =
        item.name.toLowerCase().includes(search.toLowerCase()) ||
        item.serial_number.toLowerCase().includes(search.toLowerCase()) ||
        (item.specifications && item.specifications.toLowerCase().includes(search.toLowerCase()));

      const matchCat = selectedCategory === 'ALL' || item.category === selectedCategory;
      return matchSearch && matchCat;
    });
  }, [equipmentList, search, selectedCategory]);

  const handleOpenAdd = () => {
    setNewSerial(`EQ-${Date.now().toString().slice(-6)}`);
    setNewName('');
    setNewCategory('LAPTOP');
    setNewSpecs('');
    setNewDeposit('500000');
    setActionError(null);
    setAddModalOpen(true);
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setActionError(null);
    try {
      const payload: EquipmentCreateRequest = {
        serial_number: newSerial.trim(),
        name: newName.trim(),
        category: newCategory.trim().toUpperCase(),
        specifications: newSpecs.trim() || undefined,
        deposit_amount: parseFloat(newDeposit) || 0,
        status: 'AVAILABLE',
      };
      await equipmentService.create(payload);
      setAddModalOpen(false);
      await fetchInventory();
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { detail?: string } } };
      setActionError(axiosErr.response?.data?.detail || 'Không thể thêm thiết bị mới.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenEdit = (item: Equipment) => {
    setEditingItem(item);
    setEditStatus(item.status);
    setEditSpecs(item.specifications || '');
    setEditDeposit(item.deposit_amount.toString());
    setActionError(null);
    setEditModalOpen(true);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;

    setSubmitting(true);
    setActionError(null);
    try {
      const payload: EquipmentUpdateRequest = {
        status: editStatus,
        specifications: editSpecs.trim() || undefined,
        deposit_amount: parseFloat(editDeposit) || 0,
      };
      await equipmentService.update(editingItem.id, payload);
      setEditModalOpen(false);
      await fetchInventory();
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { detail?: string } } };
      setActionError(axiosErr.response?.data?.detail || 'Không thể cập nhật thiết bị.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa thiết bị này khỏi danh mục kho?')) return;
    try {
      await equipmentService.delete(id);
      await fetchInventory();
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { detail?: string } } };
      alert(axiosErr.response?.data?.detail || 'Không thể xóa thiết bị đang được tham chiếu.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-200/80">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Quản trị kho thiết bị
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Đăng ký thiết bị đào tạo mới, cập nhật định mức ký quỹ và chuyển trạng thái bảo trì
          </p>
        </div>

        <button
          onClick={handleOpenAdd}
          className="inline-flex items-center space-x-1.5 px-3.5 py-2 bg-slate-900 text-white text-xs font-semibold rounded-xl hover:bg-slate-800 transition-colors shadow-sm active:scale-[0.98]"
        >
          <Plus className="w-4 h-4" />
          <span>Thêm thiết bị mới</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-slate-200/80 shadow-sm">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm theo tên máy, số serial..."
            className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div className="flex items-center space-x-1 overflow-x-auto">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 text-xs font-medium rounded-xl whitespace-nowrap transition-colors ${
                selectedCategory === cat
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              {cat === 'ALL' ? 'Tất cả loại' : cat}
            </button>
          ))}
        </div>
      </div>

      {/* Inventory Table */}
      {loading ? (
        <TableSkeleton rows={5} />
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/80 border-b border-slate-200/80 text-slate-500 font-semibold uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="py-3 px-4">ID</th>
                  <th className="py-3 px-4">Serial Number</th>
                  <th className="py-3 px-4">Tên thiết bị</th>
                  <th className="py-3 px-4">Danh mục</th>
                  <th className="py-3 px-4">Định mức cọc (VNĐ)</th>
                  <th className="py-3 px-4">Trạng thái</th>
                  <th className="py-3 px-4 text-right">Tùy chọn</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredItems.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-3 px-4 font-mono text-slate-400">#{item.id}</td>
                    <td className="py-3 px-4 font-mono font-semibold text-slate-900">
                      {item.serial_number}
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-semibold text-slate-900 block">{item.name}</span>
                      <span className="text-[10px] text-slate-500 block truncate max-w-xs mt-0.5">
                        {item.specifications || '--'}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 font-mono">
                        {item.category}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono font-bold text-slate-900">
                      {Number(item.deposit_amount).toLocaleString('vi-VN')} đ
                    </td>
                    <td className="py-3 px-4">
                      <StatusBadge status={item.status} />
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end space-x-1">
                        <button
                          onClick={() => handleOpenEdit(item)}
                          className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                          title="Sửa thông số & trạng thái"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(item.id)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                          title="Xóa thiết bị"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add Equipment Modal */}
      <Modal
        isOpen={addModalOpen}
        onClose={() => !submitting && setAddModalOpen(false)}
        title="Thêm thiết bị mới vào kho"
        subtitle="Khai báo thiết bị thực hành và thiết lập mức cọc quy định"
        maxWidth="lg"
      >
        <form onSubmit={handleAddSubmit} className="space-y-4">
          {actionError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700">
              {actionError}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Số Serial / Mã định danh
              </label>
              <input
                type="text"
                value={newSerial}
                onChange={(e) => setNewSerial(e.target.value)}
                required
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Danh mục thiết bị
              </label>
              <input
                type="text"
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                placeholder="LAPTOP, CAMERA, PROJECTOR..."
                required
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 uppercase"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Tên thiết bị</label>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Ví dụ: Laptop Dell XPS 15 (Core i7, 32GB RAM)"
              required
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Định mức tiền cọc mô phỏng (VNĐ)
            </label>
            <input
              type="number"
              min="0"
              step="50000"
              value={newDeposit}
              onChange={(e) => setNewDeposit(e.target.value)}
              required
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Thông số kỹ thuật / Phụ kiện kèm theo
            </label>
            <textarea
              rows={2}
              value={newSpecs}
              onChange={(e) => setNewSpecs(e.target.value)}
              placeholder="Ghi rõ cấu hình, phụ kiện cáp sạc, adapter..."
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setAddModalOpen(false)}
              disabled={submitting}
              className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-xl"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 bg-slate-900 text-white text-xs font-semibold rounded-xl hover:bg-slate-800 transition-colors shadow-sm disabled:opacity-50"
            >
              {submitting ? 'Đang lưu...' : 'Thêm thiết bị'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Edit Equipment Modal */}
      <Modal
        isOpen={editModalOpen}
        onClose={() => !submitting && setEditModalOpen(false)}
        title="Cập nhật thông tin thiết bị"
        subtitle={editingItem ? `${editingItem.name} (${editingItem.serial_number})` : ''}
        maxWidth="md"
      >
        <form onSubmit={handleEditSubmit} className="space-y-4">
          {actionError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700">
              {actionError}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Trạng thái khả dụng
            </label>
            <select
              value={editStatus}
              onChange={(e) => setEditStatus(e.target.value as EquipmentStatus)}
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="AVAILABLE">Sẵn sàng (AVAILABLE)</option>
              <option value="RESERVED">Đã giữ chỗ (RESERVED)</option>
              <option value="IN_USE">Đang sử dụng (IN_USE)</option>
              <option value="MAINTENANCE">Đang bảo dưỡng (MAINTENANCE)</option>
              <option value="RETIRED">Ngừng cấp phát (RETIRED)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Định mức ký quỹ mô phỏng (VNĐ)
            </label>
            <input
              type="number"
              min="0"
              step="50000"
              value={editDeposit}
              onChange={(e) => setEditDeposit(e.target.value)}
              required
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Thông số kỹ thuật
            </label>
            <textarea
              rows={2}
              value={editSpecs}
              onChange={(e) => setEditSpecs(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setEditModalOpen(false)}
              disabled={submitting}
              className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-xl"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 bg-slate-900 text-white text-xs font-semibold rounded-xl hover:bg-slate-800 transition-colors shadow-sm disabled:opacity-50"
            >
              {submitting ? 'Đang cập nhật...' : 'Lưu thay đổi'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
