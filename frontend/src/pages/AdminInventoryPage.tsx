import React, { useEffect, useState, useMemo, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
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
  ShieldAlert,
  Image as ImageIcon,
  Upload,
  LayoutGrid,
} from 'lucide-react';

const PRESET_EQUIPMENT_IMAGES = [
  { label: 'MacBook Pro', url: '/images/equipment/macbook-pro.jpg' },
  { label: 'Dell XPS', url: '/images/equipment/dell-xps.jpg' },
  { label: 'iPad Pro', url: '/images/equipment/ipad-pro.jpg' },
  { label: 'Máy chiếu Sony', url: '/images/equipment/sony-projector.jpg' },
  { label: 'Máy đo Rigol', url: '/images/equipment/rigol-oscilloscope.jpg' },
  { label: 'Kính hiển vi', url: '/images/equipment/andonstar-microscope.jpg' },
  { label: 'Kit STM32', url: '/images/equipment/stm32-kit.jpg' },
  { label: 'Kit Arduino', url: '/images/equipment/arduino-kit.jpg' },
];

export const AdminInventoryPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const handledEditParamRef = useRef<string | null>(null);
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
  const [newImageUrl, setNewImageUrl] = useState('');

  // Edit Modal State
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Equipment | null>(null);
  const [editStatus, setEditStatus] = useState<EquipmentStatus>('AVAILABLE');
  const [editSpecs, setEditSpecs] = useState('');
  const [editDeposit, setEditDeposit] = useState('0');
  const [editImageUrl, setEditImageUrl] = useState('');
  const [uploadingImage, setUploadingImage] = useState(false);

  // Action status
  const [submitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

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

  useEffect(() => {
    const addParam = searchParams.get('add');
    if (addParam === '1' && handledEditParamRef.current !== 'add') {
      handledEditParamRef.current = 'add';
      handleOpenAdd();
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.delete('add');
          return next;
        },
        { replace: true }
      );
      return;
    }

    const editId = searchParams.get('edit');
    if (!editId || loading || handledEditParamRef.current === editId) return;
    const target = equipmentList.find((item) => item.id.toString() === editId);
    if (target) {
      handledEditParamRef.current = editId;
      handleOpenEdit(target);
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.delete('edit');
          return next;
        },
        { replace: true }
      );
    }
  }, [searchParams, loading, equipmentList, setSearchParams]);

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
    setNewImageUrl('');
    setActionError(null);
    setAddModalOpen(true);
  };

  const handleUploadImageFile = async (
    file: File | undefined,
    onUrlReady: (url: string) => void
  ) => {
    if (!file) return;
    setUploadingImage(true);
    setActionError(null);
    try {
      const res = await equipmentService.uploadImage(file);
      onUrlReady(res.image_url);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { detail?: string } } };
      setActionError(axiosErr.response?.data?.detail || 'Không thể tải file ảnh lên máy chủ.');
    } finally {
      setUploadingImage(false);
    }
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newImageUrl.trim()) {
      setActionError('Thiết bị mới bắt buộc phải có hình ảnh minh họa (chọn ảnh hoặc tải file lên).');
      return;
    }

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
        image_url: newImageUrl.trim(),
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
    setEditImageUrl(item.image_url || '');
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
        image_url: editImageUrl.trim() || undefined,
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

  // Delete confirmation
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  const handleDelete = async (id: number) => {
    setConfirmDeleteId(id);
  };

  const handleConfirmDelete = async () => {
    if (!confirmDeleteId) return;
    setDeleteError(null);
    try {
      await equipmentService.delete(confirmDeleteId);
      setConfirmDeleteId(null);
      await fetchInventory();
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { detail?: string } } };
      setDeleteError(axiosErr.response?.data?.detail || 'Không thể xóa thiết bị đang được tham chiếu trong đơn mượn.');
      setConfirmDeleteId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Quản trị kho thiết bị
          </h1>
          <p className="text-sm text-slate-600 mt-1 max-w-2xl">
            Đăng ký thiết bị đào tạo mới, cập nhật định mức tiền cọc mô phỏng (VNĐ) và trạng thái bảo trì
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 text-xs">
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
          <button
            type="button"
            onClick={handleOpenAdd}
            className="inline-flex items-center space-x-1.5 px-3.5 py-2 bg-slate-900 text-white font-semibold rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Thêm thiết bị mới</span>
          </button>
          <button
            type="button"
            onClick={() => navigate('/equipment')}
            className="inline-flex items-center space-x-1.5 px-3 py-2 bg-white text-slate-700 border border-slate-300 font-semibold rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
          >
            <LayoutGrid className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Dạng danh sách</span>
          </button>
        </div>
      </div>

      {deleteError && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-lg flex items-start space-x-2.5 text-xs text-rose-700">
          <ShieldAlert className="w-4 h-4 flex-shrink-0 mt-0.5 text-rose-600" />
          <span>{deleteError}</span>
        </div>
      )}

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
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase text-xs tracking-wider">
                <tr>
                  <th className="py-3 px-4">ID</th>
                  <th className="py-3 px-4">Serial Number</th>
                  <th className="py-3 px-4">Tên thiết bị</th>
                  <th className="py-3 px-4">Danh mục</th>
                  <th className="py-3 px-4">Định mức tiền cọc mô phỏng (VNĐ)</th>
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
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 rounded-lg bg-slate-100 border border-slate-200 overflow-hidden flex items-center justify-center shrink-0">
                          {item.image_url ? (
                            <img
                              src={item.image_url}
                              alt={item.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <ImageIcon className="w-4 h-4 text-slate-400" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <span className="font-semibold text-slate-900 block">{item.name}</span>
                          <span className="text-xs text-slate-500 block truncate max-w-xs mt-0.5">
                            {item.specifications || '--'}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded text-xs font-bold bg-slate-100 text-slate-700 font-mono">
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
        subtitle="Khai báo thiết bị thực hành và thiết lập định mức tiền cọc mô phỏng (VNĐ)"
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
              Hình ảnh minh họa thiết bị <span className="text-rose-600">*</span>
            </label>
            <div className="space-y-2.5">
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  value={newImageUrl}
                  onChange={(e) => setNewImageUrl(e.target.value)}
                  placeholder="/images/equipment/macbook-pro.jpg hoặc URL ảnh..."
                  required
                  className="flex-1 px-3 py-2 text-xs border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                />
                <label className="inline-flex items-center justify-center space-x-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 cursor-pointer shrink-0">
                  <Upload className="w-3.5 h-3.5" />
                  <span>{uploadingImage ? 'Đang tải...' : 'Tải ảnh từ máy'}</span>
                  <input
                    type="file"
                    accept=".jpg,.jpeg,.png,.webp,.gif"
                    disabled={uploadingImage}
                    onChange={(e) =>
                      handleUploadImageFile(e.target.files?.[0], (url) => setNewImageUrl(url))
                    }
                    className="hidden"
                  />
                </label>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {PRESET_EQUIPMENT_IMAGES.map((preset) => (
                  <button
                    key={preset.url}
                    type="button"
                    onClick={() => setNewImageUrl(preset.url)}
                    className={`px-2 py-1 rounded-lg text-[11px] font-medium border transition-colors cursor-pointer ${
                      newImageUrl === preset.url
                        ? 'bg-slate-900 text-white border-slate-900'
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>

              {newImageUrl.trim() && (
                <div className="h-28 w-full rounded-xl border border-slate-200 bg-slate-50 overflow-hidden flex items-center justify-center">
                  <img
                    src={newImageUrl.trim()}
                    alt="Xem trước ảnh thiết bị"
                    className="h-full w-full object-cover"
                  />
                </div>
              )}
            </div>
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
              Định mức tiền cọc mô phỏng (VNĐ)
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
              Hình ảnh minh họa
            </label>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                value={editImageUrl}
                onChange={(e) => setEditImageUrl(e.target.value)}
                placeholder="/images/equipment/..."
                className="flex-1 px-3 py-2 text-xs border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
              />
              <label className="inline-flex items-center justify-center space-x-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 cursor-pointer shrink-0">
                <Upload className="w-3.5 h-3.5" />
                <span>{uploadingImage ? 'Đang tải...' : 'Đổi ảnh'}</span>
                <input
                  type="file"
                  accept=".jpg,.jpeg,.png,.webp,.gif"
                  disabled={uploadingImage}
                  onChange={(e) =>
                    handleUploadImageFile(e.target.files?.[0], (url) => setEditImageUrl(url))
                  }
                  className="hidden"
                />
              </label>
            </div>
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

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={confirmDeleteId !== null}
        onClose={() => setConfirmDeleteId(null)}
        title="Xác nhận xóa thiết bị"
        subtitle="Hành động này sẽ xóa thiết bị khỏi danh mục nếu chưa có đơn mượn liên kết"
        maxWidth="sm"
      >
        <div className="space-y-4">
          <p className="text-xs text-slate-600">
            Bạn có chắc chắn muốn xóa thiết bị này khỏi danh mục kho? Hành động này không thể hoàn tác.
          </p>
          <div className="flex justify-end space-x-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setConfirmDeleteId(null)}
              className="px-3.5 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg"
            >
              Hủy bỏ
            </button>
            <button
              type="button"
              onClick={handleConfirmDelete}
              className="px-3.5 py-1.5 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg transition-colors"
            >
              Xác nhận xóa
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
