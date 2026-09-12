/**
 * OraVisionAI - Clinical Context & Risk Assessment Card Component (Phase 23)
 *
 * Renders deterministic clinical urgency triage tier, authoritative contributing factors,
 * summary, recommended action, and statutory disclaimer directly from the backend.
 *
 * CRITICAL SEMANTIC INVARIANT:
 * Risk scores (25, 50, 75, 100) are technical ordinal tier indices for sorting/ranking.
 * They are NEVER formatted with '%' or presented as calibrated disease probabilities.
 * No clinical timelines are hardcoded in the frontend.
 */

import React from 'react';
import { RiskAssessmentResponse } from '../../types/screening';
import { RISK_LEVEL_CONFIG, RiskLevel } from '../../types/domain';
import { ShieldCheck, AlertTriangle, AlertOctagon, RefreshCw, FileText, CheckCircle2 } from 'lucide-react';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';

export interface ClinicalRiskCardProps {
  riskAssessment?: RiskAssessmentResponse | null;
  isEvaluating?: boolean;
  onRecompute?: () => Promise<void>;
}

export const ClinicalRiskCard: React.FC<ClinicalRiskCardProps> = ({
  riskAssessment,
  isEvaluating = false,
  onRecompute,
}) => {
  if (!riskAssessment) {
    return (
      <div className='rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-3'>
        <div className='flex items-center justify-between pb-3 border-b border-slate-100'>
          <h3 className='text-base font-semibold text-slate-900'>Clinical Urgency Tier</h3>
          <Badge variant='neutral'>Pending Evaluation</Badge>
        </div>
        <p className='text-xs text-slate-500 py-4 text-center'>
          Automated clinical context triage tier will be synthesized once AI inference is complete.
        </p>
      </div>
    );
  }

  const tierConfig = RISK_LEVEL_CONFIG[riskAssessment.risk_level as RiskLevel] || {
    label: riskAssessment.risk_level.toUpperCase(),
    variant: 'neutral',
  };

  const getUrgencyIcon = (level: string) => {
    switch (level) {
      case 'critical':
        return <AlertOctagon className='h-6 w-6 text-rose-600' />;
      case 'high':
        return <AlertTriangle className='h-6 w-6 text-rose-500' />;
      case 'moderate':
        return <AlertTriangle className='h-6 w-6 text-amber-500' />;
      default:
        return <ShieldCheck className='h-6 w-6 text-emerald-600' />;
    }
  };

  const getTierBg = (level: string) => {
    switch (level) {
      case 'critical':
        return 'bg-rose-50/80 border-rose-200 text-rose-900';
      case 'high':
        return 'bg-rose-50/50 border-rose-200 text-rose-900';
      case 'moderate':
        return 'bg-amber-50/50 border-amber-200 text-amber-900';
      default:
        return 'bg-emerald-50/50 border-emerald-200 text-emerald-900';
    }
  };

  return (
    <div className='rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4'>
      <div className='flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100'>
        <div>
          <h3 className='text-base font-semibold text-slate-900'>
            Clinical Context & Urgency Tier
          </h3>
          <p className='text-xs text-slate-500'>
            Deterministic triage evaluation synthesizing AI findings with reported context.
          </p>
        </div>
        {onRecompute && (
          <Button
            type='button'
            variant='outline'
            size='sm'
            onClick={onRecompute}
            disabled={isEvaluating}
            className='shrink-0'
          >
            <RefreshCw className={'h-3.5 w-3.5 mr-1.5 ' + (isEvaluating ? 'animate-spin' : '')} />
            Re-evaluate
          </Button>
        )}
      </div>

      {/* Urgency Level Banner */}
      <div className={'flex items-start gap-3.5 p-4 rounded-xl border ' + getTierBg(riskAssessment.risk_level)}>
        <div className='shrink-0 mt-0.5'>{getUrgencyIcon(riskAssessment.risk_level)}</div>
        <div className='flex-1 min-w-0'>
          <div className='flex flex-wrap items-center gap-2 mb-1'>
            <span className='text-sm font-bold tracking-tight'>
              {tierConfig.label.toUpperCase()}
            </span>
            <Badge variant={tierConfig.variant === 'danger' ? 'danger' : tierConfig.variant === 'warning' ? 'warning' : 'success'}>
              Triage Index: {riskAssessment.risk_score.toFixed(1)}
            </Badge>
            <span className='text-[11px] text-slate-500 font-mono'>
              (Ordinal Tier {riskAssessment.risk_score.toFixed(0)})
            </span>
          </div>
          <p className='text-xs leading-relaxed opacity-90'>
            {riskAssessment.summary}
          </p>
        </div>
      </div>

      {/* Recommended Action (Authoritative from Backend) */}
      <div className='rounded-lg border border-slate-200 bg-slate-50/70 p-3.5 space-y-1.5'>
        <div className='flex items-center gap-1.5 text-xs font-bold text-slate-800 uppercase tracking-wider'>
          <CheckCircle2 className='h-4 w-4 text-clinical-600' />
          <span>Recommended Clinical Action</span>
        </div>
        <p className='text-xs text-slate-700 leading-relaxed font-medium'>
          {riskAssessment.recommended_action}
        </p>
      </div>

      {/* Contributing Factors Breakdown */}
      {riskAssessment.contributing_factors && riskAssessment.contributing_factors.length > 0 && (
        <div className='space-y-2'>
          <h4 className='text-xs font-semibold text-slate-700 uppercase tracking-wider'>
            Contributing Evidence & Context
          </h4>
          <ul className='space-y-1.5 list-none p-0 m-0'>
            {riskAssessment.contributing_factors.map((factor, idx) => (
              <li
                key={idx}
                className='flex items-start gap-2 text-xs p-2.5 rounded-lg border border-slate-100 bg-white hover:bg-slate-50/50'
              >
                <Badge variant='neutral' className='shrink-0 text-[10px] uppercase font-mono mt-0.5'>
                  {factor.category}
                </Badge>
                <div className='flex-1 min-w-0'>
                  <span className='text-slate-800 font-medium'>{factor.observation}</span>
                  <span className='text-[10px] text-slate-400 block mt-0.5'>
                    Source: {factor.source}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Statutory Clinical Disclaimer */}
      <div className='flex items-start gap-2 pt-3 border-t border-slate-100 text-[11px] text-slate-500'>
        <FileText className='h-4 w-4 text-slate-400 shrink-0 mt-0.5' />
        <p className='leading-relaxed'>
          <span className='font-semibold text-slate-600'>Statutory Clinical Disclaimer:</span>{' '}
          {riskAssessment.disclaimer}
        </p>
      </div>
    </div>
  );
};

export default ClinicalRiskCard;
