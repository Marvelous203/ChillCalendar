'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { Turnstile, type TurnstileInstance } from '@marsidev/react-turnstile';
import useSWR from 'swr';
import { useToast } from '@/components/Toast';
import { createSupabaseBrowserClient } from '@/lib/supabase-browser';
import { loginSchema, registerSchema } from '@/lib/validation';

function mapAuthError(msg: string): string {
  const m = msg.toLowerCase();
  if (m.includes('already registered')) return 'Gmail này đã được đăng ký, hãy chuyển sang Đăng nhập';
  if (m.includes('invalid login credentials')) return 'Sai Gmail hoặc mật khẩu';
  if (m.includes('captcha')) return 'Xác nhận Captcha thất bại, vui lòng thử lại';
  return msg || 'Có lỗi xảy ra, vui lòng thử lại';
}

export default function LoginPage() {
  const router = useRouter();
  const { toast } = useToast();
  const turnstileRef = useRef<TurnstileInstance | undefined>(undefined);

  const { data: meData, mutate } = useSWR<{
    user: { id: string; email: string } | null;
    authMode: 'dev' | 'supabase';
  }>('/api/auth/me', (u: string) => fetch(u).then((r) => r.json()));

  const isDevMode = meData?.authMode === 'dev';
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? '';

  const [tab, setTab] = useState<'login' | 'register'>('register');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [captchaToken, setCaptchaToken] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (meData?.user) {
      router.replace('/new');
    }
  }, [meData?.user, router]);

  const effectiveCaptcha = isDevMode || !siteKey ? 'dev-bypass-token' : captchaToken;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    const payload =
      tab === 'register'
        ? { email, password, confirmPassword, captchaToken: effectiveCaptcha }
        : { email, password, captchaToken: effectiveCaptcha };

    const parsed =
      tab === 'register'
        ? registerSchema.safeParse(payload)
        : loginSchema.safeParse(payload);

    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Thông tin chưa hợp lệ');
      return;
    }

    setSubmitting(true);
    try {
      if (isDevMode) {
        const res = await fetch('/api/auth/dev', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...payload, mode: tab }),
        });
        const json = (await res.json()) as { error?: string };
        if (!res.ok) {
          setError(json.error ?? 'Đăng nhập thất bại');
          return;
        }
      } else {
        const sb = createSupabaseBrowserClient();
        if (tab === 'register') {
          const { error: signUpErr } = await sb.auth.signUp({
            email: parsed.data.email,
            password: parsed.data.password,
            options: { captchaToken: effectiveCaptcha },
          });
          if (signUpErr) {
            setError(mapAuthError(signUpErr.message));
            turnstileRef.current?.reset();
            setCaptchaToken('');
            return;
          }
        } else {
          const { error: signInErr } = await sb.auth.signInWithPassword({
            email: parsed.data.email,
            password: parsed.data.password,
            options: { captchaToken: effectiveCaptcha },
          });
          if (signInErr) {
            setError(mapAuthError(signInErr.message));
            turnstileRef.current?.reset();
            setCaptchaToken('');
            return;
          }
        }
      }

      await mutate();
      toast(tab === 'register' ? 'Đăng ký thành công!' : 'Đăng nhập thành công!', 'success');
      router.push('/new');
    } finally {
      setSubmitting(false);
    }
  }

  const passwordsMatch =
    confirmPassword.length > 0 && password === confirmPassword;

  return (
    <div className="mx-auto max-w-md py-4">
      <div className="glass-card p-6 sm:p-8">
        <div className="mb-6 grid grid-cols-2 rounded-2xl bg-[var(--bg)] p-1">
          {(['register', 'login'] as const).map((t) => {
            const active = tab === t;
            return (
              <button
                key={t}
                type="button"
                onClick={() => {
                  setTab(t);
                  setError('');
                }}
                className={`relative rounded-xl py-2.5 text-sm font-semibold transition ${
                  active ? 'text-[var(--primary-fg)]' : 'text-[var(--muted)]'
                }`}
              >
                {active && (
                  <motion.span
                    layoutId="auth-tab"
                    className="absolute inset-0 rounded-xl bg-[var(--primary)]"
                    transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                  />
                )}
                <span className="relative z-10">
                  {t === 'register' ? 'Đăng ký nhanh' : 'Đăng nhập'}
                </span>
              </button>
            );
          })}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-[var(--muted)]">
              Địa chỉ Gmail
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tenban@gmail.com"
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-solid)] px-3.5 py-2.5 text-sm outline-none focus:border-[var(--primary)]"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold text-[var(--muted)]">
              Mật khẩu (tối thiểu 8 ký tự)
            </label>
            <div className="relative">
              <input
                type={showPass ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-solid)] px-3.5 py-2.5 pr-11 text-sm outline-none focus:border-[var(--primary)]"
              />
              <button
                type="button"
                onClick={() => setShowPass((v) => !v)}
                aria-label="Hiện hoặc ẩn mật khẩu"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[var(--muted)]"
              >
                {showPass ? 'Ẩn' : 'Hiện'}
              </button>
            </div>
          </div>

          {tab === 'register' && (
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-[var(--muted)]">
                Nhập lại mật khẩu
              </label>
              <div className="relative">
                <input
                  type={showConfirm ? 'text' : 'password'}
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-solid)] px-3.5 py-2.5 pr-11 text-sm outline-none focus:border-[var(--primary)]"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm((v) => !v)}
                  aria-label="Hiện hoặc ẩn mật khẩu nhập lại"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[var(--muted)]"
                >
                  {showConfirm ? 'Ẩn' : 'Hiện'}
                </button>
              </div>
              {confirmPassword.length > 0 && (
                <p
                  className={`mt-1 text-xs font-medium ${
                    passwordsMatch ? 'text-[var(--primary)]' : 'text-red-500'
                  }`}
                >
                  {passwordsMatch ? '✓ Mật khẩu đã khớp' : 'Mật khẩu chưa khớp'}
                </p>
              )}
            </div>
          )}

          {!isDevMode && siteKey ? (
            <div className="flex justify-center pt-1">
              <Turnstile
                ref={turnstileRef}
                siteKey={siteKey}
                onSuccess={(token) => setCaptchaToken(token)}
                onExpire={() => setCaptchaToken('')}
              />
            </div>
          ) : (
            <p className="rounded-xl bg-[var(--primary)]/10 px-3 py-2 text-xs text-[var(--primary)]">
              Chế độ dev local (AUTH_MODE=dev): bỏ qua Captcha & xác nhận email.
            </p>
          )}

          {error && (
            <p className="rounded-xl bg-red-500/10 px-3 py-2 text-xs font-medium text-red-500">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-xl bg-[var(--primary)] py-3 text-sm font-bold text-[var(--primary-fg)] transition hover:opacity-90 disabled:opacity-60"
          >
            {submitting
              ? 'Đang xử lý...'
              : tab === 'register'
                ? 'Đăng ký & Tạo phòng ngay'
                : 'Đăng nhập'}
          </button>
        </form>
      </div>
    </div>
  );
}
