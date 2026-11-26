import { NextResponse } from 'next/server';
import { getRoomPermissions } from '@/lib/permissions';
import { resolveRoomContext } from '@/lib/room-service';
import { getStore } from '@/lib/store';
import { updateMemberSchema } from '@/lib/validation';

export async function PATCH(
  req: Request,
  context: { params: Promise<{ code: string; id: string }> }
) {
  const { code, id } = await context.params;
  const resolved = await resolveRoomContext(code, req);
  if (!resolved.ok) return resolved.response;

  const { ctx } = resolved;
  const permissions = getRoomPermissions(ctx.event, ctx.userId, ctx.participant);
  if (!permissions.canManageMembers) {
    return NextResponse.json(
      { error: 'Chỉ chủ sự kiện mới có quyền quản lý thành viên' },
      { status: 403 }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Dữ liệu không hợp lệ' }, { status: 400 });
  }

  const parsed = updateMemberSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Trạng thái thành viên không hợp lệ' }, { status: 400 });
  }

  const updated = await getStore().updateParticipantStatus(
    ctx.event.id,
    id,
    parsed.data.status
  );
  if (!updated) {
    return NextResponse.json({ error: 'Không tìm thấy thành viên' }, { status: 404 });
  }

  return NextResponse.json({
    member: {
      id: updated.id,
      name: updated.name,
      status: updated.status,
      createdAt: updated.createdAt,
    },
  });
}
