import React, { useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowRight, Info, Lock, Mail, ShieldAlert, ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface LocationAuthState {
  from?: {
    pathname?: string;
    search?: string;
  };
  authNotice?: string;
}

export const LoginPage: React.FC = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const locState = (location.state as LocationAuthState | null) ?? null;
  const borrowQueryId = searchParams.get('borrow');
  const reasonQuery = searchParams.get('reason');

  const authNotice =
    locState?.authNotice ||
    (reasonQuery === 'borrow'
      ? 'Vui lòng đăng nhập hoặc đăng ký tài khoản để mượn thiết bị.'
      : null);

  const fromTarget = locState?.from?.pathname
    ? `${locState.from.pathname}${locState.from.search || ''}`
    : borrowQueryId
    ? `/equipment?borrow=${borrowQueryId}`
    : '/equipment';

  const registerHref = borrowQueryId ? `/register?borrow=${borrowQueryId}` : '/register';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier.trim() || !password) {
      setError('Vui lòng nhập đầy đủ thông tin đăng nhập.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await login(identifier, password);
      navigate(fromTarget, { replace: true });
    } catch (err: unknown) {
      const axiosError = err as { response?: { data?: { detail?: string } } };
      setError(
        axiosError.response?.data?.detail ||
          'Tên đăng nhập hoặc mật khẩu không chính xác. Vui lòng kiểm tra lại.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[100dvh] flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 bg-slate-50">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <Link to="/" className="inline-flex items-center justify-center space-x-2.5 mb-3">
          <div className="w-8 h-8 rounded-lg bg-slate-900 flex items-center justify-center text-white">
            <ShieldCheck className="w-5 h-5 text-slate-100" aria-hidden="true" />
          </div>
          <span className="text-xl font-bold tracking-tight text-slate-900">EduVault</span>
        </Link>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Đăng nhập tài khoản</h1>
        <p className="mt-2 text-sm text-slate-600 max-w-sm mx-auto">
          Quản lý mượn trả thiết bị học tập minh bạch trên nền tảng EduVault.
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-6 sm:px-8 shadow-xs border border-slate-200 rounded-xl space-y-5">
          {authNotice && (
            <div
              role="status"
              className="p-3.5 bg-indigo-50 border border-indigo-200 rounded-lg flex items-start space-x-2.5 text-xs font-medium text-indigo-900"
            >
              <Info className="w-4 h-4 flex-shrink-0 mt-0.5 text-indigo-700" aria-hidden="true" />
              <span>{authNotice}</span>
            </div>
          )}

          {error && (
            <div
              role="alert"
              className="p-3.5 bg-rose-50 border border-rose-200 rounded-lg flex items-start space-x-2.5 text-xs font-medium text-rose-700"
            >
              <ShieldAlert className="w-4 h-4 flex-shrink-0 mt-0.5 text-rose-600" aria-hidden="true" />
              <span>{error}</span>
            </div>
          )}

          <form className="space-y-5" onSubmit={handleSubmit}>
            <div>
              <label htmlFor="identifier" className="block text-xs font-semibold text-slate-700 mb-1.5">
                Tài khoản (Email hoặc Mã số SV / Cán bộ)
              </label>
              <div className="relative rounded-lg shadow-xs">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                  <Mail className="w-4 h-4" aria-hidden="true" />
                </div>
                <input
                  id="identifier"
                  name="identifier"
                  type="text"
                  autoComplete="username"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="Nhập email hoặc mã định danh..."
                  required
                  className="block w-full pl-9 pr-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-slate-900 transition-colors"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-xs font-semibold text-slate-700 mb-1.5">
                Mật khẩu
              </label>
              <div className="relative rounded-lg shadow-xs">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                  <Lock className="w-4 h-4" aria-hidden="true" />
                </div>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Nhập mật khẩu của bạn..."
                  required
                  className="block w-full pl-9 pr-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-slate-900 transition-colors"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center space-x-2 py-2.5 px-4 rounded-lg text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              <span>{loading ? 'Đang xác thực...' : 'Đăng nhập vào hệ thống'}</span>
              <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </button>
          </form>

          <div className="pt-4 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
            <span className="text-slate-600">Chưa có tài khoản EduVault?</span>
            <Link
              to={registerHref}
              state={locState ?? undefined}
              className="inline-flex items-center justify-center px-3.5 py-2 rounded-lg font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 transition-colors"
            >
              Đăng ký tài khoản
            </Link>
          </div>
        </div>

        <div className="mt-5 text-center">
          <Link to="/" className="text-xs font-semibold text-slate-600 hover:text-slate-900">
            Quay lại trang chủ
          </Link>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
