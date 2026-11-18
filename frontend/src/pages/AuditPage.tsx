import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { auditService } from '../services/auditService';
import { blockchainService } from '../services/blockchainService';
import { loanService } from '../services/loanService';
import { LoanVerifyPanel } from '../components/LoanVerifyPanel';
import { BlockchainTx, BlockchainStatus, ContractInfo, Loan, ReconcileResult } from '../types';
import { TableSkeleton } from '../components/LoadingSkeleton';
import {
  getExplorerAddressUrl,
  getExplorerTxUrl,
  IS_SEPOLIA,
} from '../contracts/contractConfig';
import {
  Activity,
  ShieldCheck,
  CheckCircle2,
  RefreshCw,
  Search,
  ExternalLink,
  Cpu,
  Layers,
  ArrowRight,
  ShieldAlert,
} from 'lucide-react';

export const AuditPage: React.FC = () => {
  const { role, isAuthenticated } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const handledLoanParamRef = useRef<string | null>(null);
  const [transactions, setTransactions] = useState<BlockchainTx[]>([]);
  const [myLoans, setMyLoans] = useState<Loan[]>([]);
  const [chainStatus, setChainStatus] = useState<BlockchainStatus | null>(null);
  const [contractInfo, setContractInfo] = useState<ContractInfo | null>(null);
  const [loading, setLoading] = useState(true);

  // Verification panel state
  const [verifyLoanId, setVerifyLoanId] = useState('');
  const [activeVerifyLoanId, setActiveVerifyLoanId] = useState<number | null>(null);

  // Reconcile state
  const [reconciling, setReconciling] = useState(false);
  const [reconcileResult, setReconcileResult] = useState<ReconcileResult | null>(null);
  const [reconcileError, setReconcileError] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    auditService
      .getTransactions(30)
      .then((txs) => {
        setTransactions(txs);
        const ids = Array.from(
          new Set(txs.map((t) => t.request_id).filter((id): id is number => Boolean(id)))
        ).sort((a, b) => b - a);
        setVerifyLoanId((prev) => prev || (ids[0] ? String(ids[0]) : ''));
      })
      .catch(() => {})
      .finally(() => {
        setLoading(false);
      });

    Promise.allSettled([blockchainService.getStatus(), blockchainService.getContractInfo()]).then(
      ([status, cInfo]) => {
        if (status.status === 'fulfilled') setChainStatus(status.value);
        if (cInfo.status === 'fulfilled') setContractInfo(cInfo.value);
      }
    );
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (!isAuthenticated) {
      setMyLoans([]);
      return;
    }
    loanService
      .getMyLoans()
      .then((list) => {
        setMyLoans(list.filter((l) => Boolean(l.on_chain_loan_id)));
      })
      .catch(() => {});
  }, [isAuthenticated]);

  const openVerifyPanel = useCallback((id: number) => {
    if (!id || isNaN(id)) return;
    setVerifyLoanId(String(id));
    setActiveVerifyLoanId(id);
  }, []);

  useEffect(() => {
    const loanParam = searchParams.get('loan');
    if (!loanParam || handledLoanParamRef.current === loanParam) return;
    const parsedId = parseInt(loanParam, 10);
    if (!isNaN(parsedId) && parsedId > 0) {
      handledLoanParamRef.current = loanParam;
      openVerifyPanel(parsedId);
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.delete('loan');
          return next;
        },
        { replace: true }
      );
    }
  }, [searchParams, openVerifyPanel, setSearchParams]);

  const recentLoanIds = useMemo(() => {
    const uniqueIds: number[] = [];
    for (const tx of transactions) {
      if (tx.request_id && !uniqueIds.includes(tx.request_id)) {
        uniqueIds.push(tx.request_id);
      }
    }
    return uniqueIds.sort((a, b) => b - a).slice(0, 6);
  }, [transactions]);

  const handleVerify = (e: React.FormEvent) => {
    e.preventDefault();
    const id = parseInt(verifyLoanId, 10);
    openVerifyPanel(id);
  };

  const handleRunReconcile = async () => {
    setReconciling(true);
    setReconcileError(null);
    setReconcileResult(null);
    try {
      const res = await auditService.runReconcile();
      setReconcileResult(res);
      await fetchData();
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { detail?: string } } };
      setReconcileError(axiosErr.response?.data?.detail || 'Lỗi khi kích hoạt tiến trình đối soát.');
    } finally {
      setReconciling(false);
    }
  };

  const formatShortAddress = (addr?: string | null) => {
    if (!addr) return '--';
    if (addr.length <= 16) return addr;
    return `${addr.substring(0, 8)}...${addr.substring(addr.length - 6)}`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-slate-200">
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
          Tra cứu lịch sử Blockchain
        </h1>

        {role === 'ADMIN' && (
          <button
            onClick={handleRunReconcile}
            disabled={reconciling}
            className="inline-flex items-center space-x-2 px-4 py-2 bg-slate-900 text-white text-xs font-semibold rounded-lg hover:bg-slate-800 transition-colors shadow-xs active:scale-[0.98] disabled:opacity-50 cursor-pointer self-start md:self-auto"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${reconciling ? 'animate-spin' : ''}`} />
            <span>{reconciling ? 'Đang đối soát...' : 'Đối soát dữ liệu'}</span>
          </button>
        )}
      </div>

      {/* Reconcile Error Banner */}
      {reconcileError && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-lg flex items-start space-x-2.5 text-xs text-rose-700">
          <ShieldAlert className="w-4 h-4 flex-shrink-0 mt-0.5 text-rose-600" />
          <span>{reconcileError}</span>
        </div>
      )}

      {/* Reconcile Success Banner */}
      {reconcileResult && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800 space-y-1.5">
          <div className="flex items-center space-x-2 font-bold text-sm">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>Kết quả chạy tiến trình đối soát tự động:</span>
          </div>
          <p className="max-w-2xl leading-relaxed">
            Đã quét <strong>{reconcileResult.scanned_count}</strong> đơn mượn. Số đơn phát hiện lệch và tự động sửa:{' '}
            <strong>{reconcileResult.fixed_count}</strong> đơn.
          </p>
          {reconcileResult.details.length > 0 && (
            <ul className="list-disc list-inside mt-1 space-y-0.5 font-mono text-xs">
              {reconcileResult.details.map((d, i) => (
                <li key={i}>{d}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Compact Network & Contract Summary Strip */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-slate-200">
        <div className="px-4 py-3 flex items-center justify-between gap-2">
          <div>
            <span className="text-[11px] font-medium text-slate-500 block">Mạng Blockchain EVM</span>
            <div className="flex items-center space-x-2 mt-0.5">
              <span
                className={`w-2 h-2 rounded-full ${
                  chainStatus?.is_connected ? 'bg-emerald-500' : 'bg-rose-500'
                }`}
              />
              <span className="text-xs font-bold text-slate-900">
                {chainStatus
                  ? `${chainStatus.network} (${chainStatus.is_connected ? 'Online' : 'Offline'})`
                  : 'Đang kiểm tra...'}
              </span>
              {chainStatus?.chain_id && (
                <span className="text-[11px] font-mono text-slate-500">#{chainStatus.chain_id}</span>
              )}
            </div>
          </div>
          <Cpu className="w-4 h-4 text-slate-400 shrink-0" />
        </div>

        <div className="px-4 py-3 flex items-center justify-between gap-2">
          <div>
            <span className="text-[11px] font-medium text-slate-500 block">Block mới nhất</span>
            <p className="text-sm font-bold font-mono text-slate-900 mt-0.5">
              {chainStatus?.latest_block != null ? `#${chainStatus.latest_block}` : '--'}
            </p>
          </div>
          <Layers className="w-4 h-4 text-slate-400 shrink-0" />
        </div>

        <div className="px-4 py-3 flex items-center justify-between gap-2 min-w-0">
          <div className="min-w-0">
            <span className="text-[11px] font-medium text-slate-500 block">Smart Contract</span>
            <div className="flex items-center space-x-2 mt-0.5">
              <span
                className="text-xs font-mono font-bold text-slate-900 truncate"
                title={contractInfo?.contract_address || ''}
              >
                {contractInfo?.contract_address
                  ? formatShortAddress(contractInfo.contract_address)
                  : '--'}
              </span>
              {IS_SEPOLIA && contractInfo?.contract_address && (
                <a
                  href={getExplorerAddressUrl(contractInfo.contract_address)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[11px] font-semibold text-indigo-700 hover:underline inline-flex items-center space-x-0.5 shrink-0"
                >
                  <span>Etherscan</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
          </div>
          <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
        </div>
      </div>

      {/* Verification Tool (Opens Side Panel without layout shift) */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex items-center space-x-2">
          <Search className="w-4 h-4 text-slate-700" />
          <h2 className="text-base font-bold text-slate-900 tracking-tight">
            Kiểm tra đơn mượn
          </h2>
        </div>

        <form onSubmit={handleVerify} className="flex items-center gap-3 max-w-md">
          <div className="relative flex-1">
            <label htmlFor="verify-loan-id" className="sr-only">
              Mã số đơn mượn
            </label>
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-mono font-semibold text-slate-600">
              Đơn #
            </span>
            <input
              id="verify-loan-id"
              type="number"
              min="1"
              value={verifyLoanId}
              onChange={(e) => setVerifyLoanId(e.target.value)}
              placeholder="VD: 5, 4, 3..."
              required
              className="w-full pl-14 pr-3 py-2 text-xs border border-slate-300 rounded-lg bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-slate-900 font-mono tabular-nums"
            />
          </div>
          <button
            type="submit"
            className="px-4 py-2 bg-slate-900 text-white text-xs font-semibold rounded-lg hover:bg-slate-800 transition-colors shadow-xs flex items-center space-x-1.5 cursor-pointer"
          >
            <span>Kiểm tra</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </form>

        {myLoans.length > 0 ? (
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <span className="text-slate-600 font-medium mr-1">Chọn nhanh:</span>
            {myLoans.slice(0, 6).map((loan) => {
              const isSelected = activeVerifyLoanId === loan.id;
              return (
                <button
                  key={loan.id}
                  type="button"
                  onClick={() => openVerifyPanel(loan.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'bg-slate-50 text-slate-800 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <span className="font-mono font-bold">#{loan.id}</span> ·{' '}
                  {loan.equipment?.name || `Thiết bị #${loan.equipment_id}`}
                </button>
              );
            })}
          </div>
        ) : (
          recentLoanIds.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              <span className="text-slate-600 font-medium mr-1">Chọn nhanh:</span>
              {recentLoanIds.map((loanId) => (
                <button
                  key={loanId}
                  type="button"
                  onClick={() => openVerifyPanel(loanId)}
                  className={`px-2.5 py-1 rounded-md font-mono font-semibold border transition-colors cursor-pointer ${
                    activeVerifyLoanId === loanId
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  Đơn #{loanId}
                </button>
              ))}
            </div>
          )
        )}
      </div>

      {/* On-chain Transaction History Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Activity className="w-4 h-4 text-slate-700" />
            <h2 className="text-sm font-bold text-slate-900 tracking-tight">
              Nhật ký Giao dịch Blockchain On-Chain
            </h2>
          </div>
          <span className="text-xs text-slate-600 font-mono">
            {transactions.length} giao dịch gần nhất
          </span>
        </div>

        {loading ? (
          <TableSkeleton rows={4} />
        ) : transactions.length === 0 ? (
          <div className="py-12 text-center text-xs text-slate-500">
            Chưa có giao dịch on-chain nào được ghi nhận.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase text-xs tracking-wider">
                <tr>
                  <th className="py-3 px-4">Đơn mượn</th>
                  <th className="py-3 px-4">Transaction Hash</th>
                  <th className="py-3 px-4">Thao tác</th>
                  <th className="py-3 px-4">Block #</th>
                  <th className="py-3 px-4">Gas tiêu thụ</th>
                  <th className="py-3 px-4">Trạng thái</th>
                  <th className="py-3 px-4">Thời gian</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {transactions.map((tx) => (
                  <tr key={tx.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-3 px-4">
                      {tx.request_id ? (
                        <button
                          type="button"
                          onClick={() => openVerifyPanel(tx.request_id as number)}
                          className="inline-flex items-center px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100 font-semibold text-xs cursor-pointer"
                          title={`Bấm để đối soát Đơn #${tx.request_id}`}
                        >
                          Đơn #{tx.request_id}
                        </button>
                      ) : (
                        <span className="text-slate-500">--</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-slate-900 font-semibold" title={tx.tx_hash}>
                      {IS_SEPOLIA && tx.tx_hash ? (
                        <a
                          href={getExplorerTxUrl(tx.tx_hash)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-indigo-700 hover:text-indigo-900 hover:underline"
                          title="Xem trên Sepolia Etherscan"
                        >
                          {formatShortAddress(tx.tx_hash)} ↗
                        </a>
                      ) : (
                        formatShortAddress(tx.tx_hash)
                      )}
                    </td>
                    <td className="py-3 px-4 font-sans font-semibold text-slate-900">
                      {tx.action_type}
                    </td>
                    <td className="py-3 px-4 text-slate-700 tabular-nums">
                      {tx.block_number ? `#${tx.block_number}` : '--'}
                    </td>
                    <td className="py-3 px-4 text-slate-600 tabular-nums">
                      {tx.gas_used ? tx.gas_used.toLocaleString('vi-VN') : '--'}
                    </td>
                    <td className="py-3 px-4 font-sans">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold ${
                          tx.status === 'CONFIRMED'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : tx.status === 'FAILED'
                              ? 'bg-rose-50 text-rose-700 border border-rose-200'
                              : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}
                      >
                        {tx.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-600 text-xs font-sans">
                      {new Date(tx.created_at).toLocaleString('vi-VN', {
                        hour: '2-digit',
                        minute: '2-digit',
                        day: '2-digit',
                        month: '2-digit',
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <LoanVerifyPanel
        loanId={activeVerifyLoanId}
        onClose={() => setActiveVerifyLoanId(null)}
        showAuditLink={false}
      />
    </div>
  );
};
export default AuditPage;
