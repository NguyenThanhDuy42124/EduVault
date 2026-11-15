import React, { useRef } from 'react';
import { Link } from 'react-router-dom';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { ArrowRight, ClipboardCheck, Laptop, ShieldCheck, UserPlus } from 'lucide-react';
import { HomeEquipmentSection } from '../components/home/HomeEquipmentSection';
import { useAuth } from '../context/AuthContext';

gsap.registerPlugin(useGSAP);

interface IntroPoint {
  id: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}

const INTRO_POINTS: IntroPoint[] = [
  {
    id: 'tracking',
    title: 'Theo dõi thiết bị rõ ràng',
    description:
      'Tra cứu nhanh tên máy, mã thiết bị, mức cọc mô phỏng và tình trạng sẵn sàng tại phòng lab.',
    icon: Laptop,
  },
  {
    id: 'transparent-flow',
    title: 'Quy trình mượn trả minh bạch',
    description:
      'Đăng ký lịch nhận và trả máy trực tuyến, giảm trùng lịch và xác nhận rõ ràng ở mỗi khâu.',
    icon: ClipboardCheck,
  },
  {
    id: 'verifiable-history',
    title: 'Lịch sử giao dịch có thể kiểm tra',
    description:
      'Mỗi đơn mượn trả gắn liền tài khoản xác thực và bản ghi đối chiếu trên Blockchain.',
    icon: ShieldCheck,
  },
];

export const HomePage: React.FC = () => {
  const { isAuthenticated, role } = useAuth();
  const heroRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();

      mm.add('(prefers-reduced-motion: reduce)', () => {
        gsap.set('[data-hero-reveal]', { autoAlpha: 1, y: 0 });
      });

      mm.add('(prefers-reduced-motion: no-preference)', () => {
        gsap.from('[data-hero-reveal]', {
          autoAlpha: 0,
          y: 12,
          duration: 0.45,
          stagger: 0.08,
          ease: 'power2.out',
          clearProps: 'transform,opacity,visibility',
        });
      });

      return () => mm.revert();
    },
    { scope: heroRef }
  );

  const loansTarget = role === 'ADMIN' ? '/admin/loans' : '/my-loans';

  return (
    <div className="space-y-12 pb-6">
      {/* 1. Simple Editorial Hero */}
      <section
        ref={heroRef}
        aria-labelledby="hero-heading"
        className="bg-white border border-slate-200 rounded-xl px-6 py-10 sm:px-10 sm:py-12"
      >
        <div className="max-w-2xl space-y-5">
          <h1
            id="hero-heading"
            data-hero-reveal
            className="text-3xl sm:text-4xl font-bold text-slate-900 tracking-tight leading-tight"
          >
            Mượn thiết bị học tập dễ dàng và minh bạch
          </h1>

          <p
            data-hero-reveal
            className="text-base text-slate-600 leading-relaxed max-w-xl"
          >
            EduVault giúp sinh viên tìm kiếm, đăng ký và theo dõi quá trình mượn trả thiết bị học tập.
          </p>

          <div data-hero-reveal className="flex flex-wrap items-center gap-3 pt-1">
            <a
              href="#thiet-bi"
              className="inline-flex items-center space-x-2 px-5 py-2.5 bg-slate-900 text-white text-sm font-semibold rounded-lg hover:bg-slate-800 transition-colors"
            >
              <span>Xem thiết bị</span>
              <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </a>

            {isAuthenticated ? (
              <Link
                to={loansTarget}
                className="inline-flex items-center space-x-2 px-5 py-2.5 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 transition-colors"
              >
                <span>Xem đơn mượn</span>
              </Link>
            ) : (
              <Link
                to="/register"
                className="inline-flex items-center space-x-2 px-5 py-2.5 bg-white text-indigo-700 border border-indigo-200 hover:bg-indigo-50 text-sm font-semibold rounded-lg transition-colors"
              >
                <UserPlus className="w-4 h-4" aria-hidden="true" />
                <span>Đăng ký tài khoản</span>
              </Link>
            )}
          </div>
        </div>
      </section>

      {/* 2. Isolated Equipment Catalog Section */}
      <HomeEquipmentSection />

      {/* 3. Concise 3-Point Introduction */}
      <section aria-labelledby="home-intro-heading" className="space-y-5">
        <div>
          <h2 id="home-intro-heading" className="text-xl font-bold text-slate-900 tracking-tight">
            EduVault mang lại gì cho sinh viên
          </h2>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-slate-200">
          {INTRO_POINTS.map((point) => {
            const Icon = point.icon;
            return (
              <div key={point.id} className="p-6 space-y-2.5">
                <div className="w-9 h-9 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-700">
                  <Icon className="w-4 h-4" aria-hidden="true" />
                </div>
                <h3 className="text-sm font-bold text-slate-900">{point.title}</h3>
                <p className="text-xs text-slate-600 leading-relaxed">{point.description}</p>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
};

export default HomePage;
