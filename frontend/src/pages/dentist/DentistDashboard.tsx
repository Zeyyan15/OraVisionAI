/**
 * OraVisionAI — Dentist Clinical Workspace Dashboard (Phase 24)
 *
 * Provides real-time clinical caseload statistics, direct screening case discovery,
 * and upcoming consultation queue overview.
 */

import React, { useState, useEffect, useMemo } from 'react';
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
  ClipboardList,
  FolderSearch,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { getDentistPendingReviews, getMyPatientCases } from '../../api/dentistEndpoints';
import { DentistPendingReviewItem, DentistPatientCaseItem } from '../../types/dentist';
import { formatAppointmentDate } from '../../utils/dateTimeUtils';

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
    confirmAppt,
    rejectAppt,
    isApproved,
  } = useDentist();

  const [lookupScreeningId, setLookupScreeningId] = useState<string>('');
  const [lookupError, setLookupError] = useState<string | null>(null);

  const [pendingReviews, setPendingReviews] = useState<DentistPendingReviewItem[]>([]);
  const [loadingReviews, setLoadingReviews] = useState<boolean>(true);

  const [patientCases, setPatientCases] = useState<DentistPatientCaseItem[]>([]);
  const [loadingCases, setLoadingCases] = useState<boolean>(true);
  const [caseSearchTerm, setCaseSearchTerm] = useState<string>('');
  const [showManualLookup, setShowManualLookup] = useState<boolean>(false);

  useEffect(() => {
    fetchAppointments();
  }, [fetchAppointments]);

  useEffect(() => {
    let isMounted = true;
    getDentistPendingReviews()
      .then((res) => {
        if (isMounted) {
          setPendingReviews(res?.items || []);
          setLoadingReviews(false);
        }
      })
      .catch((err) => {
        console.warn('Failed to load pending reviews:', err);
        if (isMounted) setLoadingReviews(false);
      });
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;
    getMyPatientCases()
      .then((res) => {
        if (isMounted) {
          setPatientCases(res?.items || []);
          setLoadingCases(false);
        }
      })
      .catch((err) => {
        console.warn('Failed to load patient cases:', err);
        if (isMounted) setLoadingCases(false);
      });
    return () => {
      isMounted = false;
    };
  }, []);

  const filteredCases = useMemo(() => {
    if (!caseSearchTerm.trim()) return patientCases;
    const q = caseSearchTerm.toLowerCase();
    return patientCases.filter((c) => {
      return (
        c.patient_name.toLowerCase().includes(q) ||
        c.screening_id.toLowerCase().includes(q) ||
        (c.risk_level && c.risk_level.toLowerCase().includes(q)) ||
        (c.review_status && c.review_status.toLowerCase().includes(q)) ||
        (c.ai_class && c.ai_class.toLowerCase().includes(q))
      );
    });
  }, [patientCases, caseSearchTerm]);

  const getRiskBadge = (level?: string | null, score?: number | null) => {
    const norm = (level || '').toLowerCase();
    let variant: 'neutral' | 'info' | 'success' | 'warning' | 'danger' = 'neutral';
    let label = 'Low';
    if (norm === 'critical') {
      variant = 'danger';
      label = 'Critical';
    } else if (norm === 'high') {
      variant = 'danger';
      label = 'High';
    } else if (norm === 'moderate') {
      variant = 'warning';
      label = 'Moderate';
    } else if (norm === 'low') {
      variant = 'success';
      label = 'Low';
    } else {
      label = norm ? norm.toUpperCase() : 'Unassigned';
    }
    const tooltip = score !== null && score !== undefined
      ? `Clinical Urgency Score: ${score}/100 (Urgency ranking, not disease probability)`
      : 'Clinical urgency ranking, not disease probability';

    return (
      <span title={tooltip}>
        <Badge variant={variant} className="capitalize">
          {label}
        </Badge>
      </span>
    );
  };

  const getReviewStatusBadge = (status: string) => {
    switch (status) {
      case 'pending_review':
        return <Badge variant="warning">Pending Review</Badge>;
      case 'finalized':
        return <Badge variant="success">Reviewed</Badge>;
      case 'consultation_linked':
        return <Badge variant="info">Consultation Linked</Badge>;
      default:
        return <Badge variant="neutral">{status.replace('_', ' ')}</Badge>;
    }
  };

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

      {/* Primary Patient Cases Discovery Surface */}
      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="pb-3 border-b border-slate-100">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-clinical-50 text-clinical-600 rounded-lg">
                <FolderSearch className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <CardTitle className="text-base text-slate-900">
                    Patient Cases
                  </CardTitle>
                  <Badge variant="neutral" className="text-xs">
                    {patientCases.length} Total
                  </Badge>
                </div>
                <CardDescription className="text-xs text-slate-500">
                  Screening cases assigned for your clinical review or linked to patient consultations.
                </CardDescription>
              </div>
            </div>
            <div className="w-full sm:w-72">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                <Input
                  type="text"
                  placeholder="Filter cases by name, finding, risk..."
                  value={caseSearchTerm}
                  onChange={(e) => setCaseSearchTerm(e.target.value)}
                  className="pl-8 bg-white text-xs h-9"
                />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-4">
          {loadingCases ? (
            <div className="p-8 text-center text-xs text-slate-400">
              Loading authorized patient cases...
            </div>
          ) : filteredCases.length === 0 ? (
            <div className="p-8 text-center space-y-1">
              <p className="text-sm font-medium text-slate-700">
                {caseSearchTerm ? 'No matching patient cases found' : 'No Authorized Patient Cases'}
              </p>
              <p className="text-xs text-slate-500">
                {caseSearchTerm
                  ? 'Try searching with a different term or clear the filter.'
                  : 'Screenings requested for clinical review or attached to consultations will appear here automatically.'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto -mx-6">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-50/80 border-y border-slate-100 text-[11px] uppercase tracking-wider text-slate-500 font-semibold">
                  <tr>
                    <th className="px-6 py-3">Patient</th>
                    <th className="px-4 py-3">Screening Date</th>
                    <th className="px-4 py-3">Primary Finding</th>
                    <th className="px-4 py-3">Clinical Risk</th>
                    <th className="px-4 py-3">Review Status</th>
                    <th className="px-6 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredCases.map((c) => (
                    <tr key={c.screening_id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-6 py-3 font-medium text-slate-900">
                        {c.patient_name}
                      </td>
                      <td className="px-4 py-3 text-slate-500">
                        {formatAppointmentDate(c.screening_date)}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        <span className="capitalize">{c.ai_class ? c.ai_class.replace(/_/g, ' ') : 'Standard Screening'}</span>
                      </td>
                      <td className="px-4 py-3">
                        {getRiskBadge(c.risk_level, c.risk_score)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-1 items-start">
                          {getReviewStatusBadge(c.review_status)}
                          {c.appointment_id && (
                            <span className="text-[10px] bg-sky-50 text-sky-700 px-1.5 py-0.5 rounded border border-sky-200 font-medium">
                              Appt Linked
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-3 text-right">
                        <Button
                          size="sm"
                          variant="primary"
                          className="text-xs py-1 px-3 inline-flex items-center gap-1.5"
                          onClick={() => navigate(`/dentist/screenings/${c.screening_id}/review`)}
                        >
                          <FileSearch className="h-3 w-3" />
                          <span>Review Case</span>
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Advanced / Fallback: Direct Case UUID Lookup */}
      <div className="bg-slate-50/70 border border-slate-200 rounded-xl overflow-hidden transition-all">
        <button
          type="button"
          onClick={() => setShowManualLookup(!showManualLookup)}
          className="w-full flex items-center justify-between px-5 py-3.5 text-left text-xs font-medium text-slate-700 hover:bg-slate-100/70 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Search className="h-4 w-4 text-slate-400" />
            <span>Looking for a specific case by Direct Screening ID?</span>
            <span className="text-[11px] text-slate-400 font-normal">(Advanced)</span>
          </div>
          {showManualLookup ? (
            <ChevronDown className="h-4 w-4 text-slate-400" />
          ) : (
            <ChevronRight className="h-4 w-4 text-slate-400" />
          )}
        </button>

        {showManualLookup && (
          <div className="px-5 pb-5 pt-2 border-t border-slate-200/60 bg-white space-y-3">
            <p className="text-xs text-slate-500">
              Enter a direct 36-character screening UUID if provided an off-queue reference. Clinical access verification will be enforced upon navigation.
            </p>
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
          </div>
        )}
      </div>

      {/* Pending Clinical Reviews Queue */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-clinical-600" />
            <h2 className="text-lg font-semibold text-slate-900">Pending Clinical Review Requests</h2>
            <Badge variant={pendingReviews.length > 0 ? "warning" : "neutral"} className="text-xs">
              {pendingReviews.length} Pending
            </Badge>
          </div>
        </div>

        {loadingReviews ? (
          <div className="bg-white p-6 rounded-xl border border-slate-200 text-center text-xs text-slate-400">
            Loading clinical review queue...
          </div>
        ) : pendingReviews.length === 0 ? (
          <div className="bg-white p-6 rounded-xl border border-dashed border-slate-200 text-center space-y-1">
            <p className="text-sm font-medium text-slate-700">No Pending Clinical Reviews</p>
            <p className="text-xs text-slate-500">
              When patients request a clinical evaluation of their oral screening, it will appear here for assessment.
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-50 border-b border-slate-200 text-[11px] uppercase tracking-wider text-slate-500 font-semibold">
                  <tr>
                    <th className="px-4 py-3">Patient</th>
                    <th className="px-4 py-3">Screening Date</th>
                    <th className="px-4 py-3">Requested</th>
                    <th className="px-4 py-3">Notes</th>
                    <th className="px-4 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {pendingReviews.map((rev) => (
                    <tr key={rev.assessment_id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-4 py-3 font-medium text-slate-900">
                        {rev.patient_name}
                      </td>
                      <td className="px-4 py-3 text-slate-500">
                        {new Date(rev.screening_date).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 text-slate-500">
                        {new Date(rev.requested_at).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 text-slate-600 max-w-xs truncate">
                        {rev.clinical_notes || 'Patient requested clinical review'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button
                          size="sm"
                          variant="primary"
                          className="text-xs py-1 px-2.5 inline-flex items-center gap-1"
                          onClick={() => navigate(`/dentist/screenings/${rev.screening_id}/review`)}
                        >
                          <FileSearch className="h-3 w-3" />
                          <span>Review Case</span>
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

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
          onConfirm={confirmAppt}
          onReject={rejectAppt}
        />
      </div>
    </div>
  );
};

export default DentistDashboard;
