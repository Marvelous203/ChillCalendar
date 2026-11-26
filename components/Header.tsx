'use client';

import Link from 'next/link';
import { useEffect, useSyncExternalStore } from 'react';
import useSWR from 'swr';
import { createSupabaseBrowserClient } from '@/lib/supabase-browser';

interface MeResponse {
  user: { id: string; email: string } | null;
  authMode: 'dev' | 'supabase';
}

const fetcher = (url: string) => fetch(url).then((r) => r.json() as Promise<MeResponse>);

function getIsDark(): boolean {
  const saved = localStorage.getItem('cwm_theme');
  if (saved) return saved === 'dark';
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function subscribeTheme(cb: () => void): () => void {
  window.addEventListener('cwm-theme', cb);
  window.addEventListener('storage', cb);
  return () => {
    window.removeEventListener('cwm-theme', cb);
    window.removeEventListener('storage', cb);
  };
}

export function Header() {
  const { data, mutate } = useSWR<MeResponse>('/api/auth/me', fetcher);
  const dark = useSyncExternalStore(subscribeTheme, getIsDark, () => false);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    document.documentElement.classList.toggle('light', !dark);
  }, [dark]);

  function toggleTheme() {
    const next = !dark;
    localStorage.setItem('cwm_theme', next ? 'dark' : 'light');
    window.dispatchEvent(new Event('cwm-theme'));
  }

  async function handleLogout() {
    if (data?.authMode === 'dev') {
      await fetch('/api/auth/dev', { method: 'DELETE' });
    } else {
      const sb = createSupabaseBrowserClient();
      await sb.auth.signOut();
    }
    await mutate();
  }

  return (
    <header className="sticky top-0 z-30 border-b border-[var(--border)] bg-[var(--surface)] backdrop-blur-xl">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--primary)] text-sm font-bold text-[var(--primary-fg)] shadow-sm">
            HG
          </span>
          <span className="font-display text-lg font-bold tracking-tight">
            Hẹn Giờ Rảnh
          </span>
        </Link>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={toggleTheme}
            aria-label="Đổi giao diện Sáng/Tối"
            className="rounded-full border border-[var(--border)] bg-[var(--surface-solid)] px-3 py-1.5 text-xs font-medium text-[var(--text)] transition hover:opacity-85"
          >
            {dark ? '☀️ Sáng' : '🌙 Tối'}
          </button>

          {data?.user ? (
            <>
              <Link
                href="/new"
                className="rounded-full bg-[var(--primary)] px-3.5 py-1.5 text-xs font-semibold text-[var(--primary-fg)] transition hover:opacity-90 sm:text-sm"
              >
                + Tạo phòng
              </Link>
              <button
                type="button"
                onClick={handleLogout}
                className="hidden rounded-full border border-[var(--border)] px-3 py-1.5 text-xs text-[var(--muted)] hover:text-[var(--text)] sm:inline-flex"
              >
                Đăng xuất
              </button>
            </>
          ) : (
            <Link
              href="/login"
              className="rounded-full bg-[var(--primary)] px-4 py-1.5 text-xs font-semibold text-[var(--primary-fg)] transition hover:opacity-90 sm:text-sm"
            >
              Đăng nhập
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
