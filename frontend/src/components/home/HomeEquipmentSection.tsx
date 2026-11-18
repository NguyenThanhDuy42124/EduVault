import React, { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Activity,
  AlertCircle,
  ArrowRight,
  Cpu,
  Laptop,
  Package,
  RefreshCw,
  Tablet,
  Tv,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { equipmentService } from '../../services/equipmentService';
import type { Equipment } from '../../types';
import { EmptyState } from '../EmptyState';
import { CardSkeleton } from '../LoadingSkeleton';
import { StatusBadge } from '../StatusBadge';

const CATEGORY_ORDER = ['LAPTOP', 'TABLET', 'PROJECTOR', 'LAB_TOOL', 'EMBEDDED_KIT'];

const CATEGORY_META: Record<string, { label: string; description: string }> = {
  LAPTOP: {
    label: 'Laptop & Máy trạm',
    description: 'Máy tính cấu hình cao phục vụ lập trình, đồ họa và nghiên cứu.',
  },
  TABLET: {
    label: 'Máy tính bảng',
    description: 'Thiết bị di động cho thuyết trình, ghi chú và kiểm thử ứng dụng.',
  },
  PROJECTOR: {
    label: 'Máy chiếu & Trình chiếu',
    description: 'Thiết bị trình chiếu sắc nét cho hội thảo, bảo vệ đồ án và lớp học.',
  },
  LAB_TOOL: {
    label: 'Thiết bị đo & Phòng Lab',
    description: 'Máy hiện sóng, kính hiển vi và dụng cụ đo kiểm chuyên dụng.',
  },
  EMBEDDED_KIT: {
    label: 'Bộ Kit Nhúng & IoT',
    description: 'Vi điều khiển STM32, Arduino và cảm biến thực hành hệ thống nhúng.',
  },
};

function getCategoryLabel(category: string): string {
  return CATEGORY_META[category]?.label || category;
}

const CategoryIcon: React.FC<{ category: string; className?: string }> = ({
  category,
  className = 'w-9 h-9 text-slate-400',
}) => {
  switch (category) {
    case 'LAPTOP':
      return <Laptop className={className} aria-hidden="true" />;
    case 'TABLET':
      return <Tablet className={className} aria-hidden="true" />;
    case 'PROJECTOR':
      return <Tv className={className} aria-hidden="true" />;
    case 'LAB_TOOL':
      return <Activity className={className} aria-hidden="true" />;
    case 'EMBEDDED_KIT':
      return <Cpu className={className} aria-hidden="true" />;
    default:
      return <Package className={className} aria-hidden="true" />;
  }
};

interface EquipmentCardProps {
  item: Equipment;
  isAdmin: boolean;
  onActionClick: (item: Equipment) => void;
}

const EquipmentCard: React.FC<EquipmentCardProps> = memo(({ item, isAdmin, onActionClick }) => {
  const [imageFailed, setImageFailed] = useState(false);
  const isAvailable = item.status === 'AVAILABLE';
  const depositVnd = Number(item.deposit_amount).toLocaleString('vi-VN');

  return (
    <article className="bg-white rounded-xl border border-slate-200 hover:border-slate-300 hover:shadow-sm transition-all flex flex-col overflow-hidden">
      <div className="aspect-[4/3] w-full bg-slate-50 border-b border-slate-100 overflow-hidden flex items-center justify-center">
        {item.image_url && !imageFailed ? (
          <img
            src={item.image_url}
            alt={item.name}
            loading="lazy"
            onError={() => setImageFailed(true)}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-slate-50">
            <CategoryIcon category={item.category} />
          </div>
        )}
      </div>

      <div className="p-4 flex-1 flex flex-col">
        <div className="flex items-center justify-between gap-2 mb-2">
          <span className="text-[11px] font-mono font-medium text-slate-500">{item.category}</span>
          <StatusBadge status={item.status} size="sm" />
        </div>

        <h3 className="text-sm font-bold text-slate-900 tracking-tight line-clamp-1" title={item.name}>
          {item.name}
        </h3>
        <p className="text-xs text-slate-500 mt-1 line-clamp-1" title={item.specifications || item.serial_number}>
          {item.specifications || item.serial_number}
        </p>

        <div className="mt-auto pt-3.5 border-t border-slate-100 flex items-center justify-between gap-2">
          <div>
            <span className="block text-[11px] text-slate-500">Tiền cọc cần đóng</span>
            <span className="text-sm font-bold text-slate-900 font-mono tabular-nums">
              {depositVnd} đ
            </span>
          </div>

          <button
            type="button"
            disabled={!isAdmin && !isAvailable}
            onClick={() => onActionClick(item)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
              isAdmin
                ? 'bg-slate-100 text-slate-800 hover:bg-slate-200 border border-slate-200 cursor-pointer'
                : isAvailable
                ? 'bg-slate-900 text-white hover:bg-slate-800 cursor-pointer'
                : 'bg-slate-100 text-slate-500 cursor-not-allowed'
            }`}
          >
            {isAdmin ? 'Sửa' : isAvailable ? 'Đăng ký mượn' : 'Đã đặt'}
          </button>
        </div>
      </div>
    </article>
  );
});

EquipmentCard.displayName = 'EquipmentCard';

export const HomeEquipmentSection: React.FC = memo(() => {
  const { isAuthenticated, role } = useAuth();
  const navigate = useNavigate();

  const [equipmentList, setEquipmentList] = useState<Equipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [reloadTick, setReloadTick] = useState(0);

  useEffect(() => {
    let cancelled = false;

    const loadEquipment = async () => {
      setLoading(true);
      setErrorMessage(null);
      try {
        const data = await equipmentService.getAll({ limit: 100 });
        if (!cancelled) {
          setEquipmentList(data);
        }
      } catch (err: unknown) {
        if (!cancelled) {
          const axiosErr = err as { response?: { data?: { detail?: string } }; message?: string };
          setErrorMessage(
            axiosErr?.response?.data?.detail ||
              'Không thể tải danh sách thiết bị từ máy chủ. Vui lòng thử lại.'
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadEquipment();

    return () => {
      cancelled = true;
    };
  }, [reloadTick]);

  const handleRetry = useCallback(() => {
    setReloadTick((prev) => prev + 1);
  }, []);

  const handleBorrowClick = useCallback(
    (item: Equipment) => {
      if (!isAuthenticated) {
        navigate(`/login?reason=borrow&borrow=${item.id}`, {
          state: {
            from: { pathname: '/equipment', search: `?borrow=${item.id}` },
            authNotice: 'Vui lòng đăng nhập hoặc đăng ký tài khoản để mượn thiết bị.',
          },
        });
        return;
      }

      if (role === 'ADMIN') {
        navigate(`/admin/inventory?edit=${item.id}`);
        return;
      }

      navigate(`/equipment?borrow=${item.id}`);
    },
    [isAuthenticated, role, navigate]
  );

  const groupedCategories = useMemo(() => {
    const map = new Map<string, Equipment[]>();
    for (const item of equipmentList) {
      const cat = item.category || 'OTHER';
      const existing = map.get(cat);
      if (existing) {
        existing.push(item);
      } else {
        map.set(cat, [item]);
      }
    }

    return Array.from(map.entries())
      .sort(([a], [b]) => {
        const idxA = CATEGORY_ORDER.indexOf(a);
        const idxB = CATEGORY_ORDER.indexOf(b);
        if (idxA !== -1 && idxB !== -1) return idxA - idxB;
        if (idxA !== -1) return -1;
        if (idxB !== -1) return 1;
        return a.localeCompare(b);
      })
      .map(([category, items]) => ({
        category,
        label: getCategoryLabel(category),
        items,
        available: items.filter((item) => item.status === 'AVAILABLE').length,
      }));
  }, [equipmentList]);

  const featuredGroups = groupedCategories.slice(0, 3);

  return (
    <section
      id="thiet-bi"
      aria-labelledby="home-equipment-heading"
      className="scroll-mt-20 space-y-8"
    >
      {/* Category Tiles Strip (inspired by storefront category row) */}
      {!loading && !errorMessage && groupedCategories.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <h2 id="home-equipment-heading" className="text-xl font-bold text-slate-900 tracking-tight">
              Danh mục thiết bị
            </h2>
            <Link
              to="/equipment"
              className="inline-flex items-center space-x-1 text-xs font-semibold text-indigo-700 hover:text-indigo-800 transition-colors shrink-0"
            >
              <span>Xem tất cả</span>
              <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
            </Link>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {groupedCategories.map((group) => (
              <Link
                key={group.category}
                to={`/equipment?category=${encodeURIComponent(group.category)}`}
                className="group bg-white border border-slate-200 hover:border-indigo-300 hover:shadow-xs rounded-xl p-4 flex flex-col justify-between gap-3 transition-all"
              >
                <div className="w-9 h-9 rounded-lg bg-slate-900 text-white flex items-center justify-center group-hover:bg-indigo-600 transition-colors">
                  <CategoryIcon category={group.category} className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 group-hover:text-indigo-700 transition-colors">
                    {group.label}
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {group.available}/{group.items.length} thiết bị sẵn sàng
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {loading ? (
        <div
          aria-label="Đang tải danh sách thiết bị"
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5"
        >
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </div>
      ) : errorMessage ? (
        <div
          role="alert"
          className="bg-white border border-rose-200 rounded-xl p-8 text-center space-y-3"
        >
          <AlertCircle className="w-8 h-8 text-rose-600 mx-auto" aria-hidden="true" />
          <div className="space-y-1">
            <h3 className="text-base font-bold text-slate-900">Không tải được danh sách thiết bị</h3>
            <p className="text-xs text-slate-600 max-w-md mx-auto">{errorMessage}</p>
          </div>
          <button
            type="button"
            onClick={handleRetry}
            className="inline-flex items-center space-x-1.5 px-4 py-2 bg-slate-900 text-white text-xs font-semibold rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Thử lại</span>
          </button>
        </div>
      ) : equipmentList.length === 0 ? (
        <EmptyState
          title="Chưa có thiết bị nào trong hệ thống"
          description="Danh mục thiết bị hiện đang trống. Vui lòng thử tải lại hoặc quay lại sau khi Quản trị viên cập nhật kho."
          actionText="Thử lại"
          onAction={handleRetry}
        />
      ) : (
        <div className="space-y-8">
          {featuredGroups.map((group) => (
            <div key={group.category} className="space-y-3.5">
              <div className="flex items-center justify-between gap-3 border-b border-slate-200 pb-2.5">
                <div className="flex items-center space-x-2.5">
                  <h3 className="text-lg font-bold text-slate-900 tracking-tight">
                    {group.label}
                  </h3>
                  <span className="text-xs font-medium text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md tabular-nums">
                    {group.available}/{group.items.length} sẵn sàng
                  </span>
                </div>

                <Link
                  to={`/equipment?category=${encodeURIComponent(group.category)}`}
                  className="inline-flex items-center space-x-1 text-xs font-semibold text-indigo-700 hover:text-indigo-900 px-2.5 py-1.5 rounded-lg hover:bg-indigo-50 transition-colors shrink-0"
                >
                  <span>Xem thêm</span>
                  <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                </Link>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                {group.items.slice(0, 4).map((item) => (
                  <EquipmentCard
                    key={item.id}
                    item={item}
                    isAdmin={role === 'ADMIN'}
                    onActionClick={handleBorrowClick}
                  />
                ))}
              </div>
            </div>
          ))}

          {groupedCategories.length > featuredGroups.length && (
            <div className="flex justify-center pt-1">
              <Link
                to="/equipment"
                className="inline-flex items-center space-x-2 px-5 py-2.5 bg-white text-slate-800 border border-slate-300 hover:bg-slate-50 text-xs font-semibold rounded-lg shadow-2xs transition-colors"
              >
                <span>Xem thêm toàn bộ {equipmentList.length} thiết bị</span>
                <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
              </Link>
            </div>
          )}
        </div>
      )}
    </section>
  );
});

HomeEquipmentSection.displayName = 'HomeEquipmentSection';
