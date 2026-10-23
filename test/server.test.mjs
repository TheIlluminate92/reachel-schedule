import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { readFile } from 'node:fs/promises';
import { createHmac } from 'node:crypto';
import { createApp, loadConfig } from '../server.mjs';
import { CALENDAR_ID } from '../core.mjs';

// Exercise the real HTTP handler without binding sockets (the authoring
// environment restricts network access). Provider calls are explicit fixtures.
function request(server, path, { method = 'GET', headers = {}, body } = {}) {
  return new Promise(resolve => {
    const req = body instanceof Readable ? body : Readable.from(body === undefined ? [] : [Buffer.isBuffer(body) ? body : Buffer.from(JSON.stringify(body))]);
    req.method = method; req.url = path; req.headers = { ...headers }; req.socket = { remoteAddress: '127.0.0.1' };
    const responseHeaders = {};
    const res = { headersSent: false, status: 200, setHeader(k, v) { responseHeaders[k.toLowerCase()] = v; }, writeHead(status, h = {}) { this.status = status; this.headersSent = true; for (const [k, v] of Object.entries(h)) this.setHeader(k, v); }, end(data = '') { let parsed; try { parsed = JSON.parse(data); } catch { parsed = String(data); } resolve({ status: this.status, headers: responseHeaders, body: parsed, bytes: Buffer.isBuffer(data) ? data : Buffer.from(data) }); } };
    server.emit('request', req, res);
  });
}
const config = () => loadConfig({ APP_PASSWORD: 'a-test-password-123', APP_SECRET: 'a-test-secret-of-at-least-thirty-two-characters', PUBLIC_URL: 'http://localhost:3080', OPENAI_API_KEY: 'test-not-a-real-key', GOOGLE_APPLICATION_CREDENTIALS: 'fixture-not-a-real-key-file' });
test('Unraid can fetch the genuine PNG without login or provider access', async () => {
  const app = createApp(config(), { parse: () => assert.fail(), calendar: { list: () => assert.fail(), insert: () => assert.fail() } });
  const response = await request(app, '/docker-icon.png');
  assert.equal(response.status, 200);
  assert.equal(response.headers['content-type'], 'image/png');
  assert.deepEqual(response.bytes, await readFile(new URL('../public/docker-icon.png', import.meta.url)));
  assert.equal(response.bytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
  assert.equal(response.bytes.readUInt32BE(16), 512);
  assert.equal(response.bytes.readUInt32BE(20), 512);
  assert.equal((await request(app, '/api/status')).status, 401);
  app.close();
});
async function login(app) {
  const login = await request(app, '/api/login', { method: 'POST', headers: { origin: 'http://localhost:3080', 'content-type': 'application/json' }, body: { password: 'a-test-password-123' } });
  assert.equal(login.status, 200);
  const cookie = login.headers['set-cookie'].split(';')[0];
  const status = await request(app, '/api/status', { headers: { cookie } });
  return { cookie, origin: 'http://localhost:3080', 'content-type': 'application/json', 'x-csrf-token': status.body.csrf };
}
test('anonymous requests, missing CSRF and foreign origins cannot write calendar events', async () => {
  let writes = 0;
  const app = createApp(config(), { calendar: { list: async () => [], insert: async () => { writes++; } } });
  const data = { dates: ['2026-10-22'], confirmed: true };
  assert.equal((await request(app, '/api/import', { method: 'POST', headers: { origin: 'http://localhost:3080' }, body: data })).status, 401);
  const headers = await login(app);
  assert.equal((await request(app, '/api/import', { method: 'POST', headers: { ...headers, 'x-csrf-token': '' }, body: data })).status, 403);
  assert.equal((await request(app, '/api/import', { method: 'POST', headers: { ...headers, origin: 'https://evil.example' }, body: data })).status, 403);
  assert.equal((await request(app, '/api/import', { method: 'POST', headers, body: { dates: data.dates } })).status, 400);
  assert.equal(writes, 0);
  app.close();
});
test('authenticated import is fixed to Reachel Test and concurrent submissions do not duplicate shifts', async () => {
  const events = []; let writes = 0;
  const app = createApp(config(), { calendar: { list: async () => [...events], insert: async event => { writes++; events.push(event); }, get: async id => events.find(x => x.id === id) } });
  const headers = await login(app);
  const status = await request(app, '/api/status', { headers });
  assert.equal(status.body.calendarId, CALENDAR_ID);
  assert.equal(status.body.openaiKey, undefined);
  const data = { dates: ['2026-10-22'], confirmed: true, calendar_id: 'primary' };
  const results = await Promise.all([request(app, '/api/import', { method: 'POST', headers, body: data }), request(app, '/api/import', { method: 'POST', headers, body: data })]);
  assert.equal(writes, 1);
  assert.deepEqual(results.map(x => x.body.results[0].status).sort(), ['added', 'existing']);
  assert.match(events[0].summary, /^Reachel$/);
  app.close();
});
test('parse receives exact uploaded bytes and no calendar write happens during image reading', async () => {
  let received, writes = 0;
  const app = createApp(config(), { parse: async (bytes, mime, year) => { received = { bytes, mime, year }; return { shifts: [{ date: '2026-10-22' }], period: 'Oct', issues: [] }; }, calendar: { insert: async () => { writes++; } } });
  const headers = await login(app);
  const bytes = Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]), Buffer.alloc(20)]);
  const response = await request(app, '/api/parse?year=2026', { method: 'POST', headers: { ...headers, 'content-type': 'image/png' }, body: bytes });
  assert.equal(response.status, 200);
  assert.deepEqual(received.bytes, bytes);
  assert.equal(received.mime, 'image/png'); assert.equal(received.year, 2026); assert.equal(writes, 0);
  app.close();
});
test('demo mode blocks real parsing and calendar writes', async () => {
  const app = createApp({ ...config(), demo: true }, { parse: () => assert.fail(), calendar: { list: () => assert.fail(), insert: () => assert.fail() } });
  const headers = await login(app);
  const response = await request(app, '/api/demo', { method: 'POST', headers, body: {} });
  assert.match(response.body.period, /DEMO/);
  for (const path of ['/api/import', '/api/check', '/api/parse']) assert.equal((await request(app, path, { method: 'POST', headers, body: { dates: ['2026-10-22'], confirmed: true } })).status, 409);
  app.close();
});
test('setup rejects remote plaintext origins and short secrets', () => {
  assert.throws(() => loadConfig({ APP_PASSWORD: 'short' }));
  assert.throws(() => loadConfig({ APP_PASSWORD: 'a-test-password', APP_SECRET: 'x'.repeat(40), PUBLIC_URL: 'http://schedule.example' }));
  assert.equal(loadConfig({ APP_PASSWORD: 'a-test-password', APP_SECRET: 'x'.repeat(40), PUBLIC_URL: 'http://192.168.2.2:3080' }).publicURL, 'http://192.168.2.2:3080');
});
test('logout revokes replay on protected reads and writes without revoking another phone', async () => {
  let parses = 0, writes = 0;
  const app = createApp(config(), { parse: async () => { parses++; }, calendar: { list: async () => [], insert: async () => { writes++; } } });
  const first = await login(app), second = await login(app);
  const denied = await request(app, '/api/logout', { method: 'POST', headers: { ...first, 'x-csrf-token': '' }, body: {} });
  assert.equal(denied.status, 403);
  assert.equal((await request(app, '/api/status', { headers: first })).status, 200);
  const logout = await request(app, '/api/logout', { method: 'POST', headers: first, body: {} });
  assert.equal(logout.status, 200);
  assert.match(logout.headers['set-cookie'], /Max-Age=0/);
  for (const path of ['/api/status', '/api/parse', '/api/check', '/api/import']) {
    const result = await request(app, path, { method: path === '/api/status' ? 'GET' : 'POST', headers: first, body: path === '/api/status' ? undefined : { dates: ['2026-10-22'], confirmed: true } });
    assert.equal(result.status, 401, path);
  }
  assert.equal(parses, 0); assert.equal(writes, 0);
  assert.equal((await request(app, '/api/status', { headers: second })).status, 200);
  const fresh = await login(app);
  assert.equal((await request(app, '/api/status', { headers: fresh })).status, 200);
  app.close();
});
test('restart rejects old sessions with unchanged secrets, and new login still works', async () => {
  const firstApp = createApp(config(), {});
  const old = await login(firstApp);
  firstApp.close();
  const restarted = createApp(config(), {});
  assert.equal((await request(restarted, '/api/status', { headers: old })).status, 401);
  const fresh = await login(restarted);
  assert.equal((await request(restarted, '/api/status', { headers: fresh })).status, 200);
  // Includes pre-fix cookies: a valid signature alone no longer grants access.
  const payload = Buffer.from(JSON.stringify({ exp: Date.now() + 86400000, nonce: 'old-stateless-session' })).toString('base64url');
  const signature = createHmac('sha256', config().secret).update(payload).digest('base64url');
  assert.equal((await request(restarted, '/api/status', { headers: { cookie: 'schedule_session=' + payload + '.' + signature } })).status, 401);
  restarted.close();
});
test('sessions expire after 90 days and tampered cookies are rejected', async t => {
  const app = createApp(config(), {});
  const headers = await login(app);
  const bad = { ...headers, cookie: headers.cookie + 'x' };
  assert.equal((await request(app, '/api/status', { headers: bad })).status, 401);
  const expires = Date.now() + 91 * 86400000;
  t.mock.method(Date, 'now', () => expires);
  assert.equal((await request(app, '/api/status', { headers })).status, 401);
  app.close();
});
const screenshot = () => Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]), Buffer.alloc(20)]);
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
test('parse reservation covers a slow upload and provider work; rejected requests cannot release it', async () => {
  const uploadStarted = deferred(), uploadRelease = deferred(), parseStarted = deferred(), parseRelease = deferred();
  let calls = 0, uploading = true;
  const app = createApp(config(), { parse: async () => { calls++; parseStarted.resolve(); if (!uploading) await parseRelease.promise; return { shifts: [], issues: [] }; } });
  const headers = { ...await login(app), 'content-type': 'image/png' };
  const stream = Readable.from((async function* () { uploadStarted.resolve(); await uploadRelease.promise; yield screenshot(); })());
  const first = request(app, '/api/parse', { method: 'POST', headers, body: stream });
  try {
    await uploadStarted.promise;
    assert.equal((await request(app, '/api/parse', { method: 'POST', headers, body: screenshot() })).status, 429);
    uploading = false;
    uploadRelease.resolve();
    await parseStarted.promise;
    for (let n = 0; n < 2; n++) assert.equal((await request(app, '/api/parse', { method: 'POST', headers, body: screenshot() })).status, 429);
    assert.equal(calls, 1);
  } finally { uploadRelease.resolve(); parseRelease.resolve(); await first; app.close(); }
});
test('parse reservation releases on success and validation, upload, provider, or quota failure', async () => {
  let calls = 0, failProvider = false;
  const app = createApp({ ...config(), maxParses: 3 }, { parse: async () => { calls++; if (failProvider) throw new Error('fixture provider failure'); return { shifts: [], issues: [] }; } });
  const headers = { ...await login(app), 'content-type': 'image/png' };
  const parse = (body = screenshot(), path = '/api/parse') => request(app, path, { method: 'POST', headers, body });
  assert.equal((await parse(Buffer.alloc(20))).status, 400);
  assert.equal((await parse(screenshot(), '/api/parse?year=2010')).status, 400);
  assert.equal((await parse(Buffer.alloc(10 * 1024 * 1024 + 1))).status, 413);
  const broken = Readable.from((async function* () { yield screenshot(); throw new Error('fixture upload failure'); })());
  assert.equal((await parse(broken)).status, 500);
  assert.equal(calls, 0);
  assert.equal((await parse()).status, 200);
  failProvider = true;
  assert.equal((await parse()).status, 500);
  failProvider = false;
  assert.equal((await parse()).status, 200);
  assert.equal(calls, 3);
  for (let n = 0; n < 2; n++) {
    const limited = await parse();
    assert.equal(limited.status, 429);
    assert.match(limited.body.error, /Daily/);
  }
  assert.equal(calls, 3);
  app.close();
});

