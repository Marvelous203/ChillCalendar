import { NextResponse } from 'next/server';
import { buildLiveSnapshot, computeEventStatus } from '@/lib/event-lifecycle';
import { getRoomPermissions } from '@/lib/permissions';
import { buildRoomBundle, resolveRoomContext } from '@/lib/room-service';
import { getStore } from '@/lib/store';
import { broadcastRoomEvent, cancelRoomAutoEnd } from '@/lib/ws-broadcaster';

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
      { error: 'Chỉ chủ phòng mới có thể kết thúc sự kiện' },
      { status: 403 }
    );
  }

  const status = computeEventStatus(ctx.event);
  if (status !== 'live') {
    return NextResponse.json(
      { error: 'Sự kiện hiện không ở trạng thái đang diễn ra' },
      { status: 409 }
    );
  }

  const nowIso = new Date().toISOString();
  const store = getStore();
  const updated = await store.endEvent(ctx.event.id, nowIso, 'owner');
  if (!updated) {
    return NextResponse.json({ error: 'Không tìm thấy phòng' }, { status: 404 });
  }

  cancelRoomAutoEnd(updated.id);

  const [participants, responses, checkins] = await Promise.all([
    store.listParticipants(updated.id),
    store.listResponses(updated.id),
    store.listCheckins(updated.id),
  ]);
  const snapshot = buildLiveSnapshot(updated, participants, responses, checkins);

  await broadcastRoomEvent(updated.code, {
    type: 'ended',
    data: snapshot,
  });

  const bundle = await buildRoomBundle({ ...ctx, event: updated });
  return NextResponse.json(bundle);
}
