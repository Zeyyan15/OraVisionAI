/**
 * OraVisionAI — Public Layout Container
 * Used for Landing, Login, Register, Unauthorized, and Deactivated views.
 */

import React from 'react';
import { Outlet, Link } from 'react-router-dom';

export const PublicLayout: React.FC = () => {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className="border-b border-slate-200 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-clinical-600 font-bold text-white shadow-sm">
              OV
            </div>
            <div>
              <span className="text-lg font-bold tracking-tight text-slate-900">OraVision</span>
              <span className="text-lg font-semibold text-clinical-600">AI</span>
            </div>
          </Link>
          <div className="flex items-center gap-4">
            <Link
              to="/login"
              className="text-sm font-medium text-slate-700 hover:text-clinical-600"
            >
              Sign In
            </Link>
            <Link
              to="/register"
              className="rounded-lg bg-clinical-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-clinical-700"
            >
              Get Started
            </Link>
          </div>
        </div>
      </header>
      <main className="flex-1 flex flex-col items-center justify-center p-4 sm:p-6 lg:p-8">
        <Outlet />
      </main>
      <footer className="border-t border-slate-200 bg-white py-4 text-center text-xs text-slate-500">
        © {new Date().getFullYear()} OraVisionAI Platform. Clinical Dental AI Decision Support.
      </footer>
    </div>
  );
};

export default PublicLayout;
