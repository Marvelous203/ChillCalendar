import { NextResponse } from 'next/server';
import { generateSecretToken, getAuthUser } from '@/lib/auth';
import { checkRateLimit, getClientIp } from '@/lib/ratelimit';
import { newRoomCode } from '@/lib/room-code';
import { getStore } from '@/lib/store';
import { createEventSchema } from '@/lib/validation';

export async function GET() {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: 'Vui lòng đăng nhập' }, { status: 401 });
  }
  const store = getStore();
  const [events, joinedEvents] = await Promise.all([
    store.listEventsByOwner(user.id),
    store.listJoinedEventsByUser(user.id),
  ]);
  const mapSummary = (e: (typeof events)[number]) => ({
    id: e.id,
    code: e.code,
    title: e.title,
    dates: e.dates,
    hourFrom: e.hourFrom,
    hourTo: e.hourTo,
    visibility: e.visibility,
    finalizePolicy: e.finalizePolicy,
    finalDate: e.finalDate,
    finalFrom: e.finalFrom,
    finalTo: e.finalTo,
    createdAt: e.createdAt,
  });
  return NextResponse.json({
    events: events.map(mapSummary),
    joinedEvents: joinedEvents.map(mapSummary),
  });
}

export async function POST(req: Request) {
  const ip = getClientIp(req);
  const rl = await checkRateLimit(`events:create:${ip}`, 20, 60);
  if (!rl.ok) {
    return NextResponse.json(
      { error: 'Bạn thao tác quá nhanh, vui lòng thử lại sau ít phút' },
      { status: 429 }
    );
  }

  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: 'Vui lòng đăng nhập để tạo sự kiện' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Dữ liệu không hợp lệ' }, { status: 400 });
  }

  const parsed = createEventSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Dữ liệu sự kiện không hợp lệ' },
      { status: 400 }
    );
  }

  const store = getStore();
  const count = await store.countEventsByOwner(user.id);
  if (count >= 50) {
    return NextResponse.json(
      { error: 'Mỗi tài khoản tạo tối đa 50 sự kiện' },
      { status: 400 }
    );
  }

  let code = newRoomCode(6);
  for (let i = 0; i < 5; i++) {
    const exists = await store.getEventByCode(code);
    if (!exists) break;
    code = newRoomCode(6);
  }

  const inviteToken = generateSecretToken();
  const created = await store.createEvent({
    code,
    ownerId: user.id,
    title: parsed.data.title,
    note: parsed.data.note,
    dates: Array.from(new Set(parsed.data.dates)).sort(),
    hourFrom: parsed.data.from,
    hourTo: parsed.data.to,
    visibility: parsed.data.visibility,
    finalizePolicy: parsed.data.finalizePolicy,
    inviteToken,
  });

  return NextResponse.json(
    { code: created.code, inviteToken: created.inviteToken },
    { status: 201 }
  );
}
