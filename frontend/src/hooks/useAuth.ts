/**
 * OraVisionAI — useAuth Hook
 * Exposes authentication state, authoritative role, and convenience predicates.
 */

import { useContext } from 'react';
import { AuthContext, AuthContextType } from '../context/AuthContext';

export interface UseAuthReturn extends AuthContextType {
  isAuthenticated: boolean;
  role: string | null;
  isActive: boolean;
  isEmailVerified: boolean;
}

export const useAuth = (): UseAuthReturn => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }

  const { firebaseUser, userProfile } = context;

  return {
    ...context,
    isAuthenticated: !!firebaseUser && !!userProfile,
    role: userProfile?.role || null,
    isActive: userProfile?.is_active ?? false,
    isEmailVerified: userProfile?.is_email_verified ?? false,
  };
};

export default useAuth;
