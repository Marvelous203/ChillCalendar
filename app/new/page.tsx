'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import useSWR from 'swr';
import { TicketCard } from '@/components/TicketCard';
import { useToast } from '@/components/Toast';
import { formatHour, todayVN } from '@/lib/timezone';
import type { FinalizePolicy, Visibility } from '@/lib/types';

const subscribeNoop = () => () => {};

function getMonthGrid(year: number, monthIndex: number): Array<string | null> {
  const firstDay = new Date(Date.UTC(year, monthIndex, 1)).getUTCDay();
  const offset = firstDay === 0 ? 6 : firstDay - 1; // Thứ 2 đầu tuần
  const daysInMonth = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
  const cells: Array<string | null> = Array(offset).fill(null);
  for (let d = 1; d <= daysInMonth; d++) {
    const mm = String(monthIndex + 1).padStart(2, '0');
    const dd = String(d).padStart(2, '0');
    cells.push(`${year}-${mm}-${dd}`);
  }
  return cells;
}

export default function NewEventPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { data: meData, isLoading } = useSWR<{ user: { id: string; email: string } | null }>(
    '/api/auth/me',
    (u: string) => fetch(u).then((r) => r.json())
  );

  const todayStr = useSyncExternalStore(
    subscribeNoop,
    () => todayVN(),
    () => ''
  );
  const [viewYear, setViewYear] = useState(2026);
  const [viewMonth, setViewMonth] = useState(10);

  const [title, setTitle] = useState('');
  const [note, setNote] = useState('');
  const [selectedDates, setSelectedDates] = useState<string[]>([]);
  const [hourFrom, setHourFrom] = useState(8);
  const [hourTo, setHourTo] = useState(22);
  const [visibility, setVisibility] = useState<Visibility>('link');
  const [finalizePolicy, setFinalizePolicy] = useState<FinalizePolicy>('any_member');
  const [submitting, setSubmitting] = useState(false);
  const [created, setCreated] = useState<{ code: string; inviteToken: string } | null>(null);

  useEffect(() => {
    if (!isLoading && meData && !meData.user) {
      router.replace('/login');
    }
  }, [isLoading, meData, router]);

  const monthCells = useMemo(() => getMonthGrid(viewYear, viewMonth), [viewYear, viewMonth]);

  function toggleDate(d: string) {
    if (todayStr && d < todayStr) return;
    setSelectedDates((prev) => {
      if (prev.includes(d)) return prev.filter((x) => x !== d);
      if (prev.length >= 14) {
        toast('Mỗi sự kiện chọn tối đa 14 ngày', 'error');
        return prev;
      }
      return [...prev, d].sort();
    });
  }

  function shiftMonth(delta: number) {
    const dt = new Date(Date.UTC(viewYear, viewMonth + delta, 1));
    setViewYear(dt.getUTCFullYear());
    setViewMonth(dt.getUTCMonth());
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (selectedDates.length === 0) {
      toast('Hãy chọn ít nhất 1 ngày', 'error');
      return;
    }
    if (hourFrom >= hourTo) {
      toast('Giờ kết thúc phải lớn hơn giờ bắt đầu', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          note,
          dates: selectedDates,
          from: hourFrom,
          to: hourTo,
          visibility,
          finalizePolicy,
        }),
      });
      const json = (await res.json()) as {
        code?: string;
        inviteToken?: string;
        error?: string;
      };
      if (!res.ok || !json.code) {
        toast(json.error ?? 'Không tạo được sự kiện', 'error');
        return;
      }
      setCreated({ code: json.code, inviteToken: json.inviteToken ?? '' });
      toast('Tạo phòng thành công!', 'success');
    } finally {
      setSubmitting(false);
    }
  }

  if (created) {
    return (
      <div className="py-4">
        <TicketCard
          code={created.code}
          title={title}
          inviteToken={created.inviteToken}
          isPrivate={visibility === 'private'}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <form onSubmit={handleCreate} className="glass-card space-y-6 p-6 sm:p-8">
        <div>
          <h1 className="font-display text-2xl font-bold">Tạo sự kiện mới</h1>
          <p className="mt-1 text-xs text-[var(--muted)]">
            Chọn các ngày dự kiến (tối đa 14 ngày) theo giờ Việt Nam (UTC+7).
          </p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-[var(--muted)]">
              Tên buổi hẹn *
            </label>
            <input
              type="text"
              required
              maxLength={80}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Vd: Cà phê cuối tuần / Ăn lẩu team"
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-solid)] px-3.5 py-2.5 text-sm outline-none focus:border-[var(--primary)]"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold text-[var(--muted)]">
              Ghi chú (tùy chọn)
            </label>
            <textarea
              rows={2}
              maxLength={300}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Khu vực quận mấy, ngân sách dự kiến..."
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-solid)] px-3.5 py-2 text-sm outline-none focus:border-[var(--primary)]"
            />
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[var(--muted)]">
              Chọn ngày ({selectedDates.length}/14)
            </span>
            <div className="flex items-center gap-2 text-sm font-semibold">
              <button
                type="button"
                onClick={() => shiftMonth(-1)}
                className="rounded-lg border border-[var(--border)] px-2.5 py-1 text-xs"
              >
                ←
              </button>
              <span className="tabular-nums">
                Tháng {viewMonth + 1}/{viewYear}
              </span>
              <button
                type="button"
                onClick={() => shiftMonth(1)}
                className="rounded-lg border border-[var(--border)] px-2.5 py-1 text-xs"
              >
                →
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-1.5 text-center text-[11px] font-semibold text-[var(--muted)]">
            {['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'].map((w) => (
              <div key={w}>{w}</div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1.5">
            {monthCells.map((dateStr, idx) => {
              if (!dateStr) return <div key={`empty-${idx}`} />;
              const past = todayStr ? dateStr < todayStr : false;
              const selected = selectedDates.includes(dateStr);
              const dayNum = Number(dateStr.split('-')[2]);
              return (
                <button
                  key={dateStr}
                  type="button"
                  disabled={past}
                  onClick={() => toggleDate(dateStr)}
                  className={`h-10 rounded-xl text-xs font-semibold tabular-nums transition ${
                    selected
                      ? 'bg-[var(--primary)] text-[var(--primary-fg)] shadow-sm'
                      : past
                        ? 'cursor-not-allowed opacity-30'
                        : 'border border-[var(--border)] bg-[var(--surface-solid)] hover:border-[var(--primary)]'
                  }`}
                >
                  {dayNum}
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-[var(--muted)]">
              Từ giờ
            </label>
            <select
              value={hourFrom}
              onChange={(e) => setHourFrom(Number(e.target.value))}
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-solid)] px-3 py-2.5 text-sm"
            >
              {Array.from({ length: 24 }, (_, h) => (
                <option key={h} value={h}>
                  {formatHour(h)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-[var(--muted)]">
              Đến giờ
            </label>
            <select
              value={hourTo}
              onChange={(e) => setHourTo(Number(e.target.value))}
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-solid)] px-3 py-2.5 text-sm"
            >
              {Array.from({ length: 24 }, (_, i) => i + 1).map((h) => (
                <option key={h} value={h}>
                  {formatHour(h)}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-[var(--muted)]">
              Kiểu truy cập
            </label>
            <select
              value={visibility}
              onChange={(e) => setVisibility(e.target.value as Visibility)}
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-solid)] px-3 py-2.5 text-sm"
            >
              <option value="link">Ai có mã hoặc link</option>
              <option value="private">Riêng tư (cần link mời hoặc duyệt)</option>
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold text-[var(--muted)]">
              Ai được bấm Chốt lịch?
            </label>
            <select
              value={finalizePolicy}
              onChange={(e) => setFinalizePolicy(e.target.value as FinalizePolicy)}
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-solid)] px-3 py-2.5 text-sm"
            >
              <option value="any_member">Bất kỳ thành viên nào</option>
              <option value="owner_only">Chỉ chủ sự kiện</option>
            </select>
          </div>
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-2xl bg-[var(--primary)] py-3.5 text-sm font-bold text-[var(--primary-fg)] shadow-sm transition hover:opacity-90 disabled:opacity-60"
        >
          {submitting ? 'Đang tạo phòng...' : 'Tạo phòng & Nhận mã mời'}
        </button>
      </form>
    </div>
  );
}
