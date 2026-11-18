import React, { useEffect, useState, useMemo, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { equipmentService } from '../services/equipmentService';
import { Equipment, EquipmentCreateRequest, EquipmentUpdateRequest, EquipmentStatus } from '../types';
import { StatusBadge } from '../components/StatusBadge';
import { TableSkeleton } from '../components/LoadingSkeleton';
import { Pagination } from '../components/Pagination';
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

const DEFAULT_CATEGORY_OPTIONS = [
  'LAPTOP',
  'TABLET',
  'PROJECTOR',
  'LAB_TOOL',
  'EMBEDDED_KIT',
];

const CUSTOM_CATEGORY_VALUE = '__CUSTOM__';

interface CategorySelectorProps {
  idPrefix: string;
  value: string;
  customValue: string;
  options: string[];
  onChange: (value: string) => void;
  onCustomChange: (value: string) => void;
}

const CategorySelector: React.FC<CategorySelectorProps> = ({
  idPrefix,
  value,
  customValue,
  options,
  onChange,
  onCustomChange,
}) => (
  <div className="space-y-2">
    <select
      id={`${idPrefix}-category`}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-slate-900 font-semibold text-slate-900 cursor-pointer"
    >
      {options.map((opt) => (
        <option key={opt} value={opt}>
          {opt}
        </option>
      ))}
      <option value={CUSTOM_CATEGORY_VALUE}>+ Thêm danh mục mới...</option>
    </select>

    {value === CUSTOM_CATEGORY_VALUE && (
      <div>
        <label htmlFor={`${idPrefix}-custom-category`} className="sr-only">
          Tên danh mục mới
        </label>
        <input
          id={`${idPrefix}-custom-category`}
          type="text"
          value={customValue}
          onChange={(e) => onCustomChange(e.target.value)}
          placeholder="Nhập danh mục (VD: CAMERA...)"
          required
          className="w-full px-3 py-2 text-xs border border-indigo-300 rounded-lg bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-slate-900 uppercase placeholder:normal-case"
        />
      </div>
    )}
  </div>
);

const PRESET_EQUIPMENT_IMAGES = [
  { label: 'MacBook Pro', url: '/images/equipment/macbook-pro.jpg' },
  { label: 'Dell XPS', url: '/images/equipment/dell-xps.jpg' },
  { label: 'ThinkPad X1', url: '/images/equipment/thinkpad-x1.jpg' },
  { label: 'ASUS ROG G14', url: '/images/equipment/asus-rog-g14.jpg' },
  { label: 'iPad Pro', url: '/images/equipment/ipad-pro.jpg' },
  { label: 'Galaxy Tab S9', url: '/images/equipment/galaxy-tab-s9.jpg' },
  { label: 'iPad Air', url: '/images/equipment/ipad-air.jpg' },
  { label: 'Xiaomi Pad 6', url: '/images/equipment/xiaomi-pad-6.jpg' },
  { label: 'Máy chiếu Sony', url: '/images/equipment/sony-projector.jpg' },
  { label: 'Máy chiếu Epson', url: '/images/equipment/epson-eb-e01.jpg' },
  { label: 'ViewSonic DLP', url: '/images/equipment/viewsonic-pa503w.jpg' },
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
  const ITEMS_PER_PAGE = 8;
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [currentPage, setCurrentPage] = useState(1);

  // Add Modal State
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [newSerial, setNewSerial] = useState('');
  const [newName, setNewName] = useState('');
  const [newCategory, setNewCategory] = useState('LAPTOP');
  const [newCustomCategory, setNewCustomCategory] = useState('');
  const [newSpecs, setNewSpecs] = useState('');
  const [newDeposit, setNewDeposit] = useState('500000');
  const [newImageUrl, setNewImageUrl] = useState('');

  // Edit Modal State
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Equipment | null>(null);
  const [editCategory, setEditCategory] = useState('LAPTOP');
  const [editCustomCategory, setEditCustomCategory] = useState('');
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
      const data = await equipmentService.getAll({ limit: 100 });
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

  const categorySelectOptions = useMemo(() => {
    const set = new Set<string>(DEFAULT_CATEGORY_OPTIONS);
    for (const item of equipmentList) {
      if (item.category) set.add(item.category.toUpperCase());
    }
    return Array.from(set);
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

  useEffect(() => {
    setCurrentPage(1);
  }, [search, selectedCategory]);

  const paginatedItems = useMemo(() => {
    const totalPages = Math.max(1, Math.ceil(filteredItems.length / ITEMS_PER_PAGE));
    const safePage = Math.min(currentPage, totalPages);
    const start = (safePage - 1) * ITEMS_PER_PAGE;
    return filteredItems.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredItems, currentPage]);

  const handleOpenAdd = () => {
    setNewSerial(`EQ-${Date.now().toString().slice(-6)}`);
    setNewName('');
    setNewCategory(categorySelectOptions[0] || 'LAPTOP');
    setNewCustomCategory('');
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
    const resolvedCategory = (
      newCategory === CUSTOM_CATEGORY_VALUE ? newCustomCategory : newCategory
    )
      .trim()
      .toUpperCase();

    if (!resolvedCategory) {
      setActionError('Vui lòng chọn hoặc nhập tên danh mục thiết bị.');
      return;
    }

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
        category: resolvedCategory,
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
    setEditCategory(item.category.toUpperCase());
    setEditCustomCategory('');
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

    const resolvedCategory = (
      editCategory === CUSTOM_CATEGORY_VALUE ? editCustomCategory : editCategory
    )
      .trim()
      .toUpperCase();

    if (!resolvedCategory) {
      setActionError('Vui lòng chọn hoặc nhập tên danh mục thiết bị.');
      return;
    }

    setSubmitting(true);
    setActionError(null);
    try {
      const payload: EquipmentUpdateRequest = {
        category: resolvedCategory,
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
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-slate-200">
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
          Quản trị kho thiết bị
        </h1>

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
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-white p-3 rounded-xl border border-slate-200 shadow-xs">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" aria-hidden="true" />
          <label htmlFor="inventory-search" className="sr-only">
            Tìm kiếm thiết bị trong kho
          </label>
          <input
            id="inventory-search"
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm theo tên máy, số serial..."
            className="w-full pl-9 pr-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 border border-slate-200 rounded-lg bg-slate-50/60 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-slate-900 transition-colors"
          />
        </div>

        <div className="flex items-center space-x-1 overflow-x-auto scrollbar-none">
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg whitespace-nowrap transition-colors cursor-pointer ${
                selectedCategory === cat
                  ? 'bg-slate-900 text-white shadow-xs'
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
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase text-xs tracking-wider">
                <tr>
                  <th className="py-3 px-4">ID</th>
                  <th className="py-3 px-4">Serial Number</th>
                  <th className="py-3 px-4">Tên thiết bị</th>
                  <th className="py-3 px-4">Danh mục</th>
                  <th className="py-3 px-4">Tiền cọc cần đóng (VNĐ)</th>
                  <th className="py-3 px-4">Trạng thái</th>
                  <th className="py-3 px-4 text-right">Tùy chọn</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedItems.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-3 px-4 font-mono text-slate-600 tabular-nums">#{item.id}</td>
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
                            <ImageIcon className="w-4 h-4 text-slate-500" aria-hidden="true" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <span className="font-semibold text-slate-900 block">{item.name}</span>
                          <span className="text-xs text-slate-600 block truncate max-w-xs mt-0.5">
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
                    <td className="py-3 px-4 font-mono font-bold text-slate-900 tabular-nums">
                      {Number(item.deposit_amount).toLocaleString('vi-VN')} đ
                    </td>
                    <td className="py-3 px-4">
                      <StatusBadge status={item.status} />
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end space-x-1">
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(item)}
                          className="p-2 text-slate-600 hover:text-indigo-700 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                          title="Sửa thông số & trạng thái"
                          aria-label={`Sửa thiết bị ${item.name}`}
                        >
                          <Edit2 className="w-3.5 h-3.5" aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(item.id)}
                          className="p-2 text-slate-600 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                          title="Xóa thiết bị"
                          aria-label={`Xóa thiết bị ${item.name}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-3 border-t border-slate-100 bg-slate-50/50">
            <Pagination
              currentPage={currentPage}
              totalItems={filteredItems.length}
              pageSize={ITEMS_PER_PAGE}
              onPageChange={setCurrentPage}
            />
          </div>
        </div>
      )}

      {/* Add Equipment Modal */}
      <Modal
        isOpen={addModalOpen}
        onClose={() => !submitting && setAddModalOpen(false)}
        title="Thêm thiết bị mới vào kho"
        maxWidth="lg"
      >
        <form onSubmit={handleAddSubmit} className="space-y-4">
          {actionError && (
            <div role="alert" className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700">
              {actionError}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="add-serial" className="block text-xs font-semibold text-slate-700 mb-1">
                Số Serial / Mã định danh
              </label>
              <input
                id="add-serial"
                type="text"
                value={newSerial}
                onChange={(e) => setNewSerial(e.target.value)}
                required
                className="w-full px-3 py-2 text-xs text-slate-900 border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-slate-900 font-mono"
              />
            </div>
            <div>
              <label htmlFor="add-category" className="block text-xs font-semibold text-slate-700 mb-1">
                Danh mục thiết bị
              </label>
              <CategorySelector
                idPrefix="add"
                value={newCategory}
                customValue={newCustomCategory}
                options={categorySelectOptions}
                onChange={setNewCategory}
                onCustomChange={setNewCustomCategory}
              />
            </div>
          </div>

          <div>
            <label htmlFor="add-name" className="block text-xs font-semibold text-slate-700 mb-1">
              Tên thiết bị
            </label>
            <input
              id="add-name"
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Ví dụ: Laptop Dell XPS 15 (Core i7, 32GB RAM)"
              required
              className="w-full px-3 py-2 text-xs text-slate-900 border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-slate-900"
            />
          </div>

          <div>
            <label htmlFor="add-deposit" className="block text-xs font-semibold text-slate-700 mb-1">
              Tiền cọc cần đóng (VNĐ)
            </label>
            <input
              id="add-deposit"
              type="number"
              min="0"
              step="50000"
              value={newDeposit}
              onChange={(e) => setNewDeposit(e.target.value)}
              required
              className="w-full px-3 py-2 text-xs text-slate-900 border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-slate-900 font-mono tabular-nums"
            />
          </div>

          <div>
            <label htmlFor="add-image-url" className="block text-xs font-semibold text-slate-700 mb-1">
              Hình ảnh minh họa thiết bị <span className="text-rose-600">*</span>
            </label>
            <div className="space-y-2.5">
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  id="add-image-url"
                  type="text"
                  value={newImageUrl}
                  onChange={(e) => setNewImageUrl(e.target.value)}
                  placeholder="/images/equipment/macbook-pro.jpg hoặc URL ảnh..."
                  required
                  className="flex-1 px-3 py-2 text-xs text-slate-900 border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-slate-900 font-mono"
                />
                <label className="inline-flex items-center justify-center space-x-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 cursor-pointer shrink-0 transition-colors">
                  <Upload className="w-3.5 h-3.5" aria-hidden="true" />
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
                <div className="h-28 w-full rounded-lg border border-slate-200 bg-slate-50 overflow-hidden flex items-center justify-center">
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
            <label htmlFor="add-specs" className="block text-xs font-semibold text-slate-700 mb-1">
              Thông số kỹ thuật / Phụ kiện kèm theo
            </label>
            <textarea
              id="add-specs"
              rows={2}
              value={newSpecs}
              onChange={(e) => setNewSpecs(e.target.value)}
              placeholder="Ghi rõ cấu hình, phụ kiện cáp sạc, adapter..."
              className="w-full px-3 py-2 text-xs text-slate-900 border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-slate-900"
            />
          </div>

          <div className="flex justify-end space-x-2 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setAddModalOpen(false)}
              disabled={submitting}
              className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-lg cursor-pointer transition-colors"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 bg-slate-900 text-white text-xs font-semibold rounded-lg hover:bg-slate-800 transition-colors shadow-xs disabled:opacity-50 cursor-pointer"
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
            <div role="alert" className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700">
              {actionError}
            </div>
          )}

          <div>
            <label htmlFor="edit-category" className="block text-xs font-semibold text-slate-700 mb-1">
              Danh mục thiết bị
            </label>
            <CategorySelector
              idPrefix="edit"
              value={editCategory}
              customValue={editCustomCategory}
              options={categorySelectOptions}
              onChange={setEditCategory}
              onCustomChange={setEditCustomCategory}
            />
          </div>

          <div>
            <label htmlFor="edit-status" className="block text-xs font-semibold text-slate-700 mb-1">
              Trạng thái khả dụng
            </label>
            <select
              id="edit-status"
              value={editStatus}
              onChange={(e) => setEditStatus(e.target.value as EquipmentStatus)}
              className="w-full px-3 py-2 text-xs text-slate-900 border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-slate-900 cursor-pointer"
            >
              <option value="AVAILABLE">Sẵn sàng (AVAILABLE)</option>
              <option value="RESERVED">Đã giữ chỗ (RESERVED)</option>
              <option value="IN_USE">Đang sử dụng (IN_USE)</option>
              <option value="MAINTENANCE">Đang bảo dưỡng (MAINTENANCE)</option>
              <option value="RETIRED">Ngừng cấp phát (RETIRED)</option>
            </select>
          </div>

          <div>
            <label htmlFor="edit-deposit" className="block text-xs font-semibold text-slate-700 mb-1">
              Tiền cọc cần đóng (VNĐ)
            </label>
            <input
              id="edit-deposit"
              type="number"
              min="0"
              step="50000"
              value={editDeposit}
              onChange={(e) => setEditDeposit(e.target.value)}
              required
              className="w-full px-3 py-2 text-xs text-slate-900 border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-slate-900 font-mono tabular-nums"
            />
          </div>

          <div>
            <label htmlFor="edit-image-url" className="block text-xs font-semibold text-slate-700 mb-1">
              Hình ảnh minh họa
            </label>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                id="edit-image-url"
                type="text"
                value={editImageUrl}
                onChange={(e) => setEditImageUrl(e.target.value)}
                placeholder="/images/equipment/..."
                className="flex-1 px-3 py-2 text-xs text-slate-900 border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-slate-900 font-mono"
              />
              <label className="inline-flex items-center justify-center space-x-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 cursor-pointer shrink-0 transition-colors">
                <Upload className="w-3.5 h-3.5" aria-hidden="true" />
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
            <label htmlFor="edit-specs" className="block text-xs font-semibold text-slate-700 mb-1">
              Thông số kỹ thuật
            </label>
            <textarea
              id="edit-specs"
              rows={2}
              value={editSpecs}
              onChange={(e) => setEditSpecs(e.target.value)}
              className="w-full px-3 py-2 text-xs text-slate-900 border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-slate-900"
            />
          </div>

          <div className="flex justify-end space-x-2 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setEditModalOpen(false)}
              disabled={submitting}
              className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-lg cursor-pointer transition-colors"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 bg-slate-900 text-white text-xs font-semibold rounded-lg hover:bg-slate-800 transition-colors shadow-xs disabled:opacity-50 cursor-pointer"
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
