import { VN_TZ } from './timezone';

export interface GCalParams {
  title: string;
  date: string; // YYYY-MM-DD
  fromHour: number;
  toHour: number;
  placeName?: string;
  placeAddr?: string;
  note?: string;
}

function toGCalDateTime(date: string, hour: number): string {
  const compact = date.replace(/-/g, '');
  const hh = String(hour).padStart(2, '0');
  return `${compact}T${hh}0000`;
}

/** Tạo URL Thêm vào Google Calendar theo múi giờ Asia/Ho_Chi_Minh. */
export function buildGoogleCalendarUrl(params: GCalParams): string {
  const start = toGCalDateTime(params.date, params.fromHour);
  const end = toGCalDateTime(params.date, params.toHour);

  const location = [params.placeName, params.placeAddr].filter(Boolean).join(' - ');
  const url = new URL('https://calendar.google.com/calendar/render');
  url.searchParams.set('action', 'TEMPLATE');
  url.searchParams.set('text', params.title);
  url.searchParams.set('dates', `${start}/${end}`);
  url.searchParams.set('ctz', VN_TZ);
  if (location) url.searchParams.set('location', location);
  if (params.note) url.searchParams.set('details', params.note);
  return url.toString();
}
