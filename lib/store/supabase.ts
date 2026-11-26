import { createClient } from '@supabase/supabase-js';
import type {
  EventRecord,
  ItineraryStop,
  MemberStatus,
  ParticipantRecord,
  PlaceRecord,
  PlaceType,
  ResponseRecord,
} from '../types';
import type {
  CreateEventInput,
  FinalizeInput,
  StoreAdapter,
  UpdateEventInput,
} from './types';

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error('Thiếu NEXT_PUBLIC_SUPABASE_URL hoặc SUPABASE_SERVICE_ROLE_KEY');
  }
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

interface EventRow {
  id: string;
  code: string;
  owner_id: string;
  title: string;
  note: string;
  dates: string[];
  hour_from: number;
  hour_to: number;
  visibility: 'link' | 'private';
  finalize_policy: 'owner_only' | 'any_member';
  invite_token: string;
  final_date: string | null;
  final_from: number | null;
  final_to: number | null;
  final_place: string | null;
  finalized_by: string | null;
  finalized_at: string | null;
  created_at: string;
}

function mapEvent(row: EventRow): EventRecord {
  return {
    id: row.id,
    code: row.code,
    ownerId: row.owner_id,
    title: row.title,
    note: row.note,
    dates: row.dates,
    hourFrom: row.hour_from,
    hourTo: row.hour_to,
    visibility: row.visibility,
    finalizePolicy: row.finalize_policy,
    inviteToken: row.invite_token,
    finalDate: row.final_date,
    finalFrom: row.final_from,
    finalTo: row.final_to,
    finalPlaceId: row.final_place,
    finalizedBy: row.finalized_by,
    finalizedAt: row.finalized_at,
    createdAt: row.created_at,
  };
}

interface ParticipantRow {
  id: string;
  event_id: string;
  user_id?: string | null;
  token_hash: string;
  name: string;
  status: MemberStatus;
  created_at: string;
}

function mapParticipant(row: ParticipantRow): ParticipantRecord {
  return {
    id: row.id,
    eventId: row.event_id,
    userId: row.user_id ?? null,
    tokenHash: row.token_hash,
    name: row.name,
    status: row.status,
    createdAt: row.created_at,
  };
}

export const supabaseStore: StoreAdapter = {
  async countEventsByOwner(ownerId) {
    const sb = getServiceClient();
    const { count, error } = await sb
      .from('events')
      .select('id', { count: 'exact', head: true })
      .eq('owner_id', ownerId);
    if (error) throw error;
    return count ?? 0;
  },

  async listEventsByOwner(ownerId) {
    const sb = getServiceClient();
    const { data, error } = await sb
      .from('events')
      .select('*')
      .eq('owner_id', ownerId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data as EventRow[]).map(mapEvent);
  },

  async listJoinedEventsByUser(userId) {
    const sb = getServiceClient();
    const { data: parts, error: partErr } = await sb
      .from('participants')
      .select('event_id')
      .eq('user_id', userId)
      .neq('status', 'removed');
    if (partErr) throw partErr;
    const ids = Array.from(
      new Set((parts as Array<{ event_id: string }>).map((p) => p.event_id))
    );
    if (ids.length === 0) return [];
    const { data, error } = await sb
      .from('events')
      .select('*')
      .in('id', ids)
      .neq('owner_id', userId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data as EventRow[]).map(mapEvent);
  },

  async getEventByCode(code) {
    const sb = getServiceClient();
    const { data, error } = await sb
      .from('events')
      .select('*')
      .eq('code', code)
      .maybeSingle();
    if (error) throw error;
    return data ? mapEvent(data as EventRow) : null;
  },

  async createEvent(input: CreateEventInput) {
    const sb = getServiceClient();
    const { data, error } = await sb
      .from('events')
      .insert({
        code: input.code,
        owner_id: input.ownerId,
        title: input.title,
        note: input.note,
        dates: [...input.dates].sort(),
        hour_from: input.hourFrom,
        hour_to: input.hourTo,
        visibility: input.visibility,
        finalize_policy: input.finalizePolicy,
        invite_token: input.inviteToken,
      })
      .select('*')
      .single();
    if (error) throw error;
    return mapEvent(data as EventRow);
  },

  async updateEvent(eventId: string, patch: UpdateEventInput) {
    const sb = getServiceClient();
    const payload: Record<string, unknown> = {};
    if (patch.title !== undefined) payload.title = patch.title;
    if (patch.note !== undefined) payload.note = patch.note;
    if (patch.visibility !== undefined) payload.visibility = patch.visibility;
    if (patch.finalizePolicy !== undefined) payload.finalize_policy = patch.finalizePolicy;

    const { data, error } = await sb
      .from('events')
      .update(payload)
      .eq('id', eventId)
      .select('*')
      .maybeSingle();
    if (error) throw error;
    return data ? mapEvent(data as EventRow) : null;
  },

  async deleteEvent(eventId) {
    const sb = getServiceClient();
    const { error } = await sb.from('events').delete().eq('id', eventId);
    if (error) throw error;
  },

  async rotateEventCode(eventId, newCode, newInviteToken) {
    const sb = getServiceClient();
    const payload: Record<string, unknown> = { code: newCode };
    if (newInviteToken) payload.invite_token = newInviteToken;
    const { data, error } = await sb
      .from('events')
      .update(payload)
      .eq('id', eventId)
      .select('*')
      .maybeSingle();
    if (error) throw error;
    return data ? mapEvent(data as EventRow) : null;
  },

  async setFinalize(eventId: string, input: FinalizeInput) {
    const sb = getServiceClient();
    const { data, error } = await sb
      .from('events')
      .update({
        final_date: input.finalDate,
        final_from: input.finalFrom,
        final_to: input.finalTo,
        final_place: input.finalPlaceId,
        finalized_by: input.finalizedBy,
        finalized_at: input.finalizedAt,
      })
      .eq('id', eventId)
      .select('*')
      .maybeSingle();
    if (error) throw error;
    return data ? mapEvent(data as EventRow) : null;
  },

  async listParticipants(eventId) {
    const sb = getServiceClient();
    const { data, error } = await sb
      .from('participants')
      .select('*')
      .eq('event_id', eventId)
      .order('created_at', { ascending: true });
    if (error) throw error;
    return (data as ParticipantRow[]).map(mapParticipant);
  },

  async getParticipantByTokenHash(eventId, tokenHash) {
    const sb = getServiceClient();
    const { data, error } = await sb
      .from('participants')
      .select('*')
      .eq('event_id', eventId)
      .eq('token_hash', tokenHash)
      .maybeSingle();
    if (error) throw error;
    return data ? mapParticipant(data as ParticipantRow) : null;
  },

  async getParticipantByUserId(eventId, userId) {
    const sb = getServiceClient();
    const { data, error } = await sb
      .from('participants')
      .select('*')
      .eq('event_id', eventId)
      .eq('user_id', userId)
      .maybeSingle();
    if (error) throw error;
    return data ? mapParticipant(data as ParticipantRow) : null;
  },

  async getParticipantById(eventId, participantId) {
    const sb = getServiceClient();
    const { data, error } = await sb
      .from('participants')
      .select('*')
      .eq('event_id', eventId)
      .eq('id', participantId)
      .maybeSingle();
    if (error) throw error;
    return data ? mapParticipant(data as ParticipantRow) : null;
  },

  async createParticipant(eventId, tokenHash, name, status, userId = null) {
    const sb = getServiceClient();
    const { data, error } = await sb
      .from('participants')
      .insert({ event_id: eventId, user_id: userId, token_hash: tokenHash, name, status })
      .select('*')
      .single();
    if (error) throw error;
    return mapParticipant(data as ParticipantRow);
  },

  async linkParticipantUser(eventId, participantId, userId) {
    const sb = getServiceClient();
    await sb
      .from('participants')
      .update({ user_id: userId })
      .eq('event_id', eventId)
      .eq('id', participantId)
      .is('user_id', null);
  },

  async updateParticipantStatus(eventId, participantId, status) {
    const sb = getServiceClient();
    const { data, error } = await sb
      .from('participants')
      .update({ status })
      .eq('event_id', eventId)
      .eq('id', participantId)
      .select('*')
      .maybeSingle();
    if (error) throw error;
    return data ? mapParticipant(data as ParticipantRow) : null;
  },

  async listResponses(eventId) {
    const sb = getServiceClient();
    const { data, error } = await sb
      .from('responses')
      .select('*')
      .eq('event_id', eventId);
    if (error) throw error;
    return (data as Array<{ event_id: string; participant_id: string; slots: string[]; updated_at: string }>).map(
      (r): ResponseRecord => ({
        eventId: r.event_id,
        participantId: r.participant_id,
        slots: r.slots,
        updatedAt: r.updated_at,
      })
    );
  },

  async upsertResponse(eventId, participantId, slots) {
    const sb = getServiceClient();
    const updatedAt = new Date().toISOString();
    const { data, error } = await sb
      .from('responses')
      .upsert(
        {
          event_id: eventId,
          participant_id: participantId,
          slots,
          updated_at: updatedAt,
        },
        { onConflict: 'event_id,participant_id' }
      )
      .select('*')
      .single();
    if (error) throw error;
    const row = data as { event_id: string; participant_id: string; slots: string[]; updated_at: string };
    return {
      eventId: row.event_id,
      participantId: row.participant_id,
      slots: row.slots,
      updatedAt: row.updated_at,
    };
  },

  async listPlaces(eventId) {
    const sb = getServiceClient();
    const { data, error } = await sb
      .from('places')
      .select('*')
      .eq('event_id', eventId)
      .order('created_at', { ascending: true });
    if (error) throw error;
    return (
      data as Array<{
        id: string;
        event_id: string;
        participant_id: string;
        type?: PlaceType;
        name: string;
        addr: string;
        link: string;
        image_url?: string;
        note?: string;
        stops?: ItineraryStop[];
        created_at: string;
      }>
    ).map(
      (p): PlaceRecord => ({
        id: p.id,
        eventId: p.event_id,
        participantId: p.participant_id,
        type: p.type ?? 'single',
        name: p.name,
        addr: p.addr,
        link: p.link,
        imageUrl: p.image_url ?? '',
        note: p.note ?? '',
        stops: p.stops ?? [],
        createdAt: p.created_at,
      })
    );
  },

  async getPlaceById(eventId, placeId) {
    const sb = getServiceClient();
    const { data, error } = await sb
      .from('places')
      .select('*')
      .eq('event_id', eventId)
      .eq('id', placeId)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    const p = data as {
      id: string;
      event_id: string;
      participant_id: string;
      type?: PlaceType;
      name: string;
      addr: string;
      link: string;
      image_url?: string;
      note?: string;
      stops?: ItineraryStop[];
      created_at: string;
    };
    return {
      id: p.id,
      eventId: p.event_id,
      participantId: p.participant_id,
      type: p.type ?? 'single',
      name: p.name,
      addr: p.addr,
      link: p.link,
      imageUrl: p.image_url ?? '',
      note: p.note ?? '',
      stops: p.stops ?? [],
      createdAt: p.created_at,
    };
  },

  async createPlace(input) {
    const sb = getServiceClient();
    const { data, error } = await sb
      .from('places')
      .insert({
        event_id: input.eventId,
        participant_id: input.participantId,
        type: input.type,
        name: input.name,
        addr: input.addr,
        link: input.link,
        image_url: input.imageUrl ?? '',
        note: input.note ?? '',
        stops: input.stops ?? [],
      })
      .select('*')
      .single();
    if (error) throw error;
    const p = data as {
      id: string;
      event_id: string;
      participant_id: string;
      type?: PlaceType;
      name: string;
      addr: string;
      link: string;
      image_url?: string;
      note?: string;
      stops?: ItineraryStop[];
      created_at: string;
    };
    return {
      id: p.id,
      eventId: p.event_id,
      participantId: p.participant_id,
      type: p.type ?? 'single',
      name: p.name,
      addr: p.addr,
      link: p.link,
      imageUrl: p.image_url ?? '',
      note: p.note ?? '',
      stops: p.stops ?? [],
      createdAt: p.created_at,
    };
  },

  async deletePlace(eventId, placeId) {
    const sb = getServiceClient();
    const { error } = await sb
      .from('places')
      .delete()
      .eq('event_id', eventId)
      .eq('id', placeId);
    if (error) throw error;
  },

  async listVotesByEvent(eventId) {
    const sb = getServiceClient();
    const { data: placeRows, error: placeErr } = await sb
      .from('places')
      .select('id')
      .eq('event_id', eventId);
    if (placeErr) throw placeErr;
    const placeIds = (placeRows as Array<{ id: string }>).map((r) => r.id);
    if (placeIds.length === 0) return [];
    const { data, error } = await sb
      .from('votes')
      .select('*')
      .in('place_id', placeIds);
    if (error) throw error;
    return (data as Array<{ place_id: string; participant_id: string }>).map((v) => ({
      placeId: v.place_id,
      participantId: v.participant_id,
    }));
  },

  async setVote(placeId, participantId, on) {
    const sb = getServiceClient();
    if (on) {
      const { error } = await sb
        .from('votes')
        .upsert({ place_id: placeId, participant_id: participantId });
      if (error) throw error;
    } else {
      const { error } = await sb
        .from('votes')
        .delete()
        .eq('place_id', placeId)
        .eq('participant_id', participantId);
      if (error) throw error;
    }
  },
};
