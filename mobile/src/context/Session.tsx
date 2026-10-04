import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { createUserWithEmailAndPassword, onAuthStateChanged, signInWithEmailAndPassword, signOut, updateProfile } from 'firebase/auth';
import type { User } from 'firebase/auth';
import { api } from '../api';
import { auth } from '../config/firebase';
import { firebaseConfigured } from '../config/firebaseConfig';
import type { UserResponse } from '../types';
import AsyncStorage from '@react-native-async-storage/async-storage';

const pendingKey = 'oravision.pending-registration';
type PendingRegistration = { uid: string; role: 'patient' | 'dentist'; first: string; last: string };

type SessionValue = {
  profile: UserResponse | null; identity: User | null; loading: boolean; error: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, role: 'patient' | 'dentist', first: string, last: string) => Promise<void>;
  logout: () => Promise<void>; retry: () => Promise<void>;
};
const Context = createContext<SessionValue | null>(null);

export function authError(error: unknown) {
  const code = (error as { code?: string })?.code;
  if (['auth/invalid-credential', 'auth/user-not-found', 'auth/wrong-password'].includes(code || '')) return 'The email or password is incorrect. Please try again.';
  if (code === 'auth/email-already-in-use') return 'This email already has an account. Please sign in.';
  if (code === 'auth/invalid-email') return 'Please enter a valid email address.';
  if (code === 'auth/weak-password') return 'Use a password with at least 6 characters.';
  if (code === 'auth/too-many-requests') return 'Too many attempts. Please wait a moment before trying again.';
  if (code === 'auth/network-request-failed') return 'Check your internet connection and try again.';
  return error instanceof Error ? error.message : 'Unable to sign in. Please try again.';
}

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<UserResponse | null>(null);
  const [identity, setIdentity] = useState<User | null>(null);
  const [loading, setLoading] = useState(firebaseConfigured);
  const [error, setError] = useState<string | null>(null);
  const mutation = useRef(false);
  const accept = useCallback((user: UserResponse) => {
    if (!user.is_active) throw new Error('Your account is deactivated. Please contact the platform administrator.');
    if (!['patient', 'dentist'].includes(user.role)) throw new Error('This mobile app is for patients and dental practitioners. Please use the website for administration.');
    setProfile(user); setError(null);
  }, []);
  const retry = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const stored = await AsyncStorage.getItem(pendingKey);
      const pending: PendingRegistration | null = stored ? JSON.parse(stored) : null;
      if (pending && pending.uid === auth.currentUser?.uid) {
        accept(await api.register(pending.role, pending.first, pending.last));
        await AsyncStorage.removeItem(pendingKey);
      } else accept(await api.me());
    } catch (failure) { setProfile(null); setError(authError(failure)); }
    finally { setLoading(false); }
  }, [accept]);
  useEffect(() => {
    if (!firebaseConfigured) return;
    return onAuthStateChanged(auth, (user) => {
      setIdentity(user);
      if (!user) { setProfile(null); setLoading(false); return; }
      if (!mutation.current) void retry();
    });
  }, [retry]);
  const login = async (email: string, password: string) => {
    if (!firebaseConfigured) throw new Error('Firebase configuration is missing. Follow the mobile setup guide.');
    mutation.current = true; setError(null);
    try {
      const credential = await signInWithEmailAndPassword(auth, email.trim(), password);
      const stored = await AsyncStorage.getItem(pendingKey);
      const pending: PendingRegistration | null = stored ? JSON.parse(stored) : null;
      if (pending?.uid === credential.user.uid) {
        accept(await api.register(pending.role, pending.first, pending.last));
        await AsyncStorage.removeItem(pendingKey);
      } else accept(await api.me());
    }
    catch (failure) { setProfile(null); setError(authError(failure)); throw new Error(authError(failure)); }
    finally { mutation.current = false; }
  };
  const register = async (email: string, password: string, role: 'patient' | 'dentist', first: string, last: string) => {
    if (!firebaseConfigured) throw new Error('Firebase configuration is missing. Follow the mobile setup guide.');
    mutation.current = true; setError(null);
    try {
      const credential = await createUserWithEmailAndPassword(auth, email.trim(), password);
      await AsyncStorage.setItem(pendingKey, JSON.stringify({ uid: credential.user.uid, role, first: first.trim(), last: last.trim() }));
      await updateProfile(credential.user, { displayName: `${first.trim()} ${last.trim()}` });
      accept(await api.register(role, first.trim(), last.trim()));
      await AsyncStorage.removeItem(pendingKey);
    } catch (failure) { setError(authError(failure)); throw new Error(authError(failure)); }
    finally { mutation.current = false; }
  };
  const logout = async () => { await signOut(auth); setProfile(null); setIdentity(null); setError(null); };
  return <Context.Provider value={{ profile, identity, loading, error, login, register, logout, retry }}>{children}</Context.Provider>;
}

export function useSession() { const value = useContext(Context); if (!value) throw new Error('SessionProvider is required'); return value; }
