import { getApps, initializeApp } from 'firebase/app';

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

export const firebaseConfigured = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.appId);
// A valid-shaped placeholder allows the configuration screen to render before setup.
export const firebaseApp = getApps()[0] ?? initializeApp(firebaseConfigured ? firebaseConfig : {
  apiKey: 'configuration-required', projectId: 'configuration-required', appId: 'configuration-required',
});
