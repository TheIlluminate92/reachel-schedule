import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeEvent, normalizeDates, sameShift, importDates, classifyDates, visionRequest, readVisionResponse, CALENDAR_ID } from '../core.mjs';

test('winter and summer shifts use Central wall time, not a fixed UTC offset', () => {
  assert.equal(makeEvent('2026-10-22').start.dateTime, '2026-10-22T23:30:00.000Z');
  assert.equal(makeEvent('2026-11-02').start.dateTime, '2026-11-03T00:30:00.000Z');
  assert.equal(makeEvent('2026-12-31').end.dateTime, '2027-01-01T13:00:00.000Z');
});
test('overnight shifts crossing DST retain 6:30 PM / 7 AM and actual elapsed hours', () => {
  const hours = date => { const e = makeEvent(date); return (Date.parse(e.end.dateTime) - Date.parse(e.start.dateTime)) / 3600000; };
  assert.equal(hours('2026-10-31'), 13.5);
  assert.equal(hours('2026-03-07'), 11.5);
  assert.equal(hours('2026-10-22'), 12.5);
});
test('invalid dates and excessive periods are rejected; duplicates are sorted and collapsed', () => {
  assert.deepEqual(normalizeDates(['2026-10-23', '2026-10-22', '2026-10-22']), ['2026-10-22', '2026-10-23']);
  for (const dates of [[], ['2026-02-30'], ['2026-01-01', '2026-12-31'], ['26-01-01']]) assert.throws(() => normalizeDates(dates));
});
test('legacy names are recognized without hiding a different shift time or unrelated appointment', () => {
  const wanted = makeEvent('2026-10-22');
  assert.ok(sameShift({ ...wanted, summary: 'Reachel Night Shift', extendedProperties: {} }, wanted));
  assert.ok(sameShift({ ...wanted, summary: 'Reachel' }, wanted));
  assert.equal(sameShift({ ...wanted, summary: 'Dentist', extendedProperties: {} }, wanted), false);
  assert.equal(sameShift({ ...wanted, status: 'cancelled' }, wanted), false);
  assert.equal(sameShift({ ...wanted, end: { dateTime: '2026-10-23T13:00:00Z' } }, wanted), false);
});
test('reupload skips legacy events and flags a different time instead of duplicating it', async () => {
  const a = makeEvent('2026-10-22');
  const b = makeEvent('2026-10-23'); b.end.dateTime = '2026-10-24T13:00:00Z';
  const calendar = { list: async () => [a, b], insert: async () => assert.fail('must not insert') };
  const result = await importDates(['2026-10-22', '2026-10-23'], calendar);
  assert.deepEqual(result.map(x => x.status), ['existing', 'conflict']);
});
test('a write that succeeds then times out is confirmed by stable ID; partial failures remain explicit', async () => {
  const stored = new Map();
  const calendar = {
    list: async () => [],
    insert: async e => { if (e.extendedProperties.private.shiftStartDate.endsWith('22')) stored.set(e.id, e); throw new Error('timeout'); },
    get: async id => { if (stored.has(id)) return stored.get(id); throw new Error('unavailable'); }
  };
  const result = await importDates(['2026-10-22', '2026-10-23'], calendar);
  assert.deepEqual(result.map(x => x.status), ['existing', 'unconfirmed']);
  assert.equal(makeEvent('2026-10-22').id, makeEvent('2026-10-22').id);
  assert.notEqual(makeEvent('2026-10-22').id, makeEvent('2026-10-23').id);
  assert.ok(/^[0-9a-v]{5,1024}$/.test(makeEvent('2026-10-22').id));
});
test('image bytes are sent as a high-detail image, with strict blue-dot instructions and no storage', () => {
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a4nQAAAAASUVORK5CYII=', 'base64');
  const request = visionRequest(png, 'image/png', 'test-model', 2026);
  assert.equal(request.input[0].content[1].image_url, 'data:image/png;base64,' + png.toString('base64'));
  assert.equal(request.input[0].content[1].detail, 'high');
  assert.equal(request.store, false);
  assert.match(request.instructions, /ONLY dates with BLUE/);
  assert.match(request.instructions, /IGNORE GREEN/);
  assert.equal(request.text.format.strict, true);
  assert.throws(() => visionRequest(Buffer.from('not an image at all'), 'image/png', 'test'));
  assert.ok(CALENDAR_ID.endsWith('@group.calendar.google.com'));
});
test('refusals and truncated results do not become apparently successful dates', () => {
  assert.throws(() => readVisionResponse({ status: 'incomplete', output: [] }));
  assert.throws(() => readVisionResponse({ status: 'completed', output: [{ content: [{ type: 'refusal' }] }] }));
  const response = data => ({ status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify(data) }] }] });
  assert.throws(() => readVisionResponse(response({ period: 'Feb', shifts: [{ date: '2026-02-30', evidence: 'blue' }], issues: [] })));
  const result = readVisionResponse(response({ period: 'Oct 2026', shifts: [{ date: '2026-10-22', evidence: 'blue dot' }], issues: ['One dot is unclear.'] }));
  assert.deepEqual(result.shifts.map(x => x.date), ['2026-10-22']);
  assert.deepEqual(result.issues, ['One dot is unclear.']);
});
