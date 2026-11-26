export const VN_TZ = 'Asia/Ho_Chi_Minh';

const vnDateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: VN_TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** Trả về ngày hiện tại theo múi giờ Việt Nam (YYYY-MM-DD). */
export function todayVN(now: Date = new Date()): string {
  return vnDateFormatter.format(now);
}

/** Kiểm tra chuỗi ngày YYYY-MM-DD có nằm trong quá khứ so với hôm nay (UTC+7) không. */
export function isPastDateVN(dateStr: string, now: Date = new Date()): boolean {
  return dateStr < todayVN(now);
}

/** Định dạng giờ hiển thị (vd: 08:00). */
export function formatHour(hour: number): string {
  return `${String(hour).padStart(2, '0')}:00`;
}
