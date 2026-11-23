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
test('recognized shifts overlapping across midnight block import, with exact matches taking precedence', async () => {
  const date = '2032-01-01';
  const wanted = makeEvent(date, 'Synthetic');
  const early = makeEvent('2031-12-31', 'Synthetic');
  early.end = wanted.end;
  const late = { ...wanted, start: { dateTime: '2032-01-02T09:00:00Z' }, end: { dateTime: '2032-01-02T15:00:00Z' } };
  for (const overlap of [early, late]) {
    const calendar = { list: async () => [overlap], insert: async () => assert.fail('must not insert an overlap') };
    assert.deepEqual(await importDates([date], calendar, 'Synthetic'), [{ date, status: 'conflict' }]);
    calendar.list = async () => [overlap, wanted];
    assert.equal((await classifyDates([date], calendar, 'Synthetic'))[0].status, 'existing');
  }
});
test('adjacent nights, cancelled or unrelated events, and invalid intervals do not block import', async () => {
  const date = '2032-01-01';
  const wanted = makeEvent(date, 'Synthetic');
  const previous = makeEvent('2031-12-31', 'Synthetic');
  previous.end = wanted.start;
  const events = [
    previous,
    makeEvent('2032-01-02', 'Synthetic'),
    { ...wanted, start: wanted.end, end: { dateTime: '2032-01-02T14:00:00Z' } },
    { ...wanted, status: 'cancelled' },
    { ...wanted, extendedProperties: {} },
    { ...wanted, start: { dateTime: 'invalid' } },
    { ...wanted, start: wanted.end, end: wanted.start }
  ];
  const result = await classifyDates([date], { list: async () => events }, 'Synthetic');
  assert.equal(result[0].status, 'new');
});
test('a recognized shift with a same-night start still needs review when its end is missing or invalid', async () => {
  const date = '2032-01-01';
  const wanted = makeEvent(date, 'Synthetic');
  for (const end of [undefined, { dateTime: 'invalid' }, wanted.start]) {
    const calendar = { list: async () => [{ ...wanted, end }] };
    assert.equal((await classifyDates([date], calendar, 'Synthetic'))[0].status, 'conflict');
  }
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
test('image bytes are sent with high detail, narrow highlighted-white instructions and no storage', () => {
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a4nQAAAAASUVORK5CYII=', 'base64');
  const request = visionRequest(png, 'image/png', 'test-model', 2026);
  assert.equal(request.input[0].content[1].image_url, 'data:image/png;base64,' + png.toString('base64'));
  assert.equal(request.input[0].content[1].detail, 'high');
  assert.equal(request.store, false);
  assert.match(request.instructions, /BLUE scheduled-work dot/);
  assert.match(request.instructions, /IGNORE GREEN/);
  assert.match(request.instructions, /WHITE dot in a highlighted cell/);
  assert.match(request.instructions, /same day and month/);
  assert.match(request.instructions, /overnight shift STARTS/);
  assert.deepEqual(request.text.format.schema.properties.shifts.items.properties.marker.enum, ['blue', 'highlighted_white']);
  assert.equal(request.text.format.strict, true);
  assert.throws(() => visionRequest(Buffer.from('not an image at all'), 'image/png', 'test'));
  assert.ok(CALENDAR_ID.endsWith('@group.calendar.google.com'));
});
test('only date-matched highlighted white dots enter the review list alongside ordinary blue dots', () => {
  const response = data => ({ status: 'completed', output: [{ content: [{ type: 'output_text', text: JSON.stringify(data) }] }] });
  const result = readVisionResponse(response({
    period: 'January–February 2032',
    shifts: [
      { date: '2032-01-03', marker: 'blue', scheduledWorkCardDate: null, evidence: 'Blue dot' },
      { date: '2032-01-08', marker: 'blue', scheduledWorkCardDate: null, evidence: 'Blue and green dots' },
      { date: '2032-01-09', marker: 'highlighted_white', scheduledWorkCardDate: '2032-02-09', evidence: 'Card is for a different month' },
      { date: '2032-01-17', marker: 'highlighted_white', scheduledWorkCardDate: null, evidence: 'No matching assignment card' },
      { date: '2032-01-31', marker: 'highlighted_white', scheduledWorkCardDate: '2032-01-31', evidence: 'Matching assigned overnight shift that ends in February' }
    ],
    issues: ['An unhighlighted white dot needs review.']
  }));
  assert.deepEqual(result.shifts.map(x => x.date), ['2032-01-03', '2032-01-08', '2032-01-31']);
  assert.deepEqual(Object.keys(result.shifts[2]), ['date', 'evidence']);
  assert.ok(result.issues.some(x => x.includes('2032-01-09')));
  assert.ok(result.issues.some(x => x.includes('2032-01-17')));
  assert.ok(result.issues.includes('An unhighlighted white dot needs review.'));
});
test('refusals and truncated results do not become apparently successful dates', () => {
  assert.throws(() => readVisionResponse({ status: 'incomplete', output: [] }));
  assert.throws(() => readVisionResponse({ status: 'completed', output: [{ content: [{ type: 'refusal' }] }] }));
  const response = data => ({ status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify(data) }] }] });
  assert.throws(() => readVisionResponse(response({ period: 'Feb', shifts: [{ date: '2026-02-30', evidence: 'blue' }], issues: [] })));
  assert.throws(() => readVisionResponse(response({ period: 'Jan 2032', shifts: [{ date: '2032-01-03', marker: 'green', scheduledWorkCardDate: null, evidence: 'Ignored marker' }], issues: [] })));
  const result = readVisionResponse(response({ period: 'Oct 2026', shifts: [{ date: '2026-10-22', marker: 'blue', scheduledWorkCardDate: null, evidence: 'blue dot' }], issues: ['One dot is unclear.'] }));
  assert.deepEqual(result.shifts.map(x => x.date), ['2026-10-22']);
  assert.deepEqual(result.issues, ['One dot is unclear.']);
});
