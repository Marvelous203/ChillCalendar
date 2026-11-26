const ALLOWED_MAPS_HOSTS = new Set([
  'maps.app.goo.gl',
  'goo.gl',
  'google.com',
  'www.google.com',
  'maps.google.com',
  'www.google.vn',
  'google.vn',
]);

/** Kiểm tra và chuẩn hóa link Google Maps; trả null nếu không hợp lệ. */
export function validateGoogleMapsUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return null;
  }
  if (parsed.protocol !== 'https:') return null;
  const host = parsed.hostname.toLowerCase();
  if (!ALLOWED_MAPS_HOSTS.has(host)) return null;

  if (host === 'goo.gl' && !parsed.pathname.startsWith('/maps')) {
    return null;
  }
  if (
    (host === 'google.com' ||
      host === 'www.google.com' ||
      host === 'google.vn' ||
      host === 'www.google.vn') &&
    !parsed.pathname.startsWith('/maps')
  ) {
    return null;
  }

  return parsed.toString();
}

export function extractCoordsFromMapsUrl(
  rawUrl: string
): { lat: number; lng: number } | null {
  if (!rawUrl) return null;
  const pinMatch = /!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/.exec(rawUrl);
  if (pinMatch) {
    return { lat: Number(pinMatch[1]), lng: Number(pinMatch[2]) };
  }
  const atMatch = /@(-?\d+\.\d+),(-?\d+\.\d+)/.exec(rawUrl);
  if (atMatch) {
    return { lat: Number(atMatch[1]), lng: Number(atMatch[2]) };
  }
  const qMatch = /[?&](?:q|query|ll)=(-?\d+\.\d+),(-?\d+\.\d+)/.exec(rawUrl);
  if (qMatch) {
    return { lat: Number(qMatch[1]), lng: Number(qMatch[2]) };
  }
  return null;
}

export function searchMapsUrl(query: string, lat?: number, lng?: number): string {
  if (typeof lat === 'number' && typeof lng === 'number') {
    return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
  }
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query.trim())}`;
}

export function itineraryMapsUrl(
  stops: Array<{
    name: string;
    addr?: string;
    link?: string;
    lat?: number;
    lng?: number;
  }>
): string {
  const validStops = stops.filter((s) => s.name.trim().length > 0);
  if (validStops.length === 0) return 'https://www.google.com/maps';

  const toWaypoint = (s: (typeof validStops)[number]): string => {
    if (typeof s.lat === 'number' && typeof s.lng === 'number') {
      return `${s.lat},${s.lng}`;
    }
    const fromLink = s.link ? extractCoordsFromMapsUrl(s.link) : null;
    if (fromLink) {
      return `${fromLink.lat},${fromLink.lng}`;
    }
    return `${s.name} ${s.addr ?? ''}`.trim();
  };

  if (validStops.length === 1) {
    const s = validStops[0];
    return searchMapsUrl(`${s.name} ${s.addr ?? ''}`.trim(), s.lat, s.lng);
  }

  const points = validStops.map(toWaypoint);
  const url = new URL('https://www.google.com/maps/dir/');
  url.searchParams.set('api', '1');
  url.searchParams.set('origin', points[0]);
  url.searchParams.set('destination', points[points.length - 1]);
  if (points.length > 2) {
    url.searchParams.set('waypoints', points.slice(1, -1).join('|'));
  }
  return url.toString();
}
