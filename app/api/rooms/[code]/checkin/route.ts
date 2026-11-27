import { NextResponse } from 'next/server';
import { buildLiveSnapshot, computeEventStatus } from '@/lib/event-lifecycle';
import { getRoomPermissions } from '@/lib/permissions';
import { checkRateLimit } from '@/lib/ratelimit';
import { resolveRoomContext } from '@/lib/room-service';
import { getStore } from '@/lib/store';
import { checkinSchema } from '@/lib/validation';
import { broadcastRoomEvent } from '@/lib/ws-broadcaster';

export async function POST(
  req: Request,
  context: { params: Promise<{ code: string }> }
) {
  const { code } = await context.params;
  const resolved = await resolveRoomContext(code, req);
  if (!resolved.ok) return resolved.response;

  const { ctx } = resolved;
  if (!ctx.participant || ctx.participant.status !== 'approved') {
    return NextResponse.json(
      { error: 'Hãy tham gia phòng trước khi check-in' },
      { status: 403 }
    );
  }

  const permissions = getRoomPermissions(ctx.event, ctx.userId, ctx.participant);
  const status = computeEventStatus(ctx.event);
  if (!permissions.canCheckin || status !== 'live') {
    return NextResponse.json(
      { error: 'Chỉ có thể check-in khi sự kiện đang diễn ra' },
      { status: 409 }
    );
  }

  const rl = await checkRateLimit(`checkin:${ctx.event.id}:${ctx.participant.id}`, 12, 60);
  if (!rl.ok) {
    return NextResponse.json(
      { error: 'Bạn thao tác hơi nhanh, thử lại sau vài giây nhé' },
      { status: 429 }
    );
  }

  let body: unknown = {};
  try {
    const raw = await req.text();
    if (raw) body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: 'Dữ liệu không hợp lệ' }, { status: 400 });
  }

  const parsed = checkinSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Thông tin check-in không hợp lệ' },
      { status: 400 }
    );
  }

  const store = getStore();
  await store.upsertCheckin({
    eventId: ctx.event.id,
    participantId: ctx.participant.id,
    note: parsed.data.note,
    photoUrl: parsed.data.photoUrl,
  });

  const [participants, responses, checkins] = await Promise.all([
    store.listParticipants(ctx.event.id),
    store.listResponses(ctx.event.id),
    store.listCheckins(ctx.event.id),
  ]);

  const snapshot = buildLiveSnapshot(ctx.event, participants, responses, checkins);
  const myCheckin = snapshot.checkins.find((c) => c.participantId === ctx.participant!.id);

  if (myCheckin) {
    await broadcastRoomEvent(ctx.event.code, {
      type: 'checkin',
      data: myCheckin,
      counts: snapshot.counts,
    });
  } else {
    await broadcastRoomEvent(ctx.event.code, {
      type: 'counts',
      data: snapshot.counts,
    });
  }

  return NextResponse.json(snapshot);
}
