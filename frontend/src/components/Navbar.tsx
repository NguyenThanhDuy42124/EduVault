import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useWeb3 } from '../context/Web3Context';
import {
  ShieldCheck,
  Laptop,
  ClipboardList,
  Boxes,
  Activity,
  LogOut,
  RefreshCw,
  LayoutDashboard,
  Wallet,
  AlertTriangle,
} from 'lucide-react';

export const Navbar: React.FC = () => {
  const { user, role, logout, quickLogin } = useAuth();
  const { account, balanceEth, isConnected, isCorrectNetwork, connectWallet, switchNetwork } = useWeb3();
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
      name: 'Tổng quan',
      path: '/overview',
      icon: LayoutDashboard,
      roles: ['ADMIN', 'BORROWER'],
    },
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
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand */}
          <div className="flex items-center space-x-8">
            <Link to="/equipment" className="flex items-center space-x-2.5">
              <div className="w-8 h-8 rounded-lg bg-slate-900 flex items-center justify-center text-white">
                <ShieldCheck className="w-4 h-4 text-slate-100" />
              </div>
              <span className="font-bold text-slate-900 text-base tracking-tight">
                EduVault
              </span>
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
                      className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                        active
                          ? 'bg-slate-100 text-slate-900'
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
            {/* Web3 MetaMask Connect Button */}
            {isConnected ? (
              <div className="flex items-center space-x-2">
                {!isCorrectNetwork ? (
                  <button
                    onClick={switchNetwork}
                    className="inline-flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-300 rounded-lg transition-colors cursor-pointer"
                    title="Bấm để đổi sang mạng Hardhat 31337"
                  >
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                    <span>Đổi mạng (31337)</span>
                  </button>
                ) : (
                  <div className="hidden md:flex items-center space-x-2 px-2.5 py-1 bg-slate-900 text-white rounded-lg border border-slate-800 text-xs font-mono shadow-xs">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                    <span className="font-semibold text-slate-200">
                      {account ? `${account.slice(0, 6)}...${account.slice(-4)}` : ''}
                    </span>
                    {balanceEth && (
                      <span className="text-[10px] text-slate-400 border-l border-slate-700 pl-2">
                        {balanceEth} ETH
                      </span>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <button
                onClick={connectWallet}
                className="inline-flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold text-orange-700 bg-orange-50 hover:bg-orange-100 border border-orange-200 rounded-lg transition-colors cursor-pointer active:scale-[0.98]"
                title="Kết nối ví MetaMask"
              >
                <Wallet className="w-3.5 h-3.5 text-orange-600" />
                <span>Kết nối MetaMask</span>
              </button>
            )}

            {user ? (
              <>
                {/* Role Switch Button */}
                <button
                  onClick={handleQuickSwitch}
                  disabled={switching}
                  className="hidden sm:inline-flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-lg transition-colors active:scale-[0.98] cursor-pointer"
                  title="Chuyển đổi vai trò tài khoản để kiểm thử"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${switching ? 'animate-spin' : ''}`} />
                  <span>
                    Chuyển sang {role === 'ADMIN' ? 'Sinh viên' : 'Quản lý kho'}
                  </span>
                </button>

                {/* User Pill */}
                <div className="flex items-center space-x-3 pl-3 border-l border-slate-200">
                  <div className="text-right hidden sm:block">
                    <p className="text-sm font-semibold text-slate-900 leading-tight">
                      {user.full_name}
                    </p>
                    <div className="flex items-center justify-end space-x-2 mt-1">
                      <span className="text-xs font-mono font-medium text-slate-600">
                        {user.student_staff_id}
                      </span>
                      <span
                        className={`text-xs px-2.5 py-0.5 rounded-md font-semibold uppercase tracking-wide border ${
                          role === 'ADMIN'
                            ? 'bg-slate-900 text-white border-slate-900'
                            : 'bg-emerald-50 text-emerald-800 border-emerald-300'
                        }`}
                      >
                        {role}
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={logout}
                    className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                    title="Đăng xuất khỏi hệ thống"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                </div>
              </>
            ) : (
              <Link
                to="/login"
                className="px-4 py-2 bg-slate-900 text-white text-xs font-semibold rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Đăng nhập
              </Link>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
export default Navbar;
