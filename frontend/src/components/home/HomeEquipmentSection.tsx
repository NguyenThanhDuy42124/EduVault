import React, { memo, useCallback, useEffect, useState } from 'react';
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

const CategoryIcon: React.FC<{ category: string }> = ({ category }) => {
  switch (category) {
    case 'LAPTOP':
      return <Laptop className="w-9 h-9 text-slate-400" aria-hidden="true" />;
    case 'TABLET':
      return <Tablet className="w-9 h-9 text-slate-400" aria-hidden="true" />;
    case 'PROJECTOR':
      return <Tv className="w-9 h-9 text-slate-400" aria-hidden="true" />;
    case 'LAB_TOOL':
      return <Activity className="w-9 h-9 text-slate-400" aria-hidden="true" />;
    case 'EMBEDDED_KIT':
      return <Cpu className="w-9 h-9 text-slate-400" aria-hidden="true" />;
    default:
      return <Package className="w-9 h-9 text-slate-400" aria-hidden="true" />;
  }
};

interface EquipmentCardProps {
  item: Equipment;
  onBorrowClick: (item: Equipment) => void;
}

const EquipmentCard: React.FC<EquipmentCardProps> = memo(({ item, onBorrowClick }) => {
  const [imageFailed, setImageFailed] = useState(false);
  const isAvailable = item.status === 'AVAILABLE';
  const depositVnd = Number(item.deposit_amount).toLocaleString('vi-VN');

  return (
    <article className="bg-white rounded-xl border border-slate-200 hover:border-slate-300 transition-colors flex flex-col overflow-hidden">
      <div className="aspect-[16/10] w-full bg-slate-100 border-b border-slate-100 overflow-hidden flex items-center justify-center">
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

      <div className="p-5 flex-1 flex flex-col">
        <div className="flex items-center justify-between gap-2 mb-2.5">
          <span className="text-xs font-mono font-medium text-slate-600">{item.category}</span>
          <StatusBadge status={item.status} />
        </div>

        <h3 className="text-base font-bold text-slate-900 tracking-tight line-clamp-1">
          {item.name}
        </h3>
        <p className="text-xs font-mono text-slate-600 mt-1">
          Mã thiết bị: {item.serial_number}
        </p>

        <div className="mt-auto pt-4 border-t border-slate-100 flex items-center justify-between gap-3">
          <div>
            <span className="block text-xs text-slate-600">Tiền cọc mô phỏng</span>
            <span className="text-sm font-bold text-slate-900 font-mono tabular-nums">
              {depositVnd} đ
            </span>
          </div>

          <button
            type="button"
            disabled={!isAvailable}
            onClick={() => onBorrowClick(item)}
            className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
              isAvailable
                ? 'bg-slate-900 text-white hover:bg-slate-800 cursor-pointer'
                : 'bg-slate-100 text-slate-500 cursor-not-allowed'
            }`}
          >
            {isAvailable ? 'Đăng ký mượn' : 'Không khả dụng'}
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
        navigate('/equipment');
        return;
      }

      navigate(`/equipment?borrow=${item.id}`);
    },
    [isAuthenticated, role, navigate]
  );

  const availableCount = equipmentList.filter((item) => item.status === 'AVAILABLE').length;

  return (
    <section
      id="thiet-bi"
      aria-labelledby="home-equipment-heading"
      className="scroll-mt-20 space-y-6"
    >
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h2 id="home-equipment-heading" className="text-2xl font-bold text-slate-900 tracking-tight">
            Thiết bị hiện có
          </h2>
          <p className="text-sm text-slate-600 mt-1">
            Danh sách thiết bị học tập tại phòng lab. Cần đăng nhập tài khoản trước khi gửi yêu cầu mượn.
          </p>
        </div>

        <div className="flex items-center gap-4 shrink-0">
          {!loading && !errorMessage && (
            <span className="text-xs font-medium text-emerald-800 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-lg tabular-nums">
              {availableCount}/{equipmentList.length} sẵn sàng
            </span>
          )}
          <Link
            to="/equipment"
            className="inline-flex items-center space-x-1 text-xs font-semibold text-indigo-700 hover:text-indigo-800 transition-colors"
          >
            <span>Danh mục đầy đủ</span>
            <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
          </Link>
        </div>
      </div>

      {loading ? (
        <div
          aria-label="Đang tải danh sách thiết bị"
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5"
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {equipmentList.map((item) => (
            <EquipmentCard key={item.id} item={item} onBorrowClick={handleBorrowClick} />
          ))}
        </div>
      )}
    </section>
  );
});

HomeEquipmentSection.displayName = 'HomeEquipmentSection';
