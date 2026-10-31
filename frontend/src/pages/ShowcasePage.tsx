import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import {
  ShieldCheck, Database, KeyRound, Lock, CircleDollarSign,
  Server, Cpu, MonitorCheck, Copy, Check,
  Zap, Activity, Box, ChevronRight, Play, RotateCcw,
  HardDrive, Wifi, Clock, Hash, Fuel
} from 'lucide-react';
import { equipmentService } from '../services/equipmentService';
import { auditService } from '../services/auditService';
import { blockchainService } from '../services/blockchainService';
import type { Equipment, BlockchainTx, BlockchainStatus } from '../types';

// ═════════════════════════════════════════════════════════════════════
//  Helpers
// ═════════════════════════════════════════════════════════════════════

/** Rút gọn hash giao dịch */
function truncateHash(hash: string, head = 8, tail = 6): string {
  if (!hash || hash.length <= head + tail + 3) return hash || '';
  return `${hash.slice(0, head)}...${hash.slice(-tail)}`;
}

/** Nhãn tiếng Việt cho action_type */
function actionLabel(action: string): string {
  const map: Record<string, string> = {
    CREATE_LOAN: 'Tạo đơn',
    APPROVE_LOAN: 'Duyệt đơn',
    REJECT_LOAN: 'Từ chối',
    HANDOVER: 'Bàn giao',
    RETURN_LOAN: 'Trả máy',
    CANCEL_LOAN: 'Hủy đơn',
  };
  return map[action] || action;
}

/** Màu badge cho action_type */
function actionColor(action: string): string {
  const map: Record<string, string> = {
    CREATE_LOAN: 'bg-blue-100 text-blue-700',
    APPROVE_LOAN: 'bg-emerald-100 text-emerald-700',
    REJECT_LOAN: 'bg-slate-100 text-slate-600',
    HANDOVER: 'bg-amber-100 text-amber-700',
    RETURN_LOAN: 'bg-indigo-100 text-indigo-700',
    CANCEL_LOAN: 'bg-rose-100 text-rose-700',
  };
  return map[action] || 'bg-slate-100 text-slate-600';
}

/** Map equipment status sang hiển thị */
function statusBadge(status: string): { label: string; cls: string } {
  const map: Record<string, { label: string; cls: string }> = {
    AVAILABLE: { label: 'Sẵn sàng', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    IN_USE: { label: 'Đang mượn', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
    RESERVED: { label: 'Đã giữ chỗ', cls: 'bg-blue-50 text-blue-700 border-blue-200' },
    MAINTENANCE: { label: 'Bảo trì', cls: 'bg-slate-100 text-slate-600 border-slate-200' },
    RETIRED: { label: 'Ngừng cấp', cls: 'bg-rose-50 text-rose-700 border-rose-200' },
  };
  return map[status] || { label: status, cls: 'bg-slate-100 text-slate-600 border-slate-200' };
}

// ═════════════════════════════════════════════════════════════════════
//  Simulator Scenarios
// ═════════════════════════════════════════════════════════════════════

interface SimScenario {
  id: string;
  label: string;
  description: string;
  returnCondition: string;
  isOverdue: boolean;
  overdueHours: number;
  penaltyPercent: number;
  depositAction: string;
  finalState: string;
  colorCls: string;
  activeCls: string;
}

const SCENARIOS: SimScenario[] = [
  {
    id: 'on-time',
    label: 'Trả đúng hạn',
    description: 'Sinh viên trả thiết bị trước hoặc đúng hạn, thiết bị nguyên vẹn.',
    returnCondition: 'GOOD',
    isOverdue: false,
    overdueHours: 0,
    penaltyPercent: 0,
    depositAction: 'Hoàn cọc 100%',
    finalState: 'RETURNED',
    colorCls: 'text-emerald-600',
    activeCls: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  },
  {
    id: 'late-10',
    label: 'Trễ hạn ≤ 24h',
    description: 'Sinh viên trả máy trễ 12 giờ so với hạn. Thiết bị nguyên vẹn.',
    returnCondition: 'GOOD',
    isOverdue: true,
    overdueHours: 12,
    penaltyPercent: 10,
    depositAction: 'Phạt 10% — Hoàn 90% cọc',
    finalState: 'RETURNED',
    colorCls: 'text-amber-600',
    activeCls: 'bg-amber-50 text-amber-700 border-amber-200',
  },
  {
    id: 'late-50',
    label: 'Trễ hạn > 24h',
    description: 'Sinh viên trả máy trễ 48 giờ so với hạn. Thiết bị nguyên vẹn.',
    returnCondition: 'GOOD',
    isOverdue: true,
    overdueHours: 48,
    penaltyPercent: 50,
    depositAction: 'Phạt 50% — Hoàn 50% cọc',
    finalState: 'RETURNED',
    colorCls: 'text-orange-600',
    activeCls: 'bg-orange-50 text-orange-700 border-orange-200',
  },
  {
    id: 'damaged',
    label: 'Thiết bị hỏng',
    description: 'Sinh viên trả máy nhưng thiết bị bị hư hại nghiêm trọng.',
    returnCondition: 'DAMAGED',
    isOverdue: false,
    overdueHours: 0,
    penaltyPercent: 100,
    depositAction: 'Tịch thu 100% cọc',
    finalState: 'DISPUTED',
    colorCls: 'text-rose-600',
    activeCls: 'bg-rose-50 text-rose-700 border-rose-200',
  },
  {
    id: 'lost',
    label: 'Thiết bị mất',
    description: 'Sinh viên báo mất thiết bị, không thể hoàn trả.',
    returnCondition: 'LOST',
    isOverdue: false,
    overdueHours: 0,
    penaltyPercent: 100,
    depositAction: 'Tịch thu 100% cọc',
    finalState: 'DISPUTED',
    colorCls: 'text-red-700',
    activeCls: 'bg-red-50 text-red-700 border-red-200',
  },
];

// ═════════════════════════════════════════════════════════════════════
//  Pipeline Station data
// ═════════════════════════════════════════════════════════════════════

const PIPELINE_STATIONS = [
  {
    step: 1,
    title: 'MySQL Lock',
    subtitle: 'Khóa dòng chống tranh chấp',
    description: 'SELECT ... FOR UPDATE khóa thiết bị trong MySQL, chặn mượn trùng ngay tại tầng CSDL.',
    icon: Database,
    iconColor: 'text-blue-600',
    bgGradient: 'bg-gradient-to-br from-blue-50 to-blue-100/50',
    borderColor: 'border-blue-200',
  },
  {
    step: 2,
    title: 'Custodial Relayer',
    subtitle: 'FastAPI ký giao dịch',
    description: 'Backend dùng Private Key của Admin để ký và broadcast giao dịch lên EVM. Sinh viên không cần ví Web3.',
    icon: KeyRound,
    iconColor: 'text-amber-600',
    bgGradient: 'bg-gradient-to-br from-amber-50 to-amber-100/50',
    borderColor: 'border-amber-200',
  },
  {
    step: 3,
    title: 'Smart Contract',
    subtitle: 'Mutex & Khóa cọc',
    description: 'Contract kiểm tra Mutex thiết bị, ghi nhận trạng thái mượn và khóa tiền cọc mô phỏng on-chain.',
    icon: Lock,
    iconColor: 'text-emerald-600',
    bgGradient: 'bg-gradient-to-br from-emerald-50 to-emerald-100/50',
    borderColor: 'border-emerald-200',
  },
  {
    step: 4,
    title: 'Quyết toán Cọc',
    subtitle: 'Hoàn/Tịch thu tự động',
    description: 'Trả đúng hạn: hoàn 100%. Trễ ≤24h: phạt 10%. Trễ >24h: phạt 50%. Hỏng/Mất: tịch thu 100%.',
    icon: CircleDollarSign,
    iconColor: 'text-indigo-600',
    bgGradient: 'bg-gradient-to-br from-indigo-50 to-indigo-100/50',
    borderColor: 'border-indigo-200',
  },
];

// ═════════════════════════════════════════════════════════════════════
//  COMPONENT
// ═════════════════════════════════════════════════════════════════════

export const ShowcasePage: React.FC = () => {
  // ── Data ──
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [transactions, setTransactions] = useState<BlockchainTx[]>([]);
  const [bcStatus, setBcStatus] = useState<BlockchainStatus | null>(null);
  const [copiedHash, setCopiedHash] = useState<string | null>(null);

  // ── Simulator ──
  const [activeScenario, setActiveScenario] = useState<SimScenario>(SCENARIOS[0]);
  const [simStep, setSimStep] = useState(0);
  const [simRunning, setSimRunning] = useState(false);

  // ── GSAP refs ──
  const containerRef = useRef<HTMLDivElement>(null);
  const vaultRef = useRef<HTMLDivElement>(null);
  const counterRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const pipelineRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<HTMLDivElement>(null);

  // ── Fetch data ──
  useEffect(() => {
    const load = async () => {
      try {
        const [eq, txs, status] = await Promise.all([
          equipmentService.getAll(),
          auditService.getTransactions(20),
          blockchainService.getStatus(),
        ]);
        setEquipment(eq);
        setTransactions(txs);
        setBcStatus(status);
      } catch {
        // Backend chưa chạy → hiển thị fallback
      }
    };
    load();
  }, []);

  // ── Computed ──
  const availableCount = equipment.filter(e => e.status === 'AVAILABLE').length;
  const totalTx = transactions.length;
  const depositIntegrity = 100;

  // ── GSAP: 3D Vault tilt ──
  useGSAP(() => {
    if (!vaultRef.current) return;
    const vault = vaultRef.current;
    const xTo = gsap.quickTo(vault, 'rotateY', { duration: 0.4, ease: 'power2.out' });
    const yTo = gsap.quickTo(vault, 'rotateX', { duration: 0.4, ease: 'power2.out' });

    const handleMove = (e: MouseEvent) => {
      const rect = vault.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = (e.clientX - cx) / rect.width;
      const dy = (e.clientY - cy) / rect.height;
      xTo(dx * 15);
      yTo(-dy * 15);
    };
    const handleLeave = () => { xTo(0); yTo(0); };

    window.addEventListener('mousemove', handleMove);
    vault.addEventListener('mouseleave', handleLeave);
    return () => {
      window.removeEventListener('mousemove', handleMove);
      vault.removeEventListener('mouseleave', handleLeave);
    };
  }, { scope: containerRef });

  // ── GSAP: Counter animation ──
  useGSAP(() => {
    const targets = [availableCount, totalTx, depositIntegrity];
    counterRefs.current.forEach((el, i) => {
      if (!el) return;
      gsap.fromTo(
        el,
        { innerText: '0' },
        {
          innerText: String(targets[i]),
          duration: 1.8,
          ease: 'power2.out',
          snap: { innerText: 1 },
          delay: 0.3 + i * 0.15,
          onUpdate: function () {
            if (el) el.textContent = String(Math.round(Number(el.textContent || '0')));
          },
        }
      );
    });
  }, { scope: containerRef, dependencies: [availableCount, totalTx] });

  // ── GSAP: Pipeline entrance ──
  useGSAP(() => {
    if (!pipelineRef.current) return;
    const stations = pipelineRef.current.querySelectorAll('.pipeline-station');
    gsap.fromTo(stations,
      { opacity: 0, y: 30 },
      { opacity: 1, y: 0, duration: 0.6, stagger: 0.15, ease: 'power2.out', delay: 0.4 }
    );
  }, { scope: containerRef });

  // ── GSAP: Terminal rows slide-in ──
  useGSAP(() => {
    if (!terminalRef.current) return;
    const rows = terminalRef.current.querySelectorAll('.tx-row');
    gsap.fromTo(rows,
      { opacity: 0, x: -20 },
      { opacity: 1, x: 0, duration: 0.35, stagger: 0.06, ease: 'power2.out' }
    );
  }, { scope: containerRef, dependencies: [transactions] });

  // ── Clipboard ──
  const copyHash = useCallback((hash: string) => {
    navigator.clipboard.writeText(hash);
    setCopiedHash(hash);
    setTimeout(() => setCopiedHash(null), 2000);
  }, []);

  // ── Simulator ──
  const runSimulation = useCallback(() => {
    setSimStep(0);
    setSimRunning(true);
    [1, 2, 3, 4, 5].forEach((step, i) => {
      setTimeout(() => {
        setSimStep(step);
        if (step === 5) setTimeout(() => setSimRunning(false), 800);
      }, 700 * (i + 1));
    });
  }, []);

  const resetSimulation = useCallback(() => {
    setSimStep(0);
    setSimRunning(false);
  }, []);

  // ═══════════════════════════════════════════════════════════════════
  //  RENDER
  // ═══════════════════════════════════════════════════════════════════
  return (
    <div ref={containerRef} className="space-y-10">

      {/* ═══════════════ ZONE 1: HERO ═══════════════ */}
      <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-900 p-8 lg:p-12">
        {/* Grid overlay */}
        <div
          className="absolute inset-0 opacity-5 pointer-events-none"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
            backgroundSize: '40px 40px',
          }}
        />

        <div className="relative flex flex-col lg:flex-row items-center gap-10">
          {/* Left text + counters */}
          <div className="flex-1 space-y-6">
            <div className="flex items-center gap-2 text-indigo-400 text-xs font-semibold tracking-widest uppercase">
              <Zap className="w-4 h-4" />
              EduVault Interactive Showcase
            </div>
            <h1 className="text-3xl lg:text-4xl font-bold text-white leading-tight tracking-tight">
              Quản lý Mượn Trả Thiết bị
              <br />
              <span className="text-indigo-400">Bảo chứng bởi Smart Contract</span>
            </h1>
            <p className="text-slate-400 text-sm max-w-lg leading-relaxed">
              Hệ thống lai Web2.5 kết hợp MySQL, FastAPI và Solidity Smart Contract
              trên Hardhat EVM. Mọi giao dịch mượn trả đều được ghi nhận bất biến
              trên blockchain, đảm bảo minh bạch và chống gian lận.
            </p>

            {/* Live counters */}
            <div className="grid grid-cols-3 gap-4 pt-2">
              {[
                { label: 'Thiết bị sẵn sàng', suffix: '', icon: Box },
                { label: 'Giao dịch On-chain', suffix: '', icon: Activity },
                { label: 'Bảo toàn quỹ cọc', suffix: '%', icon: ShieldCheck },
              ].map((metric, i) => (
                <div key={metric.label} className="bg-white/5 border border-white/10 rounded-xl p-4 text-center">
                  <metric.icon className="w-5 h-5 text-indigo-400 mx-auto mb-2" />
                  <div className="text-2xl font-bold text-white tabular-nums">
                    <span ref={el => { counterRefs.current[i] = el; }}>0</span>
                    {metric.suffix}
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">{metric.label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Right: 3D Vault */}
          <div className="flex-shrink-0" style={{ perspective: '800px' }}>
            <div
              ref={vaultRef}
              className="w-52 h-52 lg:w-60 lg:h-60 relative cursor-pointer"
              style={{ transformStyle: 'preserve-3d' }}
            >
              {/* Front */}
              <div
                className="absolute inset-0 rounded-2xl bg-gradient-to-br from-indigo-600 to-indigo-800 border border-indigo-500/30 flex items-center justify-center shadow-2xl shadow-indigo-500/20"
                style={{ transform: 'translateZ(40px)' }}
              >
                <ShieldCheck className="w-20 h-20 text-white/80" />
              </div>
              {/* Top */}
              <div
                className="absolute inset-x-0 top-0 h-20 rounded-t-2xl bg-gradient-to-b from-indigo-500 to-indigo-600 origin-bottom"
                style={{ transform: 'rotateX(90deg) translateZ(40px)' }}
              />
              {/* Right side */}
              <div
                className="absolute inset-y-0 right-0 w-20 rounded-r-2xl bg-gradient-to-l from-indigo-700 to-indigo-800 origin-left"
                style={{ transform: 'rotateY(90deg) translateZ(192px)' }}
              />
              {/* Glow */}
              <div className="absolute -inset-6 rounded-3xl bg-indigo-500/10 blur-2xl pointer-events-none" />
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════ ZONE 2: VISUAL PIPELINE ═══════════════ */}
      <section>
        <div className="flex items-center gap-2 mb-5">
          <Server className="w-5 h-5 text-indigo-600" />
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">
            Dòng chảy Web2.5 — Từ Đơn Mượn đến Blockchain
          </h2>
        </div>

        <div ref={pipelineRef} className="grid grid-cols-1 md:grid-cols-4 gap-4 relative">
          {PIPELINE_STATIONS.map((station, i) => (
            <div key={station.step} className="pipeline-station relative">
              <div className={`rounded-xl border ${station.borderColor} ${station.bgGradient} p-5 h-full`}>
                <div className="flex items-center gap-3 mb-3">
                  <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-white shadow-sm border border-slate-100">
                    <station.icon className={`w-4 h-4 ${station.iconColor}`} />
                  </div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    Trạm {station.step}
                  </span>
                </div>
                <h3 className="text-sm font-bold text-slate-900 mb-1">{station.title}</h3>
                <p className="text-[11px] text-slate-500 mb-2">{station.subtitle}</p>
                <p className="text-xs text-slate-600 leading-relaxed">{station.description}</p>
              </div>
              {i < 3 && (
                <div className="hidden md:flex absolute -right-2.5 top-1/2 -translate-y-1/2 z-10">
                  <ChevronRight className="w-4 h-4 text-slate-300" />
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* ═══════════════ ZONE 3: LIVE TX TERMINAL ═══════════════ */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <MonitorCheck className="w-5 h-5 text-emerald-600" />
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">
              Live On-Chain Transaction Terminal
            </h2>
          </div>
          {bcStatus && (
            <div className="flex items-center gap-4 text-[11px] text-slate-500 font-mono">
              <span className="flex items-center gap-1">
                <Wifi className={`w-3 h-3 ${bcStatus.is_connected ? 'text-emerald-500' : 'text-rose-500'}`} />
                {bcStatus.is_connected ? 'Connected' : 'Offline'}
              </span>
              {bcStatus.latest_block != null && (
                <span className="flex items-center gap-1">
                  <HardDrive className="w-3 h-3" />
                  Block #{bcStatus.latest_block}
                </span>
              )}
              {bcStatus.chain_id != null && (
                <span className="flex items-center gap-1">
                  <Cpu className="w-3 h-3" />
                  Chain {bcStatus.chain_id}
                </span>
              )}
            </div>
          )}
        </div>

        <div ref={terminalRef} className="rounded-xl border border-slate-800 bg-slate-950 overflow-hidden shadow-lg">
          {/* Header bar */}
          <div className="flex items-center gap-2 px-4 py-2.5 bg-slate-900/80 border-b border-slate-800">
            <div className="flex gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-rose-500/80" />
              <div className="w-2.5 h-2.5 rounded-full bg-amber-500/80" />
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/80" />
            </div>
            <span className="text-[11px] text-slate-500 font-mono ml-2">
              hardhat-evm@127.0.0.1:8545 — transactions.log
            </span>
          </div>

          {/* Rows */}
          <div className="p-3 space-y-1 max-h-72 overflow-y-auto font-mono text-[11px]">
            {transactions.length === 0 ? (
              <div className="text-center py-8 text-slate-600 text-xs">
                Chưa có giao dịch nào. Thực hiện một thao tác mượn trả để thấy dữ liệu ở đây.
              </div>
            ) : (
              transactions.map((tx) => (
                <div
                  key={tx.id}
                  className="tx-row flex items-center gap-3 py-1.5 px-2 rounded hover:bg-slate-900/60 group transition-colors"
                >
                  {/* Status dot */}
                  <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                    tx.status === 'CONFIRMED' ? 'bg-emerald-400' :
                    tx.status === 'FAILED' ? 'bg-rose-400' : 'bg-amber-400'
                  }`} />

                  {/* Action badge */}
                  <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold leading-none ${actionColor(tx.action_type)}`}>
                    {actionLabel(tx.action_type)}
                  </span>

                  {/* Hash */}
                  <span className="text-emerald-400/90 flex items-center gap-1 min-w-0">
                    <Hash className="w-3 h-3 text-slate-600 flex-shrink-0" />
                    <span className="truncate">{truncateHash(tx.tx_hash)}</span>
                    <button
                      onClick={() => copyHash(tx.tx_hash)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 hover:text-emerald-300 flex-shrink-0 cursor-pointer"
                      title="Sao chép hash"
                    >
                      {copiedHash === tx.tx_hash
                        ? <Check className="w-3 h-3 text-emerald-400" />
                        : <Copy className="w-3 h-3" />}
                    </button>
                  </span>

                  {/* Meta */}
                  <span className="text-slate-600 ml-auto flex items-center gap-3 flex-shrink-0">
                    {tx.block_number != null && (
                      <span className="flex items-center gap-1">
                        <Box className="w-3 h-3" /> {tx.block_number}
                      </span>
                    )}
                    {tx.gas_used != null && (
                      <span className="flex items-center gap-1">
                        <Fuel className="w-3 h-3" /> {tx.gas_used.toLocaleString()}
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {new Date(tx.created_at).toLocaleTimeString('vi-VN')}
                    </span>
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      {/* ═══════════════ ZONE 4: EQUIPMENT + SIMULATOR ═══════════════ */}
      <section className="grid grid-cols-1 lg:grid-cols-5 gap-6">

        {/* Equipment spotlight */}
        <div className="lg:col-span-2">
          <div className="flex items-center gap-2 mb-4">
            <Box className="w-5 h-5 text-indigo-600" />
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">Kho Thiết bị</h2>
          </div>
          <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
            {equipment.length === 0 ? (
              <div className="text-center py-8 text-slate-400 text-xs">Chưa có dữ liệu thiết bị.</div>
            ) : (
              equipment.map(eq => {
                const badge = statusBadge(eq.status);
                const deposit = typeof eq.deposit_amount === 'string'
                  ? parseFloat(eq.deposit_amount)
                  : eq.deposit_amount;
                return (
                  <div
                    key={eq.id}
                    className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm transition-all"
                  >
                    <div className="w-11 h-11 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0 overflow-hidden">
                      {eq.image_url ? (
                        <img src={eq.image_url} alt={eq.name} className="w-full h-full object-cover rounded-lg" />
                      ) : (
                        <Cpu className="w-5 h-5 text-slate-400" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-slate-900 truncate">{eq.name}</p>
                      <p className="text-[11px] font-mono text-slate-500 truncate">{eq.serial_number}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <span className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-semibold border ${badge.cls}`}>
                        {badge.label}
                      </span>
                      <p className="text-[11px] font-mono text-slate-500 mt-0.5">
                        {deposit.toLocaleString('vi-VN')} VND
                      </p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Simulator */}
        <div className="lg:col-span-3">
          <div className="flex items-center gap-2 mb-4">
            <Zap className="w-5 h-5 text-amber-500" />
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">Simulator Playground</h2>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            {/* Scenario tabs */}
            <div className="flex flex-wrap gap-2 mb-5">
              {SCENARIOS.map(sc => (
                <button
                  key={sc.id}
                  onClick={() => { setActiveScenario(sc); resetSimulation(); }}
                  disabled={simRunning}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border cursor-pointer active:scale-[0.98] ${
                    activeScenario.id === sc.id
                      ? sc.activeCls
                      : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  {sc.label}
                </button>
              ))}
            </div>

            {/* Description */}
            <div className="bg-slate-50 border border-slate-100 rounded-lg p-4 mb-5">
              <p className="text-xs text-slate-700 leading-relaxed">{activeScenario.description}</p>
              <div className="flex items-center gap-4 mt-2 text-[11px] text-slate-500">
                <span>Tình trạng: <strong className="text-slate-700">{activeScenario.returnCondition}</strong></span>
                {activeScenario.isOverdue && (
                  <span>Quá hạn: <strong className="text-slate-700">{activeScenario.overdueHours}h</strong></span>
                )}
              </div>
            </div>

            {/* Steps */}
            <div className="space-y-2.5 mb-5">
              {[
                { s: 1, label: 'Sinh viên gửi đơn mượn', detail: 'Tạo LendingRequest trong MySQL, status = PENDING' },
                { s: 2, label: 'Admin duyệt & ký On-chain', detail: 'Backend gọi createLoan() + approveLoan() trên Smart Contract' },
                { s: 3, label: 'Bàn giao thiết bị', detail: 'confirmHandover() khóa tiền cọc mô phỏng, status = ACTIVE' },
                { s: 4, label: 'Trả thiết bị & Nghiệm thu', detail: `confirmReturn(${activeScenario.returnCondition}) — Phạt ${activeScenario.penaltyPercent}%` },
                { s: 5, label: 'Kết quả Smart Contract', detail: `${activeScenario.depositAction} — Trạng thái: ${activeScenario.finalState}` },
              ].map(({ s, label, detail }) => (
                <div
                  key={s}
                  className={`flex items-start gap-3 p-3 rounded-lg transition-all duration-300 ${
                    simStep >= s ? 'bg-slate-50' : 'opacity-30'
                  }`}
                >
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-[11px] font-bold transition-colors duration-300 ${
                    simStep > s
                      ? 'bg-emerald-600 text-white'
                      : simStep === s
                        ? 'bg-indigo-600 text-white ring-2 ring-indigo-200'
                        : 'bg-slate-200 text-slate-500'
                  }`}>
                    {simStep > s ? <Check className="w-3.5 h-3.5" /> : s}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-slate-900">{label}</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">{detail}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Result card */}
            {simStep === 5 && (
              <div className={`rounded-lg p-4 mb-4 border ${
                activeScenario.penaltyPercent === 0
                  ? 'bg-emerald-50 border-emerald-200'
                  : activeScenario.penaltyPercent <= 50
                    ? 'bg-amber-50 border-amber-200'
                    : 'bg-rose-50 border-rose-200'
              }`}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className={`text-sm font-bold ${
                      activeScenario.penaltyPercent === 0 ? 'text-emerald-800' :
                      activeScenario.penaltyPercent <= 50 ? 'text-amber-800' : 'text-rose-800'
                    }`}>
                      {activeScenario.depositAction}
                    </p>
                    <p className="text-[11px] text-slate-600 mt-0.5">
                      Trạng thái: {activeScenario.finalState}
                      {activeScenario.penaltyPercent > 0 && ` — Mức phạt: ${activeScenario.penaltyPercent}%`}
                    </p>
                  </div>
                  <div className={`text-2xl font-bold tabular-nums ${
                    activeScenario.penaltyPercent === 0 ? 'text-emerald-600' :
                    activeScenario.penaltyPercent <= 50 ? 'text-amber-600' : 'text-rose-600'
                  }`}>
                    {activeScenario.penaltyPercent}%
                  </div>
                </div>
              </div>
            )}

            {/* Controls */}
            <div className="flex gap-3">
              <button
                onClick={runSimulation}
                disabled={simRunning}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors active:scale-[0.98] cursor-pointer shadow-sm"
              >
                <Play className="w-3.5 h-3.5" />
                {simRunning ? 'Đang chạy...' : 'Chạy mô phỏng'}
              </button>
              <button
                onClick={resetSimulation}
                disabled={simRunning}
                className="flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-200 text-slate-700 text-xs font-semibold hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Đặt lại
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════ NETWORK FOOTER ═══════════════ */}
      {bcStatus && (
        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 text-[11px] text-slate-500 font-mono">
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${bcStatus.is_connected ? 'bg-emerald-400' : 'bg-rose-400'}`} />
              <span>Hardhat EVM{bcStatus.chain_id != null ? ` — Chain ID ${bcStatus.chain_id}` : ''}</span>
            </div>
            {bcStatus.relayer_address && (
              <span>Admin: <code className="text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded text-[10px]">{truncateHash(bcStatus.relayer_address)}</code></span>
            )}
            {bcStatus.relayer_balance_eth && (
              <span>Balance: {bcStatus.relayer_balance_eth} ETH</span>
            )}
          </div>
        </section>
      )}
    </div>
  );
};

export default ShowcasePage;
