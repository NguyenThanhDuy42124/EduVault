import React, { memo, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Activity, ArrowRight, ExternalLink } from 'lucide-react';
import { auditService } from '../../services/auditService';
import { blockchainService } from '../../services/blockchainService';
import { LoanVerifyPanel } from '../LoanVerifyPanel';
import {
  CONTRACT_ADDRESS,
  getExplorerAddressUrl,
  getExplorerTxUrl,
  IS_SEPOLIA,
  TARGET_CHAIN_ID,
} from '../../contracts/contractConfig';
import type { BlockchainStatus, BlockchainTx, ContractInfo } from '../../types';

function shortAddress(value?: string | null): string {
  if (!value) return '--';
  if (value.length <= 16) return value;
  return `${value.slice(0, 8)}...${value.slice(-6)}`;
}

export const HomeBlockchainSection: React.FC = memo(() => {
  const [chainStatus, setChainStatus] = useState<BlockchainStatus | null>(null);
  const [contractInfo, setContractInfo] = useState<ContractInfo | null>(null);
  const [transactions, setTransactions] = useState<BlockchainTx[]>([]);
  const [txLoading, setTxLoading] = useState(true);
  const [statusLoading, setStatusLoading] = useState(true);
  const [verifyLoanId, setVerifyLoanId] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    auditService
      .getTransactions(5)
      .then((res) => {
        if (!cancelled) setTransactions(res);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setTxLoading(false);
      });

    Promise.allSettled([blockchainService.getStatus(), blockchainService.getContractInfo()])
      .then(([statusRes, contractRes]) => {
        if (cancelled) return;
        if (statusRes.status === 'fulfilled') setChainStatus(statusRes.value);
        if (contractRes.status === 'fulfilled') setContractInfo(contractRes.value);
      })
      .finally(() => {
        if (!cancelled) setStatusLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const effectiveContractAddress =
    contractInfo?.contract_address || chainStatus?.contract_address || CONTRACT_ADDRESS;
  const effectiveChainId = chainStatus?.chain_id ?? chainStatus?.expected_chain_id ?? TARGET_CHAIN_ID;
  const isOnline = Boolean(chainStatus?.is_connected);

  return (
    <section
      id="blockchain"
      aria-labelledby="home-blockchain-heading"
      className="space-y-4 pt-2"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h2
          id="home-blockchain-heading"
          className="text-xl font-bold text-slate-900 tracking-tight"
        >
          Hoạt động Blockchain gần đây
        </h2>

        <Link
          to="/audit"
          className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 transition-colors self-start sm:self-auto shrink-0"
        >
          <Activity className="w-3.5 h-3.5" aria-hidden="true" />
          <span>Tra cứu & Đối soát</span>
          <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
        </Link>
      </div>

      {/* Compact On-Chain Status Strip */}
      <div className="bg-white rounded-xl border border-slate-200 px-4 py-3 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5">
          <div className="inline-flex items-center space-x-2">
            <span
              className={`w-2 h-2 rounded-full ${
                statusLoading ? 'bg-slate-300' : isOnline ? 'bg-emerald-500' : 'bg-rose-500'
              }`}
            />
            <span className="font-semibold text-slate-900">
              {statusLoading
                ? 'Đang kiểm tra...'
                : chainStatus
                ? `${chainStatus.network} (${isOnline ? 'Online' : 'Offline'})`
                : 'Node Offline'}
            </span>
            <span className="font-mono text-slate-500">Chain {effectiveChainId}</span>
          </div>

          <span className="text-slate-300 hidden sm:inline">|</span>

          <div className="inline-flex items-center space-x-1.5 text-slate-600">
            <span>Block mới nhất:</span>
            <span className="font-mono font-bold text-slate-900">
              {chainStatus?.latest_block != null ? `#${chainStatus.latest_block}` : '--'}
            </span>
          </div>

          <span className="text-slate-300 hidden sm:inline">|</span>

          <div className="inline-flex items-center space-x-1.5 text-slate-600">
            <span>Contract:</span>
            <span className="font-mono font-semibold text-slate-900" title={effectiveContractAddress}>
              {shortAddress(effectiveContractAddress)}
            </span>
            {IS_SEPOLIA && effectiveContractAddress && (
              <a
                href={getExplorerAddressUrl(effectiveContractAddress)}
                target="_blank"
                rel="noopener noreferrer"
                className="text-indigo-700 hover:underline inline-flex items-center space-x-0.5 font-semibold"
              >
                <span>Etherscan</span>
                <ExternalLink className="w-3 h-3" aria-hidden="true" />
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Public Recent Transactions Preview */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {txLoading ? (
          <div className="p-5 space-y-2.5">
            <div className="h-4 bg-slate-100 rounded animate-pulse w-full" />
            <div className="h-4 bg-slate-100 rounded animate-pulse w-5/6" />
          </div>
        ) : transactions.length === 0 ? (
          <div className="p-6 text-center text-xs text-slate-500">
            Chưa có giao dịch on-chain nào được ghi nhận trong hệ thống.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="py-2.5 px-4">Đơn mượn</th>
                  <th className="py-2.5 px-4">Transaction Hash</th>
                  <th className="py-2.5 px-4">Thao tác</th>
                  <th className="py-2.5 px-4">Block</th>
                  <th className="py-2.5 px-4">Trạng thái</th>
                  <th className="py-2.5 px-4">Thời gian</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {transactions.map((tx) => (
                  <tr key={tx.id} className="hover:bg-slate-50/70">
                    <td className="py-2.5 px-4">
                      {tx.request_id ? (
                        <button
                          type="button"
                          onClick={() => setVerifyLoanId(tx.request_id as number)}
                          className="inline-block px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100 font-semibold text-xs cursor-pointer"
                          title={`Kiểm tra Đơn #${tx.request_id}`}
                        >
                          Đơn #{tx.request_id}
                        </button>
                      ) : (
                        <span className="text-slate-500">--</span>
                      )}
                    </td>
                    <td className="py-2.5 px-4 text-slate-800" title={tx.tx_hash}>
                      {IS_SEPOLIA && tx.tx_hash ? (
                        <a
                          href={getExplorerTxUrl(tx.tx_hash)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-indigo-700 hover:underline inline-flex items-center space-x-1"
                        >
                          <span>{shortAddress(tx.tx_hash)}</span>
                          <ExternalLink className="w-3 h-3" aria-hidden="true" />
                        </a>
                      ) : (
                        shortAddress(tx.tx_hash)
                      )}
                    </td>
                    <td className="py-2.5 px-4 font-sans font-semibold text-slate-900">
                      {tx.action_type}
                    </td>
                    <td className="py-2.5 px-4 text-slate-600">
                      {tx.block_number ? `#${tx.block_number}` : '--'}
                    </td>
                    <td className="py-2.5 px-4 font-sans">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[11px] font-semibold ${
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
                    <td className="py-2.5 px-4 font-sans text-slate-600">
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

      <LoanVerifyPanel loanId={verifyLoanId} onClose={() => setVerifyLoanId(null)} />
    </section>
  );
});

HomeBlockchainSection.displayName = 'HomeBlockchainSection';
