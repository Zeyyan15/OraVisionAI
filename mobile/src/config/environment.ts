import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { resolveApiAddress } from './apiAddress';

const developmentHost = Constants.expoConfig?.hostUri?.split(':')[0];
export const apiBaseUrl = resolveApiAddress({
  configuredUrl: process.env.EXPO_PUBLIC_API_URL,
  webUrl: process.env.EXPO_PUBLIC_WEB_API_URL,
  platform: Platform.OS,
  browserHost: Platform.OS === 'web' && typeof location !== 'undefined' ? location.hostname : undefined,
  developmentHost,
});
