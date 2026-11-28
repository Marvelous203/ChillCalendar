'use client';

import Link from 'next/link';

interface GuideStep {
  step: string;
  title: string;
  desc: string;
  badge: string;
}

const GUEST_STEPS: GuideStep[] = [
  {
    step: '01',
    title: 'Nhập mã #xxxxxx hoặc mở link mời',
    desc: 'Không cần cài app hay tạo tài khoản. Chỉ cần nhập tên hiển thị của bạn là vào được phòng ngay.',
    badge: '10 giây',
  },
  {
    step: '02',
    title: 'Tô giờ rảnh & bình chọn quán',
    desc: 'Chạm hoặc kéo chọn khung giờ bạn rảnh (hoặc bấm nhanh Sáng / Chiều / Tối), xem lộ trình trên Google Maps.',
    badge: 'Tức thì',
  },
  {
    step: '03',
    title: 'Chốt lịch & thêm Google Calendar',
    desc: 'Hệ thống gợi ý khung giờ đông người rảnh nhất. Chốt xong là có ngay nút lưu lịch hẹn.',
    badge: 'Gọn nhẹ',
  },
  {
    step: '04',
    title: 'Vào chế độ Live & lưu khoảnh khắc',
    desc: 'Trước giờ hẹn 30 phút phòng tự bật Live: điểm danh 1 chạm, đăng ảnh kèm sticker và thả emoji bay realtime.',
    badge: 'Realtime',
  },
];

const MEMBER_STEPS: GuideStep[] = [
  {
    step: '01',
    title: 'Tạo phòng mới với “+ 1 Kỷ niệm”',
    desc: 'Chọn ngày cụ thể hoặc khung Thứ 2–Chủ nhật linh hoạt, rồi gửi link nhanh qua Zalo / Messenger.',
    badge: 'Chủ phòng',
  },
  {
    step: '02',
    title: 'Theo dõi Heatmap & Chốt kèo',
    desc: 'Xem ai rảnh / ai bận trên lưới nhiệt, chốt giờ + địa điểm (hoặc bấm “Bắt đầu sớm” để vào Live ngay).',
    badge: 'Điều phối',
  },
  {
    step: '03',
    title: 'Giữ nhịp khi Đang diễn ra (Live)',
    desc: 'Theo dõi Bảng thành viên xem ai đã đến, ghim 📌 khoảnh khắc đẹp và kết thúc sự kiện khi tan kèo.',
    badge: 'Live WS',
  },
  {
    step: '04',
    title: 'Xem lại Album theo khung giờ',
    desc: 'Toàn bộ ảnh tự xếp theo từng giờ từ đầu đến cuối kèo cùng bảng vinh danh 🏆 Ảnh được yêu thích nhất.',
    badge: 'Kỷ niệm',
  },
];

export function HomeGuideTimeline({ isLoggedIn }: { isLoggedIn: boolean }) {
  const steps = isLoggedIn ? MEMBER_STEPS : GUEST_STEPS;

  return (
    <section className="glass-card space-y-5 p-5 sm:p-7">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--primary)]/12 px-3 py-0.5 text-[11px] font-bold text-[var(--primary)]">
            {isLoggedIn ? 'Quy trình cho tài khoản' : 'Hướng dẫn nhanh'}
          </span>
          <h2 className="mt-1.5 font-display text-lg font-extrabold sm:text-xl">
            {isLoggedIn
              ? 'Cách tổ chức & giữ kỷ niệm một kèo trọn vẹn'
              : 'Từ lúc rủ kèo đến khi giữ lại album chỉ với 4 bước'}
          </h2>
        </div>

        <Link
          href={isLoggedIn ? '/new' : '/login'}
          className="rounded-xl border border-[var(--border)] bg-[var(--surface-solid)] px-3.5 py-2 text-xs font-bold text-[var(--text)] transition hover:border-[var(--primary)]"
        >
          {isLoggedIn ? '+ Tạo phòng mới' : 'Đăng nhập để tạo phòng →'}
        </Link>
      </div>

      {/* Dòng thời gian dọc */}
      <ol className="relative space-y-4 pl-7 before:absolute before:bottom-3 before:left-3 before:top-3 before:w-0.5 before:bg-gradient-to-b before:from-[var(--primary)] before:via-[var(--accent)] before:to-emerald-400">
        {steps.map((item) => (
          <li
            key={item.step}
            className="relative rounded-2xl border border-[var(--border)] bg-[var(--surface-solid)]/80 p-4 transition hover:border-[var(--primary)]/40"
          >
            <span className="absolute -left-[29px] top-4 flex h-6 w-6 items-center justify-center rounded-full border-2 border-[var(--bg)] bg-[var(--primary)] text-[10px] font-extrabold text-[var(--primary-fg)] tabular-nums shadow-sm">
              {item.step}
            </span>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-display text-sm font-bold text-[var(--text)] sm:text-base">
                {item.title}
              </h3>
              <span className="rounded-full bg-[var(--bg)] px-2.5 py-0.5 text-[10px] font-bold text-[var(--primary)]">
                {item.badge}
              </span>
            </div>
            <p className="mt-1 text-xs leading-relaxed text-[var(--muted)] sm:text-sm">
              {item.desc}
            </p>
          </li>
        ))}
      </ol>
    </section>
  );
}
