import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

// Evaluate the real entry component with a host that has no WebRTC module.
// This reproduces the route-discovery failure without needing a physical phone.
const source = readFileSync(new URL('../src/components/LiveCall.native.tsx', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: {
  module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022,
} }).outputText;

function host(environment: string, missingModule = false) {
  const requested: string[] = [];
  const updates: unknown[] = [];
  const hooks: (() => void)[] = [];
  const exports: { default?: (props: unknown) => unknown } = {};
  const component = () => null;
  const require = (name: string) => {
    requested.push(name);
    if (name === 'react') return {
      useState: (initial: unknown) => [initial, (value: unknown) => updates.push(value)],
      useEffect: (effect: () => void) => hooks.push(effect),
    };
    if (name === 'react/jsx-runtime') return { jsx: (type: unknown, props: unknown) => ({ type, props }), jsxs: (type: unknown, props: unknown) => ({ type, props }) };
    if (name === 'react-native') return { Text: component };
    if (name === 'expo') return { isRunningInExpoGo: () => environment === 'expoGo' };
    if (name === './ui') return { Card: component, Loading: component, Notice: component };
    if (name === '../theme') return { styles: { heading: {} } };
    if (name === './NativeLiveCall') {
      if (missingModule) throw new Error('WebRTC native module not found');
      return { __esModule: true, default: component };
    }
    throw new Error(`Unexpected startup import: ${name}`);
  };
  runInNewContext(compiled, { exports, require });
  assert.equal(typeof exports.default, 'function');
  return { requested, updates, render: () => exports.default!({ session: {} }), runEffects: () => hooks.forEach((effect) => effect()) };
}

test('Expo Go discovers and renders the consultation without evaluating WebRTC', async () => {
  const app = host('expoGo', true);
  app.render(); app.runEffects();
  await new Promise<void>((resolve) => setImmediate(resolve));
  assert.ok(!app.requested.includes('./NativeLiveCall'));
  assert.deepEqual(app.updates, []);
});

test('development builds load the native call only after route discovery', async () => {
  const app = host('developmentClient');
  assert.ok(!app.requested.includes('./NativeLiveCall'));
  app.render(); app.runEffects();
  await new Promise<void>((resolve) => setImmediate(resolve));
  assert.ok(app.requested.includes('./NativeLiveCall'));
  assert.equal(typeof app.updates[0], 'function');
});

test('an outdated development build shows a fallback instead of breaking the route', async () => {
  const app = host('developmentClient', true);
  app.render(); app.runEffects();
  await new Promise<void>((resolve) => setImmediate(resolve));
  assert.deepEqual(app.updates, [true]);
});
