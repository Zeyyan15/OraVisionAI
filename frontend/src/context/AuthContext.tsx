/**
 * OraVisionAI — Authentication Context & Session Management
 *
 * Features:
 * - Email/password baseline authentication
 * - Real-time Firebase Auth state listener
 * - Automatic PostgreSQL User synchronization (/api/users/me)
 * - Server-authoritative role binding (patient | dentist | admin)
 * - Deactivated user state capture
 */

import React, { createContext, useEffect, useState, useCallback, useMemo, useRef } from 'react';
import {
  User as FirebaseUser,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile as updateFirebaseProfile,
} from 'firebase/auth';
import { auth } from '../config/firebase';
import { getCurrentUserProfile, syncUserProfile } from '../api/endpoints';
import { UserResponse } from '../types/api';

export interface AuthContextType {
  firebaseUser: FirebaseUser | null;
  userProfile: UserResponse | null;
  loading: boolean;
  error: string | null;
  login: (email: string, pass: string) => Promise<UserResponse>;
  register: (email: string, pass: string, role: 'patient' | 'dentist', firstName: string, lastName: string) => Promise<UserResponse>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<UserResponse | null>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [userProfile, setUserProfile] = useState<UserResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const isRegisteringRef = useRef<boolean>(false);

  const fetchProfile = useCallback(async (): Promise<UserResponse | null> => {
    try {
      const profile = await getCurrentUserProfile();
      setUserProfile(profile);
      setError(null);
      return profile;
    } catch (err: unknown) {
      console.error('Failed to sync application user profile:', err);
      setUserProfile(null);
      setError('Unable to load application user profile.');
      return null;
    }
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      if (user) {
        if (!isRegisteringRef.current) {
          await fetchProfile();
        }
      } else {
        setUserProfile(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [fetchProfile]);

  const login = async (email: string, pass: string): Promise<UserResponse> => {
    setLoading(true);
    setError(null);
    try {
      await signInWithEmailAndPassword(auth, email, pass);
      const cred = await signInWithEmailAndPassword(auth, email, pass);
      setFirebaseUser(cred.user);
      const profile = await fetchProfile();
      if (!profile) {
        throw new Error('Authentication succeeded, but application user profile could not be loaded.');
      }
      setUserProfile(profile);
      return profile;
    } catch (err: any) {
      setError(err?.message || 'Login failed. Please check your credentials.');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const register = async (
    email: string,
    pass: string,
    requestedRole: 'patient' | 'dentist',
    firstName: string,
    lastName: string,
  ): Promise<UserResponse> => {
    isRegisteringRef.current = true;
    setLoading(true);
    setError(null);
    try {
      // 1. Create user in Firebase Auth
      const cred = await createUserWithEmailAndPassword(auth, email, pass);
      if (cred.user) {
        const displayName = `${firstName} ${lastName}`.trim();
        await updateFirebaseProfile(cred.user, { displayName });
      }
      // 2. Synchronize to PostgreSQL with explicit requestedRole
      const profile = await syncUserProfile({
        role: requestedRole,
        first_name: firstName,
        last_name: lastName,
      });
      setUserProfile(profile);
      return profile;
    } catch (err: any) {
      setError(err?.message || 'Registration failed.');
      throw err;
    } finally {
      isRegisteringRef.current = false;
      setLoading(false);
    }
  };

  const logout = async () => {
    setLoading(true);
    try {
      await signOut(auth);
      setFirebaseUser(null);
      setUserProfile(null);
      setError(null);
    } finally {
      setLoading(false);
    }
  };

  const value = useMemo(
    () => ({
      firebaseUser,
      userProfile,
      loading,
      error,
      login,
      register,
      logout,
      refreshProfile: fetchProfile,
    }),
    [firebaseUser, userProfile, loading, error, fetchProfile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
