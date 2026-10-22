import { readFile } from 'node:fs/promises';
import { createSign } from 'node:crypto';
import { CALENDAR_ID, AppError, visionRequest, readVisionResponse } from './core.mjs';

async function requestJSON(url, options = {}, timeout = 30000, fetcher = fetch) {
  let response;
  try { response = await fetcher(url, { ...options, signal: AbortSignal.timeout(timeout) }); }
  catch { throw new AppError('The provider could not be reached. Check the server connection and try again.', 502); }
  let body;
  try { body = await response.json(); } catch { body = {}; }
  if (!response.ok) {
    const messages = { 400: 'Provider rejected the request. Check the configured model or Google credentials.', 401: 'Provider authorization failed. Check the API key or Google credentials.', 403: 'Access denied. Check API permissions and share Reachel Test with the Google service account.', 404: 'Calendar, event, or model was not found. Check configuration.', 409: 'That event ID already exists.', 429: 'Provider usage limit reached. Check billing or wait before trying again.' };
    throw new AppError(messages[response.status] || 'Provider request failed. Try again later.', 502);
  }
  return body;
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
      if (!result.access_token) throw new AppError('Google did not issue an access token.', 502);
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
        let pageToken, events = [];
        for (let page = 0; page < 10; page++) {
          const query = new URLSearchParams({ timeMin, timeMax, singleEvents: 'true', maxResults: '2500', showDeleted: 'false' });
          if (pageToken) query.set('pageToken', pageToken);
          const result = await google('?' + query);
          events.push(...(result.items || []));
          pageToken = result.nextPageToken;
          if (!pageToken) return events;
        }
        throw new AppError('Calendar results exceeded the read limit. No shifts were added.', 502);
      },
      insert(event) { return google('?sendUpdates=none', { method: 'POST', body: JSON.stringify(event) }); },
      get(id) { return google('/' + encodeURIComponent(id)); }
    }
  };
}
