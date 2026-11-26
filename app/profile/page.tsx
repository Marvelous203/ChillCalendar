'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import useSWR from 'swr';
import { RoomCodeChip } from '@/components/RoomCodeChip';
import { ProfileSkeleton } from '@/components/Skeletons';
import { useToast } from '@/components/Toast';
import { UserAvatar } from '@/components/UserAvatar';
import { createSupabaseBrowserClient } from '@/lib/supabase-browser';

interface ProfileEvent {
  id: string;
  code: string;
  title: string;
  dates: string[];
  finalDate: string | null;
  visibility: 'link' | 'private';
}

interface ProfileResponse {
  profile: {
    id: string;
    email: string;
    displayName: string;
  };
  stats: {
    ownedCount: number;
    joinedCount: number;
    finalizedCount: number;
  };
  ownedEvents: ProfileEvent[];
  joinedEvents: ProfileEvent[];
}

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (res.status === 401) return null;
  if (!res.ok) throw new Error('Không tải được hồ sơ');
  return res.json() as Promise<ProfileResponse>;
};

export default function ProfilePage() {
  const router = useRouter();
  const { toast } = useToast();
  const { data, isLoading, mutate } = useSWR<ProfileResponse | null>('/api/profile', fetcher);
  const { data: meData, mutate: mutateMe } = useSWR<{ authMode: 'dev' | 'supabase' }>(
    '/api/auth/me',
    (u: string) => fetch(u).then((r) => r.json())
  );

  const [nameInput, setNameInput] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isLoading && data === null) {
      router.replace('/login');
    }
  }, [isLoading, data, router]);

  if (isLoading || !data) {
    return <ProfileSkeleton />;
  }

  const displayName = nameInput ?? data.profile.displayName;

  async function handleSaveName(e: React.FormEvent) {
    e.preventDefault();
    if (!displayName.trim()) return;
    setSaving(true);
    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ displayName: displayName.trim() }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) {
        toast(json.error ?? 'Không lưu được tên', 'error');
        return;
      }
      setNameInput(null);
      await mutate();
      toast('Đã cập nhật tên hiển thị!', 'success');
    } finally {
      setSaving(false);
    }
  }

  async function handleLogout() {
    if (meData?.authMode === 'dev') {
      await fetch('/api/auth/dev', { method: 'DELETE' });
    } else {
      const sb = createSupabaseBrowserClient();
      await sb.auth.signOut();
    }
    await mutateMe();
    router.replace('/');
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <section className="glass-card p-6 sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <UserAvatar name={data.profile.displayName} />
            <div>
              <h1 className="font-display text-2xl font-bold">{data.profile.displayName}</h1>
              <p className="text-xs text-[var(--muted)]">{data.profile.email}</p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            className="rounded-xl border border-[var(--border)] px-4 py-2 text-xs font-semibold text-[var(--muted)] hover:text-red-400"
          >
            Đăng xuất
          </button>
        </div>

        <form onSubmit={handleSaveName} className="mt-6 flex flex-col gap-2 sm:flex-row">
          <input
            type="text"
            maxLength={40}
            value={displayName}
            onChange={(e) => setNameInput(e.target.value)}
            placeholder="Tên hiển thị của bạn"
            className="flex-1 rounded-xl border border-[var(--border)] bg-[var(--surface-solid)] px-3.5 py-2.5 text-sm outline-none focus:border-[var(--primary)]"
          />
          <button
            type="submit"
            disabled={saving || !displayName.trim()}
            className="rounded-xl bg-[var(--primary)] px-5 py-2.5 text-xs font-bold text-[var(--primary-fg)] disabled:opacity-60"
          >
            {saving ? 'Đang lưu...' : 'Lưu tên hiển thị'}
          </button>
        </form>

        <div className="mt-6 grid grid-cols-3 gap-3">
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-solid)] p-3.5 text-center">
            <p className="font-display text-2xl font-extrabold text-[var(--primary)] tabular-nums">
              {data.stats.ownedCount}
            </p>
            <p className="text-[11px] text-[var(--muted)]">Phòng đã tạo</p>
          </div>
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-solid)] p-3.5 text-center">
            <p className="font-display text-2xl font-extrabold text-[var(--accent)] tabular-nums">
              {data.stats.joinedCount}
            </p>
            <p className="text-[11px] text-[var(--muted)]">Phòng đã tham gia</p>
          </div>
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-solid)] p-3.5 text-center">
            <p className="font-display text-2xl font-extrabold tabular-nums">
              {data.stats.finalizedCount}
            </p>
            <p className="text-[11px] text-[var(--muted)]">Lịch đã chốt</p>
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-lg font-bold">Sự kiện đã tạo</h2>
        {data.ownedEvents.length === 0 ? (
          <div className="glass-card p-5 text-xs text-[var(--muted)]">
            Chưa có sự kiện nào.{' '}
            <Link href="/new" className="font-semibold text-[var(--primary)] underline">
              Tạo phòng mới
            </Link>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {data.ownedEvents.map((ev) => (
              <Link
                key={ev.id}
                href={`/e/${ev.code}`}
                className="glass-card flex items-center justify-between gap-3 p-4 transition hover:border-[var(--primary)]/50"
              >
                <div className="min-w-0">
                  <p className="truncate font-display text-sm font-bold">{ev.title}</p>
                  <p className="text-[11px] text-[var(--muted)]">{ev.dates.length} ngày</p>
                </div>
                <RoomCodeChip code={ev.code} />
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-lg font-bold">Sự kiện đã tham gia</h2>
        {data.joinedEvents.length === 0 ? (
          <div className="glass-card p-5 text-xs text-[var(--muted)]">
            Bạn chưa tham gia phòng nào của bạn bè.
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {data.joinedEvents.map((ev) => (
              <Link
                key={ev.id}
                href={`/e/${ev.code}`}
                className="glass-card flex items-center justify-between gap-3 p-4 transition hover:border-[var(--primary)]/50"
              >
                <div className="min-w-0">
                  <p className="truncate font-display text-sm font-bold">{ev.title}</p>
                  <p className="text-[11px] text-[var(--muted)]">{ev.dates.length} ngày</p>
                </div>
                <RoomCodeChip code={ev.code} />
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
