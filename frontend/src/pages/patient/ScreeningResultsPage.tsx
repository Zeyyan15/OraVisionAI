/**
 * OraVisionAI - Patient Screening Results & Clinical Findings Page (Phase 23)
 *
 * Full multi-modal clinical dashboard presenting:
 * - Diagnostic Disclaimer Notice (Academic FYP Framing)
 * - Primary AI Model Finding (Model Confidence / Class Score)
 * - 7-Class Probability Distribution Chart
 * - YOLO Lesion Detector Spatial Localization
 * - Explainable AI (XAI) Feature Attributions (Target: block6a_expand_conv)
 * - Clinical Context Urgency Tier (Ordinal Index: 25, 50, 75, 100)
 * - Professional Licensed Dentist Clinical Review
 * - Clinical Report (PDF) Compilation & Download
 */

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useScreening } from '../../hooks/useScreening';
import { YoloOverlayViewer } from '../../components/screening/YoloOverlayViewer';
import { ProbabilityDistributionChart } from '../../components/screening/ProbabilityDistributionChart';
import { XaiSection } from '../../components/screening/XaiSection';
import { ClinicalRiskCard } from '../../components/screening/ClinicalRiskCard';
import { DentistReviewCard } from '../../components/screening/DentistReviewCard';
import { ReportActionCard } from '../../components/screening/ReportActionCard';
import { LoadingSkeleton } from '../../components/feedback/LoadingSkeleton';
import { getArtifactSignedUrl } from '../../api/screeningEndpoints';
import { ErrorState } from '../../components/feedback/ErrorState';
import { Alert } from '../../components/ui/Alert';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { LESION_CLASSES, LesionClassCode } from '../../types/domain';
import {
  Calendar,
  ArrowLeft,
  Trash2,
  Cpu,
  Clock,
  RefreshCw,
  ArrowUpRight,
  ShieldCheck,
} from 'lucide-react';

export const ScreeningResultsPage: React.FC = () => {
  const { screeningId } = useParams<{ screeningId: string }>();
  const navigate = useNavigate();

  const {
    screening,
    report,
    loading,
    error,
    isGeneratingXai,
    isGeneratingReport,
    isDownloadingReport,
    fetchScreening,
    generateXai,
    computeRisk,
    generateReport,
    downloadPdf,
    deleteSession,
  } = useScreening(screeningId);

  const [pollCount, setPollCount] = useState(0);
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  // Retrieve signed URL for primary oral screening photograph
  useEffect(() => {
    let isMounted = true;
    const primaryImg = screening?.images?.find((img) => img.is_primary) || screening?.images?.[0];
    if (screeningId && primaryImg?.storage_path) {
      getArtifactSignedUrl(screeningId, primaryImg.storage_path)
        .then((res) => {
          if (isMounted) setImageUrl(res.signed_url);
        })
        .catch((err) => {
          console.warn('Could not retrieve signed URL for screening image:', err);
          if (isMounted) setImageUrl(null);
        });
    } else {
      setImageUrl(null);
    }
    return () => {
      isMounted = false;
    };
  }, [screeningId, screening?.images]);

  // Polling fallback if screening status is 'processing'
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    if (screening && screening.screening_status === 'processing' && pollCount < 10) {
      timer = setTimeout(() => {
        if (screeningId) {
          fetchScreening(screeningId);
          setPollCount((prev) => prev + 1);
        }
      }, 3000);
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [screening, pollCount, screeningId, fetchScreening]);

  if (loading && !screening) {
    return (
      <div className='max-w-6xl mx-auto space-y-6'>
        <LoadingSkeleton variant='card' count={3} />
      </div>
    );
  }

  if (error && !screening) {
    return (
      <div className='max-w-4xl mx-auto py-12'>
        <ErrorState
          title='Failed to Load Screening Results'
          message={error.message || 'Unable to retrieve clinical screening data.'}
          onRetry={() => screeningId && fetchScreening(screeningId)}
        />
      </div>
    );
  }

  if (!screening) {
    return (
      <div className='max-w-4xl mx-auto py-12'>
        <ErrorState
          title='Screening Not Found'
          message='The requested screening session could not be located or you lack authorization to view it.'
          onRetry={() => navigate('/patient/screenings')}
        />
      </div>
    );
  }

  const isCompleted = screening.screening_status === 'completed';
  const primaryPred = screening.primary_prediction;
  const topCode = (primaryPred?.predicted_class || '') as LesionClassCode;
  const topName = LESION_CLASSES[topCode] || primaryPred?.predicted_class || 'Oral Finding';

  const handleDelete = async () => {
    if (confirm('Are you sure you want to soft-delete this screening session? This action cannot be undone.')) {
      const success = await deleteSession(screening.screening_id);
      if (success) {
        navigate('/patient/screenings');
      }
    }
  };

  const primaryImage = screening.images?.find(image => image.is_primary) || screening.images?.[0];
  const recorded = new Date(screening.screening_created_at);
  const dateLabel = Number.isNaN(recorded.getTime()) ? 'Date unavailable' : recorded.toLocaleDateString(undefined, {day:'numeric',month:'long',year:'numeric'});

  return (
    <div className='screening-results max-w-6xl mx-auto space-y-6'>
      <div className='flex flex-wrap items-center justify-between gap-3'>
        <button type='button' onClick={() => navigate('/patient/screenings')} className='inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-emerald-800'><ArrowLeft className='h-4 w-4' /> All screenings</button>
        <div className='flex items-center gap-2'>
          <Button type='button' variant='ghost' size='sm' onClick={() => screeningId && fetchScreening(screeningId)} disabled={loading}><RefreshCw className='mr-1.5 h-3.5 w-3.5' />Refresh</Button>
          <Button type='button' variant='ghost' size='sm' onClick={handleDelete} aria-label='Delete screening' className='text-slate-400 hover:text-rose-600'><Trash2 className='h-3.5 w-3.5' /></Button>
        </div>
      </div>
      <header className='space-y-3'>
        <div className='flex flex-wrap items-center gap-3'><p className='results-eyebrow'>Your oral health record</p><Badge variant={isCompleted ? 'success' : screening.screening_status === 'failed' ? 'danger' : 'neutral'}>{screening.screening_status.replace('_', ' ')}</Badge></div>
        <h1 className='text-3xl sm:text-4xl font-semibold tracking-tight text-[#173f38]'>Screening results</h1>
        <p className='flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-slate-500'><span className='inline-flex items-center gap-1.5'><Calendar className='h-4 w-4' />{dateLabel}</span><span>{screening.total_images} {screening.total_images === 1 ? 'photograph' : 'photographs'} {isCompleted ? 'analyzed' : 'uploaded'}</span></p>
      </header>

      {error && <Alert variant='danger' title='Unable to complete this action'>{error.message}</Alert>}
      {screening.screening_status === 'processing' && <Alert variant='info' title='Analysis in progress'><span className='flex items-center gap-2 text-sm'><Clock className='h-4 w-4' />Your results will update as analysis completes.</span></Alert>}

      {isCompleted && primaryPred && <section className='results-summary grid gap-6 p-6 sm:p-8 md:grid-cols-[minmax(0,1fr)_auto]'>
        <div><p className='text-xs font-semibold uppercase tracking-[0.14em] text-emerald-200'>Leading model finding</p><h2 className='mt-3 text-3xl font-semibold tracking-tight text-white'>{topName}</h2><p className='mt-2 max-w-lg text-sm leading-relaxed text-emerald-100/80'>The category most strongly reflected in this photograph’s model output.</p><a href='#next-steps' className='mt-5 inline-flex items-center gap-2 text-sm font-semibold text-white underline decoration-white/30 underline-offset-4'>Discuss with a dentist<ArrowUpRight className='h-4 w-4' /></a></div>
        <div className='flex items-center gap-6 rounded-2xl border border-white/15 bg-white/5 px-6 py-5'>
          <div><p className='text-xs font-medium text-emerald-200'>Model class score</p><p className='mt-1 text-4xl font-semibold tracking-tight tabular-nums text-white'>{(primaryPred.confidence * 100).toFixed(1)}<span className='ml-1 text-xl text-emerald-200'>%</span></p><p className='mt-2 text-xs text-emerald-100/70'>Not a diagnostic probability</p></div>
          {primaryPred.inference_duration_ms != null && <div className='hidden sm:block border-l border-white/15 pl-6'><Cpu className='mb-2 h-5 w-5 text-emerald-200' /><p className='text-sm font-medium text-white'>{(primaryPred.inference_duration_ms / 1000).toFixed(1)} s</p><p className='mt-1 text-xs text-emerald-100/70'>Analysis time</p></div>}
        </div>
      </section>}
      <div className='flex items-start gap-3 rounded-xl border border-amber-200/60 bg-amber-50/60 px-5 py-4'><ShieldCheck className='mt-0.5 h-5 w-5 shrink-0 text-amber-700' /><p className='text-sm leading-relaxed text-slate-600'><strong className='font-semibold text-slate-800'>Screening, not a diagnosis.</strong> These AI findings support preliminary screening. A dentist must examine you to confirm a diagnosis and recommend treatment.</p></div>

      <nav aria-label='Results sections' className='flex gap-6 overflow-x-auto border-b border-slate-200 text-sm font-medium text-slate-500'><a href='#findings' className='results-section-link'>01 <span>Findings</span></a><a href='#explanations' className='results-section-link'>02 <span>Visual explanation</span></a><a href='#next-steps' className='results-section-link'>03 <span>Next steps</span></a></nav>
      <section id='findings' className='results-anchor grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]'>
        <YoloOverlayViewer imageSrc={imageUrl} detections={screening.yolo_detections || []} fileName={primaryImage?.file_name} imageWidth={primaryImage?.image_width} imageHeight={primaryImage?.image_height} />
        {primaryPred && <ProbabilityDistributionChart probabilities={primaryPred.probabilities || []} predictedCode={topCode} confidence={primaryPred.confidence} />}
      </section>
      <section id='explanations' className='results-anchor'><XaiSection xaiResults={screening.xai_results || []} isGenerating={isGeneratingXai} onGenerateMethod={async method => { await generateXai(screening.screening_id, method); }} screeningId={screening.screening_id} /></section>
      <section id='next-steps' className='results-anchor space-y-5'>
        <div><p className='results-eyebrow'>Continue your care</p><h2 className='mt-1 text-2xl font-semibold tracking-tight text-[#173f38]'>Your next steps</h2></div>
        <ClinicalRiskCard riskAssessment={(screening.risk_assessment as any) || null} onRecompute={() => computeRisk(screening.screening_id).then(() => {})} />
        <div className='grid gap-5 xl:grid-cols-2'>
          <DentistReviewCard dentistAssessments={screening.dentist_assessments || []} screeningId={screening.screening_id} onRequestReviewSuccess={() => fetchScreening(screening.screening_id)} />
          <ReportActionCard report={report} isScreeningCompleted={isCompleted} isGenerating={isGeneratingReport} isDownloading={isDownloadingReport} onGenerateReport={async () => { const rep = await generateReport(screening.screening_id); if (rep) await downloadPdf(rep.id, rep.report_number); }} onDownloadReport={(reportId, filename) => downloadPdf(reportId, filename).then(() => {})} />
        </div>
      </section>
    </div>
  );
};

export default ScreeningResultsPage;
