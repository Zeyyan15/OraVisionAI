import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import http from 'node:http';
const require = createRequire(new URL('../mobile/package.json', import.meta.url));
const browser = await require('puppeteer-core').launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, pipe: true, args: ['--no-sandbox'] });
const preview = http.createServer((request, response) => { response.writeHead(200, {'Content-Type': 'text/html'}); response.end('<title>Expo origin verification</title>'); });
await new Promise(resolve => preview.listen(8098, '0.0.0.0', resolve));
try {
  const page = await browser.newPage();
  page.on('console', message => { if (message.type() === 'error') console.log('Browser:', message.text()); });
  page.on('requestfailed', request => console.log('Failed request:', request.url(), request.failure()?.errorText));
  for (const origin of ['http://localhost:8098', 'http://127.0.0.1:8098', 'http://192.168.18.106:8098']) {
    await page.goto(`${origin}/status`, { waitUntil: 'domcontentloaded' });
    const result = await page.evaluate(async () => {
      const api = `http://${location.hostname}:8000`;
      const health = await fetch(`${api}/health`, { headers: { Authorization: 'Bearer cors-test-not-a-real-token' } });
      const user = await fetch(`${api}/api/users/me`);
      return { health: await health.json(), userStatus: user.status, readableError: !!(await user.json()).detail };
    });
    assert.equal(result.health.status, 'healthy');
    assert.equal(result.userStatus, 401);
    assert.equal(result.readableError, true);
    console.log(`PASS: browser preflight, backend access and readable auth response from ${origin}`);
  }
} finally { await browser.close(); await new Promise(resolve => preview.close(resolve)); }
