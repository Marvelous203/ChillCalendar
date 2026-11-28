import { NextResponse } from 'next/server';
import { computeEventStatus } from '@/lib/event-lifecycle';
import { getRoomPermissions } from '@/lib/permissions';
import { checkRateLimit } from '@/lib/ratelimit';
import { resolveRoomContext } from '@/lib/room-service';
import { getStore } from '@/lib/store';
import type { ReactionEmoji } from '@/lib/types';
import { reactMomentSchema } from '@/lib/validation';
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
      { error: 'Hãy tham gia phòng trước khi thả biểu cảm' },
      { status: 403 }
    );
  }

  const permissions = getRoomPermissions(ctx.event, ctx.userId, ctx.participant);
  const status = computeEventStatus(ctx.event);
  if (!permissions.canCheckin || status !== 'live') {
    return NextResponse.json(
      { error: 'Chỉ có thể thả biểu cảm khi sự kiện đang diễn ra' },
      { status: 409 }
    );
  }

  const rl = await checkRateLimit(`react:${ctx.event.id}:${ctx.participant.id}`, 45, 30);
  if (!rl.ok) {
    return NextResponse.json(
      { error: 'Bạn thả biểu cảm hơi nhanh, thử lại sau vài giây nhé' },
      { status: 429 }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Dữ liệu không hợp lệ' }, { status: 400 });
  }

  const parsed = reactMomentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Biểu cảm không hợp lệ' }, { status: 400 });
  }

  const store = getStore();
  const moments = await store.listMoments(ctx.event.id);
  const target = moments.find((m) => m.id === parsed.data.momentId);
  if (!target) {
    return NextResponse.json({ error: 'Không tìm thấy ảnh' }, { status: 404 });
  }

  const { active } = await store.setMomentReaction(
    target.id,
    ctx.participant.id,
    parsed.data.emoji,
    parsed.data.mode
  );

  const allReactions = await store.listMomentReactions(ctx.event.id);
  const momentReactions = allReactions.filter((r) => r.momentId === target.id);
  const counts: Partial<Record<ReactionEmoji, number>> = {};
  const myReactions: ReactionEmoji[] = [];
  let totalReactions = 0;

  for (const r of momentReactions) {
    counts[r.emoji] = (counts[r.emoji] ?? 0) + 1;
    totalReactions += 1;
    if (r.participantId === ctx.participant.id && !myReactions.includes(r.emoji)) {
      myReactions.push(r.emoji);
    }
  }

  await broadcastRoomEvent(ctx.event.code, {
    type: 'reaction_count',
    momentId: target.id,
    reactions: counts,
    totalReactions,
  });

  return NextResponse.json({
    momentId: target.id,
    active,
    reactions: counts,
    myReactions,
    totalReactions,
  });
}
