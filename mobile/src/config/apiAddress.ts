type ApiAddressOptions = {
  configuredUrl?: string;
  webUrl?: string;
  platform: string;
  browserHost?: string;
  developmentHost?: string;
};

export function resolveApiAddress({ configuredUrl, webUrl, platform, browserHost, developmentHost }: ApiAddressOptions): string {
  if (platform === 'web' && webUrl?.trim()) return webUrl.trim();
  const configured = configuredUrl?.trim();
  if (configured) {
    if (platform === 'web' && browserHost && ['localhost', '127.0.0.1'].includes(browserHost)) {
      try {
        const url = new URL(configured);
        const privateHost = /^(?:192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(?:1[6-9]|2\d|3[01])\.\d+\.\d+)$/.test(url.hostname);
        // A local browser should use loopback rather than triggering Chrome's
        // local-network permission check against the same computer's LAN IP.
        if (url.protocol === 'http:' && privateHost) {
          url.hostname = browserHost;
          return url.toString().replace(/\/$/, '');
        }
      } catch { /* Invalid URLs retain their configured value for diagnostics. */ }
    }
    return configured;
  }
  const host = platform === 'web' && browserHost ? browserHost : developmentHost || (platform === 'android' ? '10.0.2.2' : 'localhost');
  return `http://${host}:8000`;
}
