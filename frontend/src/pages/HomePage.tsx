import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, CalendarCheck2, Lock, ShieldCheck, Wallet } from 'lucide-react';
import { HomeBannerSlider } from '../components/home/HomeBannerSlider';
import { HomeBlockchainSection } from '../components/home/HomeBlockchainSection';
import { HomeEquipmentSection } from '../components/home/HomeEquipmentSection';

export const HomePage: React.FC = () => {
  return (
    <div className="space-y-10 pb-6">
      {/* 1. Auto-Playing Editorial Hero Slider */}
      <HomeBannerSlider />

      {/* 2. Category Strip + Featured 3-Row Categorized Equipment Showcase */}
      <HomeEquipmentSection />

      {/* 3. Editorial Split Feature Banner (Storefront-inspired Callout) */}
      <section
        aria-label="Quy trình mượn trả minh bạch"
        className="rounded-2xl overflow-hidden border border-slate-200 bg-slate-900 grid grid-cols-1 md:grid-cols-12"
      >
        <div className="md:col-span-6 aspect-[16/10] md:aspect-auto min-h-[220px] bg-slate-800">
          <img
            src="/images/banners/banner-2.jpg"
            alt="Sinh viên thực hành tại phòng Lab với thiết bị đo kiểm"
            loading="lazy"
            className="w-full h-full object-cover"
          />
        </div>
        <div className="md:col-span-6 p-7 sm:p-10 flex flex-col justify-center space-y-4 text-white">
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight leading-snug">
            Mượn thiết bị phòng Lab nhanh gọn và có đối chứng rõ ràng
          </h2>
          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
            Từ lúc gửi đơn, nhận bàn giao đến hoàn tất trả máy và hoàn cọc, mọi mốc thời gian đều được lưu vết để sinh viên và cán bộ kiểm tra bất kỳ lúc nào.
          </p>
          <div className="pt-1 flex flex-wrap gap-3">
            <Link
              to="/equipment"
              className="inline-flex items-center space-x-1.5 px-4 py-2 bg-white text-slate-900 text-xs font-semibold rounded-lg hover:bg-slate-100 transition-colors"
            >
              <span>Chọn thiết bị ngay</span>
              <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
            </Link>
            <Link
              to="/audit"
              className="inline-flex items-center space-x-1.5 px-4 py-2 bg-slate-800 text-slate-100 border border-slate-700 hover:bg-slate-700 text-xs font-semibold rounded-lg transition-colors"
            >
              <span>Tra cứu sổ cái</span>
            </Link>
          </div>
        </div>
      </section>

      {/* 4. Compact Public Blockchain Activity Section */}
      <HomeBlockchainSection />

      {/* 5. Concise 4-Item Trust Highlights Strip */}
      <section aria-label="Cam kết vận hành" className="grid grid-cols-2 lg:grid-cols-4 gap-4 pt-2">
        {[
          {
            icon: CalendarCheck2,
            title: 'Đặt lịch trực tuyến',
            desc: 'Chọn máy và ngày nhận trả rõ ràng, tránh trùng lịch.',
          },
          {
            icon: Wallet,
            title: 'Tiền cọc minh bạch',
            desc: 'Hiển thị rõ tiền cọc cần đóng và trạng thái hoàn cọc.',
          },
          {
            icon: ShieldCheck,
            title: 'Đối chiếu Sepolia',
            desc: 'Kiểm tra lịch sử mượn trả công khai qua Blockchain.',
          },
          {
            icon: Lock,
            title: 'Bảo mật cao',
            desc: 'Xác thực chặt chẽ bằng tài khoản sinh viên và chữ ký ví MetaMask.',
          },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <div
              key={item.title}
              className="bg-white border border-slate-200 rounded-xl p-4 flex items-start space-x-3"
            >
              <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-800 flex items-center justify-center shrink-0">
                <Icon className="w-4 h-4" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <h3 className="text-xs font-bold text-slate-900">{item.title}</h3>
                <p className="text-[11px] text-slate-600 mt-0.5 leading-relaxed">{item.desc}</p>
              </div>
            </div>
          );
        })}
      </section>
    </div>
  );
};

export default HomePage;
