import React from 'react';
import { Link } from 'react-router-dom';
import { Clock, ExternalLink, MapPin, ShieldCheck } from 'lucide-react';
import { Navbar } from './Navbar';

export const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <div className="min-h-[100dvh] flex flex-col bg-slate-50 text-slate-900 font-sans antialiased">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[100] focus:px-4 focus:py-2 focus:bg-slate-900 focus:text-white focus:rounded-lg focus:text-xs focus:font-semibold focus:shadow-lg"
      >
        Chuyển đến nội dung chính
      </a>
      <Navbar />
      <main
        id="main-content"
        tabIndex={-1}
        className="flex-1 max-w-[1520px] w-full mx-auto px-4 sm:px-6 lg:px-8 2xl:px-10 py-8 focus:outline-none"
      >
        {children}
      </main>
      <footer className="bg-slate-950 text-slate-300 border-t border-slate-800 py-10 mt-auto">
        <div className="max-w-[1520px] mx-auto px-4 sm:px-6 lg:px-8 2xl:px-10 grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
          {/* Brand & Quick Links */}
          <div className="md:col-span-4 space-y-3">
            <div className="flex items-center space-x-2">
              <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center text-white">
                <ShieldCheck className="w-4 h-4" aria-hidden="true" />
              </div>
              <span className="font-bold text-base text-white tracking-tight">EduVault</span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed max-w-sm">
              Hệ thống hỗ trợ sinh viên tìm kiếm, đặt lịch mượn trả thiết bị thực hành và tra cứu lịch sử minh bạch.
            </p>
            <nav
              aria-label="Liên kết chân trang"
              className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs font-semibold text-slate-200 pt-1"
            >
              <Link to="/" className="hover:text-white transition-colors">
                Trang chủ
              </Link>
              <Link to="/equipment" className="hover:text-white transition-colors">
                Thiết bị
              </Link>
              <Link to="/audit" className="hover:text-white transition-colors">
                Blockchain
              </Link>
              <Link to="/login" className="hover:text-white transition-colors">
                Đăng nhập
              </Link>
              <Link to="/register" className="hover:text-white transition-colors">
                Đăng ký
              </Link>
            </nav>
          </div>

          {/* Location & Support Info */}
          <div className="md:col-span-4 space-y-2.5 text-xs text-slate-300">
            <h3 className="font-bold text-white text-xs uppercase tracking-wider">
              Thông tin địa điểm & Hỗ trợ
            </h3>
            <div className="flex items-start space-x-2">
              <MapPin className="w-3.5 h-3.5 text-indigo-300 shrink-0 mt-0.5" aria-hidden="true" />
              <div className="space-y-1">
                <p className="font-medium text-white">
                  Trường Đại học Kỹ thuật - Công nghệ Cần Thơ
                </p>
                <a
                  href="https://maps.app.goo.gl/H2dpiVH5vz4Cjzjd9"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center space-x-1 text-indigo-300 hover:text-indigo-200 hover:underline font-semibold"
                >
                  <span>Mở trên Google Maps</span>
                  <ExternalLink className="w-3 h-3" aria-hidden="true" />
                </a>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Clock className="w-3.5 h-3.5 text-slate-300 shrink-0" aria-hidden="true" />
              <span>Nhận & trả máy tại Lab: Thứ 2 - Thứ 7 (07:30 - 17:00)</span>
            </div>
          </div>

          {/* Interactive Google Map iFrame */}
          <div className="md:col-span-4 w-full">
            <div className="rounded-xl overflow-hidden border border-slate-800 bg-slate-900 h-44 shadow-sm">
              <iframe
                title="Bản đồ Trường Đại học Kỹ thuật - Công nghệ Cần Thơ"
                src="https://maps.google.com/maps?q=Tr%C6%B0%E1%BB%9Dng%20%C4%90%E1%BA%A1i%20h%E1%BB%8Dc%20K%E1%BB%B9%20thu%E1%BA%ADt%20-%20C%C3%B4ng%20ngh%E1%BB%87%20C%E1%BA%A7n%20Th%C6%A1&ll=10.0467807,105.7680453&z=16&output=embed"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                className="w-full h-full border-0"
                allowFullScreen
              />
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};
