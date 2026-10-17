import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { uploadBlob as webUploadBlob } from '../src/utils/uploadFile';

function loadModule(path: string, dependencies: Record<string, unknown>, globals: Record<string, unknown> = {}) {
  const exports: Record<string, unknown> = {};
  const code = ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  runInNewContext(code, {
    exports, Blob, FormData, Uint8Array, TextEncoder, ...globals,
    require(name: string) {
      assert.ok(name in dependencies, `Unexpected import: ${name}`);
      return dependencies[name];
    },
  });
  return exports;
}

// Exercise the installed SDK's real multipart serializer, rather than assuming
// a React Native URI object is equivalent to the browser's Blob implementation.
const convert = loadModule('../node_modules/expo/src/winter/fetch/convertFormData.ts', {
  '../../utils/blobUtils': { blobToArrayBufferAsync: (blob: Blob) => blob.arrayBuffer() },
}).convertFormDataAsync as (body: FormData) => Promise<{ body: Uint8Array; boundary: string }>;

class NativeBlob {
  constructor() { throw new Error('Creating blobs from ArrayBufferView is not supported'); }
}
// Use Expo's actual FormData patch. Browser FormData silently stringifies native
// File objects and Node's Blob accepts binary input that React Native rejects.
const patch = loadModule('../node_modules/expo/src/winter/FormData.ts', {}, { Blob: NativeBlob })
  .installFormDataPatch as (base: unknown) => typeof FormData;
const NativeFormData = patch(class { _parts: unknown[] = []; });
const nativeConvert = loadModule('../node_modules/expo/src/winter/fetch/convertFormData.ts', {
  '../../utils/blobUtils': { blobToArrayBufferAsync: () => { throw new Error('Native files should use bytes()'); } },
}, { Blob: NativeBlob }).convertFormDataAsync as typeof convert;

function nativeUpload(bytes: Uint8Array | Error) {
  return loadModule('../src/utils/uploadFile.native.ts', {
    'expo-file-system': {
      File: class {
        type = 'image/jpeg';
        name = 'picked-image.jpg';
        get exists() { return !(bytes instanceof Error); }
        constructor(uri: string) { assert.equal(uri, 'file:///picked-image.jpg'); }
        async bytes() { if (bytes instanceof Error) throw bytes; return bytes; }
      },
    },
  }, { Blob: NativeBlob }).uploadBlob as (asset: { uri: string; mimeType?: string }) => Promise<Blob>;
}

test('native photo is serialized as multipart bytes by Expo SDK 57', async () => {
  const jpeg = new Uint8Array([255, 216, 255, 224, 11, 22, 33, 44]);
  const blob = await nativeUpload(jpeg)({ uri: 'file:///picked-image.jpg', mimeType: 'image/jpeg' });
  const form = new NativeFormData();
  form.append('file', blob, 'oral-screening.jpg');
  const encoded = await nativeConvert(form);
  const text = new TextDecoder().decode(encoded.body);
  assert.ok(text.includes(`--${encoded.boundary}`));
  assert.ok(text.includes('name="file"; filename="picked-image.jpg"'));
  assert.ok(text.includes('content-type: image/jpeg'));
  assert.ok(Buffer.from(encoded.body).includes(Buffer.from(jpeg)));
});

test('legacy URI-only multipart values reproduce the SDK upload failure', async () => {
  const legacy = { entries: () => [['file', { uri: 'file:///picked-image.jpg', name: 'oral.jpg', type: 'image/jpeg' }]] };
  await assert.rejects(convert(legacy as unknown as FormData), /Unsupported FormDataPart implementation/);
});

test('unreadable native files produce an actionable file error', async () => {
  await assert.rejects(nativeUpload(new Error('permission denied'))({ uri: 'file:///picked-image.jpg' }), /choose it again/);
});

test('browser uploads retain the selected file bytes', async () => {
  const file = new Blob(['selected file'], { type: 'application/pdf' });
  assert.equal(await webUploadBlob({ uri: 'blob:preview', file }), file);
});
