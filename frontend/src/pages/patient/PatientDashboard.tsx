/**
 * OraVisionAI — Patient Dashboard
 * Phase 23 Connected Clinical Interface.
 */

import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { listPatientScreenings } from '../../api/screeningEndpoints';
import { listAppointments } from '../../api/dentistEndpoints';
import { ScreeningResponse } from '../../types/screening';
import { ScreeningStatus } from '../../types/domain';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { FileSearch, Calendar, Video, Activity, Plus, ChevronRight, Clock } from 'lucide-react';

export const PatientDashboard: React.FC = () => {
  const { userProfile } = useAuth();
  const navigate = useNavigate();
  const [recentScreenings, setRecentScreenings] = useState<ScreeningResponse[]>([]);
  const [totalScreenings, setTotalScreenings] = useState<number>(0);
  const [upcomingAppointments, setUpcomingAppointments] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let isMounted = true;
    async function loadDashboardData() {
      try {
        const [screeningsData, apptsData] = await Promise.all([
          listPatientScreenings(1, 3).catch(() => ({ items: [], total: 0 })),
          listAppointments().catch(() => ({ items: [], total: 0 })),
        ]);
        if (isMounted) {
          setRecentScreenings(screeningsData.items || []);
          setTotalScreenings(screeningsData.total || 0);

          const upcoming = (apptsData.items || []).filter(
            (a: any) =>
              a.status === 'requested' || a.status === 'confirmed' || a.status === 'in_progress',
          ).length;
          setUpcomingAppointments(upcoming);
        }
      } catch (err) {
        console.error('Failed to load dashboard data:', err);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }
    loadDashboardData();
    return () => {
      isMounted = false;
    };
  }, []);

  const getStatusBadgeVariant = (status: ScreeningStatus) => {
    switch (status) {
      case 'completed':
        return 'success';
      case 'processing':
        return 'warning';
      case 'failed':
        return 'danger';
      case 'uploading':
        return 'warning';
      default:
        return 'neutral';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Welcome back, {userProfile?.first_name || 'Patient'}
          </h1>
          <p className="text-sm text-slate-500">
            Your personal oral health records and screening history.
          </p>
        </div>
        <Button
          onClick={() => navigate('/patient/screenings/new')}
          className="shrink-0"
        >
          <Plus className="h-4 w-4 mr-1.5" />
          New Screening
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Recent Screenings</CardTitle>
              <FileSearch className="h-5 w-5 text-clinical-600" />
            </div>
            <CardDescription>AI-assisted oral lesion analysis</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between text-sm py-2 border-b border-slate-100">
              <span className="text-slate-600">Total Screenings</span>
              <span className="font-semibold text-slate-900">
                {loading ? '...' : totalScreenings}
              </span>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={() => navigate('/patient/screenings/new')}
                className="w-full text-xs"
                variant="primary"
              >
                New Screening
              </Button>
              <Button
                onClick={() => navigate('/patient/screenings')}
                className="w-full text-xs"
                variant="outline"
              >
                View All
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Appointments</CardTitle>
              <Calendar className="h-5 w-5 text-clinical-600" />
            </div>
            <CardDescription>Scheduled consultations & visits</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between text-sm py-2 border-b border-slate-100">
              <span className="text-slate-600">Upcoming Visits</span>
              <span className="font-semibold text-slate-900">
                {loading ? '...' : upcomingAppointments}
              </span>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={() => navigate('/patient/dentists')}
                className="w-full text-xs"
                variant="primary"
              >
                Find a Dentist
              </Button>
              <Button
                onClick={() => navigate('/patient/appointments')}
                className="w-full text-xs"
                variant="outline"
              >
                My Visits
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Teleconsultations</CardTitle>
              <Video className="h-5 w-5 text-clinical-600" />
            </div>
            <CardDescription>Direct dental specialist reviews</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between text-sm py-2 border-b border-slate-100">
              <span className="text-slate-600">Active Consultations</span>
              <span className="font-semibold text-slate-900">0</span>
            </div>
            <Button
              onClick={() => navigate('/patient/consultations')}
              className="w-full text-xs"
              variant="outline"
            >
              View Consultations
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Recent Screenings List Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Recent Screening Activity</CardTitle>
              <CardDescription>Latest oral assessments and diagnostic summaries</CardDescription>
            </div>
            <Link
              to="/patient/screenings"
              className="text-xs font-medium text-clinical-600 hover:text-clinical-700 flex items-center gap-1"
            >
              View all ({totalScreenings})
              <ChevronRight className="h-3 w-3" />
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-6 text-center text-sm text-slate-400">Loading recent screenings...</div>
          ) : recentScreenings.length === 0 ? (
            <div className="py-6 text-center">
              <p className="text-sm text-slate-500 mb-3">No screenings recorded yet.</p>
              <Button
                size="sm"
                onClick={() => navigate('/patient/screenings/new')}
              >
                Start First Screening
              </Button>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {recentScreenings.map((screening) => (
                <div
                  key={screening.id}
                  className="py-3 flex items-center justify-between hover:bg-slate-50/50 px-2 rounded-md transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-clinical-50 text-clinical-700 rounded-lg">
                      <FileSearch className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-xs font-medium text-slate-900">
                        Oral Screening Session
                      </p>
                      <p className="text-xs text-slate-400 flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {new Date(screening.created_at).toLocaleDateString(undefined, {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant={getStatusBadgeVariant(screening.status)}>
                      {screening.status.toUpperCase()}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => navigate(`/patient/screenings/${screening.id}`)}
                    >
                      View
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-clinical-600" />
            <CardTitle className="text-base">Understanding Clinical Risk Tiers</CardTitle>
          </div>
          <CardDescription>
            Categorical urgency levels assigned by the AI screening pipeline.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="p-3 rounded-lg border border-emerald-100 bg-emerald-50/50">
              <Badge variant="success" className="mb-2">LOW RISK</Badge>
              <p className="text-xs text-slate-600">Ordinal Tier 25: Baseline low clinical urgency tier.</p>
            </div>
            <div className="p-3 rounded-lg border border-amber-100 bg-amber-50/50">
              <Badge variant="warning" className="mb-2">MODERATE</Badge>
              <p className="text-xs text-slate-600">Ordinal Tier 50: Moderate clinical urgency tier.</p>
            </div>
            <div className="p-3 rounded-lg border border-rose-100 bg-rose-50/50">
              <Badge variant="danger" className="mb-2">HIGH RISK</Badge>
              <p className="text-xs text-slate-600">Ordinal Tier 75: Elevated clinical urgency tier.</p>
            </div>
            <div className="p-3 rounded-lg border border-rose-200 bg-rose-100/50">
              <Badge variant="danger" className="mb-2">CRITICAL</Badge>
              <p className="text-xs text-slate-600">Ordinal Tier 100: Highest clinical urgency tier.</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default PatientDashboard;
