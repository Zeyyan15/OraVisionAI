import assert from 'node:assert/strict';
import { test } from 'node:test';
import { resolveApiAddress } from '../src/config/apiAddress';

test('local web preview avoids LAN permission checks while native phones retain the LAN API', () => {
  const configuredUrl = 'http://192.168.18.106:8000';
  assert.equal(resolveApiAddress({ configuredUrl, platform: 'web', browserHost: 'localhost' }), 'http://localhost:8000');
  assert.equal(resolveApiAddress({ configuredUrl, platform: 'web', browserHost: '127.0.0.1' }), 'http://127.0.0.1:8000');
  for (const platform of ['android', 'ios']) assert.equal(resolveApiAddress({ configuredUrl, platform }), configuredUrl);
  assert.equal(resolveApiAddress({ configuredUrl, platform: 'web', browserHost: '192.168.18.106' }), configuredUrl);
});

test('hosted APIs and explicit web overrides are preserved', () => {
  assert.equal(resolveApiAddress({ configuredUrl: 'https://api.example.test', platform: 'web', browserHost: 'localhost' }), 'https://api.example.test');
  assert.equal(resolveApiAddress({ configuredUrl: 'http://192.168.18.106:8000', webUrl: 'https://other-api.example.test', platform: 'web', browserHost: 'localhost' }), 'https://other-api.example.test');
});

test('development fallback works for the browser, Expo phone host and Android emulator', () => {
  assert.equal(resolveApiAddress({ platform: 'web', browserHost: 'localhost' }), 'http://localhost:8000');
  assert.equal(resolveApiAddress({ platform: 'android', developmentHost: '192.168.18.106' }), 'http://192.168.18.106:8000');
  assert.equal(resolveApiAddress({ platform: 'android' }), 'http://10.0.2.2:8000');
});
