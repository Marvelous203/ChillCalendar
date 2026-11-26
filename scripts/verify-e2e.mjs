import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';

const PORT = 3099;
const BASE = `http://127.0.0.1:${PORT}`;
const DB_FILE = path.join(process.cwd(), 'data', 'db.json');

async function waitForServer(timeoutMs = 20000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`${BASE}/api/auth/me`);
      if (res.ok) return;
    } catch {
      // retry
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error('Server did not start in time');
}

async function runTests() {
  const results = [];
  const pass = (name, detail = '') => {
    results.push({ name, detail });
    console.log(`PASS: ${name}${detail ? ` (${detail})` : ''}`);
  };

  // 1. Pages render 200
  for (const p of ['/', '/login', '/new', '/profile']) {
    const res = await fetch(`${BASE}${p}`);
    assert.equal(res.status, 200, `GET ${p} expected 200`);
  }
  pass('Pages SSR/Static 200', '/, /login, /new, /profile');

  // 2. Unauthenticated POST /api/events -> 401
  {
    const res = await fetch(`${BASE}/api/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    assert.equal(res.status, 401);
    pass('Bad path: unauthenticated POST /api/events -> 401');
  }

  // 3. Register validation bad path (non-gmail) -> 400
  {
    const res = await fetch(`${BASE}/api/auth/dev`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mode: 'register',
        email: 'user@yahoo.com',
        password: 'password123',
        confirmPassword: 'password123',
        captchaToken: 'dev-bypass-token',
      }),
    });
    assert.equal(res.status, 400);
    pass('Bad path: non-gmail register -> 400');
  }

  // 4. Register valid @gmail.com -> 200 + Set-Cookie
  let ownerCookie = '';
  {
    const res = await fetch(`${BASE}/api/auth/dev`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mode: 'register',
        email: 'testowner@gmail.com',
        password: 'password123',
        confirmPassword: 'password123',
        captchaToken: 'dev-bypass-token',
      }),
    });
    assert.equal(res.status, 200);
    const setCookie = res.headers.get('set-cookie') || '';
    ownerCookie = setCookie.split(';')[0];
    assert.ok(ownerCookie.includes('cwm_dev_user='));
    pass('Auth dev register @gmail.com -> 200 + session cookie');
  }

  // 5. Create event past date -> 400
  {
    const res = await fetch(`${BASE}/api/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: ownerCookie },
      body: JSON.stringify({
        title: 'Past test',
        note: '',
        dates: ['2020-01-01'],
        from: 8,
        to: 12,
        visibility: 'link',
        finalizePolicy: 'any_member',
      }),
    });
    assert.equal(res.status, 400);
    pass('Bad path: past date event -> 400');
  }

  // 6. Create valid public event -> 201
  const tomorrow = new Date(Date.now() + 86400_000).toISOString().slice(0, 10);
  let roomCode = '';
  {
    const res = await fetch(`${BASE}/api/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: ownerCookie },
      body: JSON.stringify({
        title: 'Cà phê cuối tuần',
        note: 'Quận 1',
        dates: [tomorrow],
        from: 8,
        to: 12,
        visibility: 'link',
        finalizePolicy: 'owner_only',
      }),
    });
    assert.equal(res.status, 201);
    const json = await res.json();
    roomCode = json.code;
    assert.match(roomCode, /^[2-9A-HJ-KM-NP-Z]{6}$/);
    pass('Create public event -> 201', `#${roomCode}`);
  }

  // 7. OpenGraph image -> 200 image/png
  {
    const res = await fetch(`${BASE}/e/${roomCode}/opengraph-image`);
    assert.equal(res.status, 200);
    assert.ok((res.headers.get('content-type') || '').includes('image/png'));
    pass('Dynamic OpenGraph image -> 200 image/png');
  }

  // 8. Participant join -> 201 + token
  let participantToken = '';
  {
    const res = await fetch(`${BASE}/api/rooms/${roomCode}/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Minh Anh' }),
    });
    assert.equal(res.status, 201);
    const json = await res.json();
    assert.equal(json.status, 'approved');
    participantToken = json.participantToken;
    assert.ok(participantToken.length >= 16);
    pass('Participant join without account -> 201');
  }

  // 9. Save availability without token -> 403, with token -> 200
  {
    const bad = await fetch(`${BASE}/api/rooms/${roomCode}/response`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slots: [`${tomorrow}T09`] }),
    });
    assert.equal(bad.status, 403);

    const good = await fetch(`${BASE}/api/rooms/${roomCode}/response`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'x-participant-token': participantToken,
      },
      body: JSON.stringify({ slots: [`${tomorrow}T09`, `${tomorrow}T10`] }),
    });
    assert.equal(good.status, 200);
    pass('Save availability (403 without token, 200 with token)');
  }

  // 10. Place validation bad URL -> 400, valid Google Maps -> 201, vote -> 200
  let placeId = '';
  {
    const bad = await fetch(`${BASE}/api/rooms/${roomCode}/places`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-participant-token': participantToken,
      },
      body: JSON.stringify({
        name: 'Quán lạ',
        addr: '',
        link: 'https://evil.example.com/phish',
      }),
    });
    assert.equal(bad.status, 400);

    const good = await fetch(`${BASE}/api/rooms/${roomCode}/places`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-participant-token': participantToken,
      },
      body: JSON.stringify({
        name: 'Katinat',
        addr: 'Quận 1',
        link: 'https://maps.app.goo.gl/xyz123',
      }),
    });
    assert.equal(good.status, 201);
    const json = await good.json();
    placeId = json.place.id;

    const vote = await fetch(`${BASE}/api/rooms/${roomCode}/votes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-participant-token': participantToken,
      },
      body: JSON.stringify({ placeId, on: true }),
    });
    assert.equal(vote.status, 200);

    const itin = await fetch(`${BASE}/api/rooms/${roomCode}/places`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-participant-token': participantToken,
      },
      body: JSON.stringify({
        type: 'itinerary',
        name: 'Kèo chiều tối',
        note: 'Đi từ Q1 sang Q3',
        stops: [
          {
            id: 's1',
            category: 'checkin',
            time: '16:30',
            name: 'Nhà thờ Đức Bà',
            addr: 'Quận 1',
            link: 'https://www.google.com/maps/place/Test/@10.7797855,106.6968302,17z',
          },
          {
            id: 's2',
            category: 'cafe',
            time: '18:00',
            name: 'Phúc Long Lê Văn Sỹ',
            addr: 'Quận 3',
            link: '',
            lat: 10.7891,
            lng: 106.6789,
          },
        ],
      }),
    });
    assert.equal(itin.status, 201);
    const itinJson = await itin.json();
    assert.equal(itinJson.place.type, 'itinerary');
    assert.equal(itinJson.place.stops.length, 2);
    assert.ok(itinJson.place.link.includes('google.com/maps/dir/'));
    assert.ok(itinJson.place.link.includes('10.7797855%2C106.6968302') || itinJson.place.link.includes('10.7797855,106.6968302'));

    const editItin = await fetch(`${BASE}/api/rooms/${roomCode}/places`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'x-participant-token': participantToken,
      },
      body: JSON.stringify({
        placeId: itinJson.place.id,
        type: 'itinerary',
        name: 'Kèo chiều tối (đã sửa)',
        note: 'Đã cập nhật',
        stops: itinJson.place.stops,
      }),
    });
    assert.equal(editItin.status, 200);
    const editJson = await editItin.json();
    assert.equal(editJson.place.name, 'Kèo chiều tối (đã sửa)');
    pass('Places, Edit, Votes & Coordinate-based Itinerary URL -> 201/200');
  }

  // 11. Permission-denied: non-owner finalize on owner_only room -> 403; owner finalize -> 200
  {
    const bad = await fetch(`${BASE}/api/rooms/${roomCode}/finalize`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-participant-token': participantToken,
      },
      body: JSON.stringify({ date: tomorrow, from: 9, to: 11, placeId }),
    });
    assert.equal(bad.status, 403);

    const good = await fetch(`${BASE}/api/rooms/${roomCode}/finalize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: ownerCookie },
      body: JSON.stringify({ date: tomorrow, from: 9, to: 11, placeId }),
    });
    assert.equal(good.status, 200);
    const bundle = await good.json();
    assert.equal(bundle.event.finalDate, tomorrow);
    pass('Finalize permissions (403 non-owner, 200 owner)');
  }

  // 12. Rotate code -> 200, old code -> 404
  {
    const res = await fetch(`${BASE}/api/rooms/${roomCode}/rotate-code`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: ownerCookie },
      body: JSON.stringify({ rotateInvite: true }),
    });
    assert.equal(res.status, 200);
    const bundle = await res.json();
    assert.notEqual(bundle.event.code, roomCode);

    const oldRes = await fetch(`${BASE}/api/rooms/${roomCode}`);
    assert.equal(oldRes.status, 404);
    pass('Rotate room code invalidates old code', `${roomCode} -> ${bundle.event.code}`);
  }

  // 13. Private room gate -> 403 { private: true }
  {
    const createPriv = await fetch(`${BASE}/api/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: ownerCookie },
      body: JSON.stringify({
        title: 'Họp kín',
        note: '',
        dates: [tomorrow],
        from: 9,
        to: 12,
        visibility: 'private',
        finalizePolicy: 'owner_only',
      }),
    });
    assert.equal(createPriv.status, 201);
    const { code: privCode } = await createPriv.json();

    const unauth = await fetch(`${BASE}/api/rooms/${privCode}`);
    assert.equal(unauth.status, 403);
    const privJson = await unauth.json();
    assert.equal(privJson.private, true);
    pass('Private room gate returns 403 { private: true }');
  }

  // 14. Flexible weekday mode (no fixed dates)
  {
    const createFlex = await fetch(`${BASE}/api/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: ownerCookie },
      body: JSON.stringify({
        title: 'Lịch rảnh linh hoạt',
        note: '',
        dates: ['W1', 'W2', 'W3', 'W4', 'W5', 'W6', 'W7'],
        from: 8,
        to: 22,
        visibility: 'link',
        finalizePolicy: 'any_member',
      }),
    });
    assert.equal(createFlex.status, 201);
    const { code: flexCode } = await createFlex.json();

    const joinRes = await fetch(`${BASE}/api/rooms/${flexCode}/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'An' }),
    });
    assert.equal(joinRes.status, 201);
    const { participantToken: pt } = await joinRes.json();

    const saveRes = await fetch(`${BASE}/api/rooms/${flexCode}/response`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'x-participant-token': pt },
      body: JSON.stringify({ slots: ['W1T09', 'W6T19'] }),
    });
    assert.equal(saveRes.status, 200);
    pass('Flexible weekday mode (no fixed dates) -> 201 + save slots');
  }

  // 15. Logged-in friend persistence across sessions & joinedEvents list
  {
    const regFriend = await fetch(`${BASE}/api/auth/dev`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mode: 'register',
        email: 'friend@gmail.com',
        password: 'password123',
        confirmPassword: 'password123',
        captchaToken: 'dev-bypass-token',
      }),
    });
    assert.equal(regFriend.status, 200);
    const friendCookie = (regFriend.headers.get('set-cookie') || '').split(';')[0];

    const createEv = await fetch(`${BASE}/api/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: ownerCookie },
      body: JSON.stringify({
        title: 'Đi ăn tối',
        note: '',
        dates: [tomorrow],
        from: 17,
        to: 21,
        visibility: 'link',
        finalizePolicy: 'any_member',
      }),
    });
    assert.equal(createEv.status, 201);
    const { code: sharedCode } = await createEv.json();

    const joinRes = await fetch(`${BASE}/api/rooms/${sharedCode}/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: friendCookie },
      body: JSON.stringify({ name: 'Bạn B' }),
    });
    assert.equal(joinRes.status, 201);

    // Save & reload WITHOUT x-participant-token (simulating re-login / new device)
    const saveRes = await fetch(`${BASE}/api/rooms/${sharedCode}/response`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: friendCookie },
      body: JSON.stringify({ slots: [`${tomorrow}T18`] }),
    });
    assert.equal(saveRes.status, 200);

    const reloadRes = await fetch(`${BASE}/api/rooms/${sharedCode}`, {
      headers: { Cookie: friendCookie },
    });
    assert.equal(reloadRes.status, 200);
    const bundle = await reloadRes.json();
    assert.equal(bundle.me?.name, 'Bạn B');
    assert.ok(
      bundle.responses.some(
        (r) => r.participantId === bundle.me.id && r.slots.includes(`${tomorrow}T18`)
      )
    );

    const listRes = await fetch(`${BASE}/api/events`, {
      headers: { Cookie: friendCookie },
    });
    assert.equal(listRes.status, 200);
    const listJson = await listRes.json();
    assert.ok(listJson.joinedEvents.some((e) => e.code === sharedCode));
    pass('Logged-in friend persistence & joinedEvents list');
  }

  // 16. Profile GET & PATCH
  {
    const patchRes = await fetch(`${BASE}/api/profile`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: ownerCookie },
      body: JSON.stringify({ displayName: 'Phát Đẹp Trai' }),
    });
    assert.equal(patchRes.status, 200);

    const getRes = await fetch(`${BASE}/api/profile`, {
      headers: { Cookie: ownerCookie },
    });
    assert.equal(getRes.status, 200);
    const prof = await getRes.json();
    assert.equal(prof.profile.displayName, 'Phát Đẹp Trai');
    assert.ok(prof.stats.ownedCount >= 1);
    pass('User profile GET & PATCH -> 200');
  }

  console.log(`\nALL ${results.length} E2E CHECKS PASSED`);
}

async function main() {
  let backupDb = null;
  try {
    backupDb = await fs.readFile(DB_FILE, 'utf8');
  } catch {
    // no existing db
  }
  await fs.rm(DB_FILE, { force: true });

  const server = spawn('npx', ['next', 'start', '-p', String(PORT)], {
    cwd: process.cwd(),
    shell: true,
    stdio: 'pipe',
    env: { ...process.env, AUTH_MODE: 'dev' },
  });

  try {
    await waitForServer();
    await runTests();
  } finally {
    if (process.platform === 'win32' && server.pid) {
      spawn('taskkill', ['/pid', String(server.pid), '/T', '/F'], { stdio: 'ignore' });
    } else {
      server.kill('SIGTERM');
    }
    await fs.rm(DB_FILE, { force: true });
    if (backupDb !== null) {
      await fs.mkdir(path.dirname(DB_FILE), { recursive: true });
      await fs.writeFile(DB_FILE, backupDb, 'utf8');
    }
  }
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
