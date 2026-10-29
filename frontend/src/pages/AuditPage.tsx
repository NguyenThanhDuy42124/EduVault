import React, { useEffect, useState } from 'react';
import { auditService } from '../services/auditService';
import { blockchainService } from '../services/blockchainService';
import { BlockchainTx, BlockchainStatus, ContractInfo, LoanVerification, ReconcileResult } from '../types';
import { TableSkeleton } from '../components/LoadingSkeleton';
import {
  Activity,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Search,
  Database,
  Link as LinkIcon,
  Cpu,
  Layers,
  ArrowRight,
} from 'lucide-react';

export const AuditPage: React.FC = () => {
  const [transactions, setTransactions] = useState<BlockchainTx[]>([]);
  const [chainStatus, setChainStatus] = useState<BlockchainStatus | null>(null);
  const [contractInfo, setContractInfo] = useState<ContractInfo | null>(null);
  const [loading, setLoading] = useState(true);

  // Verification tool state
  const [verifyLoanId, setVerifyLoanId] = useState('1');
  const [verifying, setVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState<LoanVerification | null>(null);
  const [verifyError, setVerifyError] = useState<string | null>(null);

  // Reconcile state
  const [reconciling, setReconciling] = useState(false);
  const [reconcileResult, setReconcileResult] = useState<ReconcileResult | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [txs, status, cInfo] = await Promise.allSettled([
        auditService.getTransactions(30),
        blockchainService.getStatus(),
        blockchainService.getContractInfo(),
      ]);

      if (txs.status === 'fulfilled') setTransactions(txs.value);
      if (status.status === 'fulfilled') setChainStatus(status.value);
      if (cInfo.status === 'fulfilled') setContractInfo(cInfo.value);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    const id = parseInt(verifyLoanId, 10);
    if (!id || isNaN(id)) return;

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
  };

  const handleRunReconcile = async () => {
    setReconciling(true);
    try {
      const res = await auditService.runReconcile();
      setReconcileResult(res);
      await fetchData();
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { detail?: string } } };
      alert(axiosErr.response?.data?.detail || 'Lỗi khi kích hoạt tiến trình đối soát.');
    } finally {
      setReconciling(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-200/80">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Kiểm toán Blockchain & Đối soát
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Minh chứng tính toàn vẹn bất biến giữa cơ sở dữ liệu MySQL và sổ cái Smart Contract trên Hardhat EVM
          </p>
        </div>

        <button
          onClick={handleRunReconcile}
          disabled={reconciling}
          className="inline-flex items-center space-x-1.5 px-3.5 py-2 bg-slate-900 text-white text-xs font-semibold rounded-xl hover:bg-slate-800 transition-colors shadow-sm active:scale-[0.98] disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${reconciling ? 'animate-spin' : ''}`} />
          <span>{reconciling ? 'Đang đối soát...' : 'Chạy Reconciliation Worker'}</span>
        </button>
      </div>

      {/* Network & Node Metrics Bento */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Node Connectivity */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-slate-500 text-xs">
            <span className="font-medium">Mạng EVM</span>
            <Cpu className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="flex items-center space-x-2 pt-1">
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                chainStatus?.is_connected ? 'bg-emerald-500' : 'bg-rose-500 animate-ping'
              }`}
            />
            <span className="text-sm font-bold text-slate-900">
              {chainStatus?.network || 'Hardhat Local'}
            </span>
          </div>
          <span className="text-[10px] text-slate-500 font-mono block">
            Chain ID: {chainStatus?.chain_id || 31337}
          </span>
        </div>

        {/* Latest Block */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-slate-500 text-xs">
            <span className="font-medium">Block mới nhất</span>
            <Layers className="w-4 h-4 text-indigo-600" />
          </div>
          <p className="text-xl font-bold font-mono text-slate-900 pt-1">
            #{chainStatus?.latest_block ?? '--'}
          </p>
          <span className="text-[10px] text-slate-500 block">Đã đồng bộ thời gian thực</span>
        </div>

        {/* Contract Address */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-slate-500 text-xs">
            <span className="font-medium">Smart Contract</span>
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
          </div>
          <p
            className="text-xs font-mono font-bold text-indigo-700 truncate pt-1"
            title={contractInfo?.contract_address}
          >
            {contractInfo?.contract_address || '0x5FbDB2315678afecb367f032d93F642f64180aa3'}
          </p>
          <span className="text-[10px] text-slate-500 font-mono block">
            Owner: {contractInfo?.owner_address ? `${contractInfo.owner_address.substring(0, 10)}...` : 'Relayer'}
          </span>
        </div>

        {/* Relayer Balance */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-slate-500 text-xs">
            <span className="font-medium">Ví Relayer Ký Quỹ</span>
            <LinkIcon className="w-4 h-4 text-amber-600" />
          </div>
          <p className="text-sm font-mono font-bold text-slate-900 pt-1 truncate">
            {chainStatus?.relayer_balance_eth || '9999.98 ETH'}
          </p>
          <span
            className="text-[10px] text-slate-500 font-mono truncate block"
            title={chainStatus?.relayer_address}
          >
            {chainStatus?.relayer_address
              ? `${chainStatus.relayer_address.substring(0, 16)}...`
              : 'Account #0'}
          </span>
        </div>
      </div>

      {/* Reconcile Flash Result (if executed) */}
      {reconcileResult && (
        <div className="p-4 bg-emerald-50 border border-emerald-200/80 rounded-2xl text-xs text-emerald-800 space-y-1">
          <div className="flex items-center space-x-2 font-bold">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>Kết quả chạy tiến trình đối soát tự động:</span>
          </div>
          <p>
            Đã quét <strong>{reconcileResult.scanned_count}</strong> đơn mượn. Số đơn phát hiện lệch và tự động sửa:{' '}
            <strong>{reconcileResult.fixed_count}</strong> đơn.
          </p>
          {reconcileResult.details.length > 0 && (
            <ul className="list-disc list-inside mt-1 space-y-0.5 text-[11px] font-mono">
              {reconcileResult.details.map((d, i) => (
                <li key={i}>{d}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Independent Verification Tool */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
        <div>
          <div className="flex items-center space-x-2">
            <Search className="w-4 h-4 text-indigo-600" />
            <h3 className="text-base font-bold text-slate-900 tracking-tight">
              Công cụ đối soát tính toàn vẹn (Dual-State Verification)
            </h3>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Nhập ID đơn mượn để hệ thống truy vấn song song dữ liệu từ MySQL và hợp đồng thông minh trên Blockchain, sau đó so khớp từng trường thuộc tính.
          </p>
        </div>

        <form onSubmit={handleVerify} className="flex items-center gap-3 max-w-md">
          <div className="relative flex-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-mono font-bold text-slate-400">
              ID #
            </span>
            <input
              type="number"
              min="1"
              value={verifyLoanId}
              onChange={(e) => setVerifyLoanId(e.target.value)}
              placeholder="Nhập ID đơn..."
              required
              className="w-full pl-12 pr-3 py-2 text-xs border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
            />
          </div>
          <button
            type="submit"
            disabled={verifying}
            className="px-4 py-2 bg-indigo-600 text-white text-xs font-semibold rounded-xl hover:bg-indigo-700 transition-colors shadow-sm disabled:opacity-50 flex items-center space-x-1.5"
          >
            <span>{verifying ? 'Đang so khớp...' : 'Đối soát ngay'}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </form>

        {verifyError && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700">
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
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-sm">
                    {verifyResult.is_synced
                      ? 'ĐỒNG BỘ 100% - DỮ LIỆU TOÀN VẸN TUYỆT ĐỐI'
                      : 'PHÁT HIỆN SAI LỆCH DỮ LIỆU GIỮA MYSQL VÀ BLOCKCHAIN'}
                  </h4>
                  <span className="text-[11px] font-mono opacity-75">
                    Hash: {verifyResult.on_chain_loan_id?.substring(0, 16)}...
                  </span>
                </div>

                {!verifyResult.is_synced && (
                  <div className="p-2.5 bg-white/80 rounded-lg border border-rose-200 text-xs">
                    <p className="font-semibold text-rose-700">Các trường sai lệch:</p>
                    <ul className="list-disc list-inside mt-1 font-mono text-[11px]">
                      {verifyResult.mismatches.map((m, i) => (
                        <li key={i}>{m}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Side by side state viewer */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 text-xs">
                  <div className="p-3 bg-white/90 rounded-lg border border-slate-200/80 shadow-xs">
                    <div className="flex items-center space-x-1.5 font-bold text-slate-800 border-b border-slate-100 pb-1 mb-2">
                      <Database className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Dữ liệu MySQL (Off-chain)</span>
                    </div>
                    <pre className="text-[11px] font-mono text-slate-600 overflow-x-auto">
                      {JSON.stringify(verifyResult.mysql_state, null, 2)}
                    </pre>
                  </div>

                  <div className="p-3 bg-white/90 rounded-lg border border-slate-200/80 shadow-xs">
                    <div className="flex items-center space-x-1.5 font-bold text-slate-800 border-b border-slate-100 pb-1 mb-2">
                      <Activity className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Dữ liệu Smart Contract (On-chain Canonical)</span>
                    </div>
                    <pre className="text-[11px] font-mono text-slate-600 overflow-x-auto">
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
      <div className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden shadow-sm">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Activity className="w-4 h-4 text-indigo-600" />
            <h3 className="text-sm font-bold text-slate-900 tracking-tight">
              Nhật ký Giao dịch Blockchain On-Chain
            </h3>
          </div>
          <span className="text-xs text-slate-500 font-mono">
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
              <thead className="bg-slate-50/80 border-b border-slate-200/80 text-slate-500 font-semibold uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="py-3 px-4">Thao tác</th>
                  <th className="py-3 px-4">Transaction Hash</th>
                  <th className="py-3 px-4">Block #</th>
                  <th className="py-3 px-4">Gas tiêu thụ</th>
                  <th className="py-3 px-4">Trạng thái</th>
                  <th className="py-3 px-4">Thời gian</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {transactions.map((tx) => (
                  <tr key={tx.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-3 px-4 font-sans font-semibold text-slate-900">
                      {tx.action_type}
                    </td>
                    <td className="py-3 px-4 text-indigo-600 font-semibold" title={tx.tx_hash}>
                      {tx.tx_hash.substring(0, 18)}...
                    </td>
                    <td className="py-3 px-4 text-slate-700">
                      {tx.block_number ? `#${tx.block_number}` : '--'}
                    </td>
                    <td className="py-3 px-4 text-slate-500">
                      {tx.gas_used ? tx.gas_used.toLocaleString('vi-VN') : '--'}
                    </td>
                    <td className="py-3 px-4 font-sans">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          tx.status === 'CONFIRMED'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/60'
                            : tx.status === 'FAILED'
                              ? 'bg-rose-50 text-rose-700 border border-rose-200/60'
                              : 'bg-amber-50 text-amber-700 border border-amber-200/60'
                        }`}
                      >
                        {tx.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-400 text-[11px] font-sans">
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
