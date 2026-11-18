import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { auditService } from '../services/auditService';
import { blockchainService } from '../services/blockchainService';
import { BlockchainTx, BlockchainStatus, ContractInfo, LoanVerification, ReconcileResult } from '../types';
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
  AlertTriangle,
  RefreshCw,
  Search,
  Database,
  ExternalLink,
  Cpu,
  Layers,
  ArrowRight,
  ShieldAlert,
} from 'lucide-react';

export const AuditPage: React.FC = () => {
  const { role } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const verifySectionRef = useRef<HTMLDivElement>(null);
  const handledLoanParamRef = useRef<string | null>(null);
  const [transactions, setTransactions] = useState<BlockchainTx[]>([]);
  const [chainStatus, setChainStatus] = useState<BlockchainStatus | null>(null);
  const [contractInfo, setContractInfo] = useState<ContractInfo | null>(null);
  const [loading, setLoading] = useState(true);

  // Verification tool state
  const [verifyLoanId, setVerifyLoanId] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState<LoanVerification | null>(null);
  const [verifyError, setVerifyError] = useState<string | null>(null);

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
        setVerifyLoanId((prev) => {
          if (prev) return prev;
          const firstReq = txs.find((t) => t.request_id)?.request_id;
          return firstReq ? String(firstReq) : '';
        });
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

  const runVerifyById = useCallback(async (id: number) => {
    if (!id || isNaN(id)) return;
    setVerifyLoanId(String(id));
    setVerifying(true);
    setVerifyError(null);
    setVerifyResult(null);
    try {
      const res = await auditService.verifyLoan(id);
      setVerifyResult(res);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { detail?: string } } };
      setVerifyError(axiosErr.response?.data?.detail || 'Không thể đối soát đơn mượn này.');
    } finally {
      setVerifying(false);
    }
  }, []);

  useEffect(() => {
    const loanParam = searchParams.get('loan');
    if (!loanParam || handledLoanParamRef.current === loanParam) return;
    const parsedId = parseInt(loanParam, 10);
    if (!isNaN(parsedId) && parsedId > 0) {
      handledLoanParamRef.current = loanParam;
      runVerifyById(parsedId);
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.delete('loan');
          return next;
        },
        { replace: true }
      );
    }
  }, [searchParams, runVerifyById, setSearchParams]);

  const recentLoanIds = useMemo(() => {
    const uniqueIds: number[] = [];
    for (const tx of transactions) {
      if (tx.request_id && !uniqueIds.includes(tx.request_id)) {
        uniqueIds.push(tx.request_id);
      }
    }
    return uniqueIds.slice(0, 6);
  }, [transactions]);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    const id = parseInt(verifyLoanId, 10);
    await runVerifyById(id);
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
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Kiểm toán Blockchain & Đối soát
          </h1>
          <p className="text-sm text-slate-600 mt-1 max-w-md leading-relaxed">
            Đối soát tính toàn vẹn giữa CSDL MySQL và sổ cái Blockchain.
          </p>
        </div>

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

      {/* Independent Verification Tool */}
      <div
        ref={verifySectionRef}
        className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-4"
      >
        <div>
          <div className="flex items-center space-x-2">
            <Search className="w-4 h-4 text-slate-700" />
            <h2 className="text-base font-bold text-slate-900 tracking-tight">
              Đối soát dữ liệu đơn mượn
            </h2>
          </div>
          <p className="text-xs text-slate-600 mt-1 max-w-2xl leading-relaxed">
            Nhập <strong>ID Đơn mượn</strong> (ví dụ <code>1</code>, <code>2</code>, <code>3</code>... xem ở cột <strong>Đơn mượn</strong> bên dưới, không phải số Block #) để so khớp MySQL và Smart Contract.
          </p>
        </div>

        <form onSubmit={handleVerify} className="flex items-center gap-3 max-w-md">
          <div className="relative flex-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-mono font-semibold text-slate-500">
              Đơn #
            </span>
            <input
              type="number"
              min="1"
              value={verifyLoanId}
              onChange={(e) => setVerifyLoanId(e.target.value)}
              placeholder="VD: 2, 3, 4..."
              required
              className="w-full pl-14 pr-3 py-2 text-xs border border-slate-300 rounded-lg bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900 font-mono"
            />
          </div>
          <button
            type="submit"
            disabled={verifying}
            className="px-4 py-2 bg-slate-900 text-white text-xs font-semibold rounded-lg hover:bg-slate-800 transition-colors shadow-xs disabled:opacity-50 flex items-center space-x-1.5 cursor-pointer"
          >
            <span>{verifying ? 'Đang so khớp...' : 'Đối soát ngay'}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </form>

        {recentLoanIds.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <span className="text-slate-500 font-medium mr-1">Chọn nhanh đơn có giao dịch:</span>
            {recentLoanIds.map((loanId) => (
              <button
                key={loanId}
                type="button"
                onClick={() => runVerifyById(loanId)}
                className={`px-2.5 py-1 rounded-md font-mono font-semibold border transition-colors cursor-pointer ${
                  verifyResult?.loan_id === loanId || verifyLoanId === String(loanId)
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                Đơn #{loanId}
              </button>
            ))}
          </div>
        )}

        {verifyError && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700">
            {verifyError}
          </div>
        )}

        {/* Verification Result Card */}
        {verifyResult && (
          <div
            className={`p-4 rounded-xl border ${
              verifyResult.is_synced
                ? 'bg-emerald-50/60 border-emerald-200 text-emerald-900'
                : 'bg-rose-50/60 border-rose-200 text-rose-900'
            }`}
          >
            <div className="flex items-start space-x-3">
              {verifyResult.is_synced ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
              ) : (
                <AlertTriangle className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" />
              )}
              <div className="flex-1 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-bold text-sm">
                    {verifyResult.is_synced
                      ? 'ĐỒNG BỘ 100% - DỮ LIỆU TOÀN VẸN TUYỆT ĐỐI'
                      : verifyResult.sync_status === 'NOT_ON_CHAIN'
                      ? 'ĐƠN CHƯA GHI NHẬN TRÊN BLOCKCHAIN'
                      : verifyResult.sync_status === 'MISSING_ON_CHAIN'
                      ? 'CHƯA TÌM THẤY BẢN GHI ON-CHAIN'
                      : verifyResult.sync_status === 'RPC_OFFLINE'
                      ? 'NODE BLOCKCHAIN OFFLINE / SAI MẠNG'
                      : 'PHÁT HIỆN SAI LỆCH DỮ LIỆU GIỮA MYSQL VÀ BLOCKCHAIN'}
                  </h3>
                  <span className="text-xs font-mono opacity-80">
                    {verifyResult.on_chain_loan_id
                      ? `Hash: ${formatShortAddress(verifyResult.on_chain_loan_id)}`
                      : verifyResult.sync_status || 'NOT_ON_CHAIN'}
                  </span>
                </div>

                {!verifyResult.is_synced && (
                  <div className="p-2.5 bg-white/80 rounded-lg border border-rose-200 text-xs">
                    <p className="font-semibold text-rose-700">Các trường sai lệch:</p>
                    <ul className="list-disc list-inside mt-1 font-mono text-xs">
                      {verifyResult.mismatches.map((m, i) => (
                        <li key={i}>{m}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Side by side state viewer */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 text-xs">
                  <div className="p-3 bg-white/90 rounded-lg border border-slate-200 shadow-xs">
                    <div className="flex items-center space-x-1.5 font-bold text-slate-800 border-b border-slate-100 pb-1 mb-2">
                      <Database className="w-3.5 h-3.5 text-slate-700" />
                      <span>Dữ liệu MySQL (Off-chain)</span>
                    </div>
                    <pre className="text-xs font-mono text-slate-700 overflow-x-auto leading-relaxed">
                      {JSON.stringify(verifyResult.mysql_state, null, 2)}
                    </pre>
                  </div>

                  <div className="p-3 bg-white/90 rounded-lg border border-slate-200 shadow-xs">
                    <div className="flex items-center space-x-1.5 font-bold text-slate-800 border-b border-slate-100 pb-1 mb-2">
                      <Activity className="w-3.5 h-3.5 text-slate-700" />
                      <span>Dữ liệu trên Smart Contract</span>
                    </div>
                    <pre className="text-xs font-mono text-slate-700 overflow-x-auto leading-relaxed">
                      {JSON.stringify(verifyResult.blockchain_state, null, 2)}
                    </pre>
                  </div>
                </div>
              </div>
            </div>
          </div>
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
                          onClick={() => {
                            runVerifyById(tx.request_id as number);
                            verifySectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                          }}
                          className="inline-flex items-center px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100 font-semibold text-xs cursor-pointer"
                          title={`Bấm để đối soát Đơn #${tx.request_id}`}
                        >
                          Đơn #{tx.request_id}
                        </button>
                      ) : (
                        <span className="text-slate-400">--</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-slate-900 font-semibold" title={tx.tx_hash}>
                      {IS_SEPOLIA && tx.tx_hash ? (
                        <a
                          href={getExplorerTxUrl(tx.tx_hash)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-800 hover:underline"
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
                    <td className="py-3 px-4 text-slate-700">
                      {tx.block_number ? `#${tx.block_number}` : '--'}
                    </td>
                    <td className="py-3 px-4 text-slate-600">
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
    </div>
  );
};
export default AuditPage;
