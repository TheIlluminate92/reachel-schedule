import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { isIP } from 'node:net';
import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { CALENDAR_ID, TIMEZONE, AppError, checkImage, normalizeDates, classifyDates, importDates } from './core.mjs';
import { createServices } from './services.mjs';

export function loadConfig(env = process.env) {
  const publicURL = new URL(env.PUBLIC_URL || 'http://localhost:3080');
  if (publicURL.pathname !== '/' || publicURL.search || publicURL.hash || publicURL.username || publicURL.password || !['http:', 'https:'].includes(publicURL.protocol)) throw new Error('PUBLIC_URL must be a plain http(s) origin.');
  const host = publicURL.hostname;
  const octets = host.split('.').map(Number);
  const privateLAN = isIP(host) === 4 && (octets[0] === 10 || (octets[0] === 192 && octets[1] === 168) || (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31));
  if (publicURL.protocol !== 'https:' && !privateLAN && !['localhost', '127.0.0.1', '[::1]'].includes(host)) throw new Error('Use HTTPS outside localhost or a private LAN IP.');
  if (!env.APP_PASSWORD || env.APP_PASSWORD.length < 12 || !env.APP_SECRET || env.APP_SECRET.length < 32) throw new Error('Run node setup.mjs first; set APP_PASSWORD (12+ characters) and APP_SECRET (32+ characters).');
  const maxParses = Number(env.MAX_PARSES_PER_DAY || 20);
  const port = Number(env.PORT || 3080);
  if (!Number.isInteger(maxParses) || maxParses < 1 || maxParses > 1000 || !Number.isInteger(port) || port < 0 || port > 65535) throw new Error('Invalid daily parse limit or port.');
  return { publicURL: publicURL.origin, port, password: env.APP_PASSWORD, secret: env.APP_SECRET, openaiKey: env.OPENAI_API_KEY || '', model: env.OPENAI_MODEL || 'gpt-6.1-sol', googleFile: env.GOOGLE_APPLICATION_CREDENTIALS || '', demo: env.DEMO_MODE === '1', maxParses, title: env.SHIFT_TITLE || 'Reachel' };
}
export function createApp(config, suppliedServices) {
  const services = suppliedServices || createServices(config);
  const passwordSalt = randomBytes(16);
  const passwordHash = scryptSync(config.password, passwordSalt, 32);
  const sign = x => createHmac('sha256', config.secret).update(x).digest('base64url');
  const safeEqual = (a, b) => { const aa = Buffer.from(a), bb = Buffer.from(b); return aa.length === bb.length && timingSafeEqual(aa, bb); };
  const attempts = new Map();
  let importQueue = Promise.resolve(), parseBusy = false, usage = { day: '', count: 0 };
  const staticFiles = { '/': ['index.html', 'text/html'], '/app.js': ['app.js', 'text/javascript'], '/style.css': ['style.css', 'text/css'], '/manifest.webmanifest': ['manifest.webmanifest', 'application/manifest+json'], '/icon.svg': ['icon.svg', 'image/svg+xml'], '/docker-icon.png': ['docker-icon.png', 'image/png'] };
  const publicDir = new URL('./public/', import.meta.url);
  function session(req) {
    const cookie = /(?:^|;\s*)schedule_session=([^;]+)/.exec(req.headers.cookie || '')?.[1];
    if (!cookie) return null;
    const [payload, signature, extra] = cookie.split('.');
    if (!payload || !signature || extra || !safeEqual(signature, sign(payload))) return null;
    try { const obj = JSON.parse(Buffer.from(payload, 'base64url')); return obj.exp > Date.now() && typeof obj.nonce === 'string' ? obj : null; } catch { return null; }
  }
  function cookie(value, maxAge) { return `schedule_session=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${config.publicURL.startsWith('https:') ? '; Secure' : ''}`; }
  async function body(req, max = 65536) {
    const chunks = []; let size = 0;
    for await (const chunk of req) { size += chunk.length; if (size > max) throw new AppError('Upload is too large.', 413); chunks.push(chunk); }
    return Buffer.concat(chunks);
  }
  async function jsonBody(req) {
    if (req.headers['content-type']?.split(';')[0] !== 'application/json') throw new AppError('Expected JSON.', 415);
    try { return JSON.parse((await body(req)).toString('utf8')); }
    catch (err) { if (err instanceof AppError) throw err; throw new AppError('Invalid JSON.'); }
  }
  function send(res, status, result) { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(result)); }
  const server = http.createServer(async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Content-Security-Policy', "default-src 'self'; img-src 'self' blob: data:; style-src 'self'; script-src 'self'; connect-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
    try {
      const url = new URL(req.url, config.publicURL);
      if (req.method === 'GET' && url.pathname === '/healthz') return send(res, 200, { ok: true });
      if (req.method === 'GET' && staticFiles[url.pathname]) {
        const [name, mime] = staticFiles[url.pathname];
        const bytes = await readFile(new URL(name, publicDir));
        res.writeHead(200, { 'Content-Type': mime === 'image/png' ? mime : mime + '; charset=utf-8' }); return res.end(bytes);
      }
      if (req.method === 'POST') {
        if (req.headers.origin !== config.publicURL) throw new AppError('Open this app using its configured PUBLIC_URL.', 403);
        if (req.headers['sec-fetch-site'] && !['same-origin', 'none'].includes(req.headers['sec-fetch-site'])) throw new AppError('Cross-site request denied.', 403);
      }
      if (req.method === 'POST' && url.pathname === '/api/login') {
        const ip = req.socket.remoteAddress || 'unknown';
        const now = Date.now();
        for (const [key, value] of attempts) if (now > value.until) attempts.delete(key);
        const attempt = attempts.get(ip) || { count: 0, until: now + 15 * 60000 };
        if (attempt.count >= 10) throw new AppError('Too many login attempts. Wait 15 minutes.', 429);
        const input = await jsonBody(req);
        if (typeof input.password !== 'string' || input.password.length > 1024) throw new AppError('Password not accepted.', 401);
        const actual = scryptSync(input.password, passwordSalt, 32);
        if (!timingSafeEqual(actual, passwordHash)) { attempt.count++; attempts.set(ip, attempt); throw new AppError('Password not accepted.', 401); }
        attempts.delete(ip);
        const payload = Buffer.from(JSON.stringify({ exp: now + 90 * 86400000, nonce: randomBytes(24).toString('base64url') })).toString('base64url');
        res.setHeader('Set-Cookie', cookie(payload + '.' + sign(payload), 90 * 86400));
        return send(res, 200, { ok: true });
      }
      const auth = session(req);
      if (!auth) throw new AppError('Please sign in.', 401);
      const csrf = sign('csrf:' + auth.nonce);
      if (req.method === 'POST' && !safeEqual(req.headers['x-csrf-token'] || '', csrf)) throw new AppError('Refresh this page and try again.', 403);
      if (req.method === 'GET' && url.pathname === '/api/status') return send(res, 200, { csrf, calendar: 'Reachel Test', calendarId: CALENDAR_ID, timezone: TIMEZONE, title: config.title, model: config.model, openaiConfigured: Boolean(config.openaiKey), calendarConfigured: Boolean(config.googleFile), demo: config.demo, maxParsesPerDay: config.maxParses });
      if (req.method === 'POST' && url.pathname === '/api/logout') { res.setHeader('Set-Cookie', cookie('', 0)); return send(res, 200, { ok: true }); }
      if (req.method === 'POST' && url.pathname === '/api/demo') {
        if (!config.demo) throw new AppError('Demo mode is disabled.', 404);
        return send(res, 200, { period: 'DEMO — synthetic dates, not your screenshot', shifts: [{ date: '2026-10-22', evidence: 'Synthetic example only.' }, { date: '2026-10-23', evidence: 'Synthetic example only.' }], issues: ['DEMO ONLY: no screenshot was read and calendar writes are disabled.'], usage: null });
      }
      if (req.method === 'POST' && url.pathname === '/api/parse') {
        if (config.demo) throw new AppError('Turn off DEMO_MODE to read a real screenshot.', 409);
        if (!config.openaiKey) throw new AppError('Add OPENAI_API_KEY on the server first.', 503);
        if (parseBusy) throw new AppError('A screenshot is already being read. Wait for it to finish.', 429);
        const mime = String(req.headers['content-type'] || '').split(';')[0];
        const bytes = await body(req, 10 * 1024 * 1024);
        checkImage(bytes, mime);
        const year = url.searchParams.has('year') ? Number(url.searchParams.get('year')) : undefined;
        if (year !== undefined && (!Number.isInteger(year) || year < 2020 || year > 2099)) throw new AppError('Invalid year.');
        const day = new Date().toISOString().slice(0, 10);
        if (usage.day !== day) usage = { day, count: 0 };
        if (usage.count >= config.maxParses) throw new AppError('Daily screenshot-reading limit reached. Try tomorrow.', 429);
        usage.count++; parseBusy = true;
        try { return send(res, 200, await services.parse(bytes, mime, year)); }
        finally { parseBusy = false; }
      }
      if (req.method === 'POST' && ['/api/check', '/api/import'].includes(url.pathname)) {
        if (config.demo) throw new AppError('Calendar access is disabled in demo mode.', 409);
        if (!config.googleFile) throw new AppError('Google Calendar is not configured. You can still test screenshot reading.', 503);
        const input = await jsonBody(req);
        const dates = normalizeDates(input.dates);
        if (url.pathname === '/api/check') {
          const rows = await classifyDates(dates, services.calendar, config.title);
          return send(res, 200, { rows: rows.map(({ date, status }) => ({ date, status })) });
        }
        if (input.confirmed !== true) throw new AppError('Review and confirm the dates before adding shifts.');
        const run = importQueue.then(() => importDates(dates, services.calendar, config.title));
        importQueue = run.catch(() => {});
        return send(res, 200, { results: await run });
      }
      throw new AppError('Not found.', 404);
    } catch (err) { if (!res.headersSent) send(res, err instanceof AppError ? err.status : 500, { error: err instanceof AppError ? err.message : 'Server error. No result could be confirmed; check the calendar before retrying.' }); else res.end(); }
  });
  server.requestTimeout = 150000;
  server.headersTimeout = 15000;
  return server;
}
if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const config = loadConfig();
  createApp(config).listen(config.port, '0.0.0.0', () => console.log(`Reachel Schedule listening on port ${config.port}. Demo: ${config.demo}.`));
}
