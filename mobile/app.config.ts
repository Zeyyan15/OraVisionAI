import type { ConfigContext, ExpoConfig } from 'expo/config';

export default function configure({ config }: ConfigContext): ExpoConfig {
  const apiUrl = process.env.EXPO_PUBLIC_API_URL?.trim();
  const distribution = ['preview', 'production'].includes(process.env.EAS_BUILD_PROFILE || '');
  if (distribution && (!apiUrl || !apiUrl.startsWith('https://'))) {
    throw new Error('Set EXPO_PUBLIC_API_URL to your existing HTTPS backend URL before creating a distribution build.');
  }
  const local = !apiUrl || apiUrl.startsWith('http://');
  return {
    ...config,
    name: config.name || 'OraVisionAI',
    slug: config.slug || 'oravision-ai',
    plugins: (config.plugins || []).map((plugin) => plugin === 'expo-build-properties'
      ? ['expo-build-properties', { android: { usesCleartextTraffic: local } }]
      : plugin),
    ios: {
      ...config.ios,
      infoPlist: {
        ...config.ios?.infoPlist,
        NSLocalNetworkUsageDescription: 'Connect to your OraVisionAI development server on your local network.',
        NSAppTransportSecurity: { NSAllowsArbitraryLoads: local, NSAllowsLocalNetworking: local },
      },
    },
  };
}
