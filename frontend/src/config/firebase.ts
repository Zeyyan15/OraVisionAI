/**
 * OraVisionAI — Firebase Client SDK Initialization
 *
 * Provides Firebase Auth instance for email/password sign-in and token acquisition.
 * Also initializes Firebase Storage instance.
 *
 * NOTE: Direct client-side artifact retrieval from Firebase Storage (screenings/*, xai/*)
 * remains PENDING authorization infrastructure / storage security rules deployment.
 * Reports PDF download streams via the authenticated FastAPI backend (/api/reports/{id}/download).
 */

import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getStorage } from 'firebase/storage';
import { env } from './env';

const firebaseApp = getApps().length === 0 ? initializeApp(env.firebase) : getApp();

export const auth = getAuth(firebaseApp);
export const storage = getStorage(firebaseApp);
export default firebaseApp;
