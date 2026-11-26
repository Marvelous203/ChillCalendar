import { NextResponse } from 'next/server';
import { getAuthUser, getParticipantTokenFromRequest, hashParticipantToken } from './auth';
import { getRoomPermissions } from './permissions';
import { isValidCode, normalizeCode } from './room-code';
import { getStore } from './store';
import type { EventRecord, ParticipantRecord, PublicParticipant, RoomBundle } from './types';

export interface RoomContext {
  event: EventRecord;
  userId: string | null;
  participant: ParticipantRecord | null;
}

export async function resolveRoomContext(
  rawCode: string,
  req: Request
): Promise<
  | { ok: true; ctx: RoomContext }
  | { ok: false; response: NextResponse }
> {
  const code = normalizeCode(rawCode);
  if (!isValidCode(code)) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Mã phòng không hợp lệ' }, { status: 400 }),
    };
  }

  const store = getStore();
  const [event, user] = await Promise.all([
    store.getEventByCode(code),
    getAuthUser(),
  ]);
  if (!event) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Không tìm thấy phòng' }, { status: 404 }),
    };
  }

  const token = getParticipantTokenFromRequest(req);
  let participant = token
    ? await store.getParticipantByTokenHash(event.id, hashParticipantToken(token))
    : null;

  if (participant && user && participant.userId && participant.userId !== user.id) {
    participant = null;
  }
  if (!participant && user) {
    participant = await store.getParticipantByUserId(event.id, user.id);
  }
  if (participant && user && !participant.userId) {
    await store.linkParticipantUser(event.id, participant.id, user.id);
    participant = { ...participant, userId: user.id };
  }

  return {
    ok: true,
    ctx: { event, userId: user?.id ?? null, participant },
  };
}

function toPublicParticipant(p: ParticipantRecord): PublicParticipant {
  return {
    id: p.id,
    name: p.name,
    status: p.status,
    createdAt: p.createdAt,
  };
}

export async function buildRoomBundle(ctx: RoomContext): Promise<RoomBundle> {
  const store = getStore();
  const [participants, responses, places, votes] = await Promise.all([
    store.listParticipants(ctx.event.id),
    store.listResponses(ctx.event.id),
    store.listPlaces(ctx.event.id),
    store.listVotesByEvent(ctx.event.id),
  ]);

  const permissions = getRoomPermissions(ctx.event, ctx.userId, ctx.participant);
  const visibleParticipants = permissions.isOwner
    ? participants.filter((p) => p.status !== 'removed')
    : participants.filter((p) => p.status === 'approved');

  const votesByPlace = new Map<string, string[]>();
  for (const v of votes) {
    const arr = votesByPlace.get(v.placeId) ?? [];
    arr.push(v.participantId);
    votesByPlace.set(v.placeId, arr);
  }

  const meId = ctx.participant?.id ?? null;

  return {
    event: {
      id: ctx.event.id,
      code: ctx.event.code,
      title: ctx.event.title,
      note: ctx.event.note,
      dates: ctx.event.dates,
      hourFrom: ctx.event.hourFrom,
      hourTo: ctx.event.hourTo,
      visibility: ctx.event.visibility,
      finalizePolicy: ctx.event.finalizePolicy,
      ...(permissions.isOwner ? { inviteToken: ctx.event.inviteToken } : {}),
      finalDate: ctx.event.finalDate,
      finalFrom: ctx.event.finalFrom,
      finalTo: ctx.event.finalTo,
      finalPlaceId: ctx.event.finalPlaceId,
      finalizedBy: ctx.event.finalizedBy,
      finalizedAt: ctx.event.finalizedAt,
      createdAt: ctx.event.createdAt,
    },
    participants: visibleParticipants.map(toPublicParticipant),
    responses: responses.map((r) => ({
      participantId: r.participantId,
      slots: r.slots,
      updatedAt: r.updatedAt,
    })),
    places: places.map((p) => {
      const voterIds = votesByPlace.get(p.id) ?? [];
      return {
        ...p,
        voteCount: voterIds.length,
        votedByMe: Boolean(meId && voterIds.includes(meId)),
        voterIds,
      };
    }),
    me: ctx.participant ? toPublicParticipant(ctx.participant) : null,
    permissions,
  };
}
