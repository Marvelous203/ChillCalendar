import type { EventRecord, ParticipantRecord, RoomPermissions } from './types';

/** Nguồn sự thật duy nhất về phân quyền trong phòng. */
export function getRoomPermissions(
  event: Pick<EventRecord, 'ownerId' | 'visibility' | 'finalizePolicy'>,
  userId: string | null,
  participant: Pick<ParticipantRecord, 'status'> | null
): RoomPermissions {
  const isOwner = Boolean(userId && userId === event.ownerId);
  const isApprovedMember = participant?.status === 'approved';
  const canParticipate = isOwner || isApprovedMember;

  const canFinalize =
    isOwner ||
    (event.finalizePolicy === 'any_member' && isApprovedMember);

  return {
    isOwner,
    canEditSettings: isOwner,
    canManageMembers: isOwner,
    canRotateCode: isOwner,
    canFinalize,
    canParticipate,
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
