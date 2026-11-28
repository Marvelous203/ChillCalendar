import { NextResponse } from 'next/server';
import { buildLiveSnapshot, computeEventStatus } from '@/lib/event-lifecycle';
import { getRoomPermissions } from '@/lib/permissions';
import { checkRateLimit } from '@/lib/ratelimit';
import { resolveRoomContext } from '@/lib/room-service';
import { getStore } from '@/lib/store';
import { createMomentSchema } from '@/lib/validation';
import { broadcastRoomEvent } from '@/lib/ws-broadcaster';

const MAX_MOMENTS_PER_PARTICIPANT = 5;

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
      { error: 'Hãy tham gia phòng trước khi đăng khoảnh khắc' },
      { status: 403 }
    );
  }

  const permissions = getRoomPermissions(ctx.event, ctx.userId, ctx.participant);
  const status = computeEventStatus(ctx.event);
  if (!permissions.canCheckin || status !== 'live') {
    return NextResponse.json(
      { error: 'Chỉ có thể đăng khoảnh khắc khi sự kiện đang diễn ra' },
      { status: 409 }
    );
  }

  const rl = await checkRateLimit(`moment:${ctx.event.id}:${ctx.participant.id}`, 10, 60);
  if (!rl.ok) {
    return NextResponse.json(
      { error: 'Bạn thao tác hơi nhanh, thử lại sau vài giây nhé' },
      { status: 429 }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Dữ liệu không hợp lệ' }, { status: 400 });
  }

  const parsed = createMomentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Thông tin khoảnh khắc không hợp lệ' },
      { status: 400 }
    );
  }

  const store = getStore();
  const existingMoments = await store.listMoments(ctx.event.id);
  const myMomentsCount = existingMoments.filter(
    (m) => m.participantId === ctx.participant!.id
  ).length;

  if (myMomentsCount >= MAX_MOMENTS_PER_PARTICIPANT) {
    return NextResponse.json(
      { error: `Mỗi người tối đa ${MAX_MOMENTS_PER_PARTICIPANT} ảnh khoảnh khắc cho một kèo` },
      { status: 400 }
    );
  }

  // Đảm bảo đã check-in nếu đăng ảnh trực tiếp lần đầu
  await store.upsertCheckin({
    eventId: ctx.event.id,
    participantId: ctx.participant.id,
  });

  await store.createMoment({
    eventId: ctx.event.id,
    participantId: ctx.participant.id,
    photoUrl: parsed.data.photoUrl,
    caption: parsed.data.caption,
  });

  const [participants, responses, checkins, moments] = await Promise.all([
    store.listParticipants(ctx.event.id),
    store.listResponses(ctx.event.id),
    store.listCheckins(ctx.event.id),
    store.listMoments(ctx.event.id),
  ]);

  const snapshot = buildLiveSnapshot(ctx.event, participants, responses, checkins, moments);
  const myCheckin = snapshot.checkins.find((c) => c.participantId === ctx.participant!.id);

  if (myCheckin) {
    await broadcastRoomEvent(ctx.event.code, {
      type: 'checkin',
      data: myCheckin,
      counts: snapshot.counts,
    });
  } else {
    await broadcastRoomEvent(ctx.event.code, {
      type: 'snapshot',
      data: snapshot,
    });
  }

  return NextResponse.json(snapshot, { status: 201 });
}

export async function DELETE(
  req: Request,
  context: { params: Promise<{ code: string }> }
) {
  const { code } = await context.params;
  const resolved = await resolveRoomContext(code, req);
  if (!resolved.ok) return resolved.response;

  const { ctx } = resolved;
  const permissions = getRoomPermissions(ctx.event, ctx.userId, ctx.participant);
  const momentId = new URL(req.url).searchParams.get('momentId')?.trim();
  if (!momentId) {
    return NextResponse.json({ error: 'Thiếu momentId' }, { status: 400 });
  }

  const store = getStore();
  const allMoments = await store.listMoments(ctx.event.id);
  const target = allMoments.find((m) => m.id === momentId);
  if (!target) {
    return NextResponse.json({ error: 'Không tìm thấy ảnh khoảnh khắc' }, { status: 404 });
  }

  const isAuthor = Boolean(ctx.participant && ctx.participant.id === target.participantId);
  if (!permissions.isOwner && !isAuthor) {
    return NextResponse.json({ error: 'Bạn không có quyền xóa ảnh này' }, { status: 403 });
  }

  await store.deleteMoment(ctx.event.id, momentId);

  const [participants, responses, checkins, moments] = await Promise.all([
    store.listParticipants(ctx.event.id),
    store.listResponses(ctx.event.id),
    store.listCheckins(ctx.event.id),
    store.listMoments(ctx.event.id),
  ]);
  const snapshot = buildLiveSnapshot(ctx.event, participants, responses, checkins, moments);

  await broadcastRoomEvent(ctx.event.code, {
    type: 'snapshot',
    data: snapshot,
  });

  return NextResponse.json(snapshot);
}
