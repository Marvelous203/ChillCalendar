import { NextResponse } from 'next/server';
import { buildLiveSnapshot } from '@/lib/event-lifecycle';
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

  const store = getStore();
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
  const res = NextResponse.json(snapshot);
  if (ctx.participant && ctx.participant.status === 'approved') {
    res.headers.set('x-cwm-verified', '1');
  }
  return res;
}
