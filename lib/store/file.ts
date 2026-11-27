import { randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import type {
  CheckinRecord,
  EndedBy,
  EventRecord,
  MemberStatus,
  ParticipantRecord,
  PlaceRecord,
  ResponseRecord,
  VoteRecord,
} from '../types';
import type {
  CreateEventInput,
  FinalizeInput,
  StoreAdapter,
  UpdateEventInput,
} from './types';

interface DbShape {
  events: EventRecord[];
  participants: ParticipantRecord[];
  responses: ResponseRecord[];
  places: PlaceRecord[];
  votes: VoteRecord[];
  checkins: CheckinRecord[];
}

const DB_PATH = path.join(process.cwd(), 'data', 'db.json');

let writeLock: Promise<void> = Promise.resolve();

function normalizeEvent(ev: EventRecord): EventRecord {
  return {
    ...ev,
    liveFrom: ev.liveFrom ?? null,
    endedAt: ev.endedAt ?? null,
    endedBy: ev.endedBy ?? null,
  };
}

async function readDb(): Promise<DbShape> {
  try {
    const raw = await fs.readFile(DB_PATH, 'utf8');
    const parsed = JSON.parse(raw) as Partial<DbShape>;
    return {
      events: (parsed.events ?? []).map(normalizeEvent),
      participants: parsed.participants ?? [],
      responses: parsed.responses ?? [],
      places: parsed.places ?? [],
      votes: parsed.votes ?? [],
      checkins: parsed.checkins ?? [],
    };
  } catch {
    return { events: [], participants: [], responses: [], places: [], votes: [], checkins: [] };
  }
}

async function withDb<T>(mutator: (db: DbShape) => T | Promise<T>): Promise<T> {
  const prev = writeLock;
  let release!: () => void;
  writeLock = new Promise<void>((res) => {
    release = res;
  });
  await prev;
  try {
    const db = await readDb();
    const result = await mutator(db);
    await fs.mkdir(path.dirname(DB_PATH), { recursive: true });
    await fs.writeFile(DB_PATH, JSON.stringify(db, null, 2), 'utf8');
    return result;
  } finally {
    release();
  }
}

export const fileStore: StoreAdapter = {
  async countEventsByOwner(ownerId) {
    const db = await readDb();
    return db.events.filter((e) => e.ownerId === ownerId).length;
  },

  async listEventsByOwner(ownerId) {
    const db = await readDb();
    return db.events
      .filter((e) => e.ownerId === ownerId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  async listJoinedEventsByUser(userId) {
    const db = await readDb();
    const joinedEventIds = new Set(
      db.participants
        .filter((p) => p.userId === userId && p.status !== 'removed')
        .map((p) => p.eventId)
    );
    return db.events
      .filter((e) => joinedEventIds.has(e.id) && e.ownerId !== userId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  async getEventByCode(code) {
    const db = await readDb();
    return db.events.find((e) => e.code === code) ?? null;
  },

  async createEvent(input: CreateEventInput) {
    return withDb((db) => {
      const record: EventRecord = {
        id: randomUUID(),
        code: input.code,
        ownerId: input.ownerId,
        title: input.title,
        note: input.note,
        dates: [...input.dates].sort(),
        hourFrom: input.hourFrom,
        hourTo: input.hourTo,
        visibility: input.visibility,
        finalizePolicy: input.finalizePolicy,
        inviteToken: input.inviteToken,
        finalDate: null,
        finalFrom: null,
        finalTo: null,
        finalPlaceId: null,
        finalizedBy: null,
        finalizedAt: null,
        liveFrom: null,
        endedAt: null,
        endedBy: null,
        createdAt: new Date().toISOString(),
      };
      db.events.push(record);
      return record;
    });
  },

  async updateEvent(eventId: string, patch: UpdateEventInput) {
    return withDb((db) => {
      const ev = db.events.find((e) => e.id === eventId);
      if (!ev) return null;
      if (patch.title !== undefined) ev.title = patch.title;
      if (patch.note !== undefined) ev.note = patch.note;
      if (patch.visibility !== undefined) ev.visibility = patch.visibility;
      if (patch.finalizePolicy !== undefined) ev.finalizePolicy = patch.finalizePolicy;
      return { ...ev };
    });
  },

  async deleteEvent(eventId: string) {
    await withDb((db) => {
      db.events = db.events.filter((e) => e.id !== eventId);
      db.participants = db.participants.filter((p) => p.eventId !== eventId);
      db.responses = db.responses.filter((r) => r.eventId !== eventId);
      const removedPlaceIds = new Set(
        db.places.filter((p) => p.eventId === eventId).map((p) => p.id)
      );
      db.places = db.places.filter((p) => p.eventId !== eventId);
      db.votes = db.votes.filter((v) => !removedPlaceIds.has(v.placeId));
      db.checkins = db.checkins.filter((c) => c.eventId !== eventId);
    });
  },

  async rotateEventCode(eventId, newCode, newInviteToken) {
    return withDb((db) => {
      const ev = db.events.find((e) => e.id === eventId);
      if (!ev) return null;
      ev.code = newCode;
      if (newInviteToken) ev.inviteToken = newInviteToken;
      return { ...ev };
    });
  },

  async setFinalize(eventId: string, input: FinalizeInput) {
    return withDb((db) => {
      const ev = db.events.find((e) => e.id === eventId);
      if (!ev) return null;
      ev.finalDate = input.finalDate;
      ev.finalFrom = input.finalFrom;
      ev.finalTo = input.finalTo;
      ev.finalPlaceId = input.finalPlaceId;
      ev.finalizedBy = input.finalizedBy;
      ev.finalizedAt = input.finalizedAt;
      ev.liveFrom = input.liveFrom;
      return { ...ev };
    });
  },

  async listParticipants(eventId) {
    const db = await readDb();
    return db.participants
      .filter((p) => p.eventId === eventId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  },

  async getParticipantByTokenHash(eventId, tokenHash) {
    const db = await readDb();
    return (
      db.participants.find(
        (p) => p.eventId === eventId && p.tokenHash === tokenHash
      ) ?? null
    );
  },

  async getParticipantByUserId(eventId, userId) {
    const db = await readDb();
    return (
      db.participants.find(
        (p) => p.eventId === eventId && p.userId === userId
      ) ?? null
    );
  },

  async getParticipantById(eventId, participantId) {
    const db = await readDb();
    return (
      db.participants.find(
        (p) => p.eventId === eventId && p.id === participantId
      ) ?? null
    );
  },

  async createParticipant(eventId, tokenHash, name, status: MemberStatus, userId = null) {
    return withDb((db) => {
      const existing = db.participants.find(
        (p) =>
          p.eventId === eventId &&
          (p.tokenHash === tokenHash || (userId && p.userId === userId))
      );
      if (existing) return existing;
      const p: ParticipantRecord = {
        id: randomUUID(),
        eventId,
        userId,
        tokenHash,
        name,
        status,
        createdAt: new Date().toISOString(),
      };
      db.participants.push(p);
      return p;
    });
  },

  async linkParticipantUser(eventId, participantId, userId) {
    await withDb((db) => {
      const p = db.participants.find(
        (item) => item.eventId === eventId && item.id === participantId
      );
      if (p && !p.userId) {
        p.userId = userId;
      }
    });
  },

  async updateParticipantStatus(eventId, participantId, status) {
    return withDb((db) => {
      const p = db.participants.find(
        (item) => item.eventId === eventId && item.id === participantId
      );
      if (!p) return null;
      p.status = status;
      return { ...p };
    });
  },

  async listResponses(eventId) {
    const db = await readDb();
    return db.responses.filter((r) => r.eventId === eventId);
  },

  async upsertResponse(eventId, participantId, slots) {
    return withDb((db) => {
      const existing = db.responses.find(
        (r) => r.eventId === eventId && r.participantId === participantId
      );
      const updatedAt = new Date().toISOString();
      if (existing) {
        existing.slots = slots;
        existing.updatedAt = updatedAt;
        return { ...existing };
      }
      const record: ResponseRecord = {
        eventId,
        participantId,
        slots,
        updatedAt,
      };
      db.responses.push(record);
      return record;
    });
  },

  async listPlaces(eventId) {
    const db = await readDb();
    return db.places
      .filter((p) => p.eventId === eventId)
      .map((p) => ({
        ...p,
        type: p.type ?? 'single',
        imageUrl: p.imageUrl ?? '',
        note: p.note ?? '',
        stops: p.stops ?? [],
      }))
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  },

  async getPlaceById(eventId, placeId) {
    const db = await readDb();
    const p = db.places.find((item) => item.eventId === eventId && item.id === placeId);
    if (!p) return null;
    return {
      ...p,
      type: p.type ?? 'single',
      imageUrl: p.imageUrl ?? '',
      note: p.note ?? '',
      stops: p.stops ?? [],
    };
  },

  async createPlace(input) {
    return withDb((db) => {
      const place: PlaceRecord = {
        id: randomUUID(),
        eventId: input.eventId,
        participantId: input.participantId,
        type: input.type,
        name: input.name,
        addr: input.addr,
        link: input.link,
        imageUrl: input.imageUrl ?? '',
        note: input.note ?? '',
        stops: input.stops ?? [],
        createdAt: new Date().toISOString(),
      };
      db.places.push(place);
      return place;
    });
  },

  async updatePlace(eventId, placeId, patch) {
    return withDb((db) => {
      const p = db.places.find((item) => item.eventId === eventId && item.id === placeId);
      if (!p) return null;
      p.type = patch.type;
      p.name = patch.name;
      p.addr = patch.addr;
      p.link = patch.link;
      p.imageUrl = patch.imageUrl ?? '';
      p.note = patch.note ?? '';
      p.stops = patch.stops ?? [];
      return { ...p };
    });
  },

  async deletePlace(eventId, placeId) {
    await withDb((db) => {
      db.places = db.places.filter((p) => !(p.eventId === eventId && p.id === placeId));
      db.votes = db.votes.filter((v) => v.placeId !== placeId);
      for (const ev of db.events) {
        if (ev.id === eventId && ev.finalPlaceId === placeId) {
          ev.finalPlaceId = null;
        }
      }
    });
  },

  async listVotesByEvent(eventId) {
    const db = await readDb();
    const placeIds = new Set(db.places.filter((p) => p.eventId === eventId).map((p) => p.id));
    return db.votes.filter((v) => placeIds.has(v.placeId));
  },

  async setVote(placeId, participantId, on) {
    await withDb((db) => {
      db.votes = db.votes.filter(
        (v) => !(v.placeId === placeId && v.participantId === participantId)
      );
      if (on) {
        db.votes.push({ placeId, participantId });
      }
    });
  },

  async listCheckins(eventId) {
    const db = await readDb();
    return db.checkins
      .filter((c) => c.eventId === eventId)
      .sort((a, b) => b.checkedInAt.localeCompare(a.checkedInAt));
  },

  async upsertCheckin({ eventId, participantId, note, photoUrl }) {
    return withDb((db) => {
      const existing = db.checkins.find(
        (c) => c.eventId === eventId && c.participantId === participantId
      );
      if (existing) {
        if (note !== undefined) existing.note = note;
        if (photoUrl !== undefined) existing.photoUrl = photoUrl;
        return { ...existing };
      }
      const record: CheckinRecord = {
        eventId,
        participantId,
        checkedInAt: new Date().toISOString(),
        leftAt: null,
        note: note ?? '',
        photoUrl: photoUrl ?? '',
      };
      db.checkins.push(record);
      return record;
    });
  },

  async setLiveStartEarly(eventId, liveFromIso) {
    return withDb((db) => {
      const ev = db.events.find((e) => e.id === eventId);
      if (!ev) return null;
      ev.liveFrom = liveFromIso;
      return { ...ev };
    });
  },

  async endEvent(eventId, endedAtIso, endedBy: EndedBy) {
    return withDb((db) => {
      const ev = db.events.find((e) => e.id === eventId);
      if (!ev) return null;
      ev.endedAt = endedAtIso;
      ev.endedBy = endedBy;
      return { ...ev };
    });
  },

  async listActiveLiveEvents() {
    const db = await readDb();
    return db.events.filter((e) => Boolean(e.liveFrom) && !e.endedAt);
  },
};
