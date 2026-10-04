import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ScreeningRun } from '../src/utils/screeningRun';
import type { ScreeningWorkflow } from '../src/types';
import { AbortController as NativeAbortController } from 'abort-controller';

const state = (status: ScreeningWorkflow['status'], done = 0): ScreeningWorkflow => ({ status, completed_steps: done, description: status, warnings: [] });
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>((r) => { resolve = r; }); return { promise, resolve }; }

test('screening starts with the actual React Native AbortController without throwIfAborted', async () => {
  const original = globalThis.AbortController;
  globalThis.AbortController = NativeAbortController as unknown as typeof AbortController;
  try {
    let uploaded = false;
    const run = new ScreeningRun({ create: async () => ({ id: 'native-screening' }), prepare: async () => new FormData(), start: async () => { uploaded = true; return state('completed', 3); }, status: async () => state('running'), cancel: async () => state('cancelled'), results: async () => {}, progress: () => {} });
    assert.equal(typeof run.controller.signal.throwIfAborted, 'undefined');
    assert.equal((await run.start()).status, 'completed');
    assert.equal(uploaded, true);
  } finally { globalThis.AbortController = original; }
});

test('native cancellation produces an AbortError even without signal.reason', async () => {
  const original = globalThis.AbortController;
  globalThis.AbortController = NativeAbortController as unknown as typeof AbortController;
  try {
    const creation = deferred<{ id: string }>(); let uploaded = false;
    const run = new ScreeningRun({ create: () => creation.promise, prepare: async () => new FormData(), start: async () => { uploaded = true; return state('running'); }, status: async () => state('running'), cancel: async () => state('cancelled'), results: async () => {}, progress: () => {} });
    const failed = assert.rejects(run.start(), { name: 'AbortError', message: 'Screening cancelled.' });
    const cancelled = run.cancel(); creation.resolve({ id: 'native-screening' });
    await failed; assert.equal((await cancelled)?.status, 'cancelled');
    assert.equal(uploaded, false);
  } finally { globalThis.AbortController = original; }
});

test('cancelling while creating waits for the ID and never starts an upload', async () => {
  const creation = deferred<{ id: string }>(); const cancelled: string[] = []; let uploads = 0;
  const run = new ScreeningRun({ create: () => creation.promise, prepare: async () => { uploads++; return new FormData(); }, start: async () => state('running'), status: async () => state('running'), cancel: async (id) => { cancelled.push(id); return state('cancelled'); }, results: async () => {}, progress: () => {} });
  const started = run.start(); const rejected = assert.rejects(started);
  const stopped = run.cancel(); creation.resolve({ id: 'late-screening' });
  await rejected; assert.equal((await stopped)?.status, 'cancelled');
  assert.deepEqual(cancelled, ['late-screening']); assert.equal(uploads, 0);
});

test('cancelling an active upload aborts its request and stops the server once', async () => {
  const uploading = deferred<void>(); let signal!: AbortSignal; let cancels = 0;
  const run = new ScreeningRun({ create: async () => ({ id: 'screening' }), prepare: async () => new FormData(), start: async (_, __, activeSignal) => { signal = activeSignal; uploading.resolve(); return new Promise((_, reject) => activeSignal.addEventListener('abort', () => reject(activeSignal.reason))); }, status: async () => state('running'), cancel: async () => { cancels++; return state('cancelled'); }, results: async () => {}, progress: () => {} });
  const rejected = assert.rejects(run.start()); await uploading.promise;
  await Promise.all([run.cancel(), run.cancel()]); await rejected;
  assert.equal(signal.aborted, true); assert.equal(cancels, 1);
});

test('finished outputs are fetched before completion is presented', async () => {
  const events: string[] = [];
  const run = new ScreeningRun({ create: async () => ({ id: 'screening' }), prepare: async () => new FormData(), start: async () => state('completed', 3), status: async () => state('running'), cancel: async () => state('cancelled'), results: async () => { events.push('saved results'); }, progress: (s) => events.push(`${s.completed_steps}/3`) });
  assert.equal((await run.start()).status, 'completed');
  assert.deepEqual(events, ['0/3', '3/3', 'saved results']);
});

test('a failed later step still exposes partial findings', async () => {
  let reads = 0;
  const run = new ScreeningRun({ create: async () => ({ id: 'screening' }), prepare: async () => new FormData(), start: async () => state('failed', 2), status: async () => state('running'), cancel: async () => state('cancelled'), results: async () => { reads++; }, progress: () => {} });
  assert.equal((await run.start()).completed_steps, 2); assert.equal(reads, 1);
});
