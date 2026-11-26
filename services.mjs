import { readFile } from 'node:fs/promises';
import { createSign } from 'node:crypto';
import { CALENDAR_ID, AppError, sameShift, visionRequest, readVisionResponse } from './core.mjs';

async function requestJSON(url, options = {}, timeout = 30000, fetcher = fetch) {
  let response;
  try { response = await fetcher(url, { ...options, signal: AbortSignal.timeout(timeout) }); }
  catch { throw new AppError('The provider could not be reached. Check the server connection and try again.', 502); }
  if (!response.ok) {
    const messages = { 400: 'Provider rejected the request. Check the configured model or Google credentials.', 401: 'Provider authorization failed. Check the API key or Google credentials.', 403: 'Access denied. Check API permissions and share Reachel Test with the Google service account.', 404: 'Calendar, event, or model was not found. Check configuration.', 409: 'That event ID already exists.', 429: 'Provider usage limit reached. Check billing or wait before trying again.' };
    throw new AppError(messages[response.status] || 'Provider request failed. Try again later.', 502);
  }
  try { return await response.json(); }
  catch { throw new AppError('The provider returned an unreadable response.', 502); }
}

function isCalendarEvent(event) {
  if (!event || typeof event.id !== 'string' || !event.id.trim()) return false;
  // A cancelled event can contain only an ID and status.
  if (event.status === 'cancelled') return true;
  const orderedTimes = (start, end, format) => [start, end].every(value =>
    typeof value === 'string' && format.test(value)) && Date.parse(start) < Date.parse(end);
  // Compare only unambiguous times. A server-local interpretation could miss a shift.
  const timestamp = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/i;
  const date = /^\d{4}-\d{2}-\d{2}$/;
  if (event.start?.dateTime !== undefined || event.end?.dateTime !== undefined) {
    return orderedTimes(event.start?.dateTime, event.end?.dateTime, timestamp);
  }
  return orderedTimes(event.start?.date, event.end?.date, date);
}

export function createServices(config, fetcher = fetch) {
  let googleToken, refreshing;
  async function token() {
    if (googleToken && googleToken.expires > Date.now() + 60000) return googleToken.value;
    if (refreshing) return refreshing;
    refreshing = (async () => {
      if (!config.googleFile) throw new AppError('Google Calendar has not been configured yet.', 503);
      let account;
      try { account = JSON.parse(await readFile(config.googleFile, 'utf8')); }
      catch { throw new AppError('The Google service-account file could not be opened.', 503); }
      if (account.type !== 'service_account' || !account.client_email || !account.private_key) throw new AppError('Use a Google service-account JSON key file.', 503);
      const now = Math.floor(Date.now() / 1000);
      const encode = x => Buffer.from(JSON.stringify(x)).toString('base64url');
      const unsigned = encode({ alg: 'RS256', typ: 'JWT' }) + '.' + encode({ iss: account.client_email, scope: 'https://www.googleapis.com/auth/calendar.events', aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 });
      let signature;
      try { signature = createSign('RSA-SHA256').update(unsigned).sign(account.private_key, 'base64url'); }
      catch { throw new AppError('The Google service-account key is invalid.', 503); }
      const result = await requestJSON('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: unsigned + '.' + signature }) }, 30000, fetcher);
      if (!result?.access_token) throw new AppError('Google did not issue an access token.', 502);
      googleToken = { value: result.access_token, expires: Date.now() + Math.min(Number(result.expires_in) || 3600, 3600) * 1000 };
      return googleToken.value;
    })();
    try { return await refreshing; } finally { refreshing = null; }
  }
  const base = 'https://www.googleapis.com/calendar/v3/calendars/' + encodeURIComponent(CALENDAR_ID) + '/events';
  async function google(path, options = {}) {
    return requestJSON(base + path, { ...options, headers: { Authorization: `Bearer ${await token()}`, 'Content-Type': 'application/json' } }, 30000, fetcher);
  }
  return {
    async parse(bytes, mime, year) {
      if (!config.openaiKey) throw new AppError('Add OPENAI_API_KEY on the server to enable screenshot reading.', 503);
      return readVisionResponse(await requestJSON('https://api.openai.com/v1/responses', { method: 'POST', headers: { Authorization: `Bearer ${config.openaiKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify(visionRequest(bytes, mime, config.model, year)) }, 120000, fetcher));
    },
    calendar: {
      async list(timeMin, timeMax) {
        let pageToken;
        const events = [];
        const seenTokens = new Set();
        for (let page = 0; page < 10; page++) {
          const query = new URLSearchParams({ timeMin, timeMax, singleEvents: 'true', maxResults: '2500', showDeleted: 'false' });
          if (pageToken) query.set('pageToken', pageToken);
          const result = await google('?' + query);
          if (result?.kind !== 'calendar#events' || !Array.isArray(result.items) || !result.items.every(isCalendarEvent)) {
            throw new AppError('Calendar returned invalid events. No shifts were added.', 502);
          }
          events.push(...result.items);
          if (!Object.hasOwn(result, 'nextPageToken')) return events;
          pageToken = result.nextPageToken;
          if (typeof pageToken !== 'string' || !pageToken.trim() || seenTokens.has(pageToken)) {
            throw new AppError('Calendar returned invalid pagination. No shifts were added.', 502);
          }
          seenTokens.add(pageToken);
        }
        throw new AppError('Calendar results exceeded the read limit. No shifts were added.', 502);
      },
      async insert(event) {
        const result = await google('?sendUpdates=none', { method: 'POST', body: JSON.stringify(event) });
        if (!isCalendarEvent(result) || result.id !== event.id || !sameShift(result, event)) {
          throw new AppError('Calendar did not confirm the inserted shift.', 502);
        }
      },
      async get(id) {
        const result = await google('/' + encodeURIComponent(id));
        if (!isCalendarEvent(result) || result.id !== id) {
          throw new AppError('Calendar did not return the requested event.', 502);
        }
        return result;
      }
    }
  };
}
