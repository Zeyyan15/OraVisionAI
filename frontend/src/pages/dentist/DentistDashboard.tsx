/**
 * OraVisionAI — Dentist Clinical Workspace Dashboard (Phase 24)
 *
 * Provides real-time clinical caseload statistics, direct screening case discovery,
 * and upcoming consultation queue overview.
 */

import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useDentist } from '../../hooks/useDentist';
import { DentistAppointmentsTable } from '../../components/dentist/DentistAppointmentsTable';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Input } from '../../components/ui/Input';
import {
  Stethoscope,
  Calendar,
  FileSearch,
  Users,
  Search,
  CheckCircle,
  Clock,
  Building2,
  ArrowRight,
} from 'lucide-react';

export const DentistDashboard: React.FC = () => {
  const navigate = useNavigate();
  const {
    profile,
    profileLoading,
    appointments,
    appointmentsLoading,
    appointmentsTotal,
    fetchAppointments,
    updateStatus,
    cancelAppt,
    isApproved,
  } = useDentist();

  const [lookupScreeningId, setLookupScreeningId] = useState<string>('');
  const [lookupError, setLookupError] = useState<string | null>(null);

  useEffect(() => {
    fetchAppointments();
  }, [fetchAppointments]);

  const handleScreeningLookup = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = lookupScreeningId.trim();
    if (!trimmed) {
      setLookupError('Please enter a screening UUID.');
      return;
    }
    // Basic UUID validation
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(trimmed)) {
      setLookupError('Please enter a valid 36-character screening UUID.');
      return;
    }
    setLookupError(null);
    navigate(`/dentist/screenings/${trimmed}/review`);
  };

  const confirmedCount = appointments.filter((a) => a.status === 'confirmed').length;
  const inProgressCount = appointments.filter((a) => a.status === 'in_progress').length;
  const completedCount = appointments.filter((a) => a.status === 'completed').length;

  return (
    <div className="space-y-6">
      {/* Top Header & Practitioner Overview */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              {profileLoading ? (
                'Loading Practitioner Workspace...'
              ) : (
                `Dr. ${profile?.first_name || ''} ${profile?.last_name || ''}`
              )}
            </h1>
            {isApproved ? (
              <Badge variant="success" className="px-2.5 py-0.5 text-xs">
                Approved Dentist
              </Badge>
            ) : (
              <Badge variant="warning" className="px-2.5 py-0.5 text-xs">
                Pending Verification
              </Badge>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 pt-1">
            <span className="flex items-center gap-1">
              <Stethoscope className="h-3.5 w-3.5 text-clinical-600" />
              {profile?.specialization || 'General Dentistry'}
            </span>
            {profile?.clinic_name && (
              <span className="flex items-center gap-1">
                <Building2 className="h-3.5 w-3.5 text-slate-400" />
                {profile.clinic_name}
              </span>
            )}
            {profile?.years_of_experience !== undefined && (
              <span>Experience: {profile.years_of_experience} years</span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Link to="/dentist/appointments">
            <Button variant="outline" size="sm" className="text-xs flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5" />
              <span>All Appointments</span>
            </Button>
          </Link>
          <Link to="/dentist/profile">
            <Button variant="primary" size="sm" className="text-xs flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5" />
              <span>My Profile</span>
            </Button>
          </Link>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-slate-200">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardDescription className="text-xs">Total Scheduled</CardDescription>
              <Calendar className="h-4 w-4 text-clinical-600" />
            </div>
            <CardTitle className="text-2xl font-bold text-slate-900">
              {appointmentsLoading ? '—' : appointmentsTotal}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-[11px] text-slate-500">Consultations assigned in queue</p>
          </CardContent>
        </Card>

        <Card className="border-slate-200">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardDescription className="text-xs">Confirmed Sessions</CardDescription>
              <Clock className="h-4 w-4 text-amber-500" />
            </div>
            <CardTitle className="text-2xl font-bold text-amber-600">
              {appointmentsLoading ? '—' : confirmedCount}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-[11px] text-slate-500">Ready for clinical intake</p>
          </CardContent>
        </Card>

        <Card className="border-slate-200">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardDescription className="text-xs">Active Sessions</CardDescription>
              <Stethoscope className="h-4 w-4 text-clinical-600" />
            </div>
            <CardTitle className="text-2xl font-bold text-clinical-700">
              {appointmentsLoading ? '—' : inProgressCount}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-[11px] text-slate-500">Currently in consultation</p>
          </CardContent>
        </Card>

        <Card className="border-slate-200">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardDescription className="text-xs">Completed Evaluations</CardDescription>
              <CheckCircle className="h-4 w-4 text-emerald-600" />
            </div>
            <CardTitle className="text-2xl font-bold text-emerald-600">
              {appointmentsLoading ? '—' : completedCount}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-[11px] text-slate-500">Consultations closed</p>
          </CardContent>
        </Card>
      </div>

      {/* Direct Case Lookup Card */}
      <Card className="border-clinical-200 bg-clinical-50/30">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <FileSearch className="h-5 w-5 text-clinical-600" />
            <div>
              <CardTitle className="text-base text-slate-900">
                Direct Patient Screening Case Lookup
              </CardTitle>
              <CardDescription className="text-xs text-slate-600">
                Access any patient screening review package directly by screening identifier or via scheduled appointments below.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleScreeningLookup} className="space-y-2">
            <div className="flex flex-col sm:flex-row gap-3 max-w-2xl">
              <div className="flex-1">
                <Input
                  type="text"
                  placeholder="Enter 36-character screening UUID (e.g. 550e8400-e29b-41d4-a716-446655440000)"
                  value={lookupScreeningId}
                  onChange={(e) => {
                    setLookupScreeningId(e.target.value);
                    if (lookupError) setLookupError(null);
                  }}
                  className="bg-white text-xs"
                />
              </div>
              <Button type="submit" variant="primary" size="sm" className="flex items-center gap-2 text-xs">
                <Search className="h-3.5 w-3.5" />
                <span>Open Review Workbench</span>
              </Button>
            </div>
            {lookupError && (
              <p className="text-xs text-rose-600 font-medium">{lookupError}</p>
            )}
          </form>
        </CardContent>
      </Card>

      {/* Recent Appointments Queue */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Upcoming Patient Queue</h2>
          <Link
            to="/dentist/appointments"
            className="text-xs font-medium text-clinical-600 hover:text-clinical-700 hover:underline flex items-center gap-1"
          >
            <span>View all appointments</span>
            <ArrowRight className="h-3 w-3" />
          </Link>
        </div>

        <DentistAppointmentsTable
          appointments={appointments.slice(0, 5)}
          loading={appointmentsLoading}
          onUpdateStatus={updateStatus}
          onCancel={cancelAppt}
        />
      </div>
    </div>
  );
};

export default DentistDashboard;
