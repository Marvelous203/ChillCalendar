'use client';

import { motion } from 'motion/react';
import { useState } from 'react';
import { formatDateVi } from '@/lib/dates';
import { buildGoogleCalendarUrl } from '@/lib/gcal';
import { formatHour } from '@/lib/timezone';
import type { EventStatus, PublicPlace } from '@/lib/types';

export function FinalBanner({
  title,
  note,
  finalDate,
  finalFrom,
  finalTo,
  finalPlace,
  finalizedBy,
  status,
  liveFrom,
  canUnfinalize,
  canStartEarly,
  onUnfinalize,
  onStartEarly,
}: {
  title: string;
  note: string;
  finalDate: string;
  finalFrom: number;
  finalTo: number;
  finalPlace: PublicPlace | null;
  finalizedBy: string | null;
  status: EventStatus;
  liveFrom: string | null;
  canUnfinalize: boolean;
  canStartEarly: boolean;
  onUnfinalize: () => void;
  onStartEarly: () => Promise<void>;
}) {
  const [starting, setStarting] = useState(false);
  const gcalUrl = buildGoogleCalendarUrl({
    title,
    date: finalDate,
    fromHour: finalFrom,
    toHour: finalTo,
    placeName: finalPlace?.name,
    placeAddr: finalPlace?.addr,
    note,
  });

  const liveFromLocal = liveFrom
    ? new Intl.DateTimeFormat('vi-VN', {
        hour: '2-digit',
        minute: '2-digit',
        day: '2-digit',
        month: '2-digit',
      }).format(new Date(liveFrom))
    : null;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      className="rounded-3xl border border-[var(--accent)]/40 bg-[var(--accent)]/10 p-5 shadow-sm"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--accent)] px-3 py-0.5 text-xs font-bold text-[var(--accent-fg)]">
              🎉 Đã chốt lịch hẹn
            </span>
            {status === 'finalized' && liveFromLocal && (
              <span className="text-xs text-[var(--muted)]">
                Tự bật Live lúc <strong className="text-[var(--text)]">{liveFromLocal}</strong>
              </span>
            )}
          </div>
          <p className="font-display text-xl font-bold text-[var(--text)] tabular-nums">
            {formatDateVi(finalDate).full} • {formatHour(finalFrom)} – {formatHour(finalTo)}
          </p>
          {finalPlace && (
            <p className="text-sm text-[var(--text)]">
              📍 <span className="font-semibold">{finalPlace.name}</span>
              {finalPlace.addr ? ` (${finalPlace.addr})` : ''}
            </p>
          )}
          {finalizedBy && (
            <p className="text-xs text-[var(--muted)]">Chốt bởi {finalizedBy}</p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {canStartEarly && (
            <button
              type="button"
              disabled={starting}
              onClick={async () => {
                setStarting(true);
                try {
                  await onStartEarly();
                } finally {
                  setStarting(false);
                }
              }}
              className="rounded-xl bg-emerald-500 px-4 py-2.5 text-xs font-bold text-[#06201f] shadow-sm transition hover:bg-emerald-400 disabled:opacity-60"
            >
              {starting ? 'Đang bật…' : '⚡ Bắt đầu sớm'}
            </button>
          )}
          <a
            href={gcalUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-xl bg-[var(--primary)] px-4 py-2.5 text-xs font-bold text-[var(--primary-fg)] shadow-sm transition hover:opacity-90"
          >
            + Thêm vào Google Calendar
          </a>
          {canUnfinalize && status === 'finalized' && (
            <button
              type="button"
              onClick={onUnfinalize}
              className="rounded-xl border border-[var(--border)] bg-[var(--surface-solid)] px-3 py-2.5 text-xs font-semibold text-[var(--muted)] hover:text-[var(--text)]"
            >
              Bỏ chốt
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
}
