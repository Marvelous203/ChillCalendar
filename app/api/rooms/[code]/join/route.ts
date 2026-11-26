import { NextResponse } from 'next/server';
import { generateSecretToken, hashParticipantToken } from '@/lib/auth';
import { checkRateLimit, getClientIp } from '@/lib/ratelimit';
import { resolveRoomContext } from '@/lib/room-service';
import { getStore } from '@/lib/store';
import { joinRoomSchema } from '@/lib/validation';

export async function POST(
  req: Request,
  context: { params: Promise<{ code: string }> }
) {
  const ip = getClientIp(req);
  const rl = await checkRateLimit(`rooms:join:${ip}`, 10, 60);
  if (!rl.ok) {
    return NextResponse.json(
      { error: 'Bạn gửi yêu cầu quá nhanh, vui lòng thử lại sau' },
      { status: 429 }
    );
  }

  const { code } = await context.params;
  const resolved = await resolveRoomContext(code, req);
  if (!resolved.ok) return resolved.response;

  const { ctx } = resolved;

  if (ctx.participant) {
    if (ctx.participant.status === 'removed') {
      return NextResponse.json(
        { error: 'Bạn đã bị chủ phòng mời ra khỏi sự kiện này' },
        { status: 403 }
      );
    }
    return NextResponse.json({
      participantId: ctx.participant.id,
      status: ctx.participant.status,
    });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Dữ liệu không hợp lệ' }, { status: 400 });
  }

  const parsed = joinRoomSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Tên không hợp lệ' },
      { status: 400 }
    );
  }

  const isOwner = Boolean(ctx.userId && ctx.userId === ctx.event.ownerId);
  const hasInvite = Boolean(
    parsed.data.inviteToken && parsed.data.inviteToken === ctx.event.inviteToken
  );
  const status =
    ctx.event.visibility === 'link' || isOwner || hasInvite ? 'approved' : 'pending';

  const rawToken = generateSecretToken();
  const tokenHash = hashParticipantToken(rawToken);
  const created = await getStore().createParticipant(
    ctx.event.id,
    tokenHash,
    parsed.data.name,
    status,
    ctx.userId
  );

  return NextResponse.json(
    {
      participantToken: rawToken,
      participantId: created.id,
      status: created.status,
    },
    { status: 201 }
  );
}
