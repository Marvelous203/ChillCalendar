import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { getUserDisplayName } from '@/lib/profile';
import { checkRateLimit, getClientIp } from '@/lib/ratelimit';
import { getStore } from '@/lib/store';

export async function GET() {
  const user = await getAuthUser();
  const voterKey = user ? `user:${user.id}` : null;
  const status = await getStore().getAppStarStatus(voterKey);
  return NextResponse.json(status);
}

export async function POST(req: Request) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json(
      { error: 'Vui lòng đăng nhập tài khoản để Star ủng hộ' },
      { status: 401 }
    );
  }

  const ip = getClientIp(req);
  const rl = await checkRateLimit(`app-star:${user.id}:${ip}`, 20, 60);
  if (!rl.ok) {
    return NextResponse.json(
      { error: 'Bạn thao tác hơi nhanh, thử lại sau nhé' },
      { status: 429 }
    );
  }

  const displayName = await getUserDisplayName(user);
  const status = await getStore().toggleAppStar(`user:${user.id}`, displayName);
  return NextResponse.json(status);
}
