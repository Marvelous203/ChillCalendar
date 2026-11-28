'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/lib/auth-client';
import { applyThemeToDocument, THEMES, useAppTheme, useBlossomEffect } from '@/lib/themes';
import { UserAvatar } from './UserAvatar';

export function Header() {
  const { user, refreshAuth } = useAuth();
  const [theme, setTheme] = useAppTheme();
  const [blossom, setBlossom] = useBlossomEffect();
  const [themeMenuOpen, setThemeMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    applyThemeToDocument(theme);
  }, [theme]);

  useEffect(() => {
    if (!themeMenuOpen) return;
    function onClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setThemeMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [themeMenuOpen]);

  async function handleLogout() {
    await fetch('/api/auth/session', { method: 'DELETE' });
    await refreshAuth();
  }

  const currentTheme = THEMES.find((t) => t.id === theme) ?? THEMES[0];

  return (
    <header className="sticky top-0 z-30 border-b border-[var(--border)] bg-[var(--surface)] backdrop-blur-xl">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
        <Link href="/" className="flex items-center gap-2.5">
          {theme === 't1' ? (
            <span className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-xl bg-black ring-1 ring-[var(--primary)]/60 shadow-sm">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/themes/t1-logo.png" alt="T1" className="h-7 w-7 object-contain" />
            </span>
          ) : (
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--primary)] text-sm font-bold text-[var(--primary-fg)] shadow-sm">
              -.-
            </span>
          )}
          <span className="font-display text-lg font-bold tracking-tight">
            Chill With Me
          </span>
        </Link>

        <div className="flex items-center gap-2">
          {/* Nút bật/tắt hiệu ứng Hoa Đào Rơi */}
          <button
            type="button"
            onClick={() => setBlossom(!blossom)}
            aria-pressed={blossom}
            title={blossom ? 'Tắt hiệu ứng hoa đào' : 'Bật hiệu ứng hoa đào'}
            className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1.5 text-xs font-medium transition ${
              blossom
                ? 'border-pink-400/50 bg-pink-500/15 text-pink-300'
                : 'border-[var(--border)] bg-[var(--surface-solid)] text-[var(--muted)] hover:text-[var(--text)]'
            }`}
          >
            <span>🌸</span>
            <span className="hidden sm:inline">{blossom ? 'Hoa đào' : 'Tắt hoa'}</span>
          </button>

          {/* Bộ chọn Theme đóng gói */}
          <div ref={menuRef} className="relative">
            <button
              type="button"
              onClick={() => setThemeMenuOpen((v) => !v)}
              aria-label="Chọn giao diện"
              aria-expanded={themeMenuOpen}
              className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--surface-solid)] px-3 py-1.5 text-xs font-medium text-[var(--text)] transition hover:border-[var(--primary)]"
            >
              <span>{currentTheme.icon}</span>
              <span>{currentTheme.shortLabel}</span>
              <span className="text-[10px] text-[var(--muted)]">▾</span>
            </button>

            {themeMenuOpen && (
              <div className="absolute right-0 top-11 z-40 w-44 overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface-solid)] p-1.5 shadow-xl backdrop-blur-xl">
                {THEMES.map((item) => {
                  const active = item.id === theme;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        setTheme(item.id);
                        setThemeMenuOpen(false);
                      }}
                      className={`flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2 text-left text-xs font-semibold transition ${
                        active
                          ? 'bg-[var(--primary)] text-[var(--primary-fg)]'
                          : 'text-[var(--text)] hover:bg-[var(--bg)]/60'
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <span>{item.icon}</span>
                        <span>{item.label}</span>
                      </span>
                      <span
                        className="h-2.5 w-2.5 rounded-full ring-1 ring-white/40"
                        style={{ backgroundColor: item.swatch }}
                      />
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {user ? (
            <>
              <Link
                href="/new"
                className="rounded-full bg-[var(--primary)] px-3.5 py-1.5 text-xs font-semibold text-[var(--primary-fg)] transition hover:opacity-90 sm:text-sm"
              >
                + Room
              </Link>
              <Link
                href="/profile"
                className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--surface-solid)] py-1 pl-1 pr-2.5 text-xs font-semibold hover:border-[var(--primary)]"
                title="Hồ sơ người dùng"
              >
                <UserAvatar name={user.email.split('@')[0] || 'U'} size="sm" />
                <span className="hidden sm:inline">Hồ sơ</span>
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
