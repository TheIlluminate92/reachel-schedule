import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';

test('idle server handles SIGTERM and exits cleanly without a forced kill', {
  skip: process.platform === 'win32' ? 'Windows child.kill does not deliver POSIX signals; verified in Linux image CI.' : false,
  timeout: 10000,
}, async () => {
  const child = spawn(process.execPath, [fileURLToPath(new URL('../server.mjs', import.meta.url))], {
    env: {
      PATH: process.env.PATH,
      APP_PASSWORD: 'shutdown-test-password-only',
      APP_SECRET: 'shutdown-test-secret-only-at-least-32-characters',
      PUBLIC_URL: 'http://127.0.0.1:3080', PORT: '0', DEMO_MODE: '1',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const exited = once(child, 'exit');
  let output = '';
  const deadline = setTimeout(() => child.kill('SIGKILL'), 8000);
  try {
    await new Promise((resolve, reject) => {
      child.once('error', reject);
      child.once('exit', () => reject(new Error('Server exited before listening.')));
      child.stdout.on('data', data => {
        output += data;
        if (output.includes('listening on port')) resolve();
      });
    });
    const start = performance.now();
    child.kill('SIGTERM');
    const [code, signal] = await exited;
    assert.equal(code, 0);
    assert.equal(signal, null);
    assert.ok(performance.now() - start < 3000, 'Idle shutdown exceeded three seconds.');
    assert.match(output, /Received SIGTERM/);
    assert.match(output, /HTTP server closed/);
  } finally {
    clearTimeout(deadline);
    if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
  }
});
