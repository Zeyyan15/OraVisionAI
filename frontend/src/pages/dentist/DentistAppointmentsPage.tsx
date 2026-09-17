/**
 * OraVisionAI — Dentist Appointments & Caseload Page (Phase 24)
 *
 * Dedicated page for managing practitioner appointments schedule,
 * updating consultation lifecycle statuses, and accessing linked screenings.
 */

import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useDentist } from '../../hooks/useDentist';
import { DentistAppointmentsTable } from '../../components/dentist/DentistAppointmentsTable';
import { Button } from '../../components/ui/Button';
import { Calendar, ArrowLeft, RefreshCw } from 'lucide-react';

export const DentistAppointmentsPage: React.FC = () => {
  const {
    appointments,
    appointmentsLoading,
    fetchAppointments,
    updateStatus,
    cancelAppt,
    confirmAppt,
    rejectAppt,
  } = useDentist();

  useEffect(() => {
    fetchAppointments();
  }, [fetchAppointments]);

  return (
    <div className="space-y-6">
      {/* Header & Breadcrumb */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <Link
            to="/dentist/dashboard"
            className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 mb-2 transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Back to Clinical Workspace</span>
          </Link>
          <div className="flex items-center gap-2">
            <Calendar className="h-6 w-6 text-clinical-600" />
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Appointments & Clinical Cases
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Manage scheduled patient consultations, consultation lifecycle states, and direct clinical case reviews.
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => fetchAppointments()}
          disabled={appointmentsLoading}
          className="text-xs flex items-center gap-1.5 self-start sm:self-auto"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${appointmentsLoading ? 'animate-spin' : ''}`} />
          <span>Refresh Queue</span>
        </Button>
      </div>

      {/* Appointments Table */}
      <DentistAppointmentsTable
        appointments={appointments}
        loading={appointmentsLoading}
        onUpdateStatus={updateStatus}
        onCancel={cancelAppt}
        onConfirm={confirmAppt}
        onReject={rejectAppt}
      />
    </div>
  );
};

export default DentistAppointmentsPage;
