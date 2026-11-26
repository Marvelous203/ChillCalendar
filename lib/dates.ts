const WEEKDAYS_VI = ['CN', 'Th 2', 'Th 3', 'Th 4', 'Th 5', 'Th 6', 'Th 7'];
const WEEKDAY_KEY_LABELS: Record<string, { weekday: string; short: string; full: string }> = {
  W1: { weekday: 'Thứ 2', short: 'T2', full: 'Thứ 2 (linh hoạt)' },
  W2: { weekday: 'Thứ 3', short: 'T3', full: 'Thứ 3 (linh hoạt)' },
  W3: { weekday: 'Thứ 4', short: 'T4', full: 'Thứ 4 (linh hoạt)' },
  W4: { weekday: 'Thứ 5', short: 'T5', full: 'Thứ 5 (linh hoạt)' },
  W5: { weekday: 'Thứ 6', short: 'T6', full: 'Thứ 6 (linh hoạt)' },
  W6: { weekday: 'Thứ 7', short: 'T7', full: 'Thứ 7 (linh hoạt)' },
  W7: { weekday: 'Chủ nhật', short: 'CN', full: 'Chủ nhật (linh hoạt)' },
};

export const WEEKDAY_KEYS = ['W1', 'W2', 'W3', 'W4', 'W5', 'W6', 'W7'] as const;

export function isWeekdayKey(value: string): boolean {
  return /^W[1-7]$/.test(value);
}

export interface DaySession {
  id: 'morning' | 'afternoon' | 'evening';
  label: string;
  from: number;
  to: number;
}

export const DAY_SESSIONS: DaySession[] = [
  { id: 'morning', label: 'Sáng', from: 8, to: 12 },
  { id: 'afternoon', label: 'Chiều', from: 13, to: 17 },
  { id: 'evening', label: 'Tối', from: 18, to: 22 },
];

/** Tạo key ô giờ chuẩn YYYY-MM-DDTHH hoặc W[1-7]THH. */
export function makeSlotKey(date: string, hour: number): string {
  return `${date}T${String(hour).padStart(2, '0')}`;
}

/** Tách key ô giờ thành { date, hour }. */
export function parseSlotKey(slot: string): { date: string; hour: number } | null {
  const m = /^(\d{4}-\d{2}-\d{2}|W[1-7])T(\d{2})$/.exec(slot);
  if (!m) return null;
  const hour = Number(m[2]);
  if (hour < 0 || hour > 23) return null;
  return { date: m[1], hour };
}

/** Định dạng ngày YYYY-MM-DD hoặc W[1-7] sang tiếng Việt ngắn gọn. */
export function formatDateVi(dateStr: string): { weekday: string; short: string; full: string } {
  if (isWeekdayKey(dateStr)) {
    return WEEKDAY_KEY_LABELS[dateStr];
  }
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  const weekday = WEEKDAYS_VI[dt.getUTCDay()];
  const dd = String(d).padStart(2, '0');
  const mm = String(m).padStart(2, '0');
  return {
    weekday,
    short: `${dd}/${mm}`,
    full: `${weekday}, ${dd}/${mm}/${y}`,
  };
}

/** Sinh danh sách các giờ trong khoảng [hourFrom, hourTo). */
export function hoursRange(hourFrom: number, hourTo: number): number[] {
  const out: number[] = [];
  for (let h = hourFrom; h < hourTo; h++) out.push(h);
  return out;
}
