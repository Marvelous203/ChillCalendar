import { NextResponse } from 'next/server';
import { getRoomPermissions } from '@/lib/permissions';
import { buildRoomBundle, resolveRoomContext } from '@/lib/room-service';
import { getStore } from '@/lib/store';
import { finalizeRoomSchema } from '@/lib/validation';

export async function POST(
  req: Request,
  context: { params: Promise<{ code: string }> }
) {
  const { code } = await context.params;
  const resolved = await resolveRoomContext(code, req);
  if (!resolved.ok) return resolved.response;

  const { ctx } = resolved;
  const permissions = getRoomPermissions(ctx.event, ctx.userId, ctx.participant);
  if (!permissions.canFinalize) {
    return NextResponse.json(
      { error: 'Bạn không có quyền chốt lịch trong phòng này' },
      { status: 403 }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Dữ liệu không hợp lệ' }, { status: 400 });
  }

  const parsed = finalizeRoomSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Thông tin chốt lịch không hợp lệ' },
      { status: 400 }
    );
  }

  const store = getStore();
  if (!ctx.event.dates.includes(parsed.data.date)) {
    return NextResponse.json({ error: 'Ngày chốt không nằm trong sự kiện' }, { status: 400 });
  }

  let finalPlaceId: string | null = null;
  if (parsed.data.placeId) {
    const place = await store.getPlaceById(ctx.event.id, parsed.data.placeId);
    if (!place) {
      return NextResponse.json({ error: 'Địa điểm chốt không tồn tại' }, { status: 404 });
    }
    finalPlaceId = place.id;
  }

  const actorName = ctx.participant?.name ?? (permissions.isOwner ? 'Chủ sự kiện' : 'Thành viên');

  const updated = await store.setFinalize(ctx.event.id, {
    finalDate: parsed.data.date,
    finalFrom: parsed.data.from,
    finalTo: parsed.data.to,
    finalPlaceId,
    finalizedBy: actorName,
    finalizedAt: new Date().toISOString(),
  });

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
  if (!permissions.canFinalize) {
    return NextResponse.json(
      { error: 'Bạn không có quyền bỏ chốt lịch' },
      { status: 403 }
    );
  }

  const updated = await getStore().setFinalize(ctx.event.id, {
    finalDate: null,
    finalFrom: null,
    finalTo: null,
    finalPlaceId: null,
    finalizedBy: null,
    finalizedAt: null,
  });

  if (!updated) {
    return NextResponse.json({ error: 'Không tìm thấy phòng' }, { status: 404 });
  }

  const bundle = await buildRoomBundle({ ...ctx, event: updated });
  return NextResponse.json(bundle);
}
