/**
 * OraVisionAI — Deactivated User Profile Screen
 * Prevents 403 infinite redirect loops while clearly explaining account status.
 */

import React from 'react';
import { UserX, LogOut } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';

export const DeactivatedPage: React.FC = () => {
  const { userProfile, logout } = useAuth();

  return (
    <div className="w-full max-w-md text-center">
      <Card>
        <CardHeader>
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-100 text-amber-700 mb-3">
            <UserX className="h-8 w-8" />
          </div>
          <CardTitle className="text-xl">Account Suspended or Deactivated</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-slate-600">
            Your OraVisionAI account (<strong>{userProfile?.email || 'User'}</strong>) has been deactivated by an administrator or suspended per clinical platform policy.
          </p>
          <p className="text-xs text-slate-500">
            If you believe this is in error or wish to reactivate your clinical access, please contact clinical support at <span className="font-mono text-slate-700">support@oravision.ai</span>.
          </p>

          <div className="pt-4">
            <Button
              variant="outline"
              leftIcon={LogOut}
              onClick={() => logout()}
              className="w-full text-slate-700"
            >
              Sign Out
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default DeactivatedPage;
