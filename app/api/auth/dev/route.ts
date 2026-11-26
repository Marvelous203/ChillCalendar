import { createHash } from 'node:crypto';
import { NextResponse } from 'next/server';
import { DEV_AUTH_COOKIE, encodeDevCookie, isDevAuthMode } from '@/lib/auth';
import { loginSchema, registerSchema } from '@/lib/validation';

function devUserId(email: string): string {
  const hex = createHash('sha256').update(email).digest('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

export async function POST(req: Request) {
  if (!isDevAuthMode()) {
    return NextResponse.json({ error: 'Chế độ dev không được bật' }, { status: 403 });
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

  const user = {
    id: devUserId(parsed.data.email),
    email: parsed.data.email,
  };

  const res = NextResponse.json({ user });
  res.cookies.set(DEV_AUTH_COOKIE, encodeDevCookie(user), {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  });
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.delete(DEV_AUTH_COOKIE);
  return res;
}
