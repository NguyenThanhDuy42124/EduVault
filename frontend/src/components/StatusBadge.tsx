import React from 'react';
import { EquipmentStatus, LoanStatus, DepositStatus, ReturnCondition } from '../types';

type BadgeType = EquipmentStatus | LoanStatus | DepositStatus | ReturnCondition | string;

interface StatusBadgeProps {
  status: BadgeType;
  size?: 'sm' | 'md';
}

const statusConfig: Record<string, { label: string; className: string }> = {
  // Equipment Statuses
  AVAILABLE: {
    label: 'Sẵn sàng',
    className: 'bg-emerald-50 text-emerald-700 border-emerald-200/60',
  },
  RESERVED: {
    label: 'Đã giữ chỗ',
    className: 'bg-amber-50 text-amber-700 border-amber-200/60',
  },
  IN_USE: {
    label: 'Đang sử dụng',
    className: 'bg-indigo-50 text-indigo-700 border-indigo-200/60',
  },
  MAINTENANCE: {
    label: 'Bảo trì',
    className: 'bg-rose-50 text-rose-700 border-rose-200/60',
  },
  RETIRED: {
    label: 'Ngừng cấp phát',
    className: 'bg-slate-100 text-slate-600 border-slate-200',
  },

  // Loan Statuses
  PENDING: {
    label: 'Chờ duyệt',
    className: 'bg-amber-50 text-amber-700 border-amber-200/60',
  },
  APPROVED: {
    label: 'Đã duyệt',
    className: 'bg-sky-50 text-sky-700 border-sky-200/60',
  },
  ACTIVE: {
    label: 'Đang mượn',
    className: 'bg-indigo-50 text-indigo-700 border-indigo-200/60',
  },
  RETURNED: {
    label: 'Đã hoàn tất',
    className: 'bg-emerald-50 text-emerald-700 border-emerald-200/60',
  },
  REJECTED: {
    label: 'Từ chối',
    className: 'bg-slate-100 text-slate-600 border-slate-200',
  },
  CANCELLED: {
    label: 'Đã hủy',
    className: 'bg-slate-100 text-slate-600 border-slate-200',
  },
  DISPUTED: {
    label: 'Tranh chấp / Phạt',
    className: 'bg-rose-50 text-rose-700 border-rose-200/60',
  },

  // Deposit Statuses
  LOCKED: {
    label: 'Đang khóa cọc',
    className: 'bg-amber-50 text-amber-700 border-amber-200/60',
  },
  REFUNDED: {
    label: 'Đã hoàn cọc',
    className: 'bg-emerald-50 text-emerald-700 border-emerald-200/60',
  },
  FORFEITED: {
    label: 'Thu hồi cọc',
    className: 'bg-rose-50 text-rose-700 border-rose-200/60',
  },

  // Return Conditions
  GOOD: {
    label: 'Nguyên vẹn',
    className: 'bg-emerald-50 text-emerald-700 border-emerald-200/60',
  },
  DAMAGED: {
    label: 'Hư hỏng',
    className: 'bg-rose-50 text-rose-700 border-rose-200/60',
  },
  LOST: {
    label: 'Mất thiết bị',
    className: 'bg-rose-100 text-rose-800 border-rose-300',
  },
};

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, size = 'sm' }) => {
  const config = statusConfig[status] || {
    label: status,
    className: 'bg-slate-50 text-slate-700 border-slate-200',
  };

  const sizeClasses = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs';

  return (
    <span
      className={`inline-flex items-center font-medium rounded-full border ${config.className} ${sizeClasses} tracking-tight select-none`}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-current mr-1.5 opacity-75" />
      {config.label}
    </span>
  );
};
