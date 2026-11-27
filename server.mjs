import http from 'node:http';
import { URL } from 'node:url';
import next from 'next';
import { WebSocketServer } from 'ws';

const dev = process.env.NODE_ENV !== 'production';
const hostname = process.env.HOSTNAME || '0.0.0.0';
const port = Number(process.env.PORT || 3000);
const LIVE_AUTO_END_MS = 24 * 60 * 60 * 1000;

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

/** Quản lý phòng WebSocket và bộ đếm tự kết thúc 24 giờ trong bộ nhớ. */
const rooms = new Map(); // code -> Set<WebSocket>
const autoEndTimers = new Map(); // eventId -> Timeout

function broadcast(code, message) {
  const key = String(code).toUpperCase();
  const clients = rooms.get(key);
  if (!clients || clients.size === 0) return;
  const payload = JSON.stringify(message);
  for (const ws of clients) {
    if (ws.readyState === 1) {
      ws.send(payload);
    }
  }
}

function cancelAutoEnd(eventId) {
  const t = autoEndTimers.get(eventId);
  if (t) {
    clearTimeout(t);
    autoEndTimers.delete(eventId);
  }
}

function scheduleAutoEnd(event) {
  cancelAutoEnd(event.id);
  if (!event.liveFrom || event.endedAt) return;
  const liveMs = Date.parse(event.liveFrom);
  if (Number.isNaN(liveMs)) return;

  const endMs = liveMs + LIVE_AUTO_END_MS;
  const delay = Math.max(0, endMs - Date.now());
  const autoEndIso = new Date(endMs).toISOString();

  // Tránh tràn 32-bit timeout (24h = 86,400,000ms nằm gọn trong giới hạn)
  const timer = setTimeout(async () => {
    autoEndTimers.delete(event.id);
    try {
      const headers = { 'Content-Type': 'application/json' };
      if (process.env.WS_INTERNAL_SECRET) {
        headers['x-ws-secret'] = process.env.WS_INTERNAL_SECRET;
      }
      await fetch(`http://127.0.0.1:${port}/api/internal/live-sync`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ code: event.code, endedAt: autoEndIso }),
      });
    } catch (err) {
      console.error('[WS] Auto-end error:', err);
    }
  }, delay);

  if (typeof timer.unref === 'function') timer.unref();
  autoEndTimers.set(event.id, timer);
}

globalThis.__cwmWsHub = {
  broadcast,
  scheduleAutoEnd,
  cancelAutoEnd,
};

async function scanActiveLiveRooms() {
  try {
    const headers = {};
    if (process.env.WS_INTERNAL_SECRET) {
      headers['x-ws-secret'] = process.env.WS_INTERNAL_SECRET;
    }
    const res = await fetch(`http://127.0.0.1:${port}/api/internal/live-sync`, { headers });
    if (!res.ok) return;
    const json = await res.json();
    for (const item of json.active ?? []) {
      scheduleAutoEnd({ id: item.id, code: item.code, liveFrom: item.liveFrom, endedAt: null });
    }
    if ((json.active ?? []).length > 0) {
      console.log(`[WS] Đã khôi phục ${json.active.length} hẹn giờ tự kết thúc 24h`);
    }
  } catch {
    // Bỏ qua nếu server chưa sẵn sàng ở lần đầu
  }
}

app.prepare().then(() => {
  const nextUpgradeHandler = app.getUpgradeHandler();
  const wss = new WebSocketServer({ noServer: true });

  const server = http.createServer((req, res) => {
    // Endpoint nội bộ cho trường hợp deploy tách Next.js & WS server
    if (req.method === 'POST' && req.url === '/_internal/ws-publish') {
      const secret = process.env.WS_INTERNAL_SECRET;
      if (secret && req.headers['x-ws-secret'] !== secret) {
        res.statusCode = 403;
        res.end('Forbidden');
        return;
      }
      let raw = '';
      req.on('data', (chunk) => {
        raw += chunk;
      });
      req.on('end', () => {
        try {
          const parsed = JSON.parse(raw);
          if (parsed?.code && parsed?.message) {
            broadcast(parsed.code, parsed.message);
          }
          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json');
          res.end('{"ok":true}');
        } catch {
          res.statusCode = 400;
          res.end('Bad Request');
        }
      });
      return;
    }

    handle(req, res);
  });

  server.on('upgrade', async (req, socket, head) => {
    let pathname = '';
    let searchParams;
    try {
      const parsed = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
      pathname = parsed.pathname;
      searchParams = parsed.searchParams;
    } catch {
      socket.destroy();
      return;
    }

    const match = /^\/ws\/rooms\/([2-9A-HJ-KM-NP-Z]{6,8})$/i.exec(pathname);
    if (!match) {
      // Nhường lại cho Next.js HMR / internal upgrades
      nextUpgradeHandler(req, socket, head);
      return;
    }

    const code = match[1].toUpperCase();
    const pt = (searchParams.get('pt') || '').trim();
    if (pt.length < 8) {
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      socket.destroy();
      return;
    }

    try {
      const res = await fetch(`http://127.0.0.1:${port}/api/rooms/${code}/live`, {
        headers: { 'x-participant-token': pt },
      });
      if (!res.ok || res.headers.get('x-cwm-verified') !== '1') {
        socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
        socket.destroy();
        return;
      }
      const snapshot = await res.json();

      wss.handleUpgrade(req, socket, head, (ws) => {
        ws.isAlive = true;
        ws.roomCode = code;

        let set = rooms.get(code);
        if (!set) {
          set = new Set();
          rooms.set(code, set);
        }
        set.add(ws);

        ws.send(JSON.stringify({ type: 'snapshot', data: snapshot }));

        ws.on('pong', () => {
          ws.isAlive = true;
        });

        ws.on('message', (data) => {
          try {
            const msg = JSON.parse(String(data));
            if (msg?.type === 'ping') {
              ws.send(JSON.stringify({ type: 'pong', serverTime: new Date().toISOString() }));
            }
          } catch {
            // Bỏ qua gói tin không hợp lệ
          }
        });

        ws.on('close', () => {
          const roomSet = rooms.get(code);
          if (roomSet) {
            roomSet.delete(ws);
            if (roomSet.size === 0) rooms.delete(code);
          }
        });
      });
    } catch {
      socket.write('HTTP/1.1 500 Internal Server Error\r\n\r\n');
      socket.destroy();
    }
  });

  // Heartbeat 25s giữ kết nối WebSocket qua Nginx / Cloudflare / Railway proxy
  const heartbeat = setInterval(() => {
    for (const clients of rooms.values()) {
      for (const ws of clients) {
        if (ws.isAlive === false) {
          ws.terminate();
          continue;
        }
        ws.isAlive = false;
        ws.ping();
      }
    }
  }, 25000);
  if (typeof heartbeat.unref === 'function') heartbeat.unref();

  server.listen(port, hostname, () => {
    console.log(`> Chill With Me ready on http://${hostname}:${port} (WS enabled)`);
    setTimeout(scanActiveLiveRooms, 1500);
  });
});
