import { promises as fs } from 'node:fs';
import path from 'node:path';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthUser, isDevAuthMode } from '@/lib/auth';
import { getStore } from '@/lib/store';

const PROFILES_PATH = path.join(process.cwd(), 'data', 'profiles.json');

async function readDevProfiles(): Promise<Record<string, string>> {
  try {
    const raw = await fs.readFile(PROFILES_PATH, 'utf8');
    return JSON.parse(raw) as Record<string, string>;
  } catch {
    return {};
  }
}

async function writeDevProfile(userId: string, displayName: string): Promise<void> {
  const map = await readDevProfiles();
  map[userId] = displayName;
  await fs.mkdir(path.dirname(PROFILES_PATH), { recursive: true });
  await fs.writeFile(PROFILES_PATH, JSON.stringify(map, null, 2), 'utf8');
}

const updateProfileSchema = z.object({
  displayName: z.string().trim().min(1, 'Nhập tên hiển thị').max(40, 'Tối đa 40 ký tự'),
});

export async function GET() {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: 'Vui lòng đăng nhập' }, { status: 401 });
  }

  const store = getStore();
  const [owned, joined, devProfiles] = await Promise.all([
    store.listEventsByOwner(user.id),
    store.listJoinedEventsByUser(user.id),
    isDevAuthMode() ? readDevProfiles() : Promise.resolve({} as Record<string, string>),
  ]);

  const fallbackName = user.email.split('@')[0] || 'Bạn';
  const displayName = devProfiles[user.id] || fallbackName;

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

  await writeDevProfile(user.id, parsed.data.displayName);
  return NextResponse.json({ displayName: parsed.data.displayName });
}
