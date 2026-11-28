'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import useSWR from 'swr';
import { useToast } from '@/components/Toast';
import { UserAvatar } from '@/components/UserAvatar';

export interface StarLogItem {
  name: string;
  createdAt: string;
}

export interface StarStatus {
  count: number;
  starred: boolean;
  recentLogs: StarLogItem[];
}

const fetcher = (url: string) =>
  fetch(url).then((r) => r.json() as Promise<StarStatus>);

function formatStarTime(iso: string): string {
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return '';
  return new Intl.DateTimeFormat('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
  }).format(dt);
}

/**
 * Nút Star kiểu GitHub ở Homepage (yêu cầu đăng nhập, mỗi tài khoản 1 lượt).
 * Có thể ẩn/tắt dễ dàng bằng prop `enabled={false}`.
 */
export function HomeStarButton({
  enabled = true,
  isLoggedIn = false,
}: {
  enabled?: boolean;
  isLoggedIn?: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const { data, mutate } = useSWR<StarStatus>(
    enabled ? '/api/stars' : null,
    fetcher
  );
  const [submitting, setSubmitting] = useState(false);

  if (!enabled) return null;

  const starred = Boolean(data?.starred);
  const count = data?.count ?? 0;

  async function handleToggle() {
    if (!isLoggedIn) {
      toast('Vui lòng đăng nhập để Star ủng hộ (mỗi tài khoản 1 lượt)', 'info');
      router.push('/login');
      return;
    }
    if (submitting) return;
    setSubmitting(true);

    const nextStarred = !starred;
    const nextCount = Math.max(0, count + (nextStarred ? 1 : -1));

    await mutate(
      {
        count: nextCount,
        starred: nextStarred,
        recentLogs: data?.recentLogs ?? [],
      },
      { revalidate: false }
    );

    try {
      const res = await fetch('/api/stars', { method: 'POST' });
      const json = (await res.json()) as StarStatus & { error?: string };
      if (!res.ok) {
        if (res.status === 401) {
          toast(json.error ?? 'Vui lòng đăng nhập để Star ủng hộ', 'info');
          router.push('/login');
        } else {
          toast(json.error ?? 'Không cập nhật được Star', 'error');
        }
        await mutate();
        return;
      }
      await mutate(json, { revalidate: false });
      toast(json.starred ? 'Cảm ơn bạn đã Star ủng hộ ⭐' : 'Đã bỏ Star', 'success');
    } catch {
      await mutate();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="inline-flex items-center overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface-solid)] shadow-sm">
      <button
        type="button"
        disabled={submitting}
        onClick={() => void handleToggle()}
        aria-pressed={starred}
        title={isLoggedIn ? 'Star ủng hộ' : 'Đăng nhập để Star ủng hộ'}
        className={`inline-flex items-center gap-2 px-3.5 py-2.5 text-xs font-bold transition active:scale-95 sm:text-sm ${starred
          ? 'bg-red-600 text-red-600'
          : 'text-[var(--text)] hover:bg-[var(--surface)]'
          }`}
      >
        <svg
          viewBox="0 0 24 24"
          className={`h-6 w-6 ml-3 transition-transform ${starred ? 'cwm-pop-once fill-yellow-500 text-yellow-500' : 'fill-none stroke-current'
            }`}
          strokeWidth={2}
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.562.562 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5Z"
          />
        </svg>
        <span>{starred}</span>
      </button>
      <span className="border-l border-[var(--border)] bg-[var(--bg)]/60 px-3 py-2.5 text-xs font-extrabold tabular-nums text-[var(--text)] sm:text-sm">
        {count}
      </span>
    </div>
  );
}

/** Bảng log lượt Star minh bạch hiển thị bên phải Hero. */
export function HomeStarLogCard({ enabled = true }: { enabled?: boolean }) {
  const { data } = useSWR<StarStatus>(enabled ? '/api/stars' : null, fetcher);

  if (!enabled) return null;

  const logs = data?.recentLogs ?? [];
  const count = data?.count ?? 0;

  return (
    <aside className="glass-card flex flex-col justify-between gap-3 p-5">
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-red-500 text-sm text-yellow-400">
              ★
            </span>
            <div>
              <h2 className="font-display text-sm font-bold text-[var(--text)]">
                Nhật ký Star ủng hộ
              </h2>
              <p className="text-[11px] text-[var(--muted)]">
                Mỗi tài khoản 1 lượt · Minh bạch
              </p>
            </div>
          </div>
          <span className="rounded-full  bg-red-500 px-2.5 py-0.5 text-xs font-extrabold text-yellow-300 tabular-nums">
            {count} ★
          </span>
        </div>

        {logs.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[var(--border)] p-5 text-center text-xs text-[var(--muted)]">
            Chưa có lượt Star nào. Đăng nhập để trở thành người đầu tiên nhé!
          </div>
        ) : (
          <ul className="max-h-60 space-y-2 overflow-y-auto pr-1">
            {logs.map((item, idx) => (
              <li
                key={`${item.name}-${item.createdAt}-${idx}`}
                className="flex items-center justify-between gap-2 rounded-xl border border-[var(--border)]/70 bg-[var(--surface-solid)]/80 px-3 py-2 text-xs"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <UserAvatar name={item.name} size="sm" />
                  <span className="truncate font-semibold text-[var(--text)]">
                    {item.name}
                  </span>
                </div>
                <span className="shrink-0 text-[11px] text-[var(--muted)] tabular-nums">
                  {formatStarTime(item.createdAt)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className="border-t border-[var(--border)] pt-2.5 text-[11px] text-[var(--muted)]">
        Chỉ hiển thị tên hiển thị của tài khoản đã Star.
      </p>
    </aside>
  );
}
