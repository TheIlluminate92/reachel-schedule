import { randomBytes } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
const template = await readFile(new URL('./.env.example', import.meta.url), 'utf8');
try {
  await writeFile(new URL('./.env', import.meta.url), template.replace('replace-with-at-least-12-characters', randomBytes(18).toString('base64url')).replace('replace-with-a-random-secret-at-least-32-characters', randomBytes(32).toString('hex')), { flag: 'wx', mode: 0o600 });
  console.log('Created .env with random login secrets. Open it locally to set your API key. No secrets were printed.');
} catch (err) { if (err.code === 'EEXIST') console.log('.env already exists; it was not changed.'); else throw err; }
