/**
 * OraVisionAI — AI Inference Telemetry & Model Oversight (Phase 26)
 *
 * Implements operational telemetry tracking total inference predictions,
 * average prediction confidence (strictly NOT labeled accuracy), the authoritative
 * 7-class oral lesion distribution, YOLO detection counts, and active models.
 */

import React from 'react';
import { AITelemetryAnalyticsResponse } from '../../types/admin';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { LoadingSkeleton } from '../feedback/LoadingSkeleton';
import {
  Cpu,
  Sparkles,
  AlertOctagon,
  RefreshCw,
  Box,
  Binary,
} from 'lucide-react';

export interface AITelemetrySectionProps {
  data: AITelemetryAnalyticsResponse | null;
  loading: boolean;
  onRefresh: () => void;
}

export const AITelemetrySection: React.FC<AITelemetrySectionProps> = ({
  data,
  loading,
  onRefresh,
}) => {
  return (
    <div className="space-y-6">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-white rounded-xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-base font-semibold text-slate-900">AI Inference Telemetry</h2>
          <p className="text-xs text-slate-500">
            Operational throughput, classification distributions, and vision pipeline telemetry.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={onRefresh}
          disabled={loading}
          leftIcon={RefreshCw}
          className="text-xs"
        >
          Refresh Telemetry
        </Button>
      </div>

      {loading ? (
        <LoadingSkeleton variant="card" count={3} />
      ) : data ? (
        <div className="space-y-6">
          {/* Epistemic Guardrail: Confidence is NOT Accuracy */}
          <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs shadow-sm">
            <AlertOctagon className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h4 className="font-semibold text-amber-900">Critical Epistemic Distinction</h4>
              <p>
                <strong>Average Prediction Confidence</strong> measures the normalized softmax activation output across
                model inferences. It <strong>MUST NOT</strong> be interpreted as diagnostic accuracy, correctness, or
                clinical efficacy. AI prediction frequency reflects operational screening volume, not population disease
                prevalence.
              </p>
            </div>
          </div>

          {/* Primary Metric KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs text-slate-500 font-medium">Total AI Inferences</p>
                  <p className="text-2xl font-bold text-slate-900 mt-0.5">{data.total_predictions}</p>
                </div>
                <div className="p-2.5 rounded-lg bg-indigo-50 text-indigo-600">
                  <Cpu className="h-5 w-5" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs text-slate-500 font-medium">Average Confidence</p>
                  <div className="flex items-baseline gap-1 mt-0.5">
                    <span className="text-2xl font-bold text-slate-900 font-mono">
                      {(data.average_prediction_confidence * 100).toFixed(1)}%
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">Score</span>
                  </div>
                </div>
                <div className="p-2.5 rounded-lg bg-sky-50 text-sky-600">
                  <Binary className="h-5 w-5" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs text-slate-500 font-medium">Total YOLO Detections</p>
                  <div className="flex items-baseline gap-1 mt-0.5">
                    <span className="text-2xl font-bold text-slate-900">{data.total_yolo_detections}</span>
                    <span className="text-[10px] text-slate-400 font-medium">
                      ({data.average_detections_per_image.toFixed(2)}/img)
                    </span>
                  </div>
                </div>
                <div className="p-2.5 rounded-lg bg-teal-50 text-teal-600">
                  <Box className="h-5 w-5" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs text-slate-500 font-medium">XAI Saliency Maps</p>
                  <p className="text-2xl font-bold text-slate-900 mt-0.5">{data.total_xai_generations}</p>
                </div>
                <div className="p-2.5 rounded-lg bg-purple-50 text-purple-600">
                  <Sparkles className="h-5 w-5" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* 7-Class AI Classification Distribution Card */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">7-Class Oral Lesion Taxonomy Distribution</CardTitle>
                  <CardDescription className="text-xs">
                    Frequency breakdown of model top predicted classes across historical screenings
                  </CardDescription>
                </div>
                <Badge variant="info" className="text-xs font-mono">
                  {data.classification_distribution.length} Classes
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3" role="region" aria-label="7-Class Oral Lesion Taxonomy Distribution">
                {data.classification_distribution.map((item) => {
                  return (
                    <div key={item.class_code} className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-100 text-slate-800 border border-slate-200">
                            {item.class_code}
                          </span>
                          <span className="font-semibold text-slate-800">{item.class_name}</span>
                        </div>
                        <div className="flex items-center gap-2 font-mono text-xs">
                          <span className="text-slate-600 font-bold">{item.count}</span>
                          <span className="text-slate-400">({item.percentage.toFixed(1)}%)</span>
                        </div>
                      </div>

                      {/* Distribution bar */}
                      <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-indigo-600 transition-all duration-500"
                          style={{ width: `${Math.min(Math.max(item.percentage, 0), 100)}%` }}
                          role="progressbar"
                          aria-valuenow={Math.round(item.percentage)}
                          aria-valuemin={0}
                          aria-valuemax={100}
                          aria-label={`${item.class_name} percentage: ${item.percentage.toFixed(1)}%`}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Active Model Summaries */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Active Inference Models</CardTitle>
              <CardDescription className="text-xs">
                Production models currently loaded in the inference service pipeline
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {data.active_models.map((m) => (
                  <div key={`${m.name}-${m.version}`} className="rounded-lg p-4 border border-slate-200 bg-slate-50 space-y-2">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-semibold text-slate-900">{m.name}</h4>
                      <Badge variant="success" className="text-[10px]">Active</Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                      <div>
                        <span className="text-slate-500">Version:</span>{' '}
                        <span className="font-mono font-medium text-slate-800">{m.version}</span>
                      </div>
                      <div>
                        <span className="text-slate-500">Type:</span>{' '}
                        <span className="capitalize font-medium text-slate-800">{m.model_type}</span>
                      </div>
                      <div>
                        <span className="text-slate-500">Architecture:</span>{' '}
                        <span className="font-mono font-medium text-slate-800">{m.architecture}</span>
                      </div>
                      <div>
                        <span className="text-slate-500">Input Tensor:</span>{' '}
                        <span className="font-mono font-medium text-slate-800">{m.input_shape}</span>
                      </div>
                    </div>
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

export default AITelemetrySection;
