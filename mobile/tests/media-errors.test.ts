import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mediaErrorMessage, mediaLogLevel } from '../src/utils/mediaErrors';

test('camera hardware failures explain shared-device testing without implying the call disconnected', () => {
  const error = new DOMException('Could not start video source', 'NotReadableError');
  const message = mediaErrorMessage(error, 'camera');
  assert.match(message, /another browser or app/);
  assert.match(message, /stay in this call/);
  assert.doesNotMatch(message, /Allow camera access/);
  assert.equal(mediaLogLevel('error', '[devices]: Failed to get video stream', [{ error }]), 'warn');
});

test('permission and missing-device failures provide specific recovery steps', () => {
  assert.match(mediaErrorMessage(new DOMException('Denied', 'NotAllowedError'), 'microphone'), /Allow microphone access/);
  assert.match(mediaErrorMessage(new DOMException('Absent', 'NotFoundError'), 'camera'), /No camera was found/);
});

test('unrelated SDK failures retain error severity', () => {
  const hardwareError = new DOMException('Busy', 'NotReadableError');
  assert.equal(mediaLogLevel('error', 'Failed to connect to Stream', [{ error: hardwareError }]), 'error');
  assert.equal(mediaLogLevel('error', 'Failed to get video stream', [{ error: new Error('Unexpected failure') }]), 'error');
  assert.equal(mediaLogLevel('warn', 'Failed to get video stream', [{ error: hardwareError }]), 'warn');
});
