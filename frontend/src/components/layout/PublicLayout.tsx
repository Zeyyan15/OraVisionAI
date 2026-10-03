/**
 * OraVisionAI — Public Layout Container
 * Used for Landing, Login, Register, Unauthorized, and Deactivated views.
 */

import React from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import logo from '../../assets/logo.png';

export const PublicLayout: React.FC = () => {
  const { pathname } = useLocation();
  const isLanding = pathname === '/';
  const isAuth = ['/login', '/register'].includes(pathname);
  const isBranded = isLanding || isAuth;
  return (
    <div className={`min-h-screen flex flex-col ${isBranded ? 'bg-[#fcfdfb]' : 'bg-slate-50'}`}>
      <header className={`border-b ${isBranded ? 'sticky top-0 z-30 border-[#dce8e3] bg-[#fcfdfb]/95 backdrop-blur-md' : 'border-slate-200 bg-white'}`}>
        <div className={`max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between ${isBranded ? 'h-[76px]' : 'h-16'}`}>
          <Link to="/" className="flex items-center gap-2">
            <img src={logo} alt="OravisionAI" className="h-7 w-auto sm:h-8" />
          </Link>
          {isBranded && (
            <nav aria-label="Main navigation" className="hidden md:flex items-center gap-8 text-xs font-medium text-[#617471]">
              <Link to="/#demo" className="hover:text-[#087f70] focus-visible:outline-[#087f70]">Watch the demo</Link>
              <Link to="/login" className="hover:text-[#087f70] focus-visible:outline-[#087f70]">For practitioners</Link>
            </nav>
          )}
          <div className="flex items-center gap-2 sm:gap-4">
            <Link
              to="/login"
              className="rounded-lg px-2 py-2 text-xs sm:text-sm font-medium text-slate-700 transition-colors hover:bg-[#edf4eb] hover:text-[#087f70] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#087f70]"
            >
              Sign In
            </Link>
            <Link
              to="/register"
              className={`cut-corner-button px-3 sm:px-4 py-2.5 text-xs sm:text-sm font-semibold text-white shadow-sm transition-all hover:-translate-y-0.5 active:translate-y-0 motion-reduce:transform-none ${isBranded ? 'bg-[#087f70] hover:bg-[#06685c]' : 'bg-clinical-600 hover:bg-clinical-700'}`}
            >
              Get Started
            </Link>
          </div>
        </div>
      </header>
      <main className={isBranded ? 'flex-1' : 'flex-1 flex flex-col items-center justify-center p-4 sm:p-6 lg:p-8'}>
        <Outlet />
      </main>
      <footer className="border-t border-slate-200 bg-white py-4 text-center text-xs text-slate-500">
        © {new Date().getFullYear()} OraVisionAI Platform. Clinical Dental AI Decision Support.
      </footer>
    </div>
  );
};

export default PublicLayout;
