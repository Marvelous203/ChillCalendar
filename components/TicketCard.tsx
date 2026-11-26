'use client';

import Link from 'next/link';
import { useState } from 'react';
import { motion } from 'motion/react';
import { showCode } from '@/lib/room-code';
import { useToast } from './Toast';

interface TicketCardProps {
  code: string;
  title: string;
  inviteToken?: string;
  isPrivate?: boolean;
}

export function TicketCard({ code, title, inviteToken, isPrivate }: TicketCardProps) {
  const { toast } = useToast();
  const [tilt, setTilt] = useState({ x: 0, y: 0 });

  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const sharePath = isPrivate && inviteToken ? `/e/${code}?i=${inviteToken}` : `/e/${code}`;
  const fullUrl = `${origin}${sharePath}`;

  async function copyText(text: string, msg: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast(msg, 'success');
    } catch {
      toast('Không thể sao chép tự động', 'error');
    }
  }

  async function handleShare() {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Hẹn Giờ Rảnh: ${title}`,
          text: `Vào chọn giờ rảnh cùng mình nhé! Mã phòng: ${showCode(code)}`,
          url: fullUrl,
        });
        return;
      } catch {
        // Người dùng hủy share
      }
    }
    await copyText(fullUrl, 'Đã sao chép link mời');
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95, y: 12 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      onMouseMove={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const dx = (e.clientX - rect.left) / rect.width - 0.5;
        const dy = (e.clientY - rect.top) / rect.height - 0.5;
        setTilt({ x: -dy * 6, y: dx * 6 });
      }}
      onMouseLeave={() => setTilt({ x: 0, y: 0 })}
      style={{
        transform: `perspective(900px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)`,
        transition: 'transform 180ms ease-out',
      }}
      className="relative mx-auto max-w-md overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--surface-solid)] shadow-xl"
    >
      {/* Vết đục lỗ vé mời */}
      <span className="absolute -left-3 top-1/2 h-6 w-6 -translate-y-1/2 rounded-full border border-[var(--border)] bg-[var(--bg)]" />
      <span className="absolute -right-3 top-1/2 h-6 w-6 -translate-y-1/2 rounded-full border border-[var(--border)] bg-[var(--bg)]" />

      <div className="bg-gradient-to-br from-[var(--primary)] to-[#0B7D7D] px-6 py-5 text-white">
        <p className="text-xs font-semibold uppercase tracking-widest opacity-85">
          Vé mời sự kiện
        </p>
        <h2 className="mt-1 font-display text-2xl font-bold leading-snug">{title}</h2>
      </div>

      <div className="border-b border-dashed border-[var(--border)] px-6 py-6 text-center">
        <p className="text-xs font-medium text-[var(--muted)]">Mã phòng của bạn</p>
        <p className="mt-1 font-mono text-4xl font-extrabold tracking-[0.18em] text-[var(--primary)]">
          {showCode(code)}
        </p>
        {isPrivate && (
          <p className="mt-2 inline-block rounded-full bg-[var(--accent)]/15 px-3 py-0.5 text-xs font-medium text-[var(--accent)]">
            Phòng riêng tư • Link bên dưới có kèm vé mời thẳng
          </p>
        )}
      </div>

      <div className="space-y-3 p-6">
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => copyText(showCode(code), `Đã sao chép mã ${showCode(code)}`)}
            className="rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 py-2.5 text-xs font-semibold transition hover:border-[var(--primary)]"
          >
            Sao chép mã
          </button>
          <button
            type="button"
            onClick={() => copyText(fullUrl, 'Đã sao chép link phòng')}
            className="rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 py-2.5 text-xs font-semibold transition hover:border-[var(--primary)]"
          >
            Sao chép link
          </button>
        </div>

        <button
          type="button"
          onClick={handleShare}
          className="w-full rounded-xl bg-[var(--accent)] py-2.5 text-sm font-bold text-[var(--accent-fg)] transition hover:opacity-90"
        >
          Chia sẻ qua Zalo / Messenger
        </button>

        <Link
          href={`/e/${code}`}
          className="block w-full rounded-xl bg-[var(--primary)] py-2.5 text-center text-sm font-bold text-[var(--primary-fg)] transition hover:opacity-90"
        >
          Vào phòng ngay →
        </Link>
      </div>
    </motion.div>
  );
}
