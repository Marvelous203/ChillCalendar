import { NextResponse } from 'next/server';
import { generateSecretToken } from '@/lib/auth';
import { getRoomPermissions } from '@/lib/permissions';
import { newRoomCode } from '@/lib/room-code';
import { buildRoomBundle, resolveRoomContext } from '@/lib/room-service';
import { getStore } from '@/lib/store';

export async function POST(
  req: Request,
  context: { params: Promise<{ code: string }> }
) {
  const { code } = await context.params;
  const resolved = await resolveRoomContext(code, req);
  if (!resolved.ok) return resolved.response;

  const { ctx } = resolved;
  const permissions = getRoomPermissions(ctx.event, ctx.userId, ctx.participant);
  if (!permissions.canRotateCode) {
    return NextResponse.json(
      { error: 'Chỉ chủ sự kiện mới có quyền đổi mã phòng' },
      { status: 403 }
    );
  }

  let rotateInvite = false;
  try {
    const body = (await req.json()) as { rotateInvite?: boolean };
    rotateInvite = Boolean(body?.rotateInvite);
  } catch {
    // body tùy chọn
  }

  const store = getStore();
  let nextCode = newRoomCode(6);
  for (let i = 0; i < 5; i++) {
    const exists = await store.getEventByCode(nextCode);
    if (!exists) break;
    nextCode = newRoomCode(6);
  }

  const updated = await store.rotateEventCode(
    ctx.event.id,
    nextCode,
    rotateInvite ? generateSecretToken() : undefined
  );

  if (!updated) {
    return NextResponse.json({ error: 'Không tìm thấy phòng' }, { status: 404 });
  }

  const bundle = await buildRoomBundle({ ...ctx, event: updated });
  return NextResponse.json(bundle);
}
