import { NextResponse } from 'next/server';
import {
  extractCoordsFromMapsUrl,
  itineraryMapsUrl,
  searchMapsUrl,
  validateGoogleMapsUrl,
} from '@/lib/maps';
import { canDeletePlace } from '@/lib/permissions';
import { resolveRoomContext } from '@/lib/room-service';
import { getStore } from '@/lib/store';
import type { ItineraryStop, PlaceType } from '@/lib/types';
import { createPlaceSchema } from '@/lib/validation';
import type { z } from 'zod';

async function resolveCoordsForStop(
  stop: z.infer<typeof createPlaceSchema>['stops'][number]
): Promise<ItineraryStop> {
  const validLink = validateGoogleMapsUrl(stop.link) ?? '';
  let lat = stop.lat;
  let lng = stop.lng;

  if ((lat === undefined || lng === undefined) && validLink) {
    const direct = extractCoordsFromMapsUrl(validLink);
    if (direct) {
      lat = direct.lat;
      lng = direct.lng;
    } else if (/^https:\/\/(maps\.app\.goo\.gl|goo\.gl)\//.test(validLink)) {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 2500);
        const res = await fetch(validLink, {
          method: 'HEAD',
          redirect: 'follow',
          signal: controller.signal,
        });
        clearTimeout(timer);
        const redirected = extractCoordsFromMapsUrl(res.url);
        if (redirected) {
          lat = redirected.lat;
          lng = redirected.lng;
        }
      } catch {
        // Bỏ qua nếu timeout hoặc offline
      }
    }
  }

  return {
    ...stop,
    lat,
    lng,
    link: validLink || searchMapsUrl(`${stop.name} ${stop.addr}`.trim(), lat, lng),
  };
}

async function normalizePlacePayload(
  data: z.infer<typeof createPlaceSchema>
): Promise<
  | {
      ok: true;
      payload: {
        type: PlaceType;
        name: string;
        addr: string;
        link: string;
        imageUrl: string;
        note: string;
        stops: ItineraryStop[];
      };
    }
  | { ok: false; error: string }
> {
  if (data.type === 'single') {
    const normalizedLink = validateGoogleMapsUrl(data.link);
    if (normalizedLink === null) {
      return { ok: false, error: 'Link Google Maps không hợp lệ' };
    }
    return {
      ok: true,
      payload: {
        type: 'single',
        name: data.name,
        addr: data.addr,
        link: normalizedLink || searchMapsUrl(`${data.name} ${data.addr}`.trim()),
        imageUrl: data.imageUrl,
        note: data.note,
        stops: [],
      },
    };
  }

  const normalizedStops = await Promise.all(data.stops.map(resolveCoordsForStop));
  const title = data.name.trim() || `Lộ trình ${normalizedStops.length} chặng`;
  const dirLink = itineraryMapsUrl(normalizedStops);

  return {
    ok: true,
    payload: {
      type: 'itinerary',
      name: title,
      addr: normalizedStops.map((s) => s.name).join(' → ').slice(0, 160),
      link: dirLink,
      imageUrl: data.imageUrl || normalizedStops.find((s) => s.imageUrl)?.imageUrl || '',
      note: data.note,
      stops: normalizedStops,
    },
  };
}

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

  const normalized = await normalizePlacePayload(parsed.data);
  if (!normalized.ok) {
    return NextResponse.json({ error: normalized.error }, { status: 400 });
  }

  const place = await getStore().createPlace({
    eventId: ctx.event.id,
    participantId: ctx.participant.id,
    ...normalized.payload,
  });

  return NextResponse.json({ place }, { status: 201 });
}

export async function PATCH(
  req: Request,
  context: { params: Promise<{ code: string }> }
) {
  const { code } = await context.params;
  const resolved = await resolveRoomContext(code, req);
  if (!resolved.ok) return resolved.response;

  const { ctx } = resolved;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Dữ liệu không hợp lệ' }, { status: 400 });
  }

  const placeId = typeof (body as { placeId?: unknown })?.placeId === 'string'
    ? (body as { placeId: string }).placeId
    : '';
  if (!placeId) {
    return NextResponse.json({ error: 'Thiếu placeId' }, { status: 400 });
  }

  const store = getStore();
  const existing = await store.getPlaceById(ctx.event.id, placeId);
  if (!existing) {
    return NextResponse.json({ error: 'Không tìm thấy địa điểm' }, { status: 404 });
  }

  const isOwner = Boolean(ctx.userId && ctx.userId === ctx.event.ownerId);
  if (!canDeletePlace(isOwner, ctx.participant?.id ?? null, existing.participantId)) {
    return NextResponse.json(
      { error: 'Bạn không có quyền sửa địa điểm này' },
      { status: 403 }
    );
  }

  const parsed = createPlaceSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Thông tin địa điểm không hợp lệ' },
      { status: 400 }
    );
  }

  const normalized = await normalizePlacePayload(parsed.data);
  if (!normalized.ok) {
    return NextResponse.json({ error: normalized.error }, { status: 400 });
  }

  const updated = await store.updatePlace(ctx.event.id, placeId, normalized.payload);
  return NextResponse.json({ place: updated });
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
