type Device = 'camera' | 'microphone';
type Level = 'trace' | 'debug' | 'info' | 'warn' | 'error';

function errorName(error: unknown): string {
  return error && typeof error === 'object' && 'name' in error && typeof error.name === 'string' ? error.name : '';
}

export function mediaErrorMessage(error: unknown, device: Device): string {
  switch (errorName(error)) {
    case 'NotReadableError':
    case 'AbortError':
      return `Your ${device} could not start. It may already be in use by another browser or app. Turn it off there and retry, or use a second device. You can stay in this call with your ${device} off.`;
    case 'NotAllowedError':
    case 'SecurityError':
      return `Allow ${device} access in your browser and Windows privacy settings, then try again.`;
    case 'NotFoundError':
      return `No ${device} was found. Connect one and try again. You can stay in the call without it.`;
    case 'OverconstrainedError':
      return `Your ${device} does not support the requested settings. Try another device.`;
    default:
      return `Cannot access your ${device}. Check that it is connected, allowed in browser settings, and not in use by another app.`;
  }
}

// These SDK errors are caught by the call UI. Keep them visible as warnings so
// Expo's development overlay doesn't obscure a call that is still connected.
// Unexpected device errors and errors from other SDK scopes keep their severity.
export function mediaLogLevel(level: Level, message: string, details: unknown[]): Level {
  const expected = new Set(['NotReadableError', 'AbortError', 'NotAllowedError', 'SecurityError', 'NotFoundError', 'OverconstrainedError']);
  const recoverable = details.some((detail) => {
    const error = detail && typeof detail === 'object' && 'error' in detail ? detail.error : detail;
    return expected.has(errorName(error));
  });
  return level === 'error' && /Failed to get (video|audio) stream/.test(message) && recoverable ? 'warn' : level;
}
