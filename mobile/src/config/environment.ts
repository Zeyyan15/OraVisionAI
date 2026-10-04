import Constants from 'expo-constants';
import { Platform } from 'react-native';

const developmentHost = Constants.expoConfig?.hostUri?.split(':')[0];
const defaultHost = Platform.OS === 'web' && typeof location !== 'undefined'
  ? location.hostname
  : developmentHost || (Platform.OS === 'android' ? '10.0.2.2' : 'localhost');

export const apiBaseUrl = process.env.EXPO_PUBLIC_API_URL?.trim() || `http://${defaultHost}:8000`;
