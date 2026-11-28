import { NextResponse } from 'next/server';
import { buildTimelinePage, computeEventStatus } from '@/lib/event-lifecycle';
import { getRoomPermissions } from '@/lib/permissions';
import { resolveRoomContext } from '@/lib/room-service';
import { getStore } from '@/lib/store';

export async function GET(
  req: Request,
  context: { params: Promise<{ code: string }> }
) {
  const { code } = await context.params;
  const resolved = await resolveRoomContext(code, req);
  if (!resolved.ok) return resolved.response;

  const { ctx } = resolved;
  const permissions = getRoomPermissions(ctx.event, ctx.userId, ctx.participant);
  if (ctx.event.visibility === 'private' && !permissions.canParticipate) {
    return NextResponse.json({ error: 'Phòng riêng tư', private: true }, { status: 403 });
  }

  const url = new URL(req.url);
  const status = computeEventStatus(ctx.event);
  const orderParam = url.searchParams.get('order');
  const order = orderParam === 'asc' || orderParam === 'desc'
    ? orderParam
    : status === 'done'
      ? 'asc'
      : 'desc';
  const cursor = url.searchParams.get('cursor');
  const participantId = url.searchParams.get('participantId');
  const limitRaw = Number(url.searchParams.get('limit') ?? '20');
  const limit = Number.isFinite(limitRaw) ? limitRaw : 20;

  const store = getStore();
  const [participants, checkins, moments] = await Promise.all([
    store.listParticipants(ctx.event.id),
    store.listCheckins(ctx.event.id),
    store.listMoments(ctx.event.id),
  ]);

  const page = buildTimelinePage(participants, checkins, moments, {
    order,
    cursor,
    limit,
    participantId,
  });

  return NextResponse.json(page);
}
