import { makeSlotKey } from './dates';
import type { PublicParticipant } from './types';

export interface SlotSuggestion {
  date: string;
  from: number;
  to: number;
  availableIds: string[];
  busyIds: string[];
  score: number;
}

export interface HeatmapData {
  counts: Record<string, string[]>;
  maxCount: number;
  totalApproved: number;
  top3: SlotSuggestion[];
}

/** Tính lưới nhiệt và Top 3 khung giờ nhiều người rảnh nhất. */
export function computeHeatmapAndTop3(
  dates: string[],
  hourFrom: number,
  hourTo: number,
  participants: PublicParticipant[],
  responses: Array<{ participantId: string; slots: string[] }>
): HeatmapData {
  const approved = participants.filter((p) => p.status === 'approved');
  const approvedIds = new Set(approved.map((p) => p.id));
  const slotMap = new Map<string, Set<string>>();

  for (const r of responses) {
    if (!approvedIds.has(r.participantId)) continue;
    for (const s of r.slots) {
      let set = slotMap.get(s);
      if (!set) {
        set = new Set();
        slotMap.set(s, set);
      }
      set.add(r.participantId);
    }
  }

  const counts: Record<string, string[]> = {};
  let maxCount = 0;
  const singles: SlotSuggestion[] = [];

  for (const date of dates) {
    for (let h = hourFrom; h < hourTo; h++) {
      const key = makeSlotKey(date, h);
      const availSet = slotMap.get(key) ?? new Set<string>();
      const availableIds = approved.filter((p) => availSet.has(p.id)).map((p) => p.id);
      const busyIds = approved.filter((p) => !availSet.has(p.id)).map((p) => p.id);
      counts[key] = availableIds;
      if (availableIds.length > maxCount) maxCount = availableIds.length;
      if (availableIds.length > 0) {
        singles.push({
          date,
          from: h,
          to: h + 1,
          availableIds,
          busyIds,
          score: availableIds.length,
        });
      }
    }
  }

  // Gộp các khung giờ liên tiếp cùng tập người rảnh và cùng điểm cao
  const merged: SlotSuggestion[] = [];
  for (const cur of singles) {
    const prev = merged[merged.length - 1];
    if (
      prev &&
      prev.date === cur.date &&
      prev.to === cur.from &&
      prev.score === cur.score &&
      prev.availableIds.join(',') === cur.availableIds.join(',')
    ) {
      prev.to = cur.to;
    } else {
      merged.push({ ...cur });
    }
  }

  merged.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    const durA = a.to - a.from;
    const durB = b.to - b.from;
    if (durB !== durA) return durB - durA;
    return a.date.localeCompare(b.date) || a.from - b.from;
  });

  return {
    counts,
    maxCount,
    totalApproved: approved.length,
    top3: merged.slice(0, 3),
  };
}
