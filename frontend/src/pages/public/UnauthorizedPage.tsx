/**
 * OraVisionAI — 403 Forbidden / Unauthorized Page
 */

import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldX, ArrowLeft } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';

export const UnauthorizedPage: React.FC = () => {
  const { userProfile } = useAuth();

  const getReturnPath = () => {
    if (userProfile?.role === 'admin') return '/admin/dashboard';
    if (userProfile?.role === 'dentist') return '/dentist/dashboard';
    return '/patient/dashboard';
  };

  return (
    <div className="w-full max-w-md text-center">
      <Card>
        <CardHeader>
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-100 text-rose-600 mb-3">
            <ShieldX className="h-8 w-8" />
          </div>
          <CardTitle className="text-xl">Access Restricted (403)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-slate-600">
            You do not have administrative or clinical permissions to access the requested view.
            Role-based boundaries protect patient records and clinical workflows.
          </p>

          <div className="pt-2">
            <Link to={getReturnPath()}>
              <Button variant="outline" leftIcon={ArrowLeft} className="w-full">
                Return to Authorized Dashboard
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default UnauthorizedPage;
