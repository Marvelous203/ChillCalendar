import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthUser, isDevAuthMode } from '@/lib/auth';
import { getUserDisplayName, writeDevProfile } from '@/lib/profile';
import { getStore } from '@/lib/store';

const updateProfileSchema = z.object({
  displayName: z.string().trim().min(1, 'Nhập tên hiển thị').max(40, 'Tối đa 40 ký tự'),
});

export async function GET() {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: 'Vui lòng đăng nhập' }, { status: 401 });
  }

  const store = getStore();
  const [owned, joined, displayName] = await Promise.all([
    store.listEventsByOwner(user.id),
    store.listJoinedEventsByUser(user.id),
    getUserDisplayName(user),
  ]);

  return NextResponse.json({
    profile: {
      id: user.id,
      email: user.email,
      displayName,
    },
    stats: {
      ownedCount: owned.length,
      joinedCount: joined.length,
      finalizedCount: [...owned, ...joined].filter((e) => Boolean(e.finalDate)).length,
    },
    ownedEvents: owned.map((e) => ({
      id: e.id,
      code: e.code,
      title: e.title,
      dates: e.dates,
      finalDate: e.finalDate,
      visibility: e.visibility,
    })),
    joinedEvents: joined.map((e) => ({
      id: e.id,
      code: e.code,
      title: e.title,
      dates: e.dates,
      finalDate: e.finalDate,
      visibility: e.visibility,
    })),
  });
}

export async function PATCH(req: Request) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: 'Vui lòng đăng nhập' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Dữ liệu không hợp lệ' }, { status: 400 });
  }

  const parsed = updateProfileSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Tên hiển thị không hợp lệ' },
      { status: 400 }
    );
  }

  if (!isDevAuthMode()) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (url && serviceKey) {
      const sb = createClient(url, serviceKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      await sb.auth.admin.updateUserById(user.id, {
        user_metadata: { display_name: parsed.data.displayName },
      });
    }
  }
  await writeDevProfile(user.id, parsed.data.displayName);
  return NextResponse.json({ displayName: parsed.data.displayName });
}
