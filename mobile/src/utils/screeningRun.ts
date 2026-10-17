import type { ScreeningWorkflow } from '../types';

type Dependencies = {
  create: () => Promise<{ id: string }>;
  prepare: () => Promise<FormData>;
  start: (id: string, body: FormData, signal: AbortSignal) => Promise<ScreeningWorkflow>;
  status: (id: string, signal: AbortSignal) => Promise<ScreeningWorkflow>;
  cancel: (id: string) => Promise<ScreeningWorkflow>;
  results: (id: string, signal: AbortSignal) => Promise<void>;
  progress: (state: ScreeningWorkflow) => void;
};

function abortReason(signal: AbortSignal): Error {
  if (signal.reason instanceof Error) return signal.reason;
  const error = new Error('Screening cancelled.');
  error.name = 'AbortError';
  return error;
}

function ensureActive(signal: AbortSignal) {
  // React Native's AbortSignal lacks throwIfAborted(), unlike browser/Node signals.
  if (signal.aborted) throw abortReason(signal);
}

export class ScreeningRun {
  readonly controller = new AbortController();
  id: string | null = null;
  private creating: Promise<{ id: string }> | null = null;
  private cancellation: Promise<ScreeningWorkflow | null> | null = null;
  constructor(private readonly dependencies: Dependencies) {}

  async start() {
    const d = this.dependencies; const signal = this.controller.signal;
    d.progress({ status: 'running', completed_steps: 0, description: 'Creating your screening and preparing the photo.', warnings: [] });
    // Do not discard a creation response: Cancel needs its ID to stop a late upload.
    this.creating = d.create();
    this.id = (await this.creating).id;
    ensureActive(signal);
    const body = await d.prepare();
    ensureActive(signal);
    let state = await d.start(this.id, body, signal);
    while (true) {
      ensureActive(signal);
      d.progress(state);
      if (state.completed_steps > 0) await d.results(this.id, signal);
      if (state.status !== 'running') return state;
      await new Promise<void>((resolve, reject) => {
        const abort = () => { clearTimeout(timer); reject(abortReason(signal)); };
        const timer = setTimeout(() => { signal.removeEventListener('abort', abort); resolve(); }, 2500);
        signal.addEventListener('abort', abort, { once: true });
        if (signal.aborted) abort();
      });
      state = await d.status(this.id, signal);
    }
  }

  cancel(): Promise<ScreeningWorkflow | null> {
    this.controller.abort();
    if (this.cancellation) return this.cancellation;
    this.cancellation = (async () => {
      if (!this.id && this.creating) {
        try { this.id = (await this.creating).id; }
        catch { return null; } // A worker cannot start before creation succeeds.
      }
      return this.id ? this.dependencies.cancel(this.id) : null;
    })().catch((error) => { this.cancellation = null; throw error; });
    return this.cancellation;
  }
}
