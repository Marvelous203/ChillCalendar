export type Visibility = 'link' | 'private';
export type FinalizePolicy = 'owner_only' | 'any_member';
export type MemberStatus = 'pending' | 'approved' | 'removed';

export interface EventRecord {
  id: string;
  code: string;
  ownerId: string;
  title: string;
  note: string;
  dates: string[]; // YYYY-MM-DD
  hourFrom: number;
  hourTo: number;
  visibility: Visibility;
  finalizePolicy: FinalizePolicy;
  inviteToken: string;
  finalDate: string | null;
  finalFrom: number | null;
  finalTo: number | null;
  finalPlaceId: string | null;
  finalizedBy: string | null;
  finalizedAt: string | null;
  createdAt: string;
}

export interface ParticipantRecord {
  id: string;
  eventId: string;
  tokenHash: string;
  name: string;
  status: MemberStatus;
  createdAt: string;
}

export interface PublicParticipant {
  id: string;
  name: string;
  status: MemberStatus;
  createdAt: string;
}

export interface ResponseRecord {
  eventId: string;
  participantId: string;
  slots: string[]; // YYYY-MM-DDTHH
  updatedAt: string;
}

export interface PlaceRecord {
  id: string;
  eventId: string;
  participantId: string;
  name: string;
  addr: string;
  link: string;
  createdAt: string;
}

export interface PublicPlace extends PlaceRecord {
  voteCount: number;
  votedByMe: boolean;
  voterIds: string[];
}

export interface VoteRecord {
  placeId: string;
  participantId: string;
}

export interface RoomPermissions {
  isOwner: boolean;
  canEditSettings: boolean;
  canManageMembers: boolean;
  canRotateCode: boolean;
  canFinalize: boolean;
  canParticipate: boolean;
}

export interface RoomBundle {
  event: Omit<EventRecord, 'inviteToken' | 'ownerId'> & {
    inviteToken?: string;
  };
  participants: PublicParticipant[];
  responses: Array<{
    participantId: string;
    slots: string[];
    updatedAt: string;
  }>;
  places: PublicPlace[];
  me: PublicParticipant | null;
  permissions: RoomPermissions;
}
