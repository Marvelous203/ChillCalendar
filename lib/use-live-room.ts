'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { getParticipantToken } from '@/lib/participant-token';
import type { EventStatus, LiveSnapshot } from '@/lib/types';
import type { WsRoomMessage } from '@/lib/ws-broadcaster';

export type LiveConnectionMode = 'idle' | 'connecting' | 'ws' | 'polling';

interface UseLiveRoomOptions {
  code: string;
  status: EventStatus;
  initialSnapshot: LiveSnapshot;
  onStatusChange?: (nextStatus: EventStatus) => void;
}

function buildWsUrl(code: string, pt: string): string {
  const configuredBase = process.env.NEXT_PUBLIC_WS_URL?.trim();
  if (configuredBase) {
    const clean = configuredBase.replace(/\/+$/, '');
    return `${clean}/ws/rooms/${code}?pt=${encodeURIComponent(pt)}`;
  }
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${proto}//${window.location.host}/ws/rooms/${code}?pt=${encodeURIComponent(pt)}`;
}

export function useLiveRoom({
  code,
  status,
  initialSnapshot,
  onStatusChange,
}: UseLiveRoomOptions) {
  const [liveOverride, setLiveOverride] = useState<LiveSnapshot | null>(null);
  const [rawMode, setRawMode] = useState<LiveConnectionMode>('connecting');

  const snapshot =
    liveOverride &&
    (!initialSnapshot.serverTime ||
      liveOverride.serverTime >= initialSnapshot.serverTime)
      ? liveOverride
      : initialSnapshot;

  const onStatusChangeRef = useRef(onStatusChange);
  useEffect(() => {
    onStatusChangeRef.current = onStatusChange;
  }, [onStatusChange]);

  const applySnapshot = useCallback(
    (next: LiveSnapshot) => {
      setLiveOverride(next);
      if (next.status !== status) {
        onStatusChangeRef.current?.(next.status);
      }
    },
    [status]
  );

  const fetchLatest = useCallback(async () => {
    try {
      const pt = getParticipantToken(code);
      const headers: Record<string, string> = {};
      if (pt) headers['x-participant-token'] = pt;
      const res = await fetch(`/api/rooms/${code}/live`, { headers });
      if (!res.ok) return;
      const json = (await res.json()) as LiveSnapshot;
      applySnapshot(json);
    } catch {
      // Bỏ qua lỗi mạng tạm thời
    }
  }, [code, applySnapshot]);

  useEffect(() => {
    if (status !== 'live') {
      return;
    }

    const pt = getParticipantToken(code);
    if (!pt) {
      const id = window.setInterval(() => {
        setRawMode('polling');
        if (document.visibilityState === 'visible') void fetchLatest();
      }, 6000);
      return () => window.clearInterval(id);
    }

    let cancelled = false;
    let ws: WebSocket | null = null;
    let reconnectTimer: number | null = null;
    let pollTimer: number | null = null;
    let pingTimer: number | null = null;
    let attempt = 0;

    function stopPolling() {
      if (pollTimer !== null) {
        window.clearInterval(pollTimer);
        pollTimer = null;
      }
    }

    function startPolling() {
      if (pollTimer !== null) return;
      setRawMode('polling');
      pollTimer = window.setInterval(() => {
        if (document.visibilityState === 'visible') {
          void fetchLatest();
        }
      }, 5000);
    }

    function cleanupSocket() {
      if (pingTimer !== null) {
        window.clearInterval(pingTimer);
        pingTimer = null;
      }
      if (ws) {
        ws.onopen = null;
        ws.onmessage = null;
        ws.onerror = null;
        ws.onclose = null;
        if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
          ws.close();
        }
        ws = null;
      }
    }

    function connect() {
      if (cancelled) return;
      cleanupSocket();

      try {
        ws = new WebSocket(buildWsUrl(code, pt!));
      } catch {
        startPolling();
        scheduleReconnect();
        return;
      }

      ws.onopen = () => {
        if (cancelled) return;
        attempt = 0;
        stopPolling();
        setRawMode('ws');

        pingTimer = window.setInterval(() => {
          if (ws?.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'ping' }));
          }
        }, 30000);
      };

      ws.onmessage = (evt) => {
        if (cancelled) return;
        try {
          const msg = JSON.parse(String(evt.data)) as WsRoomMessage;
          if (msg.type === 'snapshot' || msg.type === 'live_started' || msg.type === 'ended') {
            applySnapshot(msg.data);
            return;
          }
          if (msg.type === 'checkin') {
            setLiveOverride((prev) => {
              const base = prev ?? initialSnapshot;
              const filtered = base.checkins.filter(
                (c) => c.participantId !== msg.data.participantId
              );
              return {
                ...base,
                counts: msg.counts,
                checkins: [msg.data, ...filtered],
                notArrived: base.notArrived.filter(
                  (n) => n.participantId !== msg.data.participantId
                ),
                serverTime: new Date().toISOString(),
              };
            });
            return;
          }
          if (msg.type === 'counts') {
            setLiveOverride((prev) => {
              const base = prev ?? initialSnapshot;
              return {
                ...base,
                counts: msg.data,
                serverTime: new Date().toISOString(),
              };
            });
          }
        } catch {
          // Bỏ qua thông điệp không hợp lệ
        }
      };

      ws.onerror = () => {
        if (cancelled) return;
        startPolling();
      };

      ws.onclose = () => {
        if (cancelled) return;
        if (pingTimer !== null) {
          window.clearInterval(pingTimer);
          pingTimer = null;
        }
        startPolling();
        scheduleReconnect();
      };
    }

    function scheduleReconnect() {
      if (cancelled || reconnectTimer !== null) return;
      const base = Math.min(20000, 1000 * Math.pow(2, attempt));
      const jitter = Math.round(Math.random() * 600);
      attempt += 1;
      reconnectTimer = window.setTimeout(() => {
        reconnectTimer = null;
        connect();
      }, base + jitter);
    }

    function handleWake() {
      if (document.visibilityState === 'visible') {
        void fetchLatest();
        if (!ws || ws.readyState !== WebSocket.OPEN) {
          if (reconnectTimer !== null) {
            window.clearTimeout(reconnectTimer);
            reconnectTimer = null;
          }
          attempt = 0;
          connect();
        }
      }
    }

    connect();
    document.addEventListener('visibilitychange', handleWake);
    window.addEventListener('online', handleWake);

    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', handleWake);
      window.removeEventListener('online', handleWake);
      if (reconnectTimer !== null) window.clearTimeout(reconnectTimer);
      stopPolling();
      cleanupSocket();
    };
  }, [code, status, initialSnapshot, applySnapshot, fetchLatest]);

  const connectionMode: LiveConnectionMode = status !== 'live' ? 'idle' : rawMode;

  return {
    snapshot,
    setSnapshot: applySnapshot,
    connectionMode,
    refreshLive: fetchLatest,
  };
}
