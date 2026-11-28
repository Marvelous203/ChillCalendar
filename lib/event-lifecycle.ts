import { isWeekdayKey, makeSlotKey } from './dates';
import { todayVN } from './timezone';
import type {
  CheckinRecord,
  EventRecord,
  EventStatus,
  LiveMomentRecord,
  LiveSnapshot,
  ParticipantRecord,
  PublicCheckin,
  PublicMoment,
  ResponseRecord,
  TimelineEntry,
  TimelinePage,
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
  moments: LiveMomentRecord[] = [],
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

  const momentsByParticipant = new Map<string, PublicMoment[]>();
  for (const m of moments) {
    if (!participantById.has(m.participantId)) continue;
    const arr = momentsByParticipant.get(m.participantId) ?? [];
    arr.push({
      id: m.id,
      participantId: m.participantId,
      photoUrl: m.photoUrl,
      caption: m.caption,
      createdAt: m.createdAt,
    });
    momentsByParticipant.set(m.participantId, arr);
  }
  for (const arr of momentsByParticipant.values()) {
    arr.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  const publicCheckins: PublicCheckin[] = checkins
    .filter((c) => participantById.has(c.participantId))
    .sort((a, b) => b.checkedInAt.localeCompare(a.checkedInAt))
    .map((c) => {
      const userMoments = momentsByParticipant.get(c.participantId) ?? [];
      // Tương thích ngược nếu có ảnh cũ trong checkins.photoUrl mà chưa nằm trong moments
      const mergedMoments: PublicMoment[] =
        userMoments.length > 0
          ? userMoments
          : c.photoUrl
            ? [
                {
                  id: `checkin-${c.participantId}`,
                  participantId: c.participantId,
                  photoUrl: c.photoUrl,
                  caption: c.note ?? '',
                  createdAt: c.checkedInAt,
                },
              ]
            : [];
      const latestMoment = mergedMoments[0];
      return {
        participantId: c.participantId,
        name: participantById.get(c.participantId)!.name,
        checkedInAt: c.checkedInAt,
        note: c.note || latestMoment?.caption || '',
        photoUrl: latestMoment?.photoUrl || c.photoUrl || '',
        moments: mergedMoments,
      };
    });

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

/** Hợp nhất check-in và ảnh khoảnh khắc thành dòng thời gian phân trang theo con trỏ. */
export function buildTimelinePage(
  participants: ParticipantRecord[],
  checkins: CheckinRecord[],
  moments: LiveMomentRecord[],
  opts: {
    order?: 'asc' | 'desc';
    cursor?: string | null;
    limit?: number;
    participantId?: string | null;
  } = {}
): TimelinePage {
  const order = opts.order === 'asc' ? 'asc' : 'desc';
  const limit = Math.max(1, Math.min(50, opts.limit ?? 20));
  const participantById = new Map(
    participants.filter((p) => p.status === 'approved').map((p) => [p.id, p])
  );

  const items: TimelineEntry[] = [];

  for (const c of checkins) {
    const p = participantById.get(c.participantId);
    if (!p) continue;
    if (opts.participantId && c.participantId !== opts.participantId) continue;
    items.push({
      id: `checkin:${c.participantId}`,
      kind: 'checkin',
      timestamp: c.checkedInAt,
      participantId: c.participantId,
      name: p.name,
      note: c.note ?? '',
    });
  }

  for (const m of moments) {
    const p = participantById.get(m.participantId);
    if (!p) continue;
    if (opts.participantId && m.participantId !== opts.participantId) continue;
    items.push({
      id: `moment:${m.id}`,
      kind: 'moment',
      timestamp: m.createdAt,
      participantId: m.participantId,
      name: p.name,
      photoUrl: m.photoUrl,
      caption: m.caption ?? '',
    });
  }

  items.sort((a, b) =>
    order === 'desc'
      ? b.timestamp.localeCompare(a.timestamp)
      : a.timestamp.localeCompare(b.timestamp)
  );

  const filtered = opts.cursor
    ? items.filter((item) =>
        order === 'desc'
          ? item.timestamp < opts.cursor!
          : item.timestamp > opts.cursor!
      )
    : items;

  const pageItems = filtered.slice(0, limit);
  const hasMore = filtered.length > limit;
  const nextCursor =
    hasMore && pageItems.length > 0
      ? pageItems[pageItems.length - 1].timestamp
      : null;

  return {
    items: pageItems,
    nextCursor,
    hasMore,
  };
}
