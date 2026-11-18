import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';
import { Navbar } from './Navbar';

export const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <div className="min-h-[100dvh] flex flex-col bg-slate-50 text-slate-900 font-sans antialiased">
      <Navbar />
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
      <footer className="bg-white border-t border-slate-200 py-8 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <ShieldCheck className="w-4 h-4 text-indigo-600" aria-hidden="true" />
              <span className="font-bold text-sm text-slate-900">EduVault</span>
            </div>
            <p className="text-xs text-slate-600 max-w-md">
              Hệ thống hỗ trợ sinh viên tìm kiếm, đăng ký và theo dõi quá trình mượn trả thiết bị học tập minh bạch.
            </p>
          </div>

          <nav aria-label="Liên kết chân trang" className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs font-semibold text-slate-700">
            <Link to="/equipment" className="hover:text-indigo-600 transition-colors">
              Thiết bị
            </Link>
            <Link to="/audit" className="hover:text-indigo-600 transition-colors">
              Sổ cái Blockchain
            </Link>
            <Link to="/login" className="hover:text-indigo-600 transition-colors">
              Đăng nhập
            </Link>
            <Link to="/register" className="hover:text-indigo-600 transition-colors">
              Đăng ký
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
};
