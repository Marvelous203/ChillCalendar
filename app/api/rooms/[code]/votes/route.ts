import { NextResponse } from 'next/server';
import { resolveRoomContext } from '@/lib/room-service';
import { getStore } from '@/lib/store';
import { votePlaceSchema } from '@/lib/validation';

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
      { error: 'Bạn cần vào phòng trước khi bình chọn' },
      { status: 403 }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Dữ liệu không hợp lệ' }, { status: 400 });
  }

  const parsed = votePlaceSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Dữ liệu bình chọn không hợp lệ' }, { status: 400 });
  }

  const store = getStore();
  const place = await store.getPlaceById(ctx.event.id, parsed.data.placeId);
  if (!place) {
    return NextResponse.json({ error: 'Địa điểm không tồn tại' }, { status: 404 });
  }

  await store.setVote(place.id, ctx.participant.id, parsed.data.on);
  return NextResponse.json({ ok: true });
}
