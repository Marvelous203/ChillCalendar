import { NextResponse } from 'next/server';
import { validateGoogleMapsUrl } from '@/lib/maps';
import { canDeletePlace } from '@/lib/permissions';
import { resolveRoomContext } from '@/lib/room-service';
import { getStore } from '@/lib/store';
import { createPlaceSchema } from '@/lib/validation';

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
      { error: 'Bạn cần vào phòng trước khi đề xuất địa điểm' },
      { status: 403 }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Dữ liệu không hợp lệ' }, { status: 400 });
  }

  const parsed = createPlaceSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Thông tin địa điểm không hợp lệ' },
      { status: 400 }
    );
  }

  const normalizedLink = validateGoogleMapsUrl(parsed.data.link);
  if (normalizedLink === null) {
    return NextResponse.json(
      { error: 'Link Google Maps không hợp lệ' },
      { status: 400 }
    );
  }

  const place = await getStore().createPlace(
    ctx.event.id,
    ctx.participant.id,
    parsed.data.name,
    parsed.data.addr,
    normalizedLink
  );

  return NextResponse.json({ place }, { status: 201 });
}

export async function DELETE(
  req: Request,
  context: { params: Promise<{ code: string }> }
) {
  const { code } = await context.params;
  const resolved = await resolveRoomContext(code, req);
  if (!resolved.ok) return resolved.response;

  const { ctx } = resolved;
  const url = new URL(req.url);
  const placeId = url.searchParams.get('placeId');
  if (!placeId) {
    return NextResponse.json({ error: 'Thiếu placeId' }, { status: 400 });
  }

  const store = getStore();
  const place = await store.getPlaceById(ctx.event.id, placeId);
  if (!place) {
    return NextResponse.json({ error: 'Không tìm thấy địa điểm' }, { status: 404 });
  }

  const isOwner = Boolean(ctx.userId && ctx.userId === ctx.event.ownerId);
  if (!canDeletePlace(isOwner, ctx.participant?.id ?? null, place.participantId)) {
    return NextResponse.json(
      { error: 'Bạn không có quyền xóa địa điểm này' },
      { status: 403 }
    );
  }

  await store.deletePlace(ctx.event.id, placeId);
  return NextResponse.json({ ok: true });
}
