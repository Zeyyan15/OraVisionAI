/**
 * OraVisionAI — 404 Route Not Found Page
 */

import React from 'react';
import { Link } from 'react-router-dom';
import { FileQuestion, Home } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';

export const NotFoundPage: React.FC = () => {
  return (
    <div className="w-full max-w-md text-center">
      <Card>
        <CardHeader>
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-500 mb-3">
            <FileQuestion className="h-8 w-8" />
          </div>
          <CardTitle className="text-xl">404 — Page Not Found</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-slate-600">
            The clinical route or view you requested does not exist or has been relocated.
          </p>
          <div className="pt-2">
            <Link to="/">
              <Button leftIcon={Home} className="w-full">
                Return to Platform Home
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default NotFoundPage;
