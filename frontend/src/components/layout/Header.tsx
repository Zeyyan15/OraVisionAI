/**
 * OraVisionAI — Universal Shell Header
 * Displays branding, active role badge, user profile summary, and logout action.
 */

import React from 'react';
import { LogOut, ShieldAlert } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { NotificationBell } from '../notifications/NotificationBell';

export interface HeaderProps {
  onToggleSidebar?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onToggleSidebar }) => {
  const { userProfile, logout } = useAuth();

  return (
    <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-slate-200 bg-white px-4 shadow-sm sm:px-6">
      <div className="flex items-center gap-3">
        {onToggleSidebar && (
          <button
            type="button"
            onClick={onToggleSidebar}
            aria-label="Toggle navigation sidebar"
            className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 md:hidden"
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        )}
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-clinical-600 font-bold text-white shadow-sm">
            OV
          </div>
          <div>
            <span className="text-lg font-bold tracking-tight text-slate-900">OraVision</span>
            <span className="text-lg font-semibold text-clinical-600">AI</span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <NotificationBell />

        {userProfile && (
          <div className="flex items-center gap-3">
            <div className="hidden text-right md:block">
              <p className="text-sm font-semibold text-slate-800">
                {userProfile.first_name} {userProfile.last_name}
              </p>
              <p className="text-xs text-slate-500">{userProfile.email}</p>
            </div>

            <Badge
              variant={
                userProfile.role === 'admin'
                  ? 'danger'
                  : userProfile.role === 'dentist'
                    ? 'info'
                    : 'neutral'
              }
            >
              {userProfile.role.toUpperCase()}
            </Badge>

            {!userProfile.is_email_verified && (
              <span title="Email not verified" className="text-amber-500">
                <ShieldAlert className="h-4 w-4" />
              </span>
            )}
          </div>
        )}

        <Button
          variant="outline"
          size="sm"
          onClick={() => logout()}
          aria-label="Sign out of application"
          className="flex items-center gap-1.5 text-slate-600 hover:text-slate-900"
        >
          <LogOut className="h-4 w-4" />
          <span className="hidden sm:inline">Sign Out</span>
        </Button>
      </div>
    </header>
  );
};

export default Header;
