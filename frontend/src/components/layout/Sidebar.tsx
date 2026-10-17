/**
 * OraVisionAI — Role-Aware Navigation Sidebar
 */

import React, { useState, useEffect } from 'react';
import { listDentistVerifications } from '../../api/adminEndpoints';
import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  FileSearch,
  PlusCircle,
  Calendar,
  Video,
  Users,
  ShieldCheck,
  Stethoscope,
  UserCheck,
  MessageSquare,
} from 'lucide-react';
import { UserRole } from '../../types/domain';

export interface SidebarProps {
  role: UserRole;
  isOpen?: boolean;
}

interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
  disabled?: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({ role, isOpen = true }) => {
  const { pathname } = useLocation();
  const patientNav: NavItem[] = [
    { name: 'Dashboard', href: '/patient/dashboard', icon: LayoutDashboard },
    { name: 'New Screening', href: '/patient/screenings/new', icon: PlusCircle },
    { name: 'My Screenings', href: '/patient/screenings', icon: FileSearch },
    { name: 'Find a Dentist', href: '/patient/dentists', icon: Stethoscope },
    { name: 'Appointments', href: '/patient/appointments', icon: Calendar },
    { name: 'Teleconsultations', href: '/patient/consultations', icon: Video },
    { name: 'Messages', href: '/patient/messages', icon: MessageSquare },
  ];

  const dentistNav: NavItem[] = [
    { name: 'Clinical Workspace', href: '/dentist/dashboard', icon: Stethoscope },
    { name: 'Appointments & Cases', href: '/dentist/appointments', icon: Calendar },
    { name: 'My Profile', href: '/dentist/profile', icon: Users },
    { name: 'Messages', href: '/dentist/messages', icon: MessageSquare },
  ];

  const [pendingVerificationsCount, setPendingVerificationsCount] = useState<number | null>(null);

  useEffect(() => {
    if (role !== 'admin') return;
    let isMounted = true;
    const fetchPending = async () => {
      try {
        const res = await listDentistVerifications({ status: 'pending', page_size: 1 });
        if (isMounted) setPendingVerificationsCount(res.total);
      } catch {
        // Non-blocking for sidebar
      }
    };
    fetchPending();
    return () => {
      isMounted = false;
    };
  }, [role]);

  const adminNav: NavItem[] = [
    { name: 'Platform Overview', href: '/admin/dashboard', icon: LayoutDashboard },
    {
      name: 'Dentist Verifications',
      href: '/admin/verifications',
      icon: UserCheck,
      badge: pendingVerificationsCount !== null && pendingVerificationsCount > 0 ? String(pendingVerificationsCount) : undefined,
    },
    { name: 'Audit Logs', href: '/admin/audit-logs', icon: ShieldCheck },
    { name: 'Screening Analytics', href: '/admin/analytics/screenings', icon: FileSearch },
    { name: 'AI Telemetry', href: '/admin/analytics/ai-telemetry', icon: Stethoscope },
    { name: 'Telehealth Analytics', href: '/admin/analytics/telehealth', icon: Video },
    { name: 'AI Model Registry', href: '/admin/ai-models', icon: Users },
  ];

  const items = role === 'admin' ? adminNav : role === 'dentist' ? dentistNav : patientNav;
  const activeHref = items
    .filter((item) => pathname === item.href || pathname.startsWith(`${item.href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;

  return (
    <aside
      className={`fixed bottom-0 left-0 top-16 z-20 flex w-64 shrink-0 flex-col border-r border-slate-200 bg-white transition-transform md:sticky md:bottom-auto md:h-[calc(100dvh-4rem)] md:self-start md:translate-x-0 ${
        isOpen ? 'translate-x-0' : '-translate-x-full'
      }`}
      aria-label="Sidebar navigation"
    >
      <div className="flex flex-1 flex-col overflow-y-auto px-4 py-6">
        <div className="mb-4 px-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            {role === 'admin' ? 'Administration' : role === 'dentist' ? 'Dental Clinic' : 'Patient Care'}
          </p>
        </div>
        <nav className="space-y-1">
          {items.map((item) => {
            const Icon = item.icon;
            if (item.disabled) {
              return (
                <div
                  key={item.name}
                  className="flex items-center justify-between rounded-lg px-3 py-2 text-sm font-medium text-slate-400 cursor-not-allowed opacity-60"
                  aria-disabled="true"
                >
                  <div className="flex items-center gap-3">
                    <Icon className="h-4 w-4" />
                    <span>{item.name}</span>
                  </div>
                  {item.badge && (
                    <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500">
                      {item.badge}
                    </span>
                  )}
                </div>
              );
            }

            return (
              <Link
                key={item.name}
                to={item.href}
                aria-current={activeHref === item.href ? 'page' : undefined}
                className={
                  `flex items-center justify-between rounded-xl px-3 py-3 text-sm font-medium transition-all duration-200 ${
                    activeHref === item.href
                      ? 'bg-clinical-500 text-clinical-900 font-bold shadow-[0_0_0_3px_#d8f5ef]'
                      : 'text-slate-700 hover:bg-clinical-50 hover:text-clinical-800'
                  }`
                }
              >
                <div className="flex items-center gap-3">
                  <Icon className="h-4 w-4" />
                  <span>{item.name}</span>
                </div>
                {item.badge && (
                  <span className="rounded bg-clinical-100 px-1.5 py-0.5 text-[10px] font-semibold text-clinical-800">
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
      </div>
    </aside>
  );
};

export default Sidebar;
