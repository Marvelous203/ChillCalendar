import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { DEV_AUTH_COOKIE, isDevAuthMode } from '@/lib/auth';
import { SEALED_SESSION_COOKIE, sealSession } from '@/lib/session-crypto';
import { loginSchema, registerSchema } from '@/lib/validation';

function mapAuthError(msg: string): string {
  const m = msg.toLowerCase();
  if (m.includes('already registered')) {
    return 'Gmail này đã được đăng ký, hãy chuyển sang Đăng nhập';
  }
  if (m.includes('invalid login credentials')) {
    return 'Sai Gmail hoặc mật khẩu';
  }
  if (m.includes('captcha')) {
    return 'Xác nhận Captcha thất bại, vui lòng thử lại';
  }
  return msg || 'Có lỗi xảy ra, vui lòng thử lại';
}

export async function POST(req: Request) {
  if (isDevAuthMode()) {
    return NextResponse.json(
      { error: 'Chế độ dev dùng /api/auth/dev' },
      { status: 400 }
    );
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    return NextResponse.json(
      { error: 'Thiếu cấu hình Supabase trên server' },
      { status: 500 }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Dữ liệu không hợp lệ' }, { status: 400 });
  }

  const mode = (body as { mode?: string }).mode === 'register' ? 'register' : 'login';
  const parsed =
    mode === 'register'
      ? registerSchema.safeParse(body)
      : loginSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Thông tin chưa hợp lệ' },
      { status: 400 }
    );
  }

  const sb = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const authRes =
    mode === 'register'
      ? await sb.auth.signUp({
          email: parsed.data.email,
          password: parsed.data.password,
          options: { captchaToken: parsed.data.captchaToken },
        })
      : await sb.auth.signInWithPassword({
          email: parsed.data.email,
          password: parsed.data.password,
          options: { captchaToken: parsed.data.captchaToken },
        });

  if (authRes.error || !authRes.data.session || !authRes.data.user?.email) {
    return NextResponse.json(
      { error: mapAuthError(authRes.error?.message ?? '') },
      { status: 401 }
    );
  }

  const { session, user } = authRes.data;
  const meta = user.user_metadata as Record<string, unknown> | undefined;
  const displayName =
    (typeof meta?.display_name === 'string' && meta.display_name) ||
    (typeof meta?.full_name === 'string' && meta.full_name) ||
    (typeof meta?.name === 'string' && meta.name) ||
    undefined;

  const sealed = sealSession({
    accessToken: session.access_token,
    refreshToken: session.refresh_token,
    expiresAt: session.expires_at,
    user: { id: user.id, email: user.email!, displayName },
  });

  const res = NextResponse.json({
    user: { id: user.id, email: user.email! },
  });
  res.cookies.set(SEALED_SESSION_COOKIE, sealed, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  });

  // Dọn sạch cookie cũ không mã hóa nếu trình duyệt từng lưu trước đó
  const cookieStore = await cookies();
  for (const c of cookieStore.getAll()) {
    if (c.name.startsWith('sb-') && c.name.includes('-auth-token')) {
      res.cookies.delete(c.name);
    }
  }

  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.delete(SEALED_SESSION_COOKIE);
  res.cookies.delete(DEV_AUTH_COOKIE);

  const cookieStore = await cookies();
  for (const c of cookieStore.getAll()) {
    if (c.name.startsWith('sb-') && c.name.includes('-auth-token')) {
      res.cookies.delete(c.name);
    }
  }

  return res;
}
