import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  Database,
  ExternalLink,
  X,
} from 'lucide-react';
import { auditService } from '../services/auditService';
import type { LoanVerification } from '../types';

interface LoanVerifyPanelProps {
  loanId: number | null;
  onClose: () => void;
  showAuditLink?: boolean;
}

const WEB_STATUS_LABELS: Record<string, string> = {
  PENDING: 'Chờ duyệt',
  APPROVED: 'Đã duyệt',
  ACTIVE: 'Đang mượn',
  RETURNED: 'Đã hoàn tất',
  CANCELLED: 'Đã hủy',
  REJECTED: 'Đã từ chối',
  DISPUTED: 'Tranh chấp / Phạt',
};

const CHAIN_STATE_LABELS: Record<number, string> = {
  0: 'Chờ duyệt',
  1: 'Đã duyệt',
  2: 'Đang mượn',
  3: 'Đã hoàn tất',
  4: 'Đã hủy',
  5: 'Tranh chấp / Phạt',
};

const DEPOSIT_STATUS_LABELS: Record<string, string> = {
  PENDING: 'Chưa khóa',
  LOCKED: 'Đang khóa cọc',
  REFUNDED: 'Đã hoàn cọc',
  FORFEITED: 'Thu hồi cọc',
};

const CHAIN_DEPOSIT_LABELS: Record<number, string> = {
  0: 'Chưa khóa',
  1: 'Đang khóa cọc',
  2: 'Đã hoàn cọc',
  3: 'Thu hồi cọc',
};

function shortHex(value: unknown): string {
  if (typeof value !== 'string' || !value) return '--';
  if (value.length <= 16) return value;
  return `${value.slice(0, 8)}...${value.slice(-6)}`;
}

function formatTs(value: unknown): string {
  const num = Number(value);
  if (!num || Number.isNaN(num) || num <= 0) return '--';
  return new Date(num * 1000).toLocaleString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function formatVnd(value: unknown): string {
  const num = Number(value);
  if (Number.isNaN(num)) return '--';
  return `${num.toLocaleString('vi-VN')} đ`;
}

export const LoanVerifyPanel: React.FC<LoanVerifyPanelProps> = ({
  loanId,
  onClose,
  showAuditLink = true,
}) => {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<LoanVerification | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loanId) {
      setResult(null);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);
    setResult(null);

    auditService
      .verifyLoan(loanId)
      .then((res) => {
        if (!cancelled) setResult(res);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const axiosErr = err as { response?: { data?: { detail?: string } } };
        setError(axiosErr.response?.data?.detail || 'Không thể kiểm tra đơn mượn này.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [loanId]);

  useEffect(() => {
    if (!loanId) return;
    document.body.style.overflow = 'hidden';

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);

    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [loanId, onClose]);

  if (!loanId) return null;

  const mysql = result?.mysql_state || {};
  const chain = result?.blockchain_state || {};
  const hasChain = Object.keys(chain).length > 0;

  const comparisonRows = result
    ? [
        {
          label: 'Trạng thái đơn',
          web: WEB_STATUS_LABELS[String(mysql.status || '')] || String(mysql.status || '--'),
          blockchain: hasChain
            ? CHAIN_STATE_LABELS[Number(chain.state)] || String(chain.state ?? '--')
            : '--',
        },
        {
          label: 'Tiền cọc cần đóng',
          web: formatVnd(mysql.deposit_amount),
          blockchain: hasChain ? formatVnd(chain.deposit_amount) : '--',
        },
        {
          label: 'Trạng thái cọc',
          web:
            DEPOSIT_STATUS_LABELS[String(mysql.deposit_status || '')] ||
            String(mysql.deposit_status || '--'),
          blockchain: hasChain
            ? CHAIN_DEPOSIT_LABELS[Number(chain.deposit_state)] || String(chain.deposit_state ?? '--')
            : '--',
        },
        {
          label: 'Mã sinh viên',
          web: String(mysql.student_id || '--'),
          blockchain: hasChain ? String(chain.student_id || '--') : '--',
        },
        {
          label: 'Ví người mượn',
          web: shortHex(mysql.borrower_wallet),
          webTitle: typeof mysql.borrower_wallet === 'string' ? mysql.borrower_wallet : '',
          blockchain: hasChain ? shortHex(chain.borrower) : '--',
          chainTitle: typeof chain.borrower === 'string' ? chain.borrower : '',
        },
        {
          label: 'Dự kiến nhận',
          web: formatTs(mysql.expected_handover),
          blockchain: hasChain ? formatTs(chain.expected_handover) : '--',
        },
        {
          label: 'Hạn trả máy',
          web: formatTs(mysql.due_date),
          blockchain: hasChain ? formatTs(chain.due_date) : '--',
        },
        {
          label: 'Bàn giao thực tế',
          web: formatTs(mysql.actual_handover),
          blockchain: hasChain ? formatTs(chain.actual_handover) : '--',
        },
        {
          label: 'Trả máy thực tế',
          web: formatTs(mysql.actual_return),
          blockchain: hasChain ? formatTs(chain.actual_return) : '--',
        },
      ]
    : [];

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-900/50 backdrop-blur-[1px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="verify-panel-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative w-full max-w-2xl bg-white rounded-xl shadow-2xl border border-slate-200 flex flex-col max-h-[88vh] overflow-hidden">
        {/* Sticky Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-3 shrink-0 bg-white">
          <div className="min-w-0">
            <h2 id="verify-panel-title" className="text-base font-bold text-slate-900">
              Kiểm tra & Đối chiếu Đơn #{loanId}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5 truncate">
              {result?.on_chain_loan_id
                ? `Mã trên chain: ${shortHex(result.on_chain_loan_id)}`
                : 'So khớp hồ sơ hệ thống với bản ghi Blockchain'}
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {showAuditLink && (
              <Link
                to={`/audit?loan=${loanId}`}
                onClick={onClose}
                className="inline-flex items-center space-x-1 px-2.5 py-1.5 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg border border-indigo-200 transition-colors"
              >
                <span>Mở trang Sổ cái</span>
                <ExternalLink className="w-3 h-3" aria-hidden="true" />
              </Link>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="Đóng hộp thoại"
              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {loading && (
            <div className="py-16 flex flex-col items-center justify-center space-y-3 text-slate-500">
              <div className="w-6 h-6 border-2 border-slate-900 border-t-transparent rounded-full animate-spin" />
              <span className="text-xs font-medium">Đang đọc dữ liệu từ Blockchain...</span>
            </div>
          )}

          {!loading && error && (
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700">
              {error}
            </div>
          )}

          {!loading && result && (
            <>
              {/* Status Banner */}
              <div
                className={`p-4 rounded-xl border flex items-start space-x-3 ${
                  result.is_synced
                    ? 'bg-emerald-50/70 border-emerald-200 text-emerald-900'
                    : 'bg-rose-50/70 border-rose-200 text-rose-900'
                }`}
              >
                {result.is_synced ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                ) : (
                  <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                )}
                <div className="flex-1 space-y-1.5">
                  <h3 className="text-sm font-bold">
                    {result.is_synced
                      ? 'Dữ liệu khớp hoàn toàn giữa web và Blockchain'
                      : result.sync_status === 'NOT_ON_CHAIN'
                      ? 'Đơn này chưa được ghi lên Blockchain'
                      : result.sync_status === 'MISSING_ON_CHAIN'
                      ? 'Chưa tìm thấy bản ghi trên Blockchain'
                      : result.sync_status === 'RPC_OFFLINE'
                      ? 'Mạng Blockchain đang tạm gián đoạn'
                      : 'Cần kiểm tra: Dữ liệu chưa khớp hoàn toàn'}
                  </h3>

                  {!result.is_synced && result.mismatches.length > 0 && (
                    <ul className="list-disc list-inside text-xs space-y-0.5 text-rose-800">
                      {result.mismatches.map((msg, idx) => (
                        <li key={idx}>{msg}</li>
                      ))}
                    </ul>
                  )}

                  {hasChain && chain.penalty_percent !== undefined && Number(chain.penalty_percent) > 0 && (
                    <p className="text-xs font-semibold">
                      Mức phạt ghi nhận trên hợp đồng: {Number(chain.penalty_percent)}% tiền cọc
                    </p>
                  )}
                </div>
              </div>

              {/* Clean Comparison Table */}
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                    <tr>
                      <th className="py-2.5 px-4">Thông tin</th>
                      <th className="py-2.5 px-4">
                        <span className="inline-flex items-center space-x-1">
                          <Database className="w-3.5 h-3.5 text-slate-500" />
                          <span>Hệ thống web</span>
                        </span>
                      </th>
                      <th className="py-2.5 px-4">
                        <span className="inline-flex items-center space-x-1">
                          <Activity className="w-3.5 h-3.5 text-slate-500" />
                          <span>Blockchain</span>
                        </span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {comparisonRows.map((row) => (
                      <tr key={row.label} className="hover:bg-slate-50/50">
                        <td className="py-2.5 px-4 font-medium text-slate-600">{row.label}</td>
                        <td
                          className="py-2.5 px-4 font-mono text-slate-900 font-medium"
                          title={row.webTitle}
                        >
                          {row.web}
                        </td>
                        <td
                          className="py-2.5 px-4 font-mono text-slate-900 font-medium"
                          title={row.chainTitle}
                        >
                          {row.blockchain}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Collapsible Raw JSON */}
              <details className="bg-slate-50 rounded-xl border border-slate-200">
                <summary className="px-4 py-2.5 text-xs font-semibold text-slate-700 cursor-pointer flex items-center justify-between select-none">
                  <span>Xem dữ liệu chi tiết dạng kỹ thuật (JSON)</span>
                  <ChevronDown className="w-4 h-4 text-slate-500" />
                </summary>
                <div className="px-4 pb-4 pt-2 grid grid-cols-1 gap-3 border-t border-slate-200 text-xs">
                  <div>
                    <span className="font-semibold text-slate-700 block mb-1">Hệ thống web:</span>
                    <pre className="p-2.5 bg-white rounded-lg border border-slate-200 font-mono text-[11px] overflow-x-auto">
                      {JSON.stringify(mysql, null, 2)}
                    </pre>
                  </div>
                  <div>
                    <span className="font-semibold text-slate-700 block mb-1">Blockchain:</span>
                    <pre className="p-2.5 bg-white rounded-lg border border-slate-200 font-mono text-[11px] overflow-x-auto">
                      {JSON.stringify(chain, null, 2)}
                    </pre>
                  </div>
                </div>
              </details>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};
