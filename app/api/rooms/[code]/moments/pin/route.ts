import { NextResponse } from 'next/server';
import { buildLiveSnapshot } from '@/lib/event-lifecycle';
import { getRoomPermissions } from '@/lib/permissions';
import { resolveRoomContext } from '@/lib/room-service';
import { getStore } from '@/lib/store';
import { pinMomentSchema } from '@/lib/validation';
import { broadcastRoomEvent } from '@/lib/ws-broadcaster';

export async function POST(
  req: Request,
  context: { params: Promise<{ code: string }> }
) {
  const { code } = await context.params;
  const resolved = await resolveRoomContext(code, req);
  if (!resolved.ok) return resolved.response;

  const { ctx } = resolved;
  const permissions = getRoomPermissions(ctx.event, ctx.userId, ctx.participant);
  if (!permissions.isOwner) {
    return NextResponse.json(
      { error: 'Chỉ chủ phòng mới có thể ghim khoảnh khắc' },
      { status: 403 }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Dữ liệu không hợp lệ' }, { status: 400 });
  }

  const parsed = pinMomentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Thông tin ghim không hợp lệ' }, { status: 400 });
  }

  const store = getStore();
  const updated = await store.setMomentPinned(
    ctx.event.id,
    parsed.data.momentId,
    parsed.data.pinned
  );
  if (!updated) {
    return NextResponse.json({ error: 'Không tìm thấy ảnh khoảnh khắc' }, { status: 404 });
  }

  const [participants, responses, checkins, moments, reactions] = await Promise.all([
    store.listParticipants(ctx.event.id),
    store.listResponses(ctx.event.id),
    store.listCheckins(ctx.event.id),
    store.listMoments(ctx.event.id),
    store.listMomentReactions(ctx.event.id),
  ]);

  const snapshot = buildLiveSnapshot(
    ctx.event,
    participants,
    responses,
    checkins,
    moments,
    reactions,
    ctx.participant?.id ?? null
  );

  await broadcastRoomEvent(ctx.event.code, {
    type: 'snapshot',
    data: snapshot,
  });

  return NextResponse.json(snapshot);
}
