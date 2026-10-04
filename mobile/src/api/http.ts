export class ApiError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

type TokenProvider = (refresh?: boolean) => Promise<string | null>;
type Options = { body?: unknown; signal?: AbortSignal; timeoutMs?: number };

export class HttpClient {
  constructor(private readonly baseUrl: string, private readonly tokenProvider: TokenProvider, private readonly fetcher: typeof fetch = fetch) {}

  async request<T>(path: string, method = 'GET', options: Options = {}, retried = false): Promise<T> {
    const controller = new AbortController();
    const abort = () => controller.abort();
    if (options.signal?.aborted) controller.abort();
    options.signal?.addEventListener('abort', abort, { once: true });
    const timeout = setTimeout(abort, options.timeoutMs ?? 30000);
    try {
      const token = await this.tokenProvider(retried);
      const headers: Record<string, string> = { Accept: 'application/json' };
      if (token) headers.Authorization = `Bearer ${token}`;
      const isForm = options.body instanceof FormData;
      if (options.body !== undefined && !isForm) headers['Content-Type'] = 'application/json';
      // Browser fetch rejects a HttpClient instance as its receiver (Illegal invocation).
      const send = this.fetcher;
      const response = await send(`${this.baseUrl.replace(/\/$/, '')}${path}`, {
        method, headers, signal: controller.signal,
        body: options.body === undefined ? undefined : isForm ? options.body as FormData : JSON.stringify(options.body),
      });
      if (response.status === 401 && !retried && token) {
        return await this.request<T>(path, method, options, true);
      }
      if (response.status === 204) return undefined as T;
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        const detail = data?.detail;
        const message = typeof detail === 'string' ? detail
          : Array.isArray(detail) ? detail.map((item: { msg?: string }) => item.msg || 'Invalid value').join('\n')
          : response.status === 429 ? 'Too many requests. Please wait a moment and try again.'
          : 'The request could not be completed. Please try again.';
        throw new ApiError(response.status, message);
      }
      return data as T;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      if (controller.signal.aborted) throw new Error('The request was interrupted or took too long. Please try again.');
      throw new Error('Cannot reach the server. Check your connection and try again.');
    } finally {
      clearTimeout(timeout);
      options.signal?.removeEventListener('abort', abort);
    }
  }
  get<T>(path: string, signal?: AbortSignal) { return this.request<T>(path, 'GET', { signal }); }
  post<T>(path: string, body: unknown = {}, timeoutMs?: number) { return this.request<T>(path, 'POST', { body, timeoutMs }); }
  patch<T>(path: string, body: unknown = {}) { return this.request<T>(path, 'PATCH', { body }); }
}
