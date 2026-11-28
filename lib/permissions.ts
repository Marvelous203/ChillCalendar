import { computeEventStatus } from './event-lifecycle';
import type { EventRecord, ParticipantRecord, RoomPermissions } from './types';

/** Nguồn sự thật duy nhất về phân quyền trong phòng. */
export function getRoomPermissions(
  event: Pick<
    EventRecord,
    'ownerId' | 'visibility' | 'finalizePolicy' | 'finalDate' | 'finalFrom' | 'finalTo' | 'liveFrom' | 'endedAt'
  >,
  userId: string | null,
  participant: Pick<ParticipantRecord, 'status'> | null
): RoomPermissions {
  const isOwner = Boolean(userId && userId === event.ownerId);
  const isApprovedMember = participant?.status === 'approved';
  const canParticipate = isOwner || isApprovedMember;
  const status = computeEventStatus(event);

  const canFinalize =
    status !== 'live' &&
    status !== 'done' &&
    (isOwner || (event.finalizePolicy === 'any_member' && isApprovedMember));

  const canCheckin = status === 'live' && isApprovedMember;
  const canStartEarly = status === 'finalized' && isOwner;
  const canEndLive = status === 'live' && isOwner;

  return {
    isOwner,
    canEditSettings: isOwner,
    canManageMembers: isOwner,
    canRotateCode: isOwner,
    canFinalize,
    canParticipate,
    canCheckin,
    canStartEarly,
    canEndLive,
  };
}

export function canDeletePlace(
  isOwner: boolean,
  participantId: string | null,
  placeOwnerId: string
): boolean {
  if (isOwner) return true;
  return Boolean(participantId && participantId === placeOwnerId);
}
