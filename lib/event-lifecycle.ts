import { isWeekdayKey, makeSlotKey } from './dates';
import { todayVN } from './timezone';
import type {
  CheckinRecord,
  EventRecord,
  EventStatus,
  LiveSnapshot,
  ParticipantRecord,
  PublicCheckin,
  ResponseRecord,
} from './types';

export const LIVE_LEAD_MINUTES = 30;
export const LIVE_AUTO_END_HOURS = 24;
const LIVE_AUTO_END_MS = LIVE_AUTO_END_HOURS * 60 * 60 * 1000;

/**
 * Chuyển ngày (YYYY-MM-DD hoặc W[1-7]) + giờ bắt đầu theo giờ VN (UTC+7)
 * thành mốc ISO UTC trừ đi 30 phút để tự động bật chế độ Live.
 */
export function computeLiveFrom(
  finalDate: string,
  finalFrom: number,
  now: Date = new Date()
): string {
  let targetDate = finalDate;
  if (isWeekdayKey(finalDate)) {
    const targetIsoDay = Number(finalDate.slice(1)); // 1=Mon .. 7=Sun
    const todayStr = todayVN(now);
    const [y, m, d] = todayStr.split('-').map(Number);
    const todayUtc = new Date(Date.UTC(y, m - 1, d));
    const currentJsDay = todayUtc.getUTCDay(); // 0=Sun..6=Sat
    const currentIsoDay = currentJsDay === 0 ? 7 : currentJsDay;
    const diff = (targetIsoDay - currentIsoDay + 7) % 7;
    todayUtc.setUTCDate(todayUtc.getUTCDate() + diff);
    targetDate = todayUtc.toISOString().slice(0, 10);
  }

  const hh = String(finalFrom).padStart(2, '0');
  const startMs = Date.parse(`${targetDate}T${hh}:00:00+07:00`);
  if (Number.isNaN(startMs)) {
    return now.toISOString();
  }
  return new Date(startMs - LIVE_LEAD_MINUTES * 60 * 1000).toISOString();
}

export function computeAutoEndAt(liveFrom: string | null): string | null {
  if (!liveFrom) return null;
  const ms = Date.parse(liveFrom);
  if (Number.isNaN(ms)) return null;
  return new Date(ms + LIVE_AUTO_END_MS).toISOString();
}

/** Tính trạng thái vòng đời sự kiện tại thời điểm đọc (không phụ thuộc cron). */
export function computeEventStatus(
  event: Pick<EventRecord, 'finalDate' | 'finalFrom' | 'finalTo' | 'liveFrom' | 'endedAt'>,
  now: Date = new Date()
): EventStatus {
  if (event.endedAt) {
    return 'done';
  }
  const nowMs = now.getTime();
  if (event.liveFrom) {
    const liveMs = Date.parse(event.liveFrom);
    if (!Number.isNaN(liveMs)) {
      if (nowMs >= liveMs + LIVE_AUTO_END_MS) {
        return 'done';
      }
      if (nowMs >= liveMs) {
        return 'live';
      }
    }
  }
  if (event.finalDate && event.finalFrom !== null && event.finalTo !== null) {
    return 'finalized';
  }
  return 'voting';
}

export function buildLiveSnapshot(
  event: EventRecord,
  participants: ParticipantRecord[],
  responses: ResponseRecord[],
  checkins: CheckinRecord[],
  now: Date = new Date()
): LiveSnapshot {
  const status = computeEventStatus(event, now);
  const autoEndAt = computeAutoEndAt(event.liveFrom);
  const endedAt =
    event.endedAt ?? (status === 'done' && autoEndAt ? autoEndAt : null);
  const endedBy = event.endedBy ?? (status === 'done' && !event.endedAt ? 'auto' : null);

  const approvedParticipants = participants.filter((p) => p.status === 'approved');
  const participantById = new Map(approvedParticipants.map((p) => [p.id, p]));

  // Tập slot đã chốt để xác định danh sách người đã hứa "Đi"
  const finalSlotKeys = new Set<string>();
  if (event.finalDate && event.finalFrom !== null && event.finalTo !== null) {
    for (let h = event.finalFrom; h < event.finalTo; h++) {
      finalSlotKeys.add(makeSlotKey(event.finalDate, h));
    }
  }

  const rsvpParticipantIds = new Set<string>();
  if (finalSlotKeys.size > 0) {
    for (const r of responses) {
      if (!participantById.has(r.participantId)) continue;
      if (r.slots.some((s) => finalSlotKeys.has(s))) {
        rsvpParticipantIds.add(r.participantId);
      }
    }
  }

  const publicCheckins: PublicCheckin[] = checkins
    .filter((c) => participantById.has(c.participantId))
    .sort((a, b) => b.checkedInAt.localeCompare(a.checkedInAt))
    .map((c) => ({
      participantId: c.participantId,
      name: participantById.get(c.participantId)!.name,
      checkedInAt: c.checkedInAt,
      note: c.note ?? '',
      photoUrl: c.photoUrl ?? '',
    }));

  const checkedInSet = new Set(publicCheckins.map((c) => c.participantId));
  const notArrived = Array.from(rsvpParticipantIds)
    .filter((id) => !checkedInSet.has(id))
    .map((id) => ({
      participantId: id,
      name: participantById.get(id)!.name,
    }));

  // Người chưa RSVP nhưng vẫn check-in thì y tự tăng để tránh hiện x > y
  const expectedTotal = new Set([...rsvpParticipantIds, ...checkedInSet]).size;

  return {
    code: event.code,
    status,
    liveFrom: event.liveFrom,
    autoEndAt,
    endedAt,
    endedBy,
    counts: {
      checkedIn: publicCheckins.length,
      expected: expectedTotal,
    },
    checkins: publicCheckins,
    notArrived,
    serverTime: now.toISOString(),
  };
}
