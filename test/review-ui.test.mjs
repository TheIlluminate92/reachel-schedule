import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';

const html = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');
const script = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');

function element(tag = '') {
  const listeners = new Map();
  return {
    tag, children: [], value: '', files: [], textContent: '', checked: false,
    classList: { toggle() {} }, setAttribute() {}, scrollIntoView() {}, focus() {},
    removeAttribute(name) { delete this[name]; },
    addEventListener(event, callback) { listeners.set(event, callback); },
    emit(event) { return listeners.get(event)?.(); },
    append(...children) { this.children.push(...children); },
    replaceChildren() { this.children = []; },
    querySelector(selector) { return this.querySelectorAll(selector)[0]; },
    querySelectorAll(selector) {
      const tags = selector.replace(/\[type=date\]/, '').split(',');
      return this.children.flatMap(child => [
        ...(tags.includes(child.tag) ? [child] : []),
        ...child.querySelectorAll(selector)
      ]);
    }
  };
}

async function browser(results = []) {
  const dom = Object.fromEntries([...html.matchAll(/id="([^"]+)"/g)].map(([, id]) => [id, element()]));
  const calls = [], revoked = [];
  const responses = {
    '/api/status': { csrf: 'fixture', openaiConfigured: true, calendarConfigured: true, demo: false },
    '/api/parse': { period: 'Fixture', shifts: [{ date: '2032-01-03' }, { date: '2032-01-04' }], issues: [] },
    '/api/check': { rows: [{ date: '2032-01-03', status: 'conflict' }] },
    '/api/import': { results }
  };
  runInNewContext(script, {
    document: { getElementById: id => dom[id], createElement: element },
    URL: class extends URL {
      static createObjectURL() { return 'blob:fixture'; }
      static revokeObjectURL(url) { revoked.push(url); }
    },
    location: { href: 'http://localhost/' },
    fetch: async (path, options) => {
      calls.push({ path, ...options });
      assert.ok(Object.hasOwn(responses, path));
      return { ok: true, json: async () => responses[path] };
    }
  });
  await new Promise(resolve => setImmediate(resolve));
  dom.screenshot.files = [{ name: 'fixture.png', type: 'image/png', size: 128 }];
  dom.screenshot.emit('change');
  return { dom, calls, revoked };
}

test('an invalid replacement removes the preview and cannot submit the old screenshot', async () => {
  const { dom, calls, revoked } = await browser();
  assert.equal(dom.parse.disabled, false);
  dom.screenshot.files = [{ name: 'wrong.txt', type: 'text/plain', size: 128 }];
  dom.screenshot.emit('change');
  assert.equal(dom.parse.disabled, true);
  assert.equal(dom['image-preview'].hidden, true);
  assert.equal(dom['preview-image'].src, undefined);
  assert.equal(dom['upload-label'].textContent, 'Choose screenshot');
  assert.deepEqual(revoked, ['blob:fixture']);
  await dom.parse.emit('click');
  assert.deepEqual(calls.map(x => x.path), ['/api/status']);
});

test('partial imports can return to the edited dates and require a new confirmation', async () => {
  const { dom, calls } = await browser([
    { date: '2032-01-03', status: 'conflict' },
    { date: '2032-01-05', status: 'unconfirmed' }
  ]);
  await dom.parse.emit('click');
  const inputs = dom.dates.querySelectorAll('input[type=date]');
  inputs[1].value = '2032-01-05';
  inputs[1].emit('input');
  await dom.check.emit('click');
  dom.confirmed.checked = true;
  dom.confirmed.emit('change');
  await dom.save.emit('click');
  assert.equal(dom['review-panel'].hidden, true);
  assert.equal(dom['review-dates'].hidden, false);
  assert.match(dom.results.children[1].children[1].textContent, /check Google Calendar/);
  dom['review-dates'].emit('click');
  assert.equal(dom['result-panel'].hidden, true);
  assert.equal(dom['review-panel'].hidden, false);
  assert.deepEqual(dom.dates.querySelectorAll('input[type=date]').map(x => x.value), ['2032-01-03', '2032-01-05']);
  assert.equal(dom['check-status'].textContent, '');
  assert.equal(dom.confirmed.checked, false);
  assert.equal(dom.save.disabled, true);
  assert.equal(calls.filter(x => x.path === '/api/import').length, 1);
});

test('Docker health probe targets the configured internal port', async () => {
  const dockerfile = await readFile(new URL('../Dockerfile', import.meta.url), 'utf8');
  const probe = dockerfile.match(/^HEALTHCHECK .* CMD node -e "([^"]+)"$/m)?.[1];
  assert.ok(probe);
  for (const [port, expected] of [[undefined, '3080'], ['18080', '18080']]) {
    await runInNewContext(probe, {
      fetch: async url => {
        assert.equal(url, 'http://127.0.0.1:' + expected + '/healthz');
        return { ok: true };
      },
      process: { env: { PORT: port }, exit: code => assert.equal(code, 0) }
    });
  }
});
