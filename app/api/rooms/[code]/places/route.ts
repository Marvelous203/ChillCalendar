import { NextResponse } from 'next/server';
import { itineraryMapsUrl, searchMapsUrl, validateGoogleMapsUrl } from '@/lib/maps';
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

  const { type, imageUrl, note } = parsed.data;

  if (type === 'single') {
    const normalizedLink = validateGoogleMapsUrl(parsed.data.link);
    if (normalizedLink === null) {
      return NextResponse.json({ error: 'Link Google Maps không hợp lệ' }, { status: 400 });
    }
    const finalLink =
      normalizedLink || searchMapsUrl(`${parsed.data.name} ${parsed.data.addr}`.trim());

    const place = await getStore().createPlace({
      eventId: ctx.event.id,
      participantId: ctx.participant.id,
      type: 'single',
      name: parsed.data.name,
      addr: parsed.data.addr,
      link: finalLink,
      imageUrl,
      note,
      stops: [],
    });
    return NextResponse.json({ place }, { status: 201 });
  }

  const normalizedStops = parsed.data.stops.map((s) => {
    const valid = validateGoogleMapsUrl(s.link);
    return {
      ...s,
      link: valid || searchMapsUrl(`${s.name} ${s.addr}`.trim()),
    };
  });

  const title =
    parsed.data.name.trim() || `Lộ trình ${normalizedStops.length} chặng`;
  const dirLink = itineraryMapsUrl(normalizedStops);

  const place = await getStore().createPlace({
    eventId: ctx.event.id,
    participantId: ctx.participant.id,
    type: 'itinerary',
    name: title,
    addr: normalizedStops.map((s) => s.name).join(' → ').slice(0, 160),
    link: dirLink,
    imageUrl: imageUrl || normalizedStops.find((s) => s.imageUrl)?.imageUrl || '',
    note,
    stops: normalizedStops,
  });

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
