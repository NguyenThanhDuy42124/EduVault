import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  ShieldCheck,
  Laptop,
  ClipboardList,
  Boxes,
  Activity,
  LogOut,
  UserCheck,
  RefreshCw,
} from 'lucide-react';

export const Navbar: React.FC = () => {
  const { user, role, logout, quickLogin } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [switching, setSwitching] = useState(false);

  const isActive = (path: string) => location.pathname === path;

  const handleQuickSwitch = async () => {
    setSwitching(true);
    try {
      if (role === 'ADMIN') {
        await quickLogin('BORROWER');
        navigate('/equipment');
      } else {
        await quickLogin('ADMIN');
        navigate('/admin/loans');
      }
    } finally {
      setSwitching(false);
    }
  };

  const navLinks = [
    {
      name: 'Danh mục thiết bị',
      path: '/equipment',
      icon: Laptop,
      roles: ['ADMIN', 'BORROWER'],
    },
    {
      name: 'Đơn mượn của tôi',
      path: '/my-loans',
      icon: ClipboardList,
      roles: ['BORROWER'],
    },
    {
      name: 'Điều phối mượn trả',
      path: '/admin/loans',
      icon: ClipboardList,
      roles: ['ADMIN'],
    },
    {
      name: 'Quản trị kho',
      path: '/admin/inventory',
      icon: Boxes,
      roles: ['ADMIN'],
    },
    {
      name: 'Kiểm toán Blockchain',
      path: '/audit',
      icon: Activity,
      roles: ['ADMIN', 'BORROWER'],
    },
  ];

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-slate-200/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand */}
          <div className="flex items-center space-x-8">
            <Link to="/equipment" className="flex items-center space-x-2.5 group">
              <div className="w-9 h-9 rounded-xl bg-slate-900 flex items-center justify-center text-white shadow-sm group-hover:bg-indigo-600 transition-colors">
                <ShieldCheck className="w-5 h-5 text-indigo-400 group-hover:text-white transition-colors" />
              </div>
              <div>
                <span className="font-bold text-slate-900 text-base tracking-tight block leading-none">
                  EduVault
                </span>
                <span className="text-[10px] text-slate-500 font-medium tracking-tight block mt-0.5">
                  Smart Lending & Audit
                </span>
              </div>
            </Link>

            {/* Navigation Links */}
            <nav className="hidden md:flex items-center space-x-1">
              {navLinks
                .filter((link) => !role || link.roles.includes(role))
                .map((link) => {
                  const Icon = link.icon;
                  const active = isActive(link.path);
                  return (
                    <Link
                      key={link.path}
                      to={link.path}
                      className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                        active
                          ? 'bg-slate-100 text-slate-900 font-semibold'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5 opacity-70" />
                      <span>{link.name}</span>
                    </Link>
                  );
                })}
            </nav>
          </div>

          {/* Right Controls */}
          <div className="flex items-center space-x-3">
            {user ? (
              <>
                {/* Demo Quick Switch */}
                <button
                  onClick={handleQuickSwitch}
                  disabled={switching}
                  className="hidden sm:inline-flex items-center space-x-1.5 px-2.5 py-1 text-[11px] font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200/80 rounded-lg transition-colors active:scale-[0.98]"
                  title="Chuyển đổi nhanh giữa tài khoản Admin và Sinh viên phục vụ Demo"
                >
                  <RefreshCw className={`w-3 h-3 ${switching ? 'animate-spin' : ''}`} />
                  <span>
                    Chuyển sang {role === 'ADMIN' ? 'Sinh viên' : 'Quản lý kho'}
                  </span>
                </button>

                {/* User Pill */}
                <div className="flex items-center space-x-2 pl-2 border-l border-slate-200">
                  <div className="text-right hidden sm:block">
                    <p className="text-xs font-semibold text-slate-900 leading-tight">
                      {user.full_name}
                    </p>
                    <div className="flex items-center justify-end space-x-1 mt-0.5">
                      <span className="text-[10px] text-slate-500 font-mono">
                        {user.student_staff_id}
                      </span>
                      <span
                        className={`text-[9px] px-1.5 py-0.2 rounded font-semibold uppercase tracking-wider ${
                          role === 'ADMIN'
                            ? 'bg-indigo-100 text-indigo-700'
                            : 'bg-emerald-100 text-emerald-700'
                        }`}
                      >
                        {role}
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={logout}
                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                    title="Đăng xuất"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                </div>
              </>
            ) : (
              <Link
                to="/login"
                className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-slate-900 text-white rounded-lg text-xs font-medium hover:bg-slate-800 transition-colors shadow-sm"
              >
                <UserCheck className="w-3.5 h-3.5" />
                <span>Đăng nhập</span>
              </Link>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
