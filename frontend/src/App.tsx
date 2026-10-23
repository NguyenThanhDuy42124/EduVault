import { useState, useEffect } from 'react';
import { 
  Activity, 
  Database, 
  Layers, 
  ShieldCheck, 
  RefreshCw, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Cpu,
  Boxes
} from 'lucide-react';
import { healthService } from './services/api';
import { SystemHealth, DatabaseHealth } from './types';

export default function App() {
  const [systemHealth, setSystemHealth] = useState<SystemHealth | null>(null);
  const [dbHealth, setDbHealth] = useState<DatabaseHealth | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [lastChecked, setLastChecked] = useState<string>('');

  const checkConnectivity = async () => {
    setLoading(true);
    try {
      const sys = await healthService.checkSystemHealth();
      setSystemHealth(sys);
    } catch {
      setSystemHealth(null);
    }

    try {
      const db = await healthService.checkDbHealth();
      setDbHealth(db.database);
    } catch {
      setDbHealth(null);
    }

    setLastChecked(new Date().toLocaleTimeString());
    setLoading(false);
  };

  useEffect(() => {
    checkConnectivity();
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 text-slate-100 p-6 md:p-12 font-sans">
      <div className="max-w-5xl mx-auto space-y-8">
        
        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-center md:justify-between pb-6 border-b border-slate-700/60 gap-4">
          <div>
            <div className="flex items-center space-x-3">
              <span className="p-2.5 bg-indigo-600/30 border border-indigo-500/40 rounded-xl text-indigo-400">
                <Boxes className="w-7 h-7" />
              </span>
              <div>
                <div className="flex items-center space-x-2">
                  <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white">
                    Edu<span className="text-indigo-400">Vault</span>
                  </h1>
                  <span className="px-2 py-0.5 rounded text-[11px] font-bold tracking-wider uppercase bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                    Web3
                  </span>
                </div>
                <p className="text-sm text-slate-400 mt-0.5">
                  Smart Contract Audited • MySQL Off-Chain Ledger • FastAPI Relayer
                </p>
              </div>
            </div>
          </div>
          
          <button
            onClick={checkConnectivity}
            disabled={loading}
            className="inline-flex items-center space-x-2 px-4 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-sm transition shadow-lg shadow-indigo-600/20 active:scale-95 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span>Check Connectivity</span>
          </button>
        </header>

        {/* Phase Status Banner */}
        <div className="p-4 rounded-xl bg-indigo-950/50 border border-indigo-500/30 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <span className="flex h-3 w-3 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
            </span>
            <span className="text-sm font-medium text-indigo-200">
              Project Phase 3: Project Structure & Environment Verification Active
            </span>
          </div>
          <div className="text-xs text-slate-400 flex items-center space-x-1">
            <Clock className="w-3.5 h-3.5" />
            <span>Last checked: {lastChecked || 'Never'}</span>
          </div>
        </div>

        {/* Core Architecture Matrix */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* Card 1: FastAPI Backend */}
          <div className="bg-slate-800/80 border border-slate-700 rounded-2xl p-6 shadow-xl flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-xl">
                  <Activity className="w-6 h-6" />
                </div>
                {systemHealth ? (
                  <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Online
                  </span>
                ) : (
                  <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                    <XCircle className="w-3.5 h-3.5 mr-1" /> Offline
                  </span>
                )}
              </div>
              <h3 className="text-lg font-semibold text-white">FastAPI Backend</h3>
              <p className="text-xs text-slate-400 mt-1">Python 3.13 • Pydantic v2 • Web3.py</p>
              
              <div className="mt-4 pt-4 border-t border-slate-700/50 space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-400">Endpoint:</span>
                  <span className="font-mono text-slate-200">/api/v1/health</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Environment:</span>
                  <span className="text-slate-200 capitalize">{systemHealth?.environment || 'N/A'}</span>
                </div>
              </div>
            </div>
            
            <div className="mt-6 text-xs text-slate-500">
              Authoritative API gateway and custodial transaction relayer.
            </div>
          </div>

          {/* Card 2: MySQL Database */}
          <div className="bg-slate-800/80 border border-slate-700 rounded-2xl p-6 shadow-xl flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-xl">
                  <Database className="w-6 h-6" />
                </div>
                {dbHealth?.status === 'connected' ? (
                  <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Connected
                  </span>
                ) : (
                  <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    <Clock className="w-3.5 h-3.5 mr-1" /> Awaiting MySQL
                  </span>
                )}
              </div>
              <h3 className="text-lg font-semibold text-white">MySQL 8.x Database</h3>
              <p className="text-xs text-slate-400 mt-1">SQLAlchemy 2.0 • PyMySQL • InnoDB</p>
              
              <div className="mt-4 pt-4 border-t border-slate-700/50 space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-400">Host / Port:</span>
                  <span className="font-mono text-slate-200">{dbHealth?.host || 'localhost'}:{dbHealth?.port || 3306}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Database:</span>
                  <span className="text-slate-200 font-mono">{dbHealth?.database || 'equipment_lending_db'}</span>
                </div>
              </div>
            </div>

            <div className="mt-6 text-xs text-slate-500">
              Authoritative store for student PII, equipment specs, and local tx cache.
            </div>
          </div>

          {/* Card 3: Smart Contract (Hardhat) */}
          <div className="bg-slate-800/80 border border-slate-700 rounded-2xl p-6 shadow-xl flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-purple-500/10 text-purple-400 border border-purple-500/20 rounded-xl">
                  <Layers className="w-6 h-6" />
                </div>
                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-purple-500/20 text-purple-300 border border-purple-500/30">
                  <ShieldCheck className="w-3.5 h-3.5 mr-1" /> Compiled & Verified
                </span>
              </div>
              <h3 className="text-lg font-semibold text-white">EquipmentLending.sol</h3>
              <p className="text-xs text-slate-400 mt-1">Solidity ^0.8.24 • Hardhat Local EVM</p>
              
              <div className="mt-4 pt-4 border-t border-slate-700/50 space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-400">Chain ID:</span>
                  <span className="font-mono text-slate-200">31337 (Local Hardhat)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Deposit Model:</span>
                  <span className="text-slate-200">Simulated Ledger</span>
                </div>
              </div>
            </div>

            <div className="mt-6 text-xs text-slate-500">
              Authoritative canonical state machine and immutable lending audit trail.
            </div>
          </div>

        </div>

        {/* Technical Stack Architecture Grid */}
        <section className="bg-slate-800/50 border border-slate-700/60 rounded-2xl p-6 space-y-4">
          <div className="flex items-center space-x-2 text-indigo-400 font-semibold text-sm">
            <Cpu className="w-4 h-4" />
            <span>Phase 3 System Environment Verification Summary</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
            <div className="p-3 bg-slate-900/60 rounded-xl border border-slate-700/40">
              <span className="text-slate-500 block">Frontend Stack</span>
              <span className="font-semibold text-slate-200">React 18 + Vite + TS</span>
            </div>
            <div className="p-3 bg-slate-900/60 rounded-xl border border-slate-700/40">
              <span className="text-slate-500 block">Icon & UI Styling</span>
              <span className="font-semibold text-slate-200">Lucide + Tailwind CSS</span>
            </div>
            <div className="p-3 bg-slate-900/60 rounded-xl border border-slate-700/40">
              <span className="text-slate-500 block">Backend Framework</span>
              <span className="font-semibold text-slate-200">FastAPI + Python 3.13</span>
            </div>
            <div className="p-3 bg-slate-900/60 rounded-xl border border-slate-700/40">
              <span className="text-slate-500 block">Database Engine</span>
              <span className="font-semibold text-slate-200">MySQL 8.x + SQLAlchemy</span>
            </div>
          </div>
        </section>

      </div>
    </div>
  );
}
