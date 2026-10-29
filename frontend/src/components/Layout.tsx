import React from 'react';
import { Navbar } from './Navbar';
import { ShieldCheck } from 'lucide-react';

export const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <div className="min-h-[100dvh] flex flex-col bg-slate-50 text-slate-900 font-sans antialiased">
      <Navbar />
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
      <footer className="bg-white border-t border-slate-200/80 py-6 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-3">
          <div className="flex items-center space-x-2">
            <ShieldCheck className="w-4 h-4 text-indigo-600" />
            <span className="font-medium text-slate-700">EduVault Core</span>
            <span>-</span>
            <span>Hệ thống Quản lý Mượn trả Thiết bị Đào tạo trên EVM Blockchain</span>
          </div>
          <div className="flex items-center space-x-4">
            <span>FastAPI + MySQL 8.0</span>
            <span>•</span>
            <span>Solidity Hardhat EVM</span>
            <span>•</span>
            <span>React 18 + Vite</span>
          </div>
        </div>
      </footer>
    </div>
  );
};
