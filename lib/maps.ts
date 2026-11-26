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

export function searchMapsUrl(query: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query.trim())}`;
}

export function itineraryMapsUrl(
  stops: Array<{ name: string; addr?: string }>
): string {
  const validStops = stops.filter((s) => s.name.trim().length > 0);
  if (validStops.length === 0) return 'https://www.google.com/maps';
  if (validStops.length === 1) {
    return searchMapsUrl(`${validStops[0].name} ${validStops[0].addr ?? ''}`.trim());
  }
  const waypoints = validStops
    .map((s) => encodeURIComponent(`${s.name} ${s.addr ?? ''}`.trim()))
    .join('/');
  return `https://www.google.com/maps/dir/${waypoints}`;
}
