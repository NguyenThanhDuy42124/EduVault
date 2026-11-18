import React, { useRef } from 'react';
import { Link } from 'react-router-dom';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { ArrowRight, ShieldCheck, UserPlus } from 'lucide-react';
import { HomeBlockchainSection } from '../components/home/HomeBlockchainSection';
import { HomeEquipmentSection } from '../components/home/HomeEquipmentSection';
import { useAuth } from '../context/AuthContext';

gsap.registerPlugin(useGSAP);

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
    <div className="space-y-10 pb-6">
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

            <Link
              to="/audit"
              className="inline-flex items-center space-x-2 px-4 py-2.5 bg-slate-100 text-slate-800 border border-slate-200 hover:bg-slate-200 text-sm font-semibold rounded-lg transition-colors"
            >
              <ShieldCheck className="w-4 h-4 text-indigo-700" aria-hidden="true" />
              <span>Xem sổ cái Blockchain</span>
            </Link>

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

      {/* 3. Compact Public Blockchain Activity Section */}
      <HomeBlockchainSection />
    </div>
  );
};

export default HomePage;
