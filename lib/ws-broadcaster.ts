import type { EventRecord, LiveCounts, LiveSnapshot, PublicCheckin } from './types';

export type WsRoomMessage =
  | { type: 'snapshot'; data: LiveSnapshot }
  | { type: 'checkin'; data: PublicCheckin; counts: LiveCounts }
  | { type: 'counts'; data: LiveCounts }
  | { type: 'live_started'; data: LiveSnapshot }
  | { type: 'ended'; data: LiveSnapshot }
  | { type: 'pong'; serverTime: string };

export interface WsHub {
  broadcast: (code: string, message: WsRoomMessage) => void;
  scheduleAutoEnd: (event: Pick<EventRecord, 'id' | 'code' | 'liveFrom' | 'endedAt'>) => void;
  cancelAutoEnd: (eventId: string) => void;
}

declare global {
  var __cwmWsHub: WsHub | undefined;
}

export async function broadcastRoomEvent(code: string, message: WsRoomMessage): Promise<void> {
  const hub = globalThis.__cwmWsHub;
  if (hub) {
    hub.broadcast(code, message);
    return;
  }

  // Fallback khi deploy tách Next.js (Vercel) và WS server (VPS/Railway)
  const publishUrl = process.env.WS_INTERNAL_PUBLISH_URL;
  if (!publishUrl) return;

  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (process.env.WS_INTERNAL_SECRET) {
      headers['x-ws-secret'] = process.env.WS_INTERNAL_SECRET;
    }
    await fetch(publishUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({ code, message }),
    });
  } catch {
    // Không làm gián đoạn API nếu WS server tạm thời không phản hồi
  }
}

export function scheduleRoomAutoEnd(
  event: Pick<EventRecord, 'id' | 'code' | 'liveFrom' | 'endedAt'>
): void {
  globalThis.__cwmWsHub?.scheduleAutoEnd(event);
}

export function cancelRoomAutoEnd(eventId: string): void {
  globalThis.__cwmWsHub?.cancelAutoEnd(eventId);
}
