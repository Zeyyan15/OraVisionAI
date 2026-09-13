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

  return (
    <div className='max-w-6xl mx-auto space-y-6'>
      {/* Navigation & Header Bar */}
      <div className='flex flex-col sm:flex-row sm:items-center justify-between gap-4'>
        <div className='flex items-center gap-3'>
          <Button
            type='button'
            variant='outline'
            size='sm'
            onClick={() => navigate('/patient/screenings')}
            className='shrink-0'
          >
            <ArrowLeft className='h-4 w-4 mr-1.5' />
            All Screenings
          </Button>

          <div>
            <div className='flex items-center gap-2'>
              <h1 className='text-xl font-bold tracking-tight text-slate-900'>
                Screening Session Results
              </h1>
              <Badge
                variant={
                  screening.screening_status === 'completed'
                    ? 'success'
                    : screening.screening_status === 'processing'
                    ? 'warning'
                    : screening.screening_status === 'failed'
                    ? 'danger'
                    : 'neutral'
                }
              >
                {screening.screening_status.toUpperCase()}
              </Badge>
            </div>
            <div className='flex items-center gap-3 text-xs text-slate-500 mt-0.5'>
              <span className='flex items-center gap-1'>
                <Calendar className='h-3.5 w-3.5' />
                {new Date(screening.screening_created_at).toLocaleDateString()}
              </span>
              <span className='text-slate-400'>Clinical Record</span>
            </div>
          </div>
        </div>

        <div className='flex items-center gap-2 self-start sm:self-auto'>
          <Button
            type='button'
            variant='outline'
            size='sm'
            onClick={() => screeningId && fetchScreening(screeningId)}
            className='text-slate-600'
          >
            <RefreshCw className='h-3.5 w-3.5 mr-1.5' />
            Refresh
          </Button>

          <Button
            type='button'
            variant='outline'
            size='sm'
            onClick={handleDelete}
            className='text-rose-600 hover:bg-rose-50 border-rose-200'
          >
            <Trash2 className='h-3.5 w-3.5 mr-1.5' />
            Delete
          </Button>
        </div>
      </div>

      {/* Statutory Clinical Decision Support Notice */}
      <Alert variant='warning' title='Clinical Decision Support Notice'>
        <div className='text-xs leading-relaxed space-y-1'>
          <p>
            The findings below are synthesized by deep learning computer vision algorithms (EfficientNetB0 and YOLO
            lesion detector) for educational and preliminary screening prioritization. They do{' '}
            <strong className='font-bold'>NOT</strong> constitute a definitive medical or dental diagnosis, clinical
            staging, or treatment plan. An in-person clinical examination by a licensed dental professional is required.
          </p>
        </div>
      </Alert>

      {/* Processing State Banner */}
      {screening.screening_status === 'processing' && (
        <Alert variant='info' title='AI Analysis in Progress'>
          <div className='flex items-center gap-2 text-xs'>
            <Clock className='h-4 w-4 shrink-0 animate-spin' />
            <span>
              The deep learning model is actively evaluating image features. This page will automatically update upon
              completion.
            </span>
          </div>
        </Alert>
      )}

      {/* Primary Classification Finding Hero Card */}
      {isCompleted && primaryPred && (
        <div className='rounded-xl border border-clinical-200 bg-gradient-to-r from-clinical-50/80 via-white to-clinical-50/40 p-5 shadow-sm'>
          <div className='flex flex-col md:flex-row md:items-center justify-between gap-4'>
            <div className='space-y-1'>
              <div className='flex items-center gap-2'>
                <span className='text-xs font-bold text-clinical-700 uppercase tracking-wider'>
                  Primary Computer Vision Finding
                </span>
                <Badge variant='info' className='font-mono text-xs'>
                  {primaryPred.predicted_class}
                </Badge>
              </div>
              <h2 className='text-2xl font-bold text-slate-900 tracking-tight'>
                {topName}
              </h2>
              <p className='text-xs text-slate-500 max-w-xl'>
                Dominant class activation identified by EfficientNetB0 oral lesion classifier.
              </p>
            </div>

            <div className='flex items-center gap-4 bg-white p-3.5 rounded-lg border border-slate-200/80 shadow-xs shrink-0'>
              <div>
                <div className='text-[11px] text-slate-400 uppercase font-semibold'>
                  Model Confidence
                </div>
                <div className='text-xl font-mono font-bold text-clinical-700'>
                  {(primaryPred.confidence * 100).toFixed(1)}%
                </div>
                <div className='text-[10px] text-slate-400 font-mono'>
                  Score: {primaryPred.confidence.toFixed(3)}
                </div>
              </div>

              {primaryPred.inference_duration_ms && (
                <div className='border-l border-slate-100 pl-3.5'>
                  <div className='text-[11px] text-slate-400 uppercase font-semibold'>
                    Inference Time
                  </div>
                  <div className='text-sm font-mono font-bold text-slate-700 flex items-center gap-1'>
                    <Cpu className='h-3.5 w-3.5 text-slate-400' />
                    {primaryPred.inference_duration_ms} ms
                  </div>
                  <div className='text-[10px] text-slate-400'>Synchronous</div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Multi-Modal Two-Column Clinical Grid */}
      <div className='grid grid-cols-1 lg:grid-cols-2 gap-6'>
        {/* Left Column: YOLO Localization & Explainable AI */}
        <div className='space-y-6'>
          {/* Spatial Localization */}
          <YoloOverlayViewer
            imageSrc={imageUrl || undefined}
            detections={screening.yolo_detections || []}
            fileName={screening.images && screening.images.length > 0 ? screening.images[0].file_name : undefined}
            imageWidth={screening.images && screening.images.length > 0 ? screening.images[0].image_width : undefined}
            imageHeight={screening.images && screening.images.length > 0 ? screening.images[0].image_height : undefined}
          />

          {/* Explainable AI */}
          <XaiSection
            xaiResults={(screening.xai_results || []) as any}
            isGenerating={isGeneratingXai}
            onGenerateMethod={(method) => generateXai(screening.screening_id, method).then(() => {})}
            screeningId={screening.screening_id}
          />
        </div>

        {/* Right Column: Probabilities, Urgency Tier, Dentist Review & Report */}
        <div className='space-y-6'>
          {/* 7-Class Distribution */}
          {primaryPred && (
            <ProbabilityDistributionChart
              probabilities={primaryPred.probabilities || []}
              predictedCode={topCode}
              confidence={primaryPred.confidence}
            />
          )}

          {/* Clinical Context & Urgency Tier */}
          <ClinicalRiskCard
            riskAssessment={(screening.risk_assessment as any) || null}
            onRecompute={() => computeRisk(screening.screening_id).then(() => {})}
          />

          {/* Licensed Dentist Clinical Review */}
          <DentistReviewCard
            dentistAssessments={screening.dentist_assessments || []}
          />

          {/* Clinical Report Action */}
          <ReportActionCard
            report={report}
            isScreeningCompleted={isCompleted}
            isGenerating={isGeneratingReport}
            isDownloading={isDownloadingReport}
            onGenerateReport={async () => {
              const rep = await generateReport(screening.screening_id);
              if (rep) {
                await downloadPdf(rep.id, rep.report_number);
              }
            }}
            onDownloadReport={(reportId, filename) => downloadPdf(reportId, filename).then(() => {})}
          />
        </div>
      </div>
    </div>
  );
};

export default ScreeningResultsPage;
