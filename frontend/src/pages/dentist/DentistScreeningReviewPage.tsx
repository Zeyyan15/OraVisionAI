/**
 * OraVisionAI — Dentist Clinical Screening Review Workbench (Phase 24)
 *
 * Provides treating dental practitioners with a comprehensive diagnostic workbench:
 * - Patient Demographics & Intake Context
 * - Multi-Modal AI Diagnostic Findings (Class Scores, YOLO Localization, XAI, Urgency Tier)
 * - Professional Assessment Form (Observations, Diagnosis, Recommendations, Referrals)
 * - Assessment Finalization & Locking with Strict Conflict Handling
 * - Clinical Report (PDF) Compilation & Streaming Download
 */

import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useDentistAssessment } from '../../hooks/useDentistAssessment';
import { DentistAssessmentForm } from '../../components/dentist/DentistAssessmentForm';
import { ProbabilityDistributionChart } from '../../components/screening/ProbabilityDistributionChart';
import { YoloOverlayViewer } from '../../components/screening/YoloOverlayViewer';
import { ClinicalRiskCard } from '../../components/screening/ClinicalRiskCard';
import { ReportActionCard } from '../../components/screening/ReportActionCard';
import { LoadingSkeleton } from '../../components/feedback/LoadingSkeleton';
import { ErrorState } from '../../components/feedback/ErrorState';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Alert } from '../../components/ui/Alert';
import {
  ArrowLeft,
  User,
  Calendar,
  Sparkles,
  Eye,
  Info,
  Layers,
  MessageSquare,
} from 'lucide-react';
import { LesionClassCode, LESION_CLASSES } from '../../types/domain';
import { RiskAssessmentResponse } from '../../types/screening';
import { initiatePatientConversation } from '../../api/communicationEndpoints';

export const DentistScreeningReviewPage: React.FC = () => {
  const { screeningId = '' } = useParams<{ screeningId: string }>();
  const navigate = useNavigate();

  const {
    reviewPackage,
    loadingReview,
    reviewError,
    reloadReview,
    assessment,
    isFinalized,
    savingDraft,
    finalizing,
    assessmentError,
    saveDraft,
    finalizeAssessment,
    generatingReport,
    reportData,
    generateReport,
    downloadReport,
  } = useDentistAssessment(screeningId);

  const [selectedImageIndex, setSelectedImageIndex] = useState<number>(0);
  const [messagingPatient, setMessagingPatient] = useState<boolean>(false);
  const [messageError, setMessageError] = useState<string | null>(null);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  if (loadingReview && !reviewPackage) {
    return (
      <div className="max-w-7xl mx-auto space-y-6">
        <LoadingSkeleton variant="card" count={3} />
      </div>
    );
  }

  if (reviewError && !reviewPackage) {
    return (
      <div className="max-w-4xl mx-auto py-12">
        <ErrorState
          title="Failed to Load Clinical Screening Review"
          message={reviewError}
          onRetry={reloadReview}
        />
      </div>
    );
  }

  if (!reviewPackage) {
    return (
      <div className="max-w-4xl mx-auto py-12">
        <ErrorState
          title="Screening Case Not Found"
          message={`No screening record matching ID '${screeningId}' was found or authorized for review.`}
        />
      </div>
    );
  }

  const primaryImage =
    reviewPackage.images && reviewPackage.images.length > 0
      ? reviewPackage.images[selectedImageIndex] || reviewPackage.images[0]
      : null;

  const predictedClassCode = reviewPackage.primary_prediction?.predicted_class as
    | LesionClassCode
    | undefined;
  const predictedClassName = predictedClassCode ? LESION_CLASSES[predictedClassCode] : undefined;

  const handleMessagePatient = async () => {
    if (!reviewPackage?.patient_id) return;
    setMessagingPatient(true);
    setMessageError(null);
    try {
      const conv = await initiatePatientConversation(reviewPackage.patient_id);
      navigate(`/dentist/messages/${conv.id}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unable to initiate message thread with patient.';
      setMessageError(msg);
    } finally {
      setMessagingPatient(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Breadcrumb & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <Link
            to="/dentist/appointments"
            className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 mb-1 transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Back to Appointments Queue</span>
          </Link>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Clinical Screening Case Review
          </h1>
          <p className="text-xs text-slate-500">
            Screening ID: <span className="font-mono text-slate-700">{screeningId}</span>
          </p>
        </div>

        <div className="flex items-center gap-2">
          {reviewPackage.patient_id && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleMessagePatient}
              loading={messagingPatient}
              className="text-xs flex items-center gap-1.5 text-clinical-600 border-clinical-200 hover:bg-clinical-50"
            >
              <MessageSquare className="h-3.5 w-3.5" />
              <span>Message Patient</span>
            </Button>
          )}

          <Badge
            variant={
              reviewPackage.screening_status === 'completed'
                ? 'success'
                : reviewPackage.screening_status === 'failed'
                ? 'danger'
                : 'warning'
            }
          >
            {reviewPackage.screening_status.toUpperCase()}
          </Badge>
        </div>
      </div>

      {messageError && (
        <Alert variant="danger" title="Messaging Error">
          {messageError}
        </Alert>
      )}

      {/* Statutory Clinical Disclaimer */}
      <Alert variant="info" title="Clinical Decision Support Notice" icon={Info}>
        OraVisionAI automated findings are provided strictly to assist dental practitioners and do
        not substitute for comprehensive in-person histological, radiological, or clinical
        evaluation. All preliminary diagnoses and treatment authorizations remain the professional
        responsibility of the treating dental practitioner.
      </Alert>

      {/* Patient Demographic Context Bar */}
      <Card className="border-slate-200 bg-white">
        <CardContent className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-full bg-clinical-50 flex items-center justify-center text-clinical-700">
                <User className="h-5 w-5" />
              </div>
              <div>
                <span className="text-slate-400 block">Patient Name</span>
                <span className="font-semibold text-slate-900 text-sm">
                  {reviewPackage.patient_name || 'Patient'}
                </span>
              </div>
            </div>

            <div>
              <span className="text-slate-400 block">Demographics</span>
              <span className="font-medium text-slate-800">
                {reviewPackage.patient_age !== null && reviewPackage.patient_age !== undefined
                  ? `${reviewPackage.patient_age} yrs`
                  : 'Age not specified'}
                {reviewPackage.patient_gender ? ` • ${reviewPackage.patient_gender}` : ''}
              </span>
            </div>

            <div>
              <span className="text-slate-400 block">Screening Initiated</span>
              <span className="font-medium text-slate-800 flex items-center gap-1 mt-0.5">
                <Calendar className="h-3.5 w-3.5 text-slate-400" />
                {new Date(reviewPackage.screening_created_at).toLocaleDateString()}
              </span>
            </div>

            <div>
              <span className="text-slate-400 block">Oral Cavity Photographs</span>
              <span className="font-medium text-slate-800">
                {reviewPackage.total_images} {reviewPackage.total_images === 1 ? 'image' : 'images'} recorded
              </span>
            </div>

            {reviewPackage.patient_notes && (
              <div className="col-span-full pt-2 border-t border-slate-100 text-slate-600">
                <strong className="text-slate-700">Patient Chief Concern:</strong> "
                {reviewPackage.patient_notes}"
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Main Grid: AI Findings (Left) & Assessment Workbench (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Multi-modal AI Clinical Findings (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Spatial Lesion Localization */}
          <div className="space-y-2">
            <YoloOverlayViewer
              detections={reviewPackage.yolo_detections}
              fileName={primaryImage?.file_name}
              imageWidth={primaryImage?.image_width}
              imageHeight={primaryImage?.image_height}
            />

            {/* Image Selector thumbnails if multiple images exist */}
            {reviewPackage.images && reviewPackage.images.length > 1 && (
              <div className="flex items-center gap-2 overflow-x-auto p-2 bg-slate-50 rounded-lg border border-slate-200">
                <span className="text-[11px] font-semibold text-slate-500 mr-1">Images:</span>
                {reviewPackage.images.map((img, idx) => (
                  <button
                    key={img.id}
                    type="button"
                    onClick={() => setSelectedImageIndex(idx)}
                    className={`px-3 py-1.5 rounded text-xs border transition-all ${
                      selectedImageIndex === idx
                        ? 'bg-clinical-600 text-white border-clinical-600 shadow-sm font-semibold'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {img.file_name || `Image ${idx + 1}`}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Primary Model Finding & Differential Distribution */}
          {reviewPackage.primary_prediction && (
            <div className="space-y-4">
              <Card className="border-slate-200 bg-white">
                <CardHeader className="pb-3 border-b border-slate-100">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Sparkles className="h-5 w-5 text-clinical-600" />
                      <div>
                        <CardTitle className="text-base text-slate-900">
                          Primary AI Model Prediction
                        </CardTitle>
                        <p className="text-xs text-slate-500">
                          Dual-stage EfficientNetB0 classification synthesis
                        </p>
                      </div>
                    </div>
                    <Badge variant="neutral" className="text-xs">
                      Target Layer: block6a_expand_conv
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="p-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-50 p-3 rounded-lg border border-slate-200">
                    <div>
                      <span className="text-xs text-slate-500 block">Predicted Oral Lesion</span>
                      <span className="text-lg font-bold text-slate-900">
                        {predictedClassName || reviewPackage.primary_prediction.predicted_class}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-xs text-slate-500 block">Model Confidence Score</span>
                      <span className="text-lg font-mono font-semibold text-clinical-700">
                        {(reviewPackage.primary_prediction.confidence * 100).toFixed(1)}%
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* 7-Class Probability Distribution */}
              {reviewPackage.primary_prediction.probabilities && (
                <ProbabilityDistributionChart
                  probabilities={reviewPackage.primary_prediction.probabilities}
                  predictedCode={predictedClassCode}
                  confidence={reviewPackage.primary_prediction.confidence}
                />
              )}
            </div>
          )}

          {/* Clinical Urgency Tier Card */}
          {reviewPackage.risk_assessment && (
            <ClinicalRiskCard
              riskAssessment={reviewPackage.risk_assessment as unknown as RiskAssessmentResponse}
            />
          )}

          {/* Explainable AI Visual Heatmaps */}
          {reviewPackage.xai_results && reviewPackage.xai_results.length > 0 && (
            <Card className="border-slate-200 bg-white">
              <CardHeader className="pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <Layers className="h-5 w-5 text-clinical-600" />
                  <div>
                    <CardTitle className="text-base text-slate-900">
                      Explainable AI (XAI) Attribution Heatmaps
                    </CardTitle>
                    <p className="text-xs text-slate-500">
                      Feature attribution maps from convolutional layer block6a_expand_conv
                    </p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-4 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {reviewPackage.xai_results.map((xai) => (
                    <div
                      key={xai.id}
                      className="rounded-lg border border-slate-200 overflow-hidden bg-slate-50 flex flex-col"
                    >
                      <div className="p-2.5 bg-white border-b border-slate-200 flex items-center justify-between">
                        <span className="text-xs font-semibold text-slate-800">
                          {xai.method.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                        </span>
                        {xai.is_primary_user_facing && (
                          <Badge variant="neutral" className="text-[10px]">
                            Primary Method
                          </Badge>
                        )}
                      </div>
                      <div className="p-2 flex-1 flex items-center justify-center bg-slate-900 min-h-[160px]">
                        <img
                          src={xai.overlay_image_storage_path}
                          alt={`${xai.method} overlay`}
                          className="max-h-48 object-contain rounded"
                        />
                      </div>
                      <div className="p-2 text-[11px] text-slate-500 bg-white border-t border-slate-100 flex items-center justify-between">
                        <span>Target: {xai.target_layer || 'block6a_expand_conv'}</span>
                        <span className="flex items-center gap-1 text-clinical-600">
                          <Eye className="h-3 w-3" /> Heatmap
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right Column: Practitioner Assessment & Clinical Report (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          {/* Assessment Form */}
          <DentistAssessmentForm
            assessment={assessment}
            isFinalized={isFinalized}
            savingDraft={savingDraft}
            finalizing={finalizing}
            assessmentError={assessmentError}
            onSaveDraft={saveDraft}
            onFinalize={finalizeAssessment}
          />

          {/* Clinical Report Action Card */}
          <ReportActionCard
            report={reportData}
            isGenerating={generatingReport}
            onGenerateReport={async () => {
              await generateReport(true);
            }}
            onDownloadReport={(reportId, filename) => downloadReport(reportId, filename)}
            isScreeningCompleted={reviewPackage.screening_status === 'completed'}
          />
        </div>
      </div>
    </div>
  );
};

export default DentistScreeningReviewPage;
