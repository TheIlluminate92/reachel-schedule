import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { readFile } from 'node:fs/promises';
import { createApp, loadConfig } from '../server.mjs';
import { CALENDAR_ID } from '../core.mjs';

// Exercise the real HTTP handler without binding sockets (the authoring
// environment restricts network access). Provider calls are explicit fixtures.
function request(server, path, { method = 'GET', headers = {}, body } = {}) {
  return new Promise(resolve => {
    const req = Readable.from(body === undefined ? [] : [Buffer.isBuffer(body) ? body : Buffer.from(JSON.stringify(body))]);
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
