/**
 * OraVisionAI — Consultation Clinical Decision Support Panel (Phase 25)
 *
 * Embeds side-by-side diagnostic telemetry during teleconsultations:
 * - Oral screening photographs (signed URLs from existing review endpoint)
 * - YOLO spatial lesion bounding box localization
 * - 7-class AI probability distribution
 * - Clinical risk tier and ordinal rank
 * - In-consultation clinical summary documentation editor
 */

import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { getScreeningReview } from '../../api/dentistEndpoints';
import { getArtifactSignedUrl } from '../../api/screeningEndpoints';
import { ScreeningReviewResponse, ScreeningImageResponse } from '../../types/screening';
import { RISK_LEVEL_CONFIG, RiskLevel } from '../../types/domain';
import { ProbabilityDistributionChart } from '../screening/ProbabilityDistributionChart';
import { YoloOverlayViewer } from '../screening/YoloOverlayViewer';
import { LoadingSkeleton } from '../feedback/LoadingSkeleton';
import { ErrorState } from '../feedback/ErrorState';
import {
  FileText,
  Activity,
  User,
  Info,
  Layers,
  Image as ImageIcon,
} from 'lucide-react';

export const RiskBadge: React.FC<{ riskLevel: string }> = ({ riskLevel }) => {
  const config = RISK_LEVEL_CONFIG[riskLevel as RiskLevel] || {
    label: riskLevel.toUpperCase(),
    variant: 'neutral' as const,
  };
  return <Badge variant={config.variant}>{config.label}</Badge>;
};

interface ConsultationClinicalPanelProps {
  screeningId?: string | null;
  clinicalSummary: string;
  onClinicalSummaryChange: (val: string) => void;
  isReadOnly?: boolean;
}

export const ConsultationClinicalPanel: React.FC<ConsultationClinicalPanelProps> = ({
  screeningId,
  clinicalSummary,
  onClinicalSummaryChange,
  isReadOnly = false,
}) => {
  const [activeTab, setActiveTab] = useState<'notes' | 'ai' | 'patient'>('notes');
  const [review, setReview] = useState<ScreeningReviewResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedImageIndex, setSelectedImageIndex] = useState<number>(0);

  useEffect(() => {
    if (!screeningId) return;

    const fetchReview = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await getScreeningReview(screeningId);
        setReview(data);
      } catch (err: unknown) {
        const e = err as Error;
        setError(e.message || 'Unable to load clinical review data.');
      } finally {
        setLoading(false);
      }
    };

    fetchReview();
  }, [screeningId]);

  const selectedImage = review?.images && review.images.length > 0
    ? review.images[selectedImageIndex] || review.images[0]
    : null;

  const [imageUrl, setImageUrl] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    if (screeningId && selectedImage?.storage_path) {
      getArtifactSignedUrl(screeningId, selectedImage.storage_path)
        .then((res) => {
          if (isMounted) setImageUrl(res.signed_url);
        })
        .catch((err) => {
          console.warn('Could not retrieve image URL for consultation panel:', err);
          if (isMounted) setImageUrl(null);
        });
    } else {
      setImageUrl(null);
    }
    return () => {
      isMounted = false;
    };
  }, [screeningId, selectedImage?.storage_path]);

  return (
    <Card className="h-full flex flex-col border-slate-200 shadow-sm">
      {/* Panel Tab Navigation */}
      <CardHeader className="pb-2 border-b border-slate-100">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold text-slate-800 flex items-center space-x-2">
            <Activity className="h-4 w-4 text-sky-600" />
            <span>Clinical Evaluation Panel</span>
          </CardTitle>
          {review?.risk_assessment && (
            <RiskBadge riskLevel={review.risk_assessment.risk_level} />
          )}
        </div>

        <div className="flex space-x-1 mt-2 bg-slate-100 p-1 rounded-lg text-xs">
          <button
            type="button"
            onClick={() => setActiveTab('notes')}
            className={`flex-1 py-1.5 px-2 rounded-md font-medium transition-colors flex items-center justify-center space-x-1 ${
              activeTab === 'notes' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <FileText className="h-3.5 w-3.5" />
            <span>Clinical Summary</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('ai')}
            className={`flex-1 py-1.5 px-2 rounded-md font-medium transition-colors flex items-center justify-center space-x-1 ${
              activeTab === 'ai' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Layers className="h-3.5 w-3.5" />
            <span>AI & Findings</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('patient')}
            className={`flex-1 py-1.5 px-2 rounded-md font-medium transition-colors flex items-center justify-center space-x-1 ${
              activeTab === 'patient' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <User className="h-3.5 w-3.5" />
            <span>Patient Context</span>
          </button>
        </div>
      </CardHeader>

      {/* Tab Content */}
      <CardContent className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Tab 1: Clinical Notes Editor */}
        {activeTab === 'notes' && (
          <div className="space-y-3 h-full flex flex-col">
            <div className="flex items-center justify-between">
              <label htmlFor="clinical_summary" className="text-xs font-semibold text-slate-700 flex items-center space-x-1">
                <FileText className="h-3.5 w-3.5 text-slate-500" />
                <span>In-Consultation Clinical Summary</span>
              </label>
              <span className="text-[11px] text-slate-400">
                {clinicalSummary.length} characters
              </span>
            </div>

            <textarea
              id="clinical_summary"
              value={clinicalSummary}
              onChange={(e) => onClinicalSummaryChange(e.target.value)}
              disabled={isReadOnly}
              placeholder="Document clinical observations, discussion with patient, oral lesion findings, and recommended next steps..."
              rows={12}
              className="w-full flex-1 p-3 text-xs text-slate-800 bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500 disabled:bg-slate-50 disabled:text-slate-500 font-sans resize-none leading-relaxed"
            />

            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-900 text-[11px] flex items-start space-x-2">
              <Info className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
              <span>
                Concluding the consultation automatically saves this summary into the appointment record. Assessments can later be drafted or finalized through the screening review page.
              </span>
            </div>
          </div>
        )}

        {/* Tab 2: AI Telemetry & Screening Photos */}
        {activeTab === 'ai' && (
          <div className="space-y-4">
            {!screeningId ? (
              <div className="text-center py-8 text-slate-400 text-xs">
                No oral screening attached to this appointment.
              </div>
            ) : loading ? (
              <LoadingSkeleton count={3} />
            ) : error ? (
              <ErrorState title="Review Unavailable" message={error} />
            ) : review ? (
              <>
                {/* Images & YOLO Visualizer */}
                {review.images && review.images.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-slate-700 flex items-center space-x-1">
                      <ImageIcon className="h-3.5 w-3.5 text-slate-500" />
                      <span>Oral Screening Photographs ({review.images.length})</span>
                    </p>

                    {/* Active Image with YOLO Boxes */}
                    <div className="rounded-xl overflow-hidden border border-slate-200 bg-slate-950">
                      <YoloOverlayViewer
                        imageSrc={imageUrl || undefined}
                        detections={review.yolo_detections || []}
                        fileName={selectedImage?.file_name}
                        imageWidth={selectedImage?.image_width}
                        imageHeight={selectedImage?.image_height}
                      />
                    </div>

                    {/* Image thumbnails */}
                    {review.images.length > 1 && (
                      <div className="flex space-x-2 overflow-x-auto pb-1">
                        {review.images.map((img: ScreeningImageResponse, idx: number) => (
                          <button
                            key={img.id}
                            type="button"
                            onClick={() => setSelectedImageIndex(idx)}
                            className={`px-2.5 py-1.5 rounded-lg border text-xs font-medium shrink-0 transition-colors ${
                              idx === selectedImageIndex ? 'border-sky-500 bg-sky-50 text-sky-800' : 'border-slate-200 bg-white text-slate-600'
                            }`}
                          >
                            {img.file_name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* 7-Class Probability Distribution */}
                {review.primary_prediction?.probabilities && (
                  <div className="space-y-1.5 pt-2 border-t border-slate-100">
                    <p className="text-xs font-semibold text-slate-700">
                      7-Class AI Classification Scores
                    </p>
                    <ProbabilityDistributionChart probabilities={review.primary_prediction.probabilities} />
                  </div>
                )}

                {/* Risk Assessment */}
                {review.risk_assessment && (
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5 text-xs">
                    <div className="flex justify-between items-center">
                      <span className="font-medium text-slate-700">Clinical Urgency Tier</span>
                      <RiskBadge riskLevel={review.risk_assessment.risk_level} />
                    </div>
                    <p className="text-[11px] text-slate-500">
                      Ordinal Tier Score: {review.risk_assessment.risk_score.toFixed(1)} / 100.0 (Categorical Rank)
                    </p>
                  </div>
                )}
              </>
            ) : null}
          </div>
        )}

        {/* Tab 3: Patient Context & Medical Profile */}
        {activeTab === 'patient' && (
          <div className="space-y-3">
            {!review ? (
              <div className="text-center py-8 text-slate-400 text-xs">
                No attached clinical context.
              </div>
            ) : (
              <div className="space-y-3 text-xs">
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                  <p className="font-semibold text-slate-700">Patient Information</p>
                  <div className="grid grid-cols-2 gap-2 text-slate-600">
                    <div>
                      <span className="text-slate-400 block text-[11px]">Age</span>
                      <span>{review.patient_age ? `${review.patient_age} years` : 'Not specified'}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[11px]">Gender</span>
                      <span className="capitalize">{review.patient_gender || 'Not specified'}</span>
                    </div>
                  </div>
                </div>

                {review.patient_notes && (
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                    <p className="font-semibold text-slate-700">Patient Reported Symptoms / Notes</p>
                    <p className="text-slate-600 leading-relaxed">{review.patient_notes}</p>
                  </div>
                )}

                {review.risk_assessment?.contributing_factors && (
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5">
                    <p className="font-semibold text-slate-700">Reported Contributing Factors</p>
                    <div className="flex flex-wrap gap-1.5">
                      {review.risk_assessment.contributing_factors.map((f, i) => (
                        <Badge key={i} variant="neutral" className="text-[10px]">
                          {f.category}: {f.observation}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
