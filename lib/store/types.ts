import type {
  CheckinRecord,
  EndedBy,
  EventRecord,
  FinalizePolicy,
  ItineraryStop,
  LiveMomentRecord,
  MemberStatus,
  MomentReactionRecord,
  ParticipantRecord,
  PlaceRecord,
  PlaceType,
  ReactionEmoji,
  ResponseRecord,
  Visibility,
  VoteRecord,
} from '../types';

export interface CreateEventInput {
  code: string;
  ownerId: string;
  title: string;
  note: string;
  dates: string[];
  hourFrom: number;
  hourTo: number;
  visibility: Visibility;
  finalizePolicy: FinalizePolicy;
  inviteToken: string;
}

export interface UpdateEventInput {
  title?: string;
  note?: string;
  visibility?: Visibility;
  finalizePolicy?: FinalizePolicy;
}

export interface FinalizeInput {
  finalDate: string | null;
  finalFrom: number | null;
  finalTo: number | null;
  finalPlaceId: string | null;
  finalizedBy: string | null;
  finalizedAt: string | null;
  liveFrom: string | null;
}

export interface StoreAdapter {
  countEventsByOwner(ownerId: string): Promise<number>;
  listEventsByOwner(ownerId: string): Promise<EventRecord[]>;
  listJoinedEventsByUser(userId: string): Promise<EventRecord[]>;
  getEventByCode(code: string): Promise<EventRecord | null>;
  createEvent(input: CreateEventInput): Promise<EventRecord>;
  updateEvent(eventId: string, patch: UpdateEventInput): Promise<EventRecord | null>;
  deleteEvent(eventId: string): Promise<void>;
  rotateEventCode(eventId: string, newCode: string, newInviteToken?: string): Promise<EventRecord | null>;
  setFinalize(eventId: string, input: FinalizeInput): Promise<EventRecord | null>;

  listParticipants(eventId: string): Promise<ParticipantRecord[]>;
  getParticipantByTokenHash(eventId: string, tokenHash: string): Promise<ParticipantRecord | null>;
  getParticipantByUserId(eventId: string, userId: string): Promise<ParticipantRecord | null>;
  getParticipantById(eventId: string, participantId: string): Promise<ParticipantRecord | null>;
  createParticipant(
    eventId: string,
    tokenHash: string,
    name: string,
    status: MemberStatus,
    userId?: string | null
  ): Promise<ParticipantRecord>;
  linkParticipantUser(eventId: string, participantId: string, userId: string): Promise<void>;
  updateParticipantStatus(
    eventId: string,
    participantId: string,
    status: MemberStatus
  ): Promise<ParticipantRecord | null>;

  listResponses(eventId: string): Promise<ResponseRecord[]>;
  upsertResponse(eventId: string, participantId: string, slots: string[]): Promise<ResponseRecord>;

  listPlaces(eventId: string): Promise<PlaceRecord[]>;
  getPlaceById(eventId: string, placeId: string): Promise<PlaceRecord | null>;
  createPlace(input: {
    eventId: string;
    participantId: string;
    type: PlaceType;
    name: string;
    addr: string;
    link: string;
    imageUrl?: string;
    note?: string;
    stops?: ItineraryStop[];
  }): Promise<PlaceRecord>;
  updatePlace(
    eventId: string,
    placeId: string,
    patch: {
      type: PlaceType;
      name: string;
      addr: string;
      link: string;
      imageUrl?: string;
      note?: string;
      stops?: ItineraryStop[];
    }
  ): Promise<PlaceRecord | null>;
  deletePlace(eventId: string, placeId: string): Promise<void>;

  listVotesByEvent(eventId: string): Promise<VoteRecord[]>;
  setVote(placeId: string, participantId: string, on: boolean): Promise<void>;

  listCheckins(eventId: string): Promise<CheckinRecord[]>;
  upsertCheckin(input: {
    eventId: string;
    participantId: string;
    note?: string;
    photoUrl?: string;
  }): Promise<CheckinRecord>;
  setLiveStartEarly(eventId: string, liveFromIso: string): Promise<EventRecord | null>;
  endEvent(eventId: string, endedAtIso: string, endedBy: EndedBy): Promise<EventRecord | null>;
  listActiveLiveEvents(): Promise<EventRecord[]>;

  listMoments(eventId: string): Promise<LiveMomentRecord[]>;
  createMoment(input: {
    eventId: string;
    participantId: string;
    photoUrl: string;
    caption: string;
    sticker?: string;
  }): Promise<LiveMomentRecord>;
  setMomentPinned(eventId: string, momentId: string, pinned: boolean): Promise<LiveMomentRecord | null>;
  deleteMoment(eventId: string, momentId: string): Promise<void>;

  listMomentReactions(eventId: string): Promise<MomentReactionRecord[]>;
  setMomentReaction(
    momentId: string,
    participantId: string,
    emoji: ReactionEmoji,
    mode: 'toggle' | 'set'
  ): Promise<{ active: boolean }>;

  getAppStarStatus(voterKey: string | null): Promise<{
    count: number;
    starred: boolean;
    recentLogs: Array<{ name: string; createdAt: string }>;
  }>;
  toggleAppStar(
    voterKey: string,
    displayName: string
  ): Promise<{
    count: number;
    starred: boolean;
    recentLogs: Array<{ name: string; createdAt: string }>;
  }>;
}
