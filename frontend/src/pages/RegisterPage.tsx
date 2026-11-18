import React, { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowRight, Eye, EyeOff, IdCard, Lock, Mail, ShieldAlert, ShieldCheck, User as UserIcon } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { authService } from '../services/authService';

interface ValidationErrorItem {
  msg?: string;
}

function extractRegisterError(err: unknown): string {
  const axiosError = err as {
    response?: {
      status?: number;
      data?: {
        detail?: string | ValidationErrorItem[];
      };
    };
  };

  if (!axiosError.response) {
    return 'Không thể kết nối tới máy chủ EduVault. Vui lòng kiểm tra Backend API và thử lại.';
  }

  const detail = axiosError.response.data?.detail;
  if (typeof detail === 'string' && detail.trim()) {
    return detail;
  }

  if (Array.isArray(detail) && detail.length > 0) {
    const messages = detail
      .map((item) => item?.msg?.replace(/^Value error,\s*/i, '').trim())
      .filter((msg): msg is string => Boolean(msg));
    if (messages.length > 0) {
      return messages.join(' ');
    }
  }

  return 'Không thể đăng ký tài khoản lúc này. Vui lòng kiểm tra lại thông tin.';
}

export const RegisterPage: React.FC = () => {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  const [fullName, setFullName] = useState('');
  const [studentStaffId, setStudentStaffId] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const borrowQueryId = searchParams.get('borrow');
  const loginHref = borrowQueryId ? `/login?borrow=${borrowQueryId}` : '/login';

  if (!authLoading && isAuthenticated) {
    return <Navigate to={borrowQueryId ? `/equipment?borrow=${borrowQueryId}` : '/'} replace />;
  }

  const validateForm = (): string | null => {
    if (fullName.trim().length < 2) {
      return 'Họ và tên phải có tối thiểu 2 ký tự.';
    }
    if (studentStaffId.trim().length < 3) {
      return 'Mã số sinh viên / cán bộ phải có tối thiểu 3 ký tự.';
    }
    const cleanEmail = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      return 'Vui lòng nhập địa chỉ email hợp lệ.';
    }
    if (password.length < 8) {
      return 'Mật khẩu phải có tối thiểu 8 ký tự.';
    }
    if (password !== passwordConfirmation) {
      return 'Mật khẩu xác nhận không khớp.';
    }
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const createdUser = await authService.register({
        full_name: fullName,
        student_staff_id: studentStaffId,
        email,
        password,
        password_confirmation: passwordConfirmation,
      });

      const prevState = (location.state as Record<string, unknown> | null) ?? {};
      navigate(loginHref, {
        replace: true,
        state: {
          ...prevState,
          authNotice: undefined,
          registerSuccess: 'Đăng ký tài khoản thành công! Vui lòng đăng nhập để tiếp tục.',
          prefillIdentifier: createdUser.email,
        },
      });
    } catch (err: unknown) {
      setError(extractRegisterError(err));
    } finally {
      setSubmitting(false);
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
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Đăng ký tài khoản sinh viên</h1>
        <p className="mt-2 text-sm text-slate-600 max-w-sm mx-auto">
          Tạo tài khoản người mượn (BORROWER) để đăng ký và theo dõi đơn mượn thiết bị học tập.
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-6 sm:px-8 shadow-xs border border-slate-200 rounded-xl space-y-5">
          {error && (
            <div
              role="alert"
              className="p-3.5 bg-rose-50 border border-rose-200 rounded-lg flex items-start space-x-2.5 text-xs font-medium text-rose-700"
            >
              <ShieldAlert className="w-4 h-4 flex-shrink-0 mt-0.5 text-rose-600" aria-hidden="true" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <div>
              <label htmlFor="reg-fullname" className="block text-xs font-semibold text-slate-700 mb-1.5">
                Họ và tên
              </label>
              <div className="relative rounded-lg shadow-xs">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                  <UserIcon className="h-4 w-4" aria-hidden="true" />
                </div>
                <input
                  id="reg-fullname"
                  type="text"
                  autoComplete="name"
                  required
                  value={fullName}
                  onChange={(e) => {
                    setFullName(e.target.value);
                    if (error) setError(null);
                  }}
                  placeholder="Nguyễn Văn An"
                  className="block w-full pl-9 pr-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-slate-900 bg-white transition-colors"
                />
              </div>
            </div>

            <div>
              <label htmlFor="reg-student-id" className="block text-xs font-semibold text-slate-700 mb-1.5">
                Mã số sinh viên / Cán bộ
              </label>
              <div className="relative rounded-lg shadow-xs">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                  <IdCard className="h-4 w-4" aria-hidden="true" />
                </div>
                <input
                  id="reg-student-id"
                  type="text"
                  required
                  value={studentStaffId}
                  onChange={(e) => {
                    setStudentStaffId(e.target.value);
                    if (error) setError(null);
                  }}
                  placeholder="SV2026009"
                  className="block w-full pl-9 pr-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-slate-900 bg-white transition-colors"
                />
              </div>
            </div>

            <div>
              <label htmlFor="reg-email" className="block text-xs font-semibold text-slate-700 mb-1.5">
                Email trường
              </label>
              <div className="relative rounded-lg shadow-xs">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                  <Mail className="h-4 w-4" aria-hidden="true" />
                </div>
                <input
                  id="reg-email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (error) setError(null);
                  }}
                  placeholder="sinhvien@eduvault.edu.vn"
                  className="block w-full pl-9 pr-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-slate-900 bg-white transition-colors"
                />
              </div>
            </div>

            <div>
              <label htmlFor="reg-password" className="block text-xs font-semibold text-slate-700 mb-1.5">
                Mật khẩu
              </label>
              <div className="relative rounded-lg shadow-xs">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                  <Lock className="h-4 w-4" aria-hidden="true" />
                </div>
                <input
                  id="reg-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  required
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (error) setError(null);
                  }}
                  placeholder="Tối thiểu 8 ký tự..."
                  className="block w-full pl-9 pr-10 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-slate-900 bg-white transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                  aria-pressed={showPassword}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-500 hover:text-slate-800 cursor-pointer"
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" aria-hidden="true" />
                  ) : (
                    <Eye className="w-4 h-4" aria-hidden="true" />
                  )}
                </button>
              </div>
            </div>

            <div>
              <label htmlFor="reg-password-confirm" className="block text-xs font-semibold text-slate-700 mb-1.5">
                Xác nhận mật khẩu
              </label>
              <div className="relative rounded-lg shadow-xs">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                  <Lock className="h-4 w-4" aria-hidden="true" />
                </div>
                <input
                  id="reg-password-confirm"
                  type={showConfirmPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  required
                  value={passwordConfirmation}
                  onChange={(e) => {
                    setPasswordConfirmation(e.target.value);
                    if (error) setError(null);
                  }}
                  placeholder="Nhập lại mật khẩu..."
                  className="block w-full pl-9 pr-10 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-slate-900 bg-white transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword((prev) => !prev)}
                  aria-label={showConfirmPassword ? 'Ẩn mật khẩu xác nhận' : 'Hiện mật khẩu xác nhận'}
                  aria-pressed={showConfirmPassword}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-500 hover:text-slate-800 cursor-pointer"
                >
                  {showConfirmPassword ? (
                    <EyeOff className="w-4 h-4" aria-hidden="true" />
                  ) : (
                    <Eye className="w-4 h-4" aria-hidden="true" />
                  )}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full flex justify-center items-center py-2.5 px-4 border border-transparent rounded-lg text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-900 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
            >
              {submitting ? (
                <span>Đang tạo tài khoản...</span>
              ) : (
                <>
                  <span>Đăng ký tài khoản</span>
                  <ArrowRight className="w-4 h-4 ml-2" aria-hidden="true" />
                </>
              )}
            </button>
          </form>

          <div className="pt-4 border-t border-slate-200 flex items-center justify-between text-xs text-slate-600">
            <span>Đã có tài khoản?</span>
            <Link
              to={borrowQueryId ? `/login?reason=borrow&borrow=${borrowQueryId}` : '/login'}
              state={location.state ?? undefined}
              className="font-semibold text-indigo-700 hover:text-indigo-800"
            >
              Đăng nhập ngay
            </Link>
          </div>
        </div>

        <div className="mt-5 text-center space-x-4 text-xs">
          <Link to="/" className="font-semibold text-slate-600 hover:text-slate-900">
            Quay lại trang chủ
          </Link>
          <span className="text-slate-300">·</span>
          <Link to="/equipment" className="font-semibold text-slate-600 hover:text-slate-900">
            Xem thiết bị hiện có
          </Link>
        </div>
      </div>
    </div>
  );
};

export default RegisterPage;
