/**
 * OraVisionAI — Protected Route Guard
 *
 * Enforces:
 * 1. Authentication check (redirects unauthenticated to /login)
 * 2. Active status check (redirects deactivated/suspended to /deactivated)
 * 3. Role-based access control (redirects unauthorized roles to /unauthorized)
 */

import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { UserRole } from '../types/domain';
import { LoadingSkeleton } from '../components/feedback/LoadingSkeleton';

export interface ProtectedRouteProps {
  children?: React.ReactNode;
  allowedRoles?: UserRole[];
  requireActive?: boolean;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  allowedRoles,
  requireActive = true,
}) => {
  const { firebaseUser, userProfile, loading, isAuthenticated } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6" aria-busy="true">
        <LoadingSkeleton variant="card" count={2} />
      </div>
    );
  }

  // 1. Unauthenticated check
  if (!isAuthenticated || !firebaseUser) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // 2. Active status check
  if (requireActive && userProfile && !userProfile.is_active) {
    return <Navigate to="/deactivated" replace />;
  }

  // 3. RBAC role match check
  if (allowedRoles && userProfile && !allowedRoles.includes(userProfile.role)) {
    return <Navigate to="/unauthorized" replace />;
  }

  return children ? <>{children}</> : null;
};

export default ProtectedRoute;
