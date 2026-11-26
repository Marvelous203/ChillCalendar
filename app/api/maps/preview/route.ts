import { NextResponse } from 'next/server';
import { validateGoogleMapsUrl } from '@/lib/maps';
import { checkRateLimit, getClientIp } from '@/lib/ratelimit';

function extractMeta(html: string, property: string): string {
  const patterns = [
    new RegExp(
      `<meta[^>]+(?:property|name)=["']${property}["'][^>]+content=["']([^"']+)["']`,
      'i'
    ),
    new RegExp(
      `<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${property}["']`,
      'i'
    ),
  ];
  for (const re of patterns) {
    const m = re.exec(html);
    if (m?.[1]) {
      return m[1].replace(/&amp;/g, '&').trim();
    }
  }
  return '';
}

export async function POST(req: Request) {
  const ip = getClientIp(req);
  const rl = await checkRateLimit(`maps:preview:${ip}`, 20, 60);
  if (!rl.ok) {
    return NextResponse.json({ error: 'Thử lại sau ít phút' }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Dữ liệu không hợp lệ' }, { status: 400 });
  }

  const rawUrl = typeof (body as { url?: unknown })?.url === 'string'
    ? (body as { url: string }).url
    : '';
  const safeUrl = validateGoogleMapsUrl(rawUrl);
  if (!safeUrl) {
    return NextResponse.json({ error: 'Link Google Maps không hợp lệ' }, { status: 400 });
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4500);
    const res = await fetch(safeUrl, {
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (compatible; ChillWithMeBot/1.0; +https://chillwithme.local)',
        'Accept-Language': 'vi-VN,vi;q=0.9,en;q=0.8',
      },
    });
    clearTimeout(timer);

    if (!res.ok) {
      return NextResponse.json({ imageUrl: '', title: '' });
    }

    const html = await res.text();
    const rawImg = extractMeta(html, 'og:image');
    const title = extractMeta(html, 'og:title');
    const imageUrl = rawImg.startsWith('https://') ? rawImg.slice(0, 500) : '';

    return NextResponse.json({ imageUrl, title });
  } catch {
    return NextResponse.json({ imageUrl: '', title: '' });
  }
}
