const $ = id => document.getElementById(id);
let state, selectedFile, objectURL, busy = false, latestRows = new Map();
const formatDate = value => new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' }).format(new Date(value + 'T12:00:00Z'));
function notice(message, error = false) { $('notice').textContent = message; $('notice').classList.toggle('error', error); $('notice').hidden = !message; }
async function api(path, data, raw = false) {
  const headers = {};
  if (state?.csrf) headers['X-CSRF-Token'] = state.csrf;
  if (data !== undefined) headers['Content-Type'] = raw ? selectedFile.type : 'application/json';
  const response = await fetch(path, { method: data === undefined ? 'GET' : 'POST', headers, body: data === undefined ? undefined : raw ? data : JSON.stringify(data) });
  const result = await response.json();
  if (!response.ok) {
    if (response.status === 401 && path !== '/api/login') showLogin();
    throw new Error(result.error || 'The request could not be completed.');
  }
  return result;
}
function showLogin() { state = null; $('login-panel').hidden = false; $('app-panel').hidden = true; $('logout').hidden = true; }
function rows() { return [...$('dates').querySelectorAll('input[type=date]')].map(x => x.value); }
function refreshSave() { $('save').disabled = busy || !state?.calendarConfigured || state?.demo || !$('confirmed').checked || !rows().length || rows().some(x => !x); }
function invalidateCheck() { latestRows.clear(); $('check-status').textContent = ''; $('confirmed').checked = false; updateDateLabels(); refreshSave(); }
function updateDateLabels() {
  for (const row of $('dates').children) {
    const date = row.querySelector('input').value;
    row.querySelector('strong').textContent = date ? formatDate(date) : 'Choose a date';
    const status = latestRows.get(date);
    row.querySelector('small').textContent = status === 'existing' ? 'Already on calendar · skip' : status === 'conflict' ? 'Different shift time · review' : status === 'new' ? 'New work night' : '6:30 PM → next day 7:00 AM';
  }
}
function addDate(date = '') {
  const row = document.createElement('div'); row.className = 'date-row';
  const input = document.createElement('input'); input.type = 'date'; input.value = date; input.setAttribute('aria-label', 'Night shift start date'); input.addEventListener('input', invalidateCheck);
  const info = document.createElement('div'); info.className = 'date-info'; info.append(document.createElement('strong'), document.createElement('small'));
  const remove = document.createElement('button'); remove.className = 'remove'; remove.textContent = '×'; remove.setAttribute('aria-label', 'Remove this work night'); remove.addEventListener('click', () => { row.remove(); invalidateCheck(); });
  row.append(input, info, remove); $('dates').append(row); invalidateCheck();
}
async function withBusy(button, label, run) {
  if (busy) return;
  busy = true; const original = button.textContent; button.disabled = true; button.textContent = label;
  $('dates').querySelectorAll('input,button').forEach(x => x.disabled = true);
  for (const id of ['parse', 'demo', 'check', 'add-date', 'confirmed', 'screenshot']) $(id).disabled = true;
  refreshSave(); notice('');
  try { await run(); } catch (err) { notice(err.message || 'Something went wrong.', true); }
  finally {
    busy = false; button.textContent = original; button.disabled = false;
    $('dates').querySelectorAll('input,button').forEach(x => x.disabled = false);
    for (const id of ['demo', 'add-date', 'confirmed', 'screenshot']) $(id).disabled = false;
    $('parse').disabled = !selectedFile || !state?.openaiConfigured || state?.demo;
    $('check').disabled = !state?.calendarConfigured || state?.demo;
    refreshSave();
  }
}
async function initialize() {
  try {
    state = await api('/api/status');
    $('login-panel').hidden = true; $('app-panel').hidden = false; $('logout').hidden = false;
    $('demo-banner').hidden = !state.demo; $('demo').hidden = !state.demo;
    $('check').disabled = !state.calendarConfigured || state.demo;
    $('calendar-help').textContent = state.demo ? 'Calendar writes are disabled in demo mode.' : state.calendarConfigured ? '' : 'Calendar connection needs attention. You can still review your dates.';
    $('parse').disabled = !selectedFile || !state.openaiConfigured || state.demo; refreshSave();
    if (new URL(location.href).searchParams.get('shared') === '1') notice('Choose the screenshot you want to send.');
  } catch (err) { showLogin(); if (err.message !== 'Please sign in.') notice(err.message, true); }
}
$('login-form').addEventListener('submit', async event => {
  event.preventDefault(); const button = event.submitter; button.disabled = true; notice('');
  try { await api('/api/login', { password: $('password').value }); $('password').value = ''; await initialize(); }
  catch (err) { notice(err.message, true); } finally { button.disabled = false; }
});
$('logout').addEventListener('click', async () => { try { await api('/api/logout', {}); location.reload(); } catch (err) { notice(err.message, true); } });
$('screenshot').addEventListener('change', () => {
  const file = $('screenshot').files[0]; if (!file) return;
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 10 * 1024 * 1024) { notice('Choose a PNG, JPEG, or WebP screenshot under 10 MB.', true); $('screenshot').value = ''; return; }
  if (objectURL) URL.revokeObjectURL(objectURL);
  selectedFile = file; objectURL = URL.createObjectURL(file); $('preview-image').src = objectURL;
  $('image-preview').hidden = false; $('upload-label').textContent = file.name; $('review-panel').hidden = true; $('result-panel').hidden = true;
  $('parse').disabled = !state?.openaiConfigured || state.demo; notice('');
});
$('change-image').addEventListener('click', () => { if (!busy) $('screenshot').click(); });
function showParsed(result) {
  $('period').textContent = result.period; $('dates').replaceChildren(); latestRows.clear();
  for (const shift of result.shifts) addDate(shift.date);
  $('issues').replaceChildren(); const issues = [...result.issues];
  if (!result.shifts.length) issues.push('No work nights were identified. You can add dates manually, or choose a clearer screenshot.');
  for (const issue of issues) { const p = document.createElement('p'); p.textContent = issue; $('issues').append(p); }
  $('issues').hidden = !issues.length; $('review-panel').hidden = false; $('result-panel').hidden = true;
  $('review-panel').scrollIntoView({ behavior: 'smooth', block: 'start' });
}
$('parse').addEventListener('click', () => withBusy($('parse'), 'Reading blue dots…', async () => {
  if (!selectedFile) return;
  const year = $('year').value.trim();
  if (year && (!/^20\d{2}$/.test(year) || +year < 2020)) throw new Error('Enter a year between 2020 and 2099.');
  showParsed(await api('/api/parse' + (year ? '?year=' + encodeURIComponent(year) : ''), selectedFile, true));
}));
$('demo').addEventListener('click', () => withBusy($('demo'), 'Loading example…', async () => showParsed(await api('/api/demo', {}))));
$('add-date').addEventListener('click', () => { if (!busy) addDate(); });
$('confirmed').addEventListener('change', refreshSave);
$('check').addEventListener('click', () => withBusy($('check'), 'Checking calendar…', async () => {
  const result = await api('/api/check', { dates: rows() }); latestRows = new Map(result.rows.map(x => [x.date, x.status])); updateDateLabels();
  const count = status => result.rows.filter(x => x.status === status).length;
  $('check-status').textContent = `${count('new')} new · ${count('existing')} already present · ${count('conflict')} need review`;
}));
$('save').addEventListener('click', () => withBusy($('save'), 'Adding shifts…', async () => {
  if (!$('confirmed').checked) throw new Error('Check the dates before adding shifts.');
  const { results } = await api('/api/import', { dates: rows(), confirmed: true });
  const added = results.filter(x => x.status === 'added').length;
  const uncertain = results.some(x => ['conflict', 'unconfirmed'].includes(x.status));
  $('result-title').textContent = uncertain ? 'Some shifts need attention' : added ? `${added} shift${added === 1 ? '' : 's'} added` : 'These shifts are already there';
  $('results').replaceChildren();
  const labels = { added: 'Added', existing: 'Already present · skipped', conflict: 'Conflict · not changed', unconfirmed: 'Unconfirmed · check Google Calendar' };
  for (const result of results) {
    const row = document.createElement('div'); row.className = 'result-line'; const date = document.createElement('span'); date.textContent = formatDate(result.date); const status = document.createElement('strong'); status.textContent = labels[result.status]; row.append(date, status); $('results').append(row);
  }
  $('result-panel').hidden = false; $('review-panel').hidden = true; $('confirmed').checked = false; $('result-panel').scrollIntoView({ behavior: 'smooth' });
}));
$('another').addEventListener('click', () => { if (busy) return; $('result-panel').hidden = true; $('review-panel').hidden = true; $('app-panel').scrollIntoView({ behavior: 'smooth' }); $('screenshot').click(); });
initialize();
