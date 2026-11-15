import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useWeb3 } from '../context/Web3Context';
import { TARGET_CHAIN_ID, TARGET_CHAIN_NAME } from '../contracts/contractConfig';
import {
  Activity,
  AlertTriangle,
  Boxes,
  ClipboardList,
  Home,
  Laptop,
  LayoutDashboard,
  LogOut,
  Menu,
  RefreshCw,
  ShieldCheck,
  Wallet,
  X,
} from 'lucide-react';

interface NavLinkItem {
  name: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
}

export const Navbar: React.FC = () => {
  const { user, role, logout, quickLogin } = useAuth();
  const { account, balanceEth, isConnected, isCorrectNetwork, connectWallet, switchNetwork } = useWeb3();
  const location = useLocation();
  const navigate = useNavigate();
  const [switching, setSwitching] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isActive = (path: string) => location.pathname === path;

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

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

  // Core menu always includes Trang chủ & Thiết bị; authenticated roles add concise secondary links
  const navLinks: NavLinkItem[] = [
    { name: 'Trang chủ', path: '/', icon: Home },
    { name: 'Thiết bị', path: '/equipment', icon: Laptop },
  ];

  if (user && role === 'BORROWER') {
    navLinks.push(
      { name: 'Tổng quan', path: '/overview', icon: LayoutDashboard },
      { name: 'Kiểm toán', path: '/audit', icon: Activity }
    );
  } else if (user && role === 'ADMIN') {
    navLinks.push(
      { name: 'Kho máy', path: '/admin/inventory', icon: Boxes },
      { name: 'Phân quyền', path: '/admin/roles', icon: ShieldCheck },
      { name: 'Kiểm toán', path: '/audit', icon: Activity }
    );
  }

  const loansTarget = role === 'ADMIN' ? '/admin/loans' : '/my-loans';

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-2 sm:gap-4">
          {/* Brand + Main Nav */}
          <div className="flex items-center space-x-4 xl:space-x-6 shrink-0 lg:shrink lg:min-w-0">
            <Link to="/" className="flex items-center space-x-2 sm:space-x-2.5 shrink-0">
              <div className="w-8 h-8 rounded-lg bg-slate-900 flex items-center justify-center text-white shrink-0">
                <ShieldCheck className="w-4 h-4 text-slate-100" aria-hidden="true" />
              </div>
              <span className="font-bold text-slate-900 text-base tracking-tight whitespace-nowrap">EduVault</span>
            </Link>

            <nav aria-label="Điều hướng chính" className="hidden lg:flex items-center space-x-1">
              {navLinks.map((link) => {
                const Icon = link.icon;
                const active = isActive(link.path);
                return (
                  <Link
                    key={link.path}
                    to={link.path}
                    className={`inline-flex items-center space-x-1.5 px-2.5 xl:px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                      active
                        ? 'bg-slate-900 text-white'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                  >
                    <Icon className={`w-3.5 h-3.5 ${active ? 'text-white' : 'text-slate-500'}`} aria-hidden="true" />
                    <span>{link.name}</span>
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* Right Controls */}
          <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
            {user ? (
              <>
                {/* Compact Web3 Status (preserved for authenticated Pure Web3 flows) */}
                {isConnected ? (
                  !isCorrectNetwork ? (
                    <button
                      type="button"
                      onClick={switchNetwork}
                      className="hidden lg:inline-flex items-center space-x-1.5 px-2.5 py-1.5 text-xs font-semibold text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-300 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
                      title={`Đổi sang mạng ${TARGET_CHAIN_NAME} (${TARGET_CHAIN_ID})`}
                    >
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-600" aria-hidden="true" />
                      <span>Đổi mạng</span>
                    </button>
                  ) : (
                    <div
                      className="hidden xl:flex items-center space-x-1.5 px-2.5 py-1.5 bg-slate-100 text-slate-800 rounded-lg border border-slate-200 text-xs font-mono whitespace-nowrap"
                      title={
                        user.wallet_verified && user.wallet_address?.toLowerCase() === account?.toLowerCase()
                          ? `Ví đã xác minh EIP-191 khớp ${user.student_staff_id}`
                          : 'Ví MetaMask đã kết nối'
                      }
                    >
                      <span
                        className={`w-2 h-2 rounded-full ${
                          user.wallet_verified && user.wallet_address?.toLowerCase() === account?.toLowerCase()
                            ? 'bg-emerald-500'
                            : 'bg-amber-500'
                        }`}
                      />
                      <span>{account ? `${account.slice(0, 6)}...${account.slice(-4)}` : ''}</span>
                      {balanceEth && (
                        <span className="text-slate-500 border-l border-slate-300 pl-1.5">
                          {balanceEth} ETH
                        </span>
                      )}
                    </div>
                  )
                ) : (
                  <button
                    type="button"
                    onClick={connectWallet}
                    className="hidden xl:inline-flex items-center space-x-1.5 px-2.5 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
                    title="Kết nối ví MetaMask"
                  >
                    <Wallet className="w-3.5 h-3.5 text-slate-600" aria-hidden="true" />
                    <span>Kết nối ví</span>
                  </button>
                )}

                {/* Required "Xem đơn mượn" CTA for authenticated users */}
                <Link
                  to={loansTarget}
                  className={`inline-flex items-center space-x-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                    isActive(loansTarget)
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-900 text-white hover:bg-slate-800'
                  }`}
                >
                  <ClipboardList className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                  <span>Xem đơn mượn</span>
                </Link>

                {/* Role quick switch on very wide desktop screens */}
                <button
                  type="button"
                  onClick={handleQuickSwitch}
                  disabled={switching}
                  className="hidden 2xl:inline-flex items-center space-x-1.5 px-2.5 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
                  title="Chuyển đổi vai trò kiểm thử"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${switching ? 'animate-spin' : ''}`} aria-hidden="true" />
                  <span>{role === 'ADMIN' ? 'Đổi sang SV' : 'Đổi sang Admin'}</span>
                </button>

                {/* User Name + Logout (hidden on <640px mobile to prevent crowding brand; shown in mobile drawer) */}
                <div className="hidden sm:flex items-center space-x-2 pl-2.5 border-l border-slate-200 shrink-0">
                  <div className="text-right">
                    <p
                      className="text-xs font-semibold text-slate-900 leading-tight truncate max-w-[130px] xl:max-w-[180px]"
                      title={user.full_name}
                    >
                      {user.full_name}
                    </p>
                    <span
                      className={`inline-block mt-0.5 text-[10px] px-1.5 py-0.5 rounded font-semibold uppercase tracking-wide border ${
                        role === 'ADMIN'
                          ? 'bg-slate-900 text-white border-slate-900'
                          : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                      }`}
                    >
                      {role}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={logout}
                    className="p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                    aria-label="Đăng xuất khỏi hệ thống"
                    title="Đăng xuất khỏi hệ thống"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                </div>
              </>
            ) : (
              <div className="hidden sm:flex items-center space-x-2">
                <Link
                  to="/login"
                  className="px-3.5 py-2 text-xs font-semibold text-slate-700 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors whitespace-nowrap"
                >
                  Đăng nhập
                </Link>
                <Link
                  to="/register"
                  className="px-4 py-2 bg-indigo-600 text-white text-xs font-semibold rounded-lg hover:bg-indigo-700 transition-colors whitespace-nowrap"
                >
                  Đăng ký
                </Link>
              </div>
            )}

            {/* Mobile & Tablet Menu Toggle */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen((prev) => !prev)}
              aria-expanded={mobileMenuOpen}
              aria-controls="mobile-nav-drawer"
              aria-label={mobileMenuOpen ? 'Đóng menu điều hướng' : 'Mở menu điều hướng'}
              className="lg:hidden p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer shrink-0"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile & Tablet Drawer */}
        {mobileMenuOpen && (
          <nav
            id="mobile-nav-drawer"
            aria-label="Điều hướng di động"
            className="lg:hidden py-3 border-t border-slate-200 space-y-1.5"
          >
            {user && (
              <div className="px-3 py-2 mb-1 bg-slate-50 rounded-lg border border-slate-200 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900 truncate">{user.full_name}</p>
                  <p className="text-xs font-mono text-slate-600 truncate">{user.student_staff_id}</p>
                </div>
                <span
                  className={`text-xs px-2 py-0.5 rounded font-semibold uppercase border shrink-0 ${
                    role === 'ADMIN'
                      ? 'bg-slate-900 text-white border-slate-900'
                      : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                  }`}
                >
                  {role}
                </span>
              </div>
            )}

            {navLinks.map((link) => {
              const Icon = link.icon;
              const active = isActive(link.path);
              return (
                <Link
                  key={link.path}
                  to={link.path}
                  className={`flex items-center space-x-2.5 px-3 py-2 rounded-lg text-sm font-semibold transition-colors ${
                    active
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-700 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  <Icon className="w-4 h-4" aria-hidden="true" />
                  <span>{link.name}</span>
                </Link>
              );
            })}

            {user ? (
              <div className="pt-2 border-t border-slate-200 space-y-1.5">
                {!isConnected && (
                  <button
                    type="button"
                    onClick={connectWallet}
                    className="w-full flex items-center space-x-2.5 px-3 py-2 rounded-lg text-sm font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 transition-colors cursor-pointer text-left"
                  >
                    <Wallet className="w-4 h-4" aria-hidden="true" />
                    <span>Kết nối MetaMask</span>
                  </button>
                )}
                {isConnected && !isCorrectNetwork && (
                  <button
                    type="button"
                    onClick={switchNetwork}
                    className="w-full flex items-center space-x-2.5 px-3 py-2 rounded-lg text-sm font-semibold text-amber-800 bg-amber-50 hover:bg-amber-100 transition-colors cursor-pointer text-left"
                  >
                    <AlertTriangle className="w-4 h-4" aria-hidden="true" />
                    <span>Đổi sang mạng {TARGET_CHAIN_NAME}</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleQuickSwitch}
                  disabled={switching}
                  className="w-full flex items-center space-x-2.5 px-3 py-2 rounded-lg text-sm font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 transition-colors cursor-pointer text-left"
                >
                  <RefreshCw className={`w-4 h-4 ${switching ? 'animate-spin' : ''}`} aria-hidden="true" />
                  <span>Chuyển sang {role === 'ADMIN' ? 'Sinh viên' : 'Quản lý kho'}</span>
                </button>
                <button
                  type="button"
                  onClick={logout}
                  className="sm:hidden w-full flex items-center space-x-2.5 px-3 py-2 rounded-lg text-sm font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 transition-colors cursor-pointer text-left"
                >
                  <LogOut className="w-4 h-4" aria-hidden="true" />
                  <span>Đăng xuất khỏi hệ thống</span>
                </button>
              </div>
            ) : (
              <div className="pt-2 border-t border-slate-200 grid grid-cols-2 gap-2">
                <Link
                  to="/login"
                  className="text-center px-3 py-2 rounded-lg text-sm font-semibold text-slate-700 border border-slate-300 hover:bg-slate-50"
                >
                  Đăng nhập
                </Link>
                <Link
                  to="/register"
                  className="text-center px-3 py-2 rounded-lg text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700"
                >
                  Đăng ký
                </Link>
              </div>
            )}
          </nav>
        )}
      </div>
    </header>
  );
};

export default Navbar;
