/**
 * OraVisionAI — Patient Teleconsultations Queue Page (Phase 25)
 *
 * Displays all scheduled, active, and past teleconsultations for the patient,
 * with status filters and entry buttons into the session room.
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { LoadingSkeleton } from '../../components/feedback/LoadingSkeleton';
import { EmptyState } from '../../components/feedback/EmptyState';
import { ErrorState } from '../../components/feedback/ErrorState';
import { listConsultations } from '../../api/consultations';
import { ConsultationResponse, ConsultationStatus } from '../../types/consultation';
import {
  Video,
  Mic,
  MessageSquare,
  Calendar,
  Clock,
  User,
  ArrowRight,
  Shield,
  Filter,
} from 'lucide-react';

export const PatientConsultationsPage: React.FC = () => {
  const navigate = useNavigate();
  const [consultations, setConsultations] = useState<ConsultationResponse[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const fetchConsultations = async () => {
    setLoading(true);
    setError(null);
    try {
      const filter = statusFilter === 'all' ? undefined : statusFilter;
      const res = await listConsultations(filter);
      setConsultations(res.consultations);
    } catch (err: unknown) {
      const e = err as Error;
      setError(e.message || 'Unable to load consultations.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConsultations();
  }, [statusFilter]);

  const getStatusBadge = (status: ConsultationStatus) => {
    switch (status) {
      case 'active':
        return <Badge variant="success">Active Now</Badge>;
      case 'scheduled':
        return <Badge variant="info">Scheduled</Badge>;
      case 'ended':
        return <Badge variant="neutral">Concluded</Badge>;
      case 'failed':
        return <Badge variant="danger">Cancelled</Badge>;
      default:
        return <Badge variant="neutral">{status}</Badge>;
    }
  };

  const getModalityIcon = (type: string) => {
    switch (type) {
      case 'video':
        return <Video className="h-4 w-4 text-blue-600" />;
      case 'audio':
        return <Mic className="h-4 w-4 text-emerald-600" />;
      case 'chat':
        return <MessageSquare className="h-4 w-4 text-purple-600" />;
      default:
        return <Video className="h-4 w-4 text-slate-600" />;
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Teleconsultations
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Access appointment-bound video, audio, or messaging sessions with your treating dental practitioner.
          </p>
        </div>
      </div>

      {/* Media Honesty Notice */}
      <div className="flex items-start space-x-3 p-3.5 bg-sky-50 border border-sky-200 rounded-xl text-sky-900 text-xs">
        <Shield className="h-4 w-4 text-sky-600 shrink-0 mt-0.5" />
        <div>
          <span className="font-semibold">Teleconsultation Container: </span>
          Sessions are synchronized directly with your confirmed appointments. The room provides hardware readiness testing and live status synchronization with your treating practitioner.
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center space-x-2 border-b border-slate-200 pb-3">
        <Filter className="h-4 w-4 text-slate-400 mr-1" />
        {(['all', 'scheduled', 'active', 'ended', 'failed'] as const).map((filter) => (
          <button
            key={filter}
            type="button"
            onClick={() => setStatusFilter(filter)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors ${
              statusFilter === filter
                ? 'bg-sky-600 text-white'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            {filter === 'all' ? 'All Sessions' : filter}
          </button>
        ))}
      </div>

      {/* Consultations List */}
      {loading ? (
        <LoadingSkeleton count={3} />
      ) : error ? (
        <ErrorState title="Error Loading Consultations" message={error} onRetry={fetchConsultations} />
      ) : consultations.length === 0 ? (
        <EmptyState
          title="No Consultations Found"
          description={
            statusFilter === 'all'
              ? 'You do not have any teleconsultations scheduled. Book an appointment with a dental practitioner to get started.'
              : `No consultations found matching status "${statusFilter}".`
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {consultations.map((c) => (
            <Card key={c.id} className="hover:shadow-md transition-shadow border-slate-200">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <div className="p-2 bg-slate-100 rounded-lg">
                      {getModalityIcon(c.consultation_type)}
                    </div>
                    <div>
                      <CardTitle className="text-base font-semibold capitalize">
                        {c.consultation_type} Teleconsultation
                      </CardTitle>
                      <CardDescription className="text-xs">
                        {c.clinic_name || 'Dental Clinic'}
                      </CardDescription>
                    </div>
                  </div>
                  {getStatusBadge(c.session_status)}
                </div>
              </CardHeader>

              <CardContent className="space-y-4 pt-0">
                <div className="grid grid-cols-2 gap-2 text-xs text-slate-600 bg-slate-50 p-3 rounded-lg">
                  <div className="flex items-center space-x-1.5">
                    <User className="h-3.5 w-3.5 text-slate-400" />
                    <span className="truncate">{c.dentist_name || 'Dental Practitioner'}</span>
                  </div>
                  <div className="flex items-center space-x-1.5">
                    <Calendar className="h-3.5 w-3.5 text-slate-400" />
                    <span>
                      {c.scheduled_start
                        ? new Date(c.scheduled_start).toLocaleDateString()
                        : new Date(c.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  {c.duration_seconds > 0 && (
                    <div className="flex items-center space-x-1.5 col-span-2 text-slate-500">
                      <Clock className="h-3.5 w-3.5 text-slate-400" />
                      <span>Duration: {Math.round(c.duration_seconds / 60)} minutes</span>
                    </div>
                  )}
                </div>

                <Button
                  variant={c.session_status === 'active' ? 'primary' : 'outline'}
                  size="sm"
                  className="w-full flex items-center justify-center space-x-2 text-xs"
                  onClick={() => navigate(`/patient/consultations/${c.id}`)}
                >
                  <span>
                    {c.session_status === 'active'
                      ? 'Enter Active Room'
                      : c.session_status === 'scheduled'
                      ? 'Enter Session Room'
                      : 'View Session Summary'}
                  </span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};
