/**
 * OraVisionAI — Dentist Clinical Screening Review Workbench (Phase 24 & Phase 32)
 *
 * Provides treating dental practitioners with a comprehensive diagnostic workbench:
 * - Patient Demographics, Exposure Context & Intake Notes
 * - Linked Telehealth Appointment & Consultation Context
 * - Multi-Modal Visual Inspection: Untouched Clinical Photo & YOLO Lesion Localization
 * - Multi-Modal AI Diagnostic Findings (Class Scores, 7-Class Distribution, XAI, Urgency Tier)
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
import { Modal } from '../../components/ui/Modal';
import {
  ArrowLeft,
  User,
  Calendar,
  Sparkles,
  Eye,
  Info,
  Layers,
  MessageSquare,
  CheckCircle2,
  Clock,
  Video,
  Camera,
  Maximize2,
  Cigarette,
  Wine,
  Activity,
  FileText,
} from 'lucide-react';
import { LesionClassCode, LESION_CLASSES } from '../../types/domain';
import { RiskAssessmentResponse } from '../../types/screening';
import { initiatePatientConversation } from '../../api/communicationEndpoints';
import { getArtifactSignedUrl } from '../../api/screeningEndpoints';

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
  const [visualMode, setVisualMode] = useState<'original' | 'yolo'>('original');
  const [previewImage, setPreviewImage] = useState<{
    src: string;
    title: string;
    subtitle?: string;
  } | null>(null);

  const [messagingPatient, setMessagingPatient] = useState<boolean>(false);
  const [messageError, setMessageError] = useState<string | null>(null);
  const [artifactUrls, setArtifactUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  // Retrieve signed URLs for oral photos and XAI overlays
  useEffect(() => {
    let isMounted = true;
    if (!screeningId || !reviewPackage) return;

    const pathsToFetch: string[] = [];
    if (reviewPackage.images) {
      for (const img of reviewPackage.images) {
        if (img.storage_path) pathsToFetch.push(img.storage_path);
      }
    }
    if (reviewPackage.xai_results) {
      for (const xai of reviewPackage.xai_results) {
        if (xai.overlay_image_storage_path) pathsToFetch.push(xai.overlay_image_storage_path);
        if (xai.heatmap_storage_path) pathsToFetch.push(xai.heatmap_storage_path);
      }
    }

    if (pathsToFetch.length === 0) return;

    Promise.all(
      pathsToFetch.map((p) =>
        getArtifactSignedUrl(screeningId, p)
          .then((res) => ({ path: p, url: res.signed_url }))
          .catch((err) => {
            console.warn(`Failed to resolve signed URL for ${p}:`, err);
            return null;
          }),
      ),
    ).then((results) => {
      if (!isMounted) return;
      const urlMap: Record<string, string> = {};
      for (const r of results) {
        if (r) urlMap[r.path] = r.url;
      }
      setArtifactUrls(urlMap);
    });

    return () => {
      isMounted = false;
    };
  }, [screeningId, reviewPackage]);

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

  const primaryImageSrc = primaryImage?.storage_path
    ? artifactUrls[primaryImage.storage_path]
    : undefined;

  const predictedClassCode = reviewPackage.primary_prediction?.predicted_class as
    | LesionClassCode
    | undefined;
  const predictedClassName = predictedClassCode ? LESION_CLASSES[predictedClassCode] : undefined;

  // Format lifestyle exposure context
  const smokingLabel = reviewPackage.patient_lifestyle?.smoking_status
    ? reviewPackage.patient_lifestyle.smoking_status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
    : 'Not reported';
  const alcoholLabel = reviewPackage.patient_lifestyle?.alcohol_consumption
    ? reviewPackage.patient_lifestyle.alcohol_consumption.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
    : 'Not reported';
  const betelLabel =
    reviewPackage.patient_lifestyle?.betel_quid_user === true
      ? 'Active Chewer'
      : reviewPackage.patient_lifestyle?.betel_quid_user === false
      ? 'Non-user'
      : 'Not reported';

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

  const renderReviewStatusBadge = () => {
    if (isFinalized) {
      return (
        <Badge variant="success" className="flex items-center gap-1 font-medium">
          <CheckCircle2 className="h-3 w-3" />
          <span>Reviewed & Finalized</span>
        </Badge>
      );
    }
    if (assessment) {
      return (
        <Badge variant="warning" className="flex items-center gap-1 font-medium">
          <FileText className="h-3 w-3" />
          <span>Draft In Progress</span>
        </Badge>
      );
    }
    return (
      <Badge variant="neutral" className="flex items-center gap-1 font-medium text-amber-800 bg-amber-50 border-amber-200">
        <Clock className="h-3 w-3 text-amber-600" />
        <span>Pending Clinical Review</span>
      </Badge>
    );
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

        <div className="flex flex-wrap items-center gap-2">
          {renderReviewStatusBadge()}

          {reviewPackage.linked_appointment && (
            <Badge variant="info" className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              <span>Appt Linked</span>
            </Badge>
          )}

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
            Pipeline: {reviewPackage.screening_status.toUpperCase()}
          </Badge>
        </div>
      </div>

      {messageError && (
        <Alert variant="danger" title="Messaging Error">
          {messageError}
        </Alert>
      )}

      {/* Statutory Clinical Decision Support Notice */}
      <Alert variant="info" title="Clinical Decision Support Notice" icon={Info}>
        OraVisionAI automated findings are provided strictly to assist dental practitioners and do
        not substitute for comprehensive in-person histological, radiological, or clinical
        evaluation. All preliminary diagnoses and treatment authorizations remain the professional
        responsibility of the treating dental practitioner.
      </Alert>

      {/* Linked Appointment & Telehealth Context (if associated) */}
      {reviewPackage.linked_appointment && (
        <Card className="border-sky-200 bg-sky-50/50">
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-lg bg-sky-100 text-sky-700">
                  <Calendar className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-sky-950">
                      Linked Consultation Appointment
                    </span>
                    <Badge
                      variant={
                        reviewPackage.linked_appointment.status === 'confirmed'
                          ? 'success'
                          : reviewPackage.linked_appointment.status === 'cancelled'
                          ? 'danger'
                          : 'warning'
                      }
                      className="text-[10px] uppercase font-mono"
                    >
                      {reviewPackage.linked_appointment.status}
                    </Badge>
                  </div>
                  <p className="text-xs text-slate-800 font-semibold mt-0.5">
                    UTC Schedule:{' '}
                    <span className="font-mono">
                      {new Date(reviewPackage.linked_appointment.scheduled_start).toISOString().replace('T', ' ').slice(0, 16)} UTC
                      {' '}&ndash;{' '}
                      {new Date(reviewPackage.linked_appointment.scheduled_end).toISOString().replace('T', ' ').slice(11, 16)} UTC
                    </span>
                  </p>
                  <p className="text-[11px] text-slate-600">
                    Type: {reviewPackage.linked_appointment.appointment_type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                  </p>
                  {reviewPackage.linked_appointment.cancellation_reason && (
                    <p className="text-[11px] text-rose-700 mt-0.5 font-medium">
                      Cancellation Reason: {reviewPackage.linked_appointment.cancellation_reason}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
                {reviewPackage.linked_appointment.consultation_id ? (
                  <Button
                    size="sm"
                    variant="primary"
                    className="text-xs flex items-center gap-1.5"
                    onClick={() =>
                      navigate(`/dentist/consultations/${reviewPackage.linked_appointment?.consultation_id}`)
                    }
                  >
                    <Video className="h-3.5 w-3.5" />
                    <span>Enter Consultation Room</span>
                  </Button>
                ) : (
                  <Link
                    to="/dentist/appointments"
                    className="text-xs text-sky-800 hover:text-sky-900 font-medium underline"
                  >
                    View in Appointments Queue
                  </Link>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Patient Demographic & Exposure Context Bar */}
      <Card className="border-slate-200 bg-white">
        <CardContent className="p-4 space-y-4">
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
              <span className="text-slate-400 block">Oral Photographs</span>
              <span className="font-medium text-slate-800">
                {reviewPackage.total_images} {reviewPackage.total_images === 1 ? 'image' : 'images'} recorded
              </span>
            </div>
          </div>

          {/* Lifestyle Exposure Context Row */}
          <div className="pt-3 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs bg-slate-50/70 p-3 rounded-lg border border-slate-100">
            <div className="flex items-center gap-2">
              <Cigarette className="h-4 w-4 text-slate-500 shrink-0" />
              <div>
                <span className="text-slate-400 text-[11px] block">Smoking Status:</span>
                <span className="font-medium text-slate-800">{smokingLabel}</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-slate-500 shrink-0" />
              <div>
                <span className="text-slate-400 text-[11px] block">Betel Quid Chewing:</span>
                <span className="font-medium text-slate-800">{betelLabel}</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Wine className="h-4 w-4 text-slate-500 shrink-0" />
              <div>
                <span className="text-slate-400 text-[11px] block">Alcohol Intake:</span>
                <span className="font-medium text-slate-800">{alcoholLabel}</span>
              </div>
            </div>
          </div>

          {reviewPackage.patient_notes && (
            <div className="pt-2 border-t border-slate-100 text-xs text-slate-600">
              <strong className="text-slate-700">Patient Chief Concern:</strong> &ldquo;
              {reviewPackage.patient_notes}&rdquo;
            </div>
          )}
        </CardContent>
      </Card>

      {/* Main Grid: AI Findings (Left) & Assessment Workbench (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Multi-modal AI Clinical Findings (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Spatial Lesion Localization & Visual Evidence */}
          <Card className="border-slate-200 bg-white">
            <CardHeader className="pb-3 border-b border-slate-100">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Camera className="h-5 w-5 text-clinical-600" />
                  <div>
                    <CardTitle className="text-base text-slate-900">
                      Oral Cavity Visual Inspection
                    </CardTitle>
                    <p className="text-xs text-slate-500">
                      High-resolution photographic capture and YOLO spatial region-of-interest findings
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-lg border border-slate-200 text-xs">
                  <button
                    type="button"
                    onClick={() => setVisualMode('original')}
                    className={`px-3 py-1 rounded font-medium transition-colors ${
                      visualMode === 'original'
                        ? 'bg-white text-clinical-700 shadow-xs font-semibold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Original Photo
                  </button>
                  <button
                    type="button"
                    onClick={() => setVisualMode('yolo')}
                    className={`px-3 py-1 rounded font-medium transition-colors ${
                      visualMode === 'yolo'
                        ? 'bg-white text-clinical-700 shadow-xs font-semibold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    YOLO Localization ({reviewPackage.yolo_detections?.length || 0})
                  </button>
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-4 space-y-4">
              {visualMode === 'original' ? (
                <div className="space-y-3">
                  <div className="relative overflow-hidden rounded-lg border border-slate-200 bg-slate-950 flex items-center justify-center min-h-[280px] max-h-[460px] group">
                    {primaryImageSrc ? (
                      <>
                        <img
                          src={primaryImageSrc}
                          alt="Original oral cavity screening photograph"
                          className="max-h-[440px] w-auto max-w-full object-contain rounded transition-transform group-hover:scale-[1.01]"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setPreviewImage({
                              src: primaryImageSrc,
                              title: primaryImage?.file_name || 'Original Oral Cavity Photograph',
                              subtitle: 'Pristine photographic capture — unmodified clinical representation',
                            })
                          }
                          className="absolute bottom-3 right-3 bg-slate-900/80 hover:bg-slate-900 text-white text-xs px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 backdrop-blur-xs transition-colors"
                        >
                          <Maximize2 className="h-3.5 w-3.5" />
                          <span>Enlarge Photograph</span>
                        </button>
                      </>
                    ) : (
                      <div className="p-8 text-center text-slate-400 text-xs">
                        Loading photographic artifact from storage...
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-500 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                    <span className="font-semibold text-slate-700">
                      Original Clinical Capture &mdash; Untouched Photographic Record
                    </span>
                    <span>
                      {primaryImage?.file_name || 'Photograph 1'}
                      {primaryImage?.image_width && primaryImage?.image_height
                        ? ` • ${primaryImage.image_width}×${primaryImage.image_height}px`
                        : ''}
                    </span>
                  </div>
                </div>
              ) : (
                <YoloOverlayViewer
                  imageSrc={primaryImageSrc}
                  detections={reviewPackage.yolo_detections}
                  fileName={primaryImage?.file_name}
                  imageWidth={primaryImage?.image_width}
                  imageHeight={primaryImage?.image_height}
                />
              )}

              {/* Image Selector thumbnails if multiple images exist */}
              {reviewPackage.images && reviewPackage.images.length > 1 && (
                <div className="flex items-center gap-2 overflow-x-auto p-2 bg-slate-50 rounded-lg border border-slate-200">
                  <span className="text-[11px] font-semibold text-slate-500 mr-1">Photographs:</span>
                  {reviewPackage.images.map((img, idx) => (
                    <button
                      key={img.id}
                      type="button"
                      onClick={() => setSelectedImageIndex(idx)}
                      className={`px-3 py-1.5 rounded text-xs border transition-all ${
                        selectedImageIndex === idx
                          ? 'bg-clinical-600 text-white border-clinical-600 shadow-xs font-semibold'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {img.file_name || `Photo ${idx + 1}`}
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

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
                      <span className="text-xs text-slate-500 block">Predicted Oral Lesion Finding</span>
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
                  {reviewPackage.xai_results.map((xai) => {
                    const imgSrc = artifactUrls[xai.overlay_image_storage_path] || xai.overlay_image_storage_path;
                    const methodName = xai.method.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
                    return (
                      <div
                        key={xai.id}
                        className="rounded-lg border border-slate-200 overflow-hidden bg-slate-50 flex flex-col group"
                      >
                        <div className="p-2.5 bg-white border-b border-slate-200 flex items-center justify-between">
                          <span className="text-xs font-semibold text-slate-800">
                            {methodName}
                          </span>
                          {xai.is_primary_user_facing && (
                            <Badge variant="neutral" className="text-[10px]">
                              Primary Method
                            </Badge>
                          )}
                        </div>
                        <div className="relative p-2 flex-1 flex items-center justify-center bg-slate-950 min-h-[160px]">
                          <img
                            src={imgSrc}
                            alt={`${xai.method} overlay`}
                            className="max-h-48 object-contain rounded transition-transform group-hover:scale-[1.01]"
                          />
                          <button
                            type="button"
                            onClick={() =>
                              setPreviewImage({
                                src: imgSrc,
                                title: `${methodName} XAI Feature Attribution`,
                                subtitle: `Convolutional attribution map targeting layer ${xai.target_layer || 'block6a_expand_conv'}`,
                              })
                            }
                            className="absolute bottom-2 right-2 bg-slate-900/80 hover:bg-slate-900 text-white text-[10px] px-2 py-1 rounded flex items-center gap-1 backdrop-blur-xs"
                          >
                            <Maximize2 className="h-3 w-3" />
                            <span>Zoom</span>
                          </button>
                        </div>
                        <div className="p-2 text-[11px] text-slate-500 bg-white border-t border-slate-100 flex items-center justify-between">
                          <span>Target: {xai.target_layer || 'block6a_expand_conv'}</span>
                          <span className="flex items-center gap-1 text-clinical-600 font-medium">
                            <Eye className="h-3 w-3" /> Attribution Map
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="flex items-start gap-2 pt-2 border-t border-slate-100 text-[11px] text-slate-500">
                  <Info className="h-4 w-4 text-slate-400 shrink-0 mt-0.5" />
                  <p>
                    <span className="font-semibold text-slate-600">Feature Attribution Policy:</span> Visual
                    heatmaps highlight pixel regions that contributed most to the model&rsquo;s classification
                    score. They do not represent pathological margins or diagnostic certainty.
                  </p>
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

      {/* Lightbox / High-Resolution Image Preview Modal */}
      {previewImage && (
        <Modal
          isOpen={true}
          onClose={() => setPreviewImage(null)}
          title={previewImage.title}
          maxWidth="xl"
        >
          <div className="space-y-3">
            <div className="bg-slate-950 rounded-lg p-2 flex items-center justify-center max-h-[70vh] overflow-auto">
              <img
                src={previewImage.src}
                alt={previewImage.title}
                className="max-h-[65vh] w-auto max-w-full object-contain rounded"
              />
            </div>
            {previewImage.subtitle && (
              <p className="text-xs text-slate-500 text-center">
                {previewImage.subtitle}
              </p>
            )}
            <div className="flex justify-end pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPreviewImage(null)}
                className="text-xs"
              >
                Close Preview
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default DentistScreeningReviewPage;
