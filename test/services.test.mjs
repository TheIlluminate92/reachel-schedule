import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync, verify } from 'node:crypto';
import { writeFile, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServices } from '../services.mjs';
import { CALENDAR_ID } from '../core.mjs';

test('Google authentication signs a valid JWT and pagination remains on the fixed calendar', async () => {
  const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const filename = join(tmpdir(), `reachel-test-${crypto.randomUUID()}.json`);
  await writeFile(filename, JSON.stringify({ type: 'service_account', client_email: 'fixture@example.iam.gserviceaccount.com', private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }), token_uri: 'https://untrusted.example' }), { mode: 0o600 });
  let tokens = 0, pages = 0;
  try {
    const service = createServices({ googleFile: filename }, async (url, options) => {
      if (url === 'https://oauth2.googleapis.com/token') {
        tokens++;
        const [header, payload, signature] = options.body.get('assertion').split('.');
        const claims = JSON.parse(Buffer.from(payload, 'base64url'));
        assert.equal(claims.scope, 'https://www.googleapis.com/auth/calendar.events');
        assert.equal(claims.aud, 'https://oauth2.googleapis.com/token');
        assert.equal(claims.exp - claims.iat, 3600);
        assert.ok(verify('RSA-SHA256', Buffer.from(header + '.' + payload), publicKey, Buffer.from(signature, 'base64url')));
        return { ok: true, json: async () => ({ access_token: 'fixture-token', expires_in: 3600 }) };
      }
      const parsed = new URL(url);
      assert.ok(parsed.pathname.startsWith('/calendar/v3/calendars/' + encodeURIComponent(CALENDAR_ID) + '/events'));
      assert.equal(options.headers.Authorization, 'Bearer fixture-token');
      assert.equal(parsed.searchParams.get('timeMin'), '2026-10-01T00:00:00Z');
      pages++;
      return { ok: true, json: async () => pages === 1 ? { items: [{ id: 'first' }], nextPageToken: 'page-two' } : { items: [{ id: 'second' }] } };
    });
    const result = await service.calendar.list('2026-10-01T00:00:00Z', '2026-11-01T00:00:00Z');
    assert.deepEqual(result.map(x => x.id), ['first', 'second']);
    assert.equal(tokens, 1); assert.equal(pages, 2);
  } finally { await unlink(filename); }
});
test('OpenAI adapter sends an image to Responses and returns parsed dates, not calendar writes', async () => {
  const bytes = Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]), Buffer.alloc(20)]);
  const service = createServices({ openaiKey: 'fixture-key', model: 'fixture-model' }, async (url, options) => {
    assert.equal(url, 'https://api.openai.com/v1/responses');
    const body = JSON.parse(options.body);
    assert.equal(body.model, 'fixture-model');
    assert.equal(body.input[0].content[1].image_url, 'data:image/png;base64,' + bytes.toString('base64'));
    return { ok: true, json: async () => ({ status: 'completed', output: [{ content: [{ type: 'output_text', text: JSON.stringify({ period: 'Oct 2026', shifts: [{ date: '2026-10-22', evidence: 'Blue dot' }], issues: [] }) }] }], usage: { input_tokens: 123, output_tokens: 45 } }) };
  });
  assert.equal((await service.parse(bytes, 'image/png')).shifts[0].date, '2026-10-22');
});
