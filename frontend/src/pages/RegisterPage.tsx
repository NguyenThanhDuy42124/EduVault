import React from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { AlertCircle, ArrowLeft, ShieldCheck } from 'lucide-react';

export const RegisterPage: React.FC = () => {
  const location = useLocation();
  const [searchParams] = useSearchParams();

  const borrowQueryId = searchParams.get('borrow');
  const loginHref = borrowQueryId ? `/login?reason=borrow&borrow=${borrowQueryId}` : '/login';

  return (
    <div className="min-h-[100dvh] flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 bg-slate-50">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <Link to="/" className="inline-flex items-center justify-center space-x-2.5 mb-3">
          <div className="w-8 h-8 rounded-lg bg-slate-900 flex items-center justify-center text-white">
            <ShieldCheck className="w-5 h-5 text-slate-100" aria-hidden="true" />
          </div>
          <span className="text-xl font-bold tracking-tight text-slate-900">EduVault</span>
        </Link>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Đăng ký tài khoản</h1>
        <p className="mt-2 text-sm text-slate-600 max-w-sm mx-auto">
          Tài khoản sinh viên và cán bộ được gắn với mã định danh trường để mượn thiết bị.
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-6 sm:px-8 shadow-xs border border-slate-200 rounded-xl space-y-5">
          {/* Honest status notice: backend does not yet provide a public self-registration endpoint */}
          <div
            role="status"
            className="p-3.5 bg-amber-50 border border-amber-200 rounded-lg flex items-start space-x-2.5 text-xs text-amber-900 leading-relaxed"
          >
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-amber-700" aria-hidden="true" />
            <div>
              <p className="font-semibold">Cổng tự đăng ký chưa kích hoạt trên Backend API</p>
              <p className="mt-1">
                Hệ thống hiện chỉ hỗ trợ cấp tài khoản bởi Quản trị viên phòng lab để đối chiếu đúng MSSV/Email trước khi cấp quyền mượn. Vui lòng liên hệ Quản trị viên hoặc đăng nhập bằng tài khoản đã được cấp.
              </p>
            </div>
          </div>

          <div className="space-y-3 opacity-60" aria-disabled="true">
            <div>
              <label htmlFor="reg-fullname" className="block text-xs font-semibold text-slate-700 mb-1">
                Họ và tên
              </label>
              <input
                id="reg-fullname"
                type="text"
                disabled
                placeholder="Nguyễn Văn An"
                className="block w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-slate-100 text-slate-500 cursor-not-allowed"
              />
            </div>

            <div>
              <label htmlFor="reg-student-id" className="block text-xs font-semibold text-slate-700 mb-1">
                Mã số sinh viên / Cán bộ
              </label>
              <input
                id="reg-student-id"
                type="text"
                disabled
                placeholder="SV2026001"
                className="block w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-slate-100 text-slate-500 cursor-not-allowed"
              />
            </div>

            <div>
              <label htmlFor="reg-email" className="block text-xs font-semibold text-slate-700 mb-1">
                Email trường
              </label>
              <input
                id="reg-email"
                type="email"
                disabled
                placeholder="sv@eduvault.edu.vn"
                className="block w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-slate-100 text-slate-500 cursor-not-allowed"
              />
            </div>

            <button
              type="button"
              disabled
              className="w-full py-2.5 px-4 rounded-lg text-sm font-semibold text-slate-500 bg-slate-200 cursor-not-allowed"
            >
              Chưa mở tự đăng ký trên máy chủ
            </button>
          </div>

          <div className="pt-4 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
            <Link
              to={loginHref}
              state={location.state ?? undefined}
              className="w-full sm:w-auto inline-flex items-center justify-center space-x-1.5 px-4 py-2 rounded-lg text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Chuyển sang Đăng nhập</span>
            </Link>

            <Link
              to="/equipment"
              className="text-xs font-semibold text-indigo-700 hover:text-indigo-800"
            >
              Xem thiết bị hiện có
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

export default RegisterPage;
