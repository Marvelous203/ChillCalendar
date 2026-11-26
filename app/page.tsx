'use client';

import Link from 'next/link';
import useSWR from 'swr';
import { motion } from 'motion/react';
import { JoinBox } from '@/components/JoinBox';
import { RoomCodeChip } from '@/components/RoomCodeChip';
import { formatDateVi } from '@/lib/dates';
import { fadeSlideUp } from '@/lib/motion';
import { formatHour } from '@/lib/timezone';

interface EventSummary {
  id: string;
  code: string;
  title: string;
  dates: string[];
  hourFrom: number;
  hourTo: number;
  visibility: 'link' | 'private';
  finalDate: string | null;
  finalFrom: number | null;
  finalTo: number | null;
}

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) return null;
  return res.json() as Promise<{ events: EventSummary[] }>;
};

export default function HomePage() {
  const { data: meData } = useSWR<{ user: { id: string; email: string } | null }>(
    '/api/auth/me',
    (u: string) => fetch(u).then((r) => r.json())
  );
  const { data: eventsData } = useSWR(
    meData?.user ? '/api/events' : null,
    fetcher
  );

  return (
    <div className="space-y-10">
      <motion.section
        variants={fadeSlideUp}
        initial="hidden"
        animate="visible"
        className="glass-card p-6 sm:p-10"
      >
        <div className="max-w-2xl space-y-5">
          <span className="inline-flex items-center gap-2 rounded-full bg-[var(--primary)]/12 px-3.5 py-1 text-xs font-semibold text-[var(--primary)]">
            Không cần cài app • Múi giờ Việt Nam (UTC+7)
          </span>

          <h1 className="font-display text-3xl font-extrabold leading-tight tracking-tight sm:text-5xl">
            Hẹn bạn bè đi chơi,{' '}
            <span className="text-[var(--primary)]">chốt giờ & quán</span> trong một nốt nhạc.
          </h1>

          <p className="text-sm leading-relaxed text-[var(--muted)] sm:text-base">
            Tạo phòng lấy mã <span className="font-mono font-bold text-[var(--text)]">#K7M2QX</span>{' '}
            và gửi vào nhóm Zalo. Bạn bè chỉ cần nhập tên là chọn được giờ rảnh và bình chọn quán,
            không cần đăng ký tài khoản.
          </p>

          <div className="pt-2">
            <JoinBox />
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-1">
            <Link
              href={meData?.user ? '/new' : '/login'}
              className="rounded-2xl bg-[var(--accent)] px-5 py-3 text-sm font-bold text-[var(--accent-fg)] shadow-sm transition hover:opacity-90"
            >
              {meData?.user ? '+ Tạo sự kiện mới' : 'Đăng ký nhanh để tạo phòng'}
            </Link>
            {!meData?.user && (
              <span className="text-xs text-[var(--muted)]">
                Chỉ cần Gmail & mật khẩu, vào tạo ngay lập tức.
              </span>
            )}
          </div>
        </div>
      </motion.section>

      {meData?.user && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-xl font-bold">Sự kiện của tôi</h2>
            <span className="text-xs text-[var(--muted)]">{meData.user.email}</span>
          </div>

          {!eventsData?.events?.length ? (
            <div className="glass-card p-6 text-center text-sm text-[var(--muted)]">
              Bạn chưa tạo sự kiện nào.{' '}
              <Link href="/new" className="font-semibold text-[var(--primary)] underline">
                Tạo phòng đầu tiên ngay
              </Link>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {eventsData.events.map((ev) => (
                <div
                  key={ev.id}
                  className="glass-card flex flex-col justify-between gap-4 p-5 transition hover:border-[var(--primary)]/40"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <RoomCodeChip code={ev.code} />
                      <span className="rounded-full border border-[var(--border)] px-2.5 py-0.5 text-[11px] text-[var(--muted)]">
                        {ev.visibility === 'private' ? '🔒 Riêng tư' : '🔗 Công khai theo mã'}
                      </span>
                    </div>
                    <Link
                      href={`/e/${ev.code}`}
                      className="block font-display text-lg font-bold hover:text-[var(--primary)]"
                    >
                      {ev.title}
                    </Link>
                    <p className="text-xs text-[var(--muted)] tabular-nums">
                      {ev.dates.length} ngày • {formatHour(ev.hourFrom)} – {formatHour(ev.hourTo)}
                    </p>
                  </div>

                  <div className="flex items-center justify-between border-t border-[var(--border)] pt-3 text-xs">
                    {ev.finalDate && ev.finalFrom !== null && ev.finalTo !== null ? (
                      <span className="font-semibold text-[var(--accent)]">
                        ✓ Đã chốt: {formatDateVi(ev.finalDate).short} ({formatHour(ev.finalFrom)}–
                        {formatHour(ev.finalTo)})
                      </span>
                    ) : (
                      <span className="text-[var(--muted)]">Đang gom giờ rảnh</span>
                    )}
                    <Link
                      href={`/e/${ev.code}`}
                      className="font-semibold text-[var(--primary)] hover:underline"
                    >
                      Mở phòng →
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
