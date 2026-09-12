/**
 * OraVisionAI — Clinical Screening Analytics Section (Phase 26)
 *
 * Implements screening cohort analytics strictly anchored to Screening.created_at,
 * status breakdowns, 4-tier risk distributions (low, moderate, high, critical),
 * reports generated, and dentist assessments.
 */

import React, { useState } from 'react';
import {
  ClinicalScreeningAnalyticsResponse,
  ScreeningAnalyticsQueryParams,
} from '../../types/admin';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { LoadingSkeleton } from '../feedback/LoadingSkeleton';
import {
  Activity,
  AlertTriangle,
  FileCheck,
  Stethoscope,
  Info,
  Search,
  RotateCcw,
} from 'lucide-react';

export interface ScreeningAnalyticsSectionProps {
  data: ClinicalScreeningAnalyticsResponse | null;
  loading: boolean;
  params: ScreeningAnalyticsQueryParams;
  onDateChange: (start?: string, end?: string) => void;
  onRefresh: () => void;
}

export const ScreeningAnalyticsSection: React.FC<ScreeningAnalyticsSectionProps> = ({
  data,
  loading,
  params,
  onDateChange,
  onRefresh,
}) => {
  const [startDateInput, setStartDateInput] = useState<string>(
    params.start_date ? params.start_date.substring(0, 10) : ''
  );
  const [endDateInput, setEndDateInput] = useState<string>(
    params.end_date ? params.end_date.substring(0, 10) : ''
  );
  const [dateError, setDateError] = useState<string | null>(null);

  const handleApplyDates = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setDateError(null);

    if (startDateInput && endDateInput && startDateInput > endDateInput) {
      setDateError('Start date cannot be after end date.');
      return;
    }

    const formattedStart = startDateInput ? `${startDateInput}T00:00:00Z` : undefined;
    const formattedEnd = endDateInput ? `${endDateInput}T23:59:59Z` : undefined;

    onDateChange(formattedStart, formattedEnd);
  };

  const handleResetDates = () => {
    setStartDateInput('');
    setEndDateInput('');
    setDateError(null);
    onDateChange(undefined, undefined);
  };

  return (
    <div className="space-y-6">
      {/* Date Filter & Cohort Anchor Notice */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Screening Temporal Cohort Filter</h3>
            <p className="text-xs text-slate-500">
              Filter clinical metrics by patient screening initiation date.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {onRefresh && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={onRefresh}
                className="text-xs text-slate-600"
              >
                Refresh
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleResetDates}
              leftIcon={RotateCcw}
              className="text-xs"
            >
              All Time
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleApplyDates}
              leftIcon={Search}
              className="text-xs"
            >
              Apply Window
            </Button>
          </div>
        </div>

        <form onSubmit={handleApplyDates} className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs max-w-xl">
          <div>
            <label htmlFor="screening-start-date" className="block font-medium text-slate-700 mb-1">
              Cohort Start Date
            </label>
            <input
              id="screening-start-date"
              type="date"
              value={startDateInput}
              onChange={(e) => setStartDateInput(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-800 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label htmlFor="screening-end-date" className="block font-medium text-slate-700 mb-1">
              Cohort End Date
            </label>
            <input
              id="screening-end-date"
              type="date"
              value={endDateInput}
              onChange={(e) => setEndDateInput(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-800 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
        </form>

        {dateError && (
          <p className="text-xs font-medium text-rose-600" role="alert">
            {dateError}
          </p>
        )}

        {/* Authoritative Temporal Cohort Anchor Callout */}
        <div className="flex items-start gap-2.5 p-3 rounded-lg bg-indigo-50/60 border border-indigo-100 text-xs text-indigo-900">
          <Info className="h-4 w-4 text-indigo-600 shrink-0 mt-0.5" />
          <p>
            <strong>Authoritative Temporal Anchor:</strong> Metrics are strictly anchored to{' '}
            <code className="font-mono bg-indigo-100/70 px-1 py-0.5 rounded text-[11px]">Screening.created_at</code>.
            All associated risk assessments, practitioner clinical assessments, and PDF reports reflect screenings
            created within this temporal interval.
          </p>
        </div>
      </div>

      {loading ? (
        <LoadingSkeleton variant="card" count={3} />
      ) : data ? (
        <div className="space-y-6">
          {/* KPI Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card>
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs text-slate-500 font-medium">Cohort Screenings</p>
                  <p className="text-2xl font-bold text-slate-900 mt-0.5">{data.total_screenings}</p>
                </div>
                <div className="p-2.5 rounded-lg bg-teal-50 text-teal-600">
                  <Activity className="h-5 w-5" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs text-slate-500 font-medium">Clinical Reports Generated</p>
                  <p className="text-2xl font-bold text-slate-900 mt-0.5">{data.reports_generated}</p>
                </div>
                <div className="p-2.5 rounded-lg bg-indigo-50 text-indigo-600">
                  <FileCheck className="h-5 w-5" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs text-slate-500 font-medium">Dentist Assessments</p>
                  <div className="flex items-baseline gap-2 mt-0.5">
                    <span className="text-2xl font-bold text-slate-900">
                      {data.dentist_assessments.total_assessments}
                    </span>
                    <span className="text-xs text-emerald-600 font-medium">
                      ({data.dentist_assessments.finalized_count} finalized)
                    </span>
                  </div>
                </div>
                <div className="p-2.5 rounded-lg bg-purple-50 text-purple-600">
                  <Stethoscope className="h-5 w-5" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* 4-Tier Risk Distribution Card */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">Categorical Risk Distribution</CardTitle>
                  <CardDescription className="text-xs">
                    Distribution across the exact four clinical triage tiers
                  </CardDescription>
                </div>
                <Badge variant="neutral" className="text-xs font-mono">
                  {data.risk_distribution.reduce((acc, i) => acc + i.count, 0)} Total Assessed
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3" role="region" aria-label="Risk level distribution">
                {data.risk_distribution.map((item) => {
                  const level = item.risk_level;
                  const barColor = {
                    low: 'bg-emerald-500',
                    moderate: 'bg-amber-500',
                    high: 'bg-orange-500',
                    critical: 'bg-rose-600',
                  }[level] || 'bg-slate-500';

                  return (
                    <div key={level} className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <span className={`w-2.5 h-2.5 rounded-full ${barColor}`} />
                          <span className="font-semibold text-slate-800 uppercase tracking-wide text-[11px]">
                            {level} Risk
                          </span>
                        </div>
                        <div className="flex items-center gap-2 font-mono">
                          <span className="text-slate-600 font-bold">{item.count} cases</span>
                          <span className="text-slate-400">({item.percentage.toFixed(1)}%)</span>
                        </div>
                      </div>

                      {/* Pure CSS Progress Bar */}
                      <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${barColor}`}
                          style={{ width: `${Math.min(Math.max(item.percentage, 0), 100)}%` }}
                          role="progressbar"
                          aria-valuenow={Math.round(item.percentage)}
                          aria-valuemin={0}
                          aria-valuemax={100}
                          aria-label={`${level} risk percentage: ${item.percentage.toFixed(1)}%`}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Epistemic Safety Notice */}
              <div className="flex items-start gap-2 pt-3 border-t border-slate-100 text-[11px] text-slate-500">
                <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                <p>
                  <strong>Clinical Decision-Support Notice:</strong> Risk levels represent categorical triage
                  prioritizations derived from clinical questionnaire responses and AI lesion scores. They do{' '}
                  <strong>NOT</strong> represent epidemiological disease prevalence, and risk percentages must never
                  be conflated with calibrated individual disease probabilities.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Screening Pipeline Lifecycle Breakdown */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Screening Lifecycle Statuses</CardTitle>
              <CardDescription className="text-xs">
                Pipeline execution states for the active cohort
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-center">
                {Object.entries(data.screening_status_breakdown).map(([statusKey, count]) => (
                  <div key={statusKey} className="rounded-lg bg-slate-50 p-3 border border-slate-100">
                    <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold">{statusKey}</p>
                    <p className="text-xl font-bold text-slate-900 mt-1">{count}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}
    </div>
  );
};

export default ScreeningAnalyticsSection;
