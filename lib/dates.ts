const WEEKDAYS_VI = ['CN', 'Th 2', 'Th 3', 'Th 4', 'Th 5', 'Th 6', 'Th 7'];

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

/** Tạo key ô giờ chuẩn YYYY-MM-DDTHH. */
export function makeSlotKey(date: string, hour: number): string {
  return `${date}T${String(hour).padStart(2, '0')}`;
}

/** Tách key ô giờ thành { date, hour }. */
export function parseSlotKey(slot: string): { date: string; hour: number } | null {
  const m = /^(\d{4}-\d{2}-\d{2})T(\d{2})$/.exec(slot);
  if (!m) return null;
  const hour = Number(m[2]);
  if (hour < 0 || hour > 23) return null;
  return { date: m[1], hour };
}

/** Định dạng ngày YYYY-MM-DD sang tiếng Việt ngắn gọn: "Th 6, 27/11". */
export function formatDateVi(dateStr: string): { weekday: string; short: string; full: string } {
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
