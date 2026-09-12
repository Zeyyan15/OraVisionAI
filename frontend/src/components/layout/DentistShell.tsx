/**
 * OraVisionAI — Dentist Application Shell
 * Displays prominent pending verification banner if dentist account is unverified.
 */

import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { AlertTriangle, ShieldAlert } from 'lucide-react';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { Alert } from '../ui/Alert';
import { useDentist } from '../../hooks/useDentist';

export const DentistShell: React.FC = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { isPending, isRejected } = useDentist();

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:p-4 focus:bg-white focus:text-clinical-700"
      >
        Skip to main content
      </a>
      <Header onToggleSidebar={() => setSidebarOpen((prev) => !prev)} />
      <div className="flex flex-1">
        <Sidebar role="dentist" isOpen={sidebarOpen} />
        <main id="main-content" className="flex-1 p-6 md:p-8 max-w-7xl mx-auto w-full space-y-6">
          {isPending && (
            <Alert
              variant="warning"
              title="Dentist Account Verification Notice"
              icon={AlertTriangle}
            >
              Your clinical account is currently in <strong>pending verification</strong> state. An administrator must verify your professional credentials before clinical consultations and treatment plan authorizations are enabled.
            </Alert>
          )}
          {isRejected && (
            <Alert
              variant="danger"
              title="Practitioner Verification Rejected"
              icon={ShieldAlert}
            >
              Your submitted credential documentation was not approved. Please visit your profile to review administrator notes and submit updated credential metadata.
            </Alert>
          )}
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default DentistShell;
