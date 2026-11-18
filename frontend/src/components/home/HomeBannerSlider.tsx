import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Pause,
  Play,
  ShieldCheck,
  UserPlus,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

interface BannerSlide {
  id: string;
  imageUrl: string;
  imageAlt: string;
  title: string;
  subtitle: string;
  primaryLabel: string;
  primaryHref: string;
  primaryIsAnchor?: boolean;
  secondaryType: 'auth' | 'audit' | 'equipment';
}

const BANNER_SLIDES: BannerSlide[] = [
  {
    id: 'catalog',
    imageUrl: '/images/banners/banner-1.jpg',
    imageAlt: 'Laptop, máy tính bảng, máy hiện sóng và bộ kit vi điều khiển trong phòng lab',
    title: 'Mượn thiết bị học tập dễ dàng và minh bạch',
    subtitle:
      'Tra cứu nhanh Laptop, Tablet, Máy chiếu, Thiết bị đo phòng Lab và Bộ Kit nhúng IoT sẵn sàng phục vụ thực hành.',
    primaryLabel: 'Xem thiết bị',
    primaryHref: '#thiet-bi',
    primaryIsAnchor: true,
    secondaryType: 'auth',
  },
  {
    id: 'workflow',
    imageUrl: '/images/banners/banner-2.jpg',
    imageAlt: 'Sinh viên kỹ thuật thực hành đo kiểm mạch điện và máy tính tại phòng thí nghiệm',
    title: 'Đặt lịch trực tuyến và bàn giao rõ ràng',
    subtitle:
      'Theo dõi lịch nhận máy, hạn trả và tiền cọc cần đóng theo từng bước ngay trên tài khoản sinh viên.',
    primaryLabel: 'Khám phá danh mục',
    primaryHref: '/equipment',
    secondaryType: 'audit',
  },
  {
    id: 'ledger',
    imageUrl: '/images/banners/banner-3.jpg',
    imageAlt: 'Thiết bị phần cứng và vi mạch xác thực kỹ thuật số trong không gian phòng lab hiện đại',
    title: 'Đối chiếu lịch sử giao dịch trên Blockchain',
    subtitle:
      'Mọi thao tác duyệt đơn, bàn giao và nghiệm thu đều lưu vết công khai trên mạng Ethereum Sepolia.',
    primaryLabel: 'Tra cứu sổ cái',
    primaryHref: '/audit',
    secondaryType: 'equipment',
  },
];

const AUTO_SLIDE_MS = 5000;

export const HomeBannerSlider: React.FC = () => {
  const { isAuthenticated, role } = useAuth();
  const [activeIndex, setActiveIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  const totalSlides = BANNER_SLIDES.length;
  const loansTarget = role === 'ADMIN' ? '/admin/loans' : '/my-loans';

  const goToNext = useCallback(() => {
    setActiveIndex((prev) => (prev + 1) % totalSlides);
  }, [totalSlides]);

  const goToPrev = useCallback(() => {
    setActiveIndex((prev) => (prev - 1 + totalSlides) % totalSlides);
  }, [totalSlides]);

  useEffect(() => {
    if (paused) return;
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return;
    }

    const timer = window.setInterval(goToNext, AUTO_SLIDE_MS);
    return () => window.clearInterval(timer);
  }, [paused, goToNext]);

  return (
    <section
      aria-label="Banner nổi bật EduVault"
      aria-roledescription="carousel"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      className="relative rounded-2xl overflow-hidden border border-slate-200 bg-slate-900 shadow-sm"
    >
      {/* Sliding Track */}
      <div
        className="flex transition-transform duration-700 ease-out"
        style={{ transform: `translateX(-${activeIndex * 100}%)` }}
      >
        {BANNER_SLIDES.map((slide, idx) => (
          <div
            key={slide.id}
            aria-hidden={idx !== activeIndex}
            className="relative w-full shrink-0 min-h-[340px] sm:min-h-[390px] lg:min-h-[420px] flex items-center"
          >
            {/* Background Artwork */}
            <img
              src={slide.imageUrl}
              alt={slide.imageAlt}
              loading="eager"
              className="absolute inset-0 w-full h-full object-cover object-center"
            />
            {/* Contrast Scrim for Crisp Left Typography */}
            <div
              className="absolute inset-0 bg-gradient-to-r from-slate-950/90 via-slate-950/70 to-slate-950/20"
              aria-hidden="true"
            />

            {/* Foreground Text & Actions */}
            <div className="relative z-10 w-full px-6 py-10 sm:px-16 lg:px-16">
              <div className="max-w-xl space-y-4">
                <h1
                  {...(idx === 0 ? { id: 'hero-heading' } : {})}
                  className="text-2xl sm:text-4xl font-bold text-white tracking-tight leading-tight"
                >
                  {slide.title}
                </h1>

                <p className="text-sm sm:text-base text-slate-200 leading-relaxed max-w-lg">
                  {slide.subtitle}
                </p>

                <div className="flex flex-wrap items-center gap-3 pt-2">
                  {slide.primaryIsAnchor ? (
                    <a
                      href={slide.primaryHref}
                      className="inline-flex items-center space-x-2 px-5 py-2.5 bg-white text-slate-900 text-sm font-semibold rounded-lg hover:bg-slate-100 transition-colors"
                    >
                      <span>{slide.primaryLabel}</span>
                      <ArrowRight className="w-4 h-4" aria-hidden="true" />
                    </a>
                  ) : (
                    <Link
                      to={slide.primaryHref}
                      className="inline-flex items-center space-x-2 px-5 py-2.5 bg-white text-slate-900 text-sm font-semibold rounded-lg hover:bg-slate-100 transition-colors"
                    >
                      <span>{slide.primaryLabel}</span>
                      <ArrowRight className="w-4 h-4" aria-hidden="true" />
                    </Link>
                  )}

                  {slide.secondaryType === 'auth' &&
                    (isAuthenticated ? (
                      <Link
                        to={loansTarget}
                        className="inline-flex items-center space-x-2 px-5 py-2.5 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-500 transition-colors"
                      >
                        <span>Xem đơn mượn</span>
                      </Link>
                    ) : (
                      <Link
                        to="/register"
                        className="inline-flex items-center space-x-2 px-5 py-2.5 bg-slate-900/75 text-white border border-white/25 hover:bg-slate-900 text-sm font-semibold rounded-lg backdrop-blur-xs transition-colors"
                      >
                        <UserPlus className="w-4 h-4" aria-hidden="true" />
                        <span>Đăng ký tài khoản</span>
                      </Link>
                    ))}

                  {slide.secondaryType === 'audit' && (
                    <Link
                      to="/audit"
                      className="inline-flex items-center space-x-2 px-4 py-2.5 bg-slate-900/75 text-white border border-white/25 hover:bg-slate-900 text-sm font-semibold rounded-lg backdrop-blur-xs transition-colors"
                    >
                      <ShieldCheck className="w-4 h-4 text-indigo-300" aria-hidden="true" />
                      <span>Xem sổ cái</span>
                    </Link>
                  )}

                  {slide.secondaryType === 'equipment' && (
                    <a
                      href="#thiet-bi"
                      className="inline-flex items-center space-x-2 px-4 py-2.5 bg-slate-900/75 text-white border border-white/25 hover:bg-slate-900 text-sm font-semibold rounded-lg backdrop-blur-xs transition-colors"
                    >
                      <span>Xem thiết bị</span>
                    </a>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Left / Right Navigation Arrows */}
      <button
        type="button"
        onClick={goToPrev}
        aria-label="Slide trước"
        className="hidden sm:inline-flex items-center justify-center w-9 h-9 rounded-full bg-slate-950/55 hover:bg-slate-950/80 text-white border border-white/20 backdrop-blur-xs absolute left-3 top-1/2 -translate-y-1/2 transition-colors cursor-pointer z-20"
      >
        <ChevronLeft className="w-5 h-5" aria-hidden="true" />
      </button>

      <button
        type="button"
        onClick={goToNext}
        aria-label="Slide tiếp theo"
        className="hidden sm:inline-flex items-center justify-center w-9 h-9 rounded-full bg-slate-950/55 hover:bg-slate-950/80 text-white border border-white/20 backdrop-blur-xs absolute right-3 top-1/2 -translate-y-1/2 transition-colors cursor-pointer z-20"
      >
        <ChevronRight className="w-5 h-5" aria-hidden="true" />
      </button>

      {/* Bottom Dots + Pause Toggle */}
      <div className="absolute bottom-3.5 left-6 right-6 sm:left-12 sm:right-12 flex items-center justify-between z-20">
        <div className="flex items-center space-x-2" role="tablist" aria-label="Chọn slide banner">
          {BANNER_SLIDES.map((slide, idx) => {
            const isActive = idx === activeIndex;
            return (
              <button
                key={slide.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                aria-label={`Chuyển đến slide ${idx + 1}: ${slide.title}`}
                onClick={() => setActiveIndex(idx)}
                className={`h-2 rounded-full transition-all cursor-pointer ${
                  isActive ? 'w-7 bg-white' : 'w-2 bg-white/45 hover:bg-white/75'
                }`}
              />
            );
          })}
        </div>

        <button
          type="button"
          onClick={() => setPaused((p) => !p)}
          aria-label={paused ? 'Tiếp tục chạy slider' : 'Tạm dừng slider'}
          className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full bg-slate-950/55 hover:bg-slate-950/80 text-white/90 text-[11px] font-medium border border-white/20 backdrop-blur-xs transition-colors cursor-pointer"
        >
          {paused ? (
            <>
              <Play className="w-3 h-3" aria-hidden="true" />
              <span>Chạy</span>
            </>
          ) : (
            <>
              <Pause className="w-3 h-3" aria-hidden="true" />
              <span>Dừng</span>
            </>
          )}
        </button>
      </div>
    </section>
  );
};
