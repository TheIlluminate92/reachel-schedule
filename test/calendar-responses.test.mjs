import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CALENDAR_ID, importDates, makeEvent } from '../core.mjs';
import { createServices } from '../services.mjs';

const date = '2032-01-03';
const event = makeEvent(date);
const list = (items = [], pagination = {}) => ({ kind: 'calendar#events', items, ...pagination });
const fixtureKey = generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey;
const unreadable = Symbol('unreadable response');
const response = body => ({
  ok: true,
  async json() {
    if (body === unreadable) throw new SyntaxError('fixture truncated body');
    return body;
  }
});

async function calendarFixture(t, reply) {
  const directory = await mkdtemp(join(tmpdir(), 'reachel-calendar-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const googleFile = join(directory, 'fixture.json');
  await writeFile(googleFile, JSON.stringify({
    type: 'service_account', client_email: 'fixture@example.test',
    private_key: fixtureKey.export({ type: 'pkcs8', format: 'pem' })
  }), { mode: 0o600 });
  return createServices({ googleFile }, async (url, options) => {
    if (url === 'https://oauth2.googleapis.com/token') return response({ access_token: 'fixture-token' });
    const parsed = new URL(url);
    const path = '/calendar/v3/calendars/' + encodeURIComponent(CALENDAR_ID) + '/events';
    assert.equal(parsed.origin, 'https://www.googleapis.com');
    assert.ok(parsed.pathname === path || parsed.pathname === path + '/' + event.id);
    return reply(parsed, options);
  }).calendar;
}

test('every Calendar page must be valid before any insert, including subsequent and repeated pages', async t => {
  for (const [label, invalid] of [
    ['non-JSON', unreadable], ['null body', null], ['missing items', { kind: 'calendar#events' }],
    ['non-array items', list({})], ['not an event', list([null])],
    ['invalid event time', list([{ ...event, start: { dateTime: '7' } }])],
    ['ambiguous local time', list([{ ...event, start: { dateTime: '2032-01-03T18:30:00' } }])],
    ['wrong collection', { kind: 'calendar#event', items: [] }],
    ['invalid token', list([], { nextPageToken: false })],
    ['blank token', list([], { nextPageToken: ' ' })],
    ['repeated token', list([], { nextPageToken: 'second' })]
  ]) {
    await t.test(label, async t => {
      let reads = 0, writes = 0;
      const calendar = await calendarFixture(t, (url, options) => {
        if (options.method === 'POST') {
          writes++;
          return response(event);
        }
        reads++;
        return response(url.searchParams.get('pageToken') ? invalid : list([], { nextPageToken: 'second' }));
      });
      await assert.rejects(importDates([date], calendar), error => error.status === 502);
      assert.equal(reads, 2);
      assert.equal(writes, 0);
    });
  }
});

test('valid Calendar pagination supports empty pages, all-day events and explicit empty results', async t => {
  const allDay = { id: 'all-day-fixture', summary: 'Day off', start: { date: '2032-01-03' }, end: { date: '2032-01-04' } };
  const calendar = await calendarFixture(t, (url, options) => {
    if (options.method === 'POST') return response(event);
    return response(url.searchParams.get('pageToken') ? list([allDay]) : list([], { nextPageToken: 'second' }));
  });
  assert.deepEqual(await importDates([date], calendar), [{ date, status: 'added' }]);
});

test('ambiguous insert responses trigger one stable-ID lookup without replay', async t => {
  for (const [label, insertBody, getBody, expected] of [
    ['unreadable insert, exact event', unreadable, event, 'existing'],
    ['null insert, exact event', null, event, 'existing'],
    ['invalid insert, conflicting event', {}, { ...event, end: { dateTime: '2032-01-04T15:00:00Z' } }, 'conflict'],
    ['wrong insert ID, unreadable lookup', { ...event, id: 'wrong' }, unreadable, 'unconfirmed'],
    ['wrong insert times, wrong lookup ID', { ...event, end: { dateTime: '2032-01-04T15:00:00Z' } }, { ...event, id: 'wrong' }, 'unconfirmed'],
    ['valid insert', event, undefined, 'added']
  ]) {
    await t.test(label, async t => {
      const calls = [];
      const calendar = await calendarFixture(t, (url, options) => {
        if (options.method === 'POST') {
          calls.push('insert');
          assert.equal(JSON.parse(options.body).id, event.id);
          return response(insertBody);
        }
        if (url.pathname.endsWith('/' + event.id)) {
          calls.push('lookup');
          return response(getBody);
        }
        calls.push('list');
        return response(list());
      });
      assert.deepEqual(await importDates([date], calendar), [{ date, status: expected }]);
      assert.deepEqual(calls, getBody === undefined ? ['list', 'insert'] : ['list', 'insert', 'lookup']);
    });
  }
});
