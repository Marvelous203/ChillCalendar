import { NextResponse } from 'next/server';
import { generateSecretToken, hashParticipantToken } from '@/lib/auth';
import { getRoomPermissions } from '@/lib/permissions';
import { getUserDisplayName } from '@/lib/profile';
import { checkRateLimit, getClientIp } from '@/lib/ratelimit';
import { buildRoomBundle, resolveRoomContext } from '@/lib/room-service';
import { getStore } from '@/lib/store';
import { updateRoomSchema } from '@/lib/validation';

export async function GET(
  req: Request,
  context: { params: Promise<{ code: string }> }
) {
  const ip = getClientIp(req);
  const rl = await checkRateLimit(`rooms:get:${ip}`, 30, 60);
  if (!rl.ok) {
    return NextResponse.json({ error: 'Quá nhiều yêu cầu, vui lòng thử lại sau' }, { status: 429 });
  }

  const { code } = await context.params;
  const resolved = await resolveRoomContext(code, req);
  if (!resolved.ok) return resolved.response;

  const { ctx } = resolved;
  const url = new URL(req.url);
  const inviteQuery = url.searchParams.get('i');
  const hasValidInvite = Boolean(inviteQuery && inviteQuery === ctx.event.inviteToken);
  const permissions = getRoomPermissions(ctx.event, ctx.userId, ctx.participant);

  if (
    ctx.event.visibility === 'private' &&
    !permissions.isOwner &&
    !hasValidInvite &&
    ctx.participant?.status !== 'approved'
  ) {
    return NextResponse.json(
      {
        private: true,
        pending: ctx.participant?.status === 'pending',
        removed: ctx.participant?.status === 'removed',
      },
      { status: 403 }
    );
  }

  let activeCtx = ctx;
  let autoParticipantToken: string | undefined;

  // Nếu người dùng đã đăng nhập và phòng cho phép vào ngay, tự động tham gia bằng tên hiển thị
  if (
    !activeCtx.participant &&
    activeCtx.user &&
    (activeCtx.event.visibility === 'link' || permissions.isOwner || hasValidInvite)
  ) {
    const displayName = await getUserDisplayName(activeCtx.user);
    const rawToken = generateSecretToken();
    const created = await getStore().createParticipant(
      activeCtx.event.id,
      hashParticipantToken(rawToken),
      displayName,
      'approved',
      activeCtx.user.id
    );
    activeCtx = { ...activeCtx, participant: created };
    autoParticipantToken = rawToken;
  }

  const bundle = await buildRoomBundle(activeCtx);
  if (autoParticipantToken) {
    bundle.autoParticipantToken = autoParticipantToken;
  }
  return NextResponse.json(bundle);
}

export async function PATCH(
  req: Request,
  context: { params: Promise<{ code: string }> }
) {
  const { code } = await context.params;
  const resolved = await resolveRoomContext(code, req);
  if (!resolved.ok) return resolved.response;

  const { ctx } = resolved;
  const permissions = getRoomPermissions(ctx.event, ctx.userId, ctx.participant);
  if (!permissions.canEditSettings) {
    return NextResponse.json({ error: 'Chỉ chủ sự kiện mới có quyền sửa cài đặt' }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Dữ liệu không hợp lệ' }, { status: 400 });
  }

  const parsed = updateRoomSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Dữ liệu không hợp lệ' },
      { status: 400 }
    );
  }

  const updated = await getStore().updateEvent(ctx.event.id, parsed.data);
  if (!updated) {
    return NextResponse.json({ error: 'Không tìm thấy phòng' }, { status: 404 });
  }

  const bundle = await buildRoomBundle({ ...ctx, event: updated });
  return NextResponse.json(bundle);
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
  if (!permissions.isOwner) {
    return NextResponse.json({ error: 'Chỉ chủ sự kiện mới được xóa phòng' }, { status: 403 });
  }

  await getStore().deleteEvent(ctx.event.id);
  return NextResponse.json({ ok: true });
}
