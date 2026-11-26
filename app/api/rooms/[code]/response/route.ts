import { NextResponse } from 'next/server';
import { makeSlotKey, parseSlotKey } from '@/lib/dates';
import { resolveRoomContext } from '@/lib/room-service';
import { getStore } from '@/lib/store';
import { saveResponseSchema } from '@/lib/validation';

export async function PUT(
  req: Request,
  context: { params: Promise<{ code: string }> }
) {
  const { code } = await context.params;
  const resolved = await resolveRoomContext(code, req);
  if (!resolved.ok) return resolved.response;

  const { ctx } = resolved;
  if (!ctx.participant || ctx.participant.status !== 'approved') {
    return NextResponse.json(
      { error: 'Bạn cần nhập tên và được duyệt vào phòng trước' },
      { status: 403 }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Dữ liệu không hợp lệ' }, { status: 400 });
  }

  const parsed = saveResponseSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Danh sách giờ không hợp lệ' },
      { status: 400 }
    );
  }

  const allowedDates = new Set(ctx.event.dates);
  const cleanSlots = Array.from(
    new Set(
      parsed.data.slots.filter((s) => {
        const p = parseSlotKey(s);
        return (
          p !== null &&
          allowedDates.has(p.date) &&
          p.hour >= ctx.event.hourFrom &&
          p.hour < ctx.event.hourTo
        );
      })
    )
  ).map((s) => {
    const p = parseSlotKey(s)!;
    return makeSlotKey(p.date, p.hour);
  });

  const saved = await getStore().upsertResponse(
    ctx.event.id,
    ctx.participant.id,
    cleanSlots
  );

  return NextResponse.json({ slots: saved.slots, updatedAt: saved.updatedAt });
}
