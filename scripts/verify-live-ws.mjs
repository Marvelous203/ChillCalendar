import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
import WebSocket from 'ws';

const PORT = 3123;
const BASE = `http://127.0.0.1:${PORT}`;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function waitForServer() {
  for (let i = 0; i < 40; i++) {
    try {
      const res = await fetch(`${BASE}/api/auth/me`);
      if (res.ok) return;
    } catch {
      // retry
    }
    await sleep(300);
  }
  throw new Error('Server did not start in time');
}

async function run() {
  const proc = spawn('node', ['server.mjs'], {
    cwd: process.cwd(),
    env: { ...process.env, PORT: String(PORT), NODE_ENV: 'production', AUTH_MODE: 'dev' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let stdout = '';
  let stderr = '';
  proc.stdout.on('data', (d) => (stdout += d.toString()));
  proc.stderr.on('data', (d) => (stderr += d.toString()));

  try {
    await waitForServer();
    console.log('1. Server booted cleanly on port', PORT);

    // 1. Dev login as owner
    const loginRes = await fetch(`${BASE}/api/auth/dev`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'ws-tester@gmail.com',
        password: 'TestPassword123',
        captchaToken: 'dev-bypass',
      }),
    });
    assert.equal(loginRes.status, 200);
    const cookie = loginRes.headers.get('set-cookie').split(';')[0];

    // 2. Create event for today/tomorrow
    const today = new Date().toISOString().slice(0, 10);
    const createRes = await fetch(`${BASE}/api/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({
        title: 'Live WS Test',
        note: 'Test live mode',
        dates: [today],
        from: 18,
        to: 22,
        visibility: 'link',
        finalizePolicy: 'owner_only',
      }),
    });
    assert.equal(createRes.status, 201);
    const created = await createRes.json();
    const code = created.code;
    console.log('2. Created room:', code);

    // 3. Join as owner & as guest
    const joinOwner = await fetch(`${BASE}/api/rooms/${code}/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ name: 'Owner Tester' }),
    });
    assert.ok(joinOwner.status === 200 || joinOwner.status === 201);
    const ownerPt = (await joinOwner.json()).participantToken;

    const joinGuest = await fetch(`${BASE}/api/rooms/${code}/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Guest Tester' }),
    });
    assert.ok(joinGuest.status === 200 || joinGuest.status === 201);
    const guestPt = (await joinGuest.json()).participantToken;

    // Guest RSVPs slot 19:00
    const rsvpRes = await fetch(`${BASE}/api/rooms/${code}/response`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'x-participant-token': guestPt },
      body: JSON.stringify({ slots: [`${today}T19`] }),
    });
    assert.equal(rsvpRes.status, 200);

    // 4. Finalize room
    const finRes = await fetch(`${BASE}/api/rooms/${code}/finalize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie, 'x-participant-token': ownerPt },
      body: JSON.stringify({ date: today, from: 19, to: 21 }),
    });
    assert.equal(finRes.status, 200);

    // 5. Permission denied check: guest cannot start-early
    const badStart = await fetch(`${BASE}/api/rooms/${code}/start-early`, {
      method: 'POST',
      headers: { 'x-participant-token': guestPt },
    });
    assert.equal(badStart.status, 403);
    console.log('3. Permission-denied check passed (guest start-early -> 403)');

    // 6. Bad path: check-in before live -> 409
    const badCheckin = await fetch(`${BASE}/api/rooms/${code}/checkin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-participant-token': guestPt },
      body: JSON.stringify({ note: 'early' }),
    });
    assert.equal(badCheckin.status, 409);
    console.log('4. Bad-path check passed (checkin before live -> 409)');

    // 7. Owner starts early -> live
    const startRes = await fetch(`${BASE}/api/rooms/${code}/start-early`, {
      method: 'POST',
      headers: { Cookie: cookie, 'x-participant-token': ownerPt },
    });
    assert.equal(startRes.status, 200);
    const startedBundle = await startRes.json();
    assert.equal(startedBundle.event.status, 'live');
    console.log('5. Start early succeeded, status = live');

    // 8. Connect WebSocket with invalid token -> must reject
    await new Promise((resolve) => {
      const badWs = new WebSocket(`ws://127.0.0.1:${PORT}/ws/rooms/${code}?pt=invalidtoken123`);
      badWs.on('unexpected-response', (_req, res) => {
        assert.equal(res.statusCode, 403);
        resolve();
      });
      badWs.on('error', () => resolve());
    });
    console.log('6. WebSocket invalid token rejected (403)');

    // 9. Connect WebSocket as owner and receive snapshot, checkin, ended
    const received = [];
    const ws = new WebSocket(`ws://127.0.0.1:${PORT}/ws/rooms/${code}?pt=${encodeURIComponent(ownerPt)}`);
    await new Promise((resolve, reject) => {
      ws.on('open', resolve);
      ws.on('error', reject);
    });

    ws.on('message', (data) => {
      received.push(JSON.parse(data.toString()));
    });

    await sleep(200);
    assert.equal(received[0]?.type, 'snapshot');
    assert.equal(received[0]?.data?.status, 'live');
    console.log('7. WebSocket connected & received initial snapshot');

    // 10. Guest checks in with note
    const checkinRes = await fetch(`${BASE}/api/rooms/${code}/checkin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-participant-token': guestPt },
      body: JSON.stringify({ note: 'Đã tới bàn góc!' }),
    });
    assert.equal(checkinRes.status, 200);

    await sleep(200);
    const checkinMsg = received.find((m) => m.type === 'checkin');
    assert.ok(checkinMsg, 'Expected WS checkin broadcast');
    assert.equal(checkinMsg.data.name, 'Guest Tester');
    assert.equal(checkinMsg.data.note, 'Đã tới bàn góc!');
    assert.equal(checkinMsg.counts.checkedIn, 1);
    assert.equal(checkinMsg.counts.expected, 1);
    console.log('8. Real-time WebSocket checkin broadcast verified (1/1)');

    // 11. Owner ends event -> WS ended broadcast
    const endRes = await fetch(`${BASE}/api/rooms/${code}/end`, {
      method: 'POST',
      headers: { Cookie: cookie, 'x-participant-token': ownerPt },
    });
    assert.equal(endRes.status, 200);

    await sleep(200);
    const endedMsg = received.find((m) => m.type === 'ended');
    assert.ok(endedMsg, 'Expected WS ended broadcast');
    assert.equal(endedMsg.data.status, 'done');
    assert.equal(endedMsg.data.endedBy, 'owner');
    console.log('9. Real-time WebSocket ended broadcast verified (status = done)');

    ws.close();

    // Cleanup test event
    await fetch(`${BASE}/api/rooms/${code}`, {
      method: 'DELETE',
      headers: { Cookie: cookie },
    });
    console.log('ALL LIVE & WEBSOCKET CHECKS PASSED!');
  } finally {
    proc.kill();
    if (stderr.trim()) console.error('Server stderr:', stderr);
    void stdout;
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
