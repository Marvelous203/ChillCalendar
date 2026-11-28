import { NextResponse } from 'next/server';
import { buildLiveSnapshot, computeAutoEndAt, computeEventStatus } from '@/lib/event-lifecycle';
import { getStore } from '@/lib/store';
import { broadcastRoomEvent } from '@/lib/ws-broadcaster';

function isAuthorizedInternal(req: Request): boolean {
  const secret = process.env.WS_INTERNAL_SECRET;
  if (secret) {
    return req.headers.get('x-ws-secret') === secret;
  }
  const host = req.headers.get('host') ?? '';
  return host.startsWith('127.0.0.1:') || host.startsWith('localhost:');
}

/** Quét các phòng đang live để tiến trình WebSocket đặt lại hẹn giờ tự kết thúc 24h khi khởi động. */
export async function GET(req: Request) {
  if (!isAuthorizedInternal(req)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const store = getStore();
  const events = await store.listActiveLiveEvents();
  const now = new Date();
  const active: Array<{ id: string; code: string; liveFrom: string; autoEndAt: string }> = [];

  for (const ev of events) {
    if (!ev.liveFrom) continue;
    const status = computeEventStatus(ev, now);
    const autoEndAt = computeAutoEndAt(ev.liveFrom);
    if (!autoEndAt) continue;

    if (status === 'done') {
      await store.endEvent(ev.id, autoEndAt, 'auto');
    } else {
      active.push({ id: ev.id, code: ev.code, liveFrom: ev.liveFrom, autoEndAt });
    }
  }

  return NextResponse.json({ active });
}

/** Đóng phòng tự động sau 24 giờ từ tiến trình WebSocket. */
export async function POST(req: Request) {
  if (!isAuthorizedInternal(req)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const body = (await req.json().catch(() => ({}))) as { code?: string; endedAt?: string };
  if (!body.code) {
    return NextResponse.json({ error: 'Missing code' }, { status: 400 });
  }

  const store = getStore();
  const ev = await store.getEventByCode(body.code);
  if (!ev || ev.endedAt) {
    return NextResponse.json({ ok: true, skipped: true });
  }

  const endedAt = body.endedAt ?? computeAutoEndAt(ev.liveFrom) ?? new Date().toISOString();
  const updated = await store.endEvent(ev.id, endedAt, 'auto');
  if (!updated) {
    return NextResponse.json({ ok: true, skipped: true });
  }

  const [participants, responses, checkins, moments] = await Promise.all([
    store.listParticipants(updated.id),
    store.listResponses(updated.id),
    store.listCheckins(updated.id),
    store.listMoments(updated.id),
  ]);
  const snapshot = buildLiveSnapshot(updated, participants, responses, checkins, moments);

  await broadcastRoomEvent(updated.code, {
    type: 'ended',
    data: snapshot,
  });

  return NextResponse.json({ ok: true });
}
