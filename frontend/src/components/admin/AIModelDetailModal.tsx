/**
 * OraVisionAI — AI Model Detail Inspector Modal (Phase 26)
 *
 * Displays safe architectural parameters of a registered AIModel entity.
 * Invariant: Never exposes model weight paths or host filesystem paths.
 */

import React, { useState, useEffect } from 'react';
import { AIModelResponse } from '../../types/admin';
import { getAIModelDetail } from '../../api/adminEndpoints';
import { Modal } from '../ui/Modal';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { LoadingSkeleton } from '../feedback/LoadingSkeleton';
import {
  Layers,
  Cpu,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Box,
  Binary,
} from 'lucide-react';

export interface AIModelDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  modelId: string | null;
  initialModel?: AIModelResponse | null;
}

export const AIModelDetailModal: React.FC<AIModelDetailModalProps> = ({
  isOpen,
  onClose,
  modelId,
  initialModel,
}) => {
  const [model, setModel] = useState<AIModelResponse | null>(initialModel || null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !modelId) return;

    if (initialModel && initialModel.id === modelId) {
      setModel(initialModel);
      return;
    }

    let isMounted = true;
    const fetchDetail = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await getAIModelDetail(modelId);
        if (isMounted) setModel(res);
      } catch (err: unknown) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'Failed to retrieve AI model details');
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchDetail();
    return () => {
      isMounted = false;
    };
  }, [isOpen, modelId, initialModel]);

  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="AI Model Architecture Metadata" maxWidth="lg">
      <div className="space-y-4">
        {loading ? (
          <div className="p-4">
            <LoadingSkeleton variant="card" count={2} />
          </div>
        ) : error ? (
          <div className="p-4 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        ) : model ? (
          <div className="space-y-4 text-xs">
            {/* Header info bar */}
            <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-slate-50 rounded-lg border border-slate-200">
              <div>
                <h3 className="text-sm font-bold text-slate-900">{model.name}</h3>
                <p className="text-[11px] text-slate-500">Version: {model.version}</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="neutral" className="capitalize text-[10px]">
                  {model.model_type}
                </Badge>
                {model.is_active ? (
                  <Badge variant="success" className="text-[10px] flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3" /> Active
                  </Badge>
                ) : (
                  <Badge variant="neutral" className="text-[10px] flex items-center gap-1">
                    <XCircle className="h-3 w-3" /> Inactive
                  </Badge>
                )}
              </div>
            </div>

            {/* Architecture Details Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="p-3 rounded-lg border border-slate-100 bg-white space-y-1">
                <span className="text-[11px] font-semibold text-slate-500 uppercase flex items-center gap-1">
                  <Cpu className="h-3 w-3" /> Architecture
                </span>
                <p className="font-mono text-slate-900 font-medium">{model.architecture}</p>
              </div>

              <div className="p-3 rounded-lg border border-slate-100 bg-white space-y-1">
                <span className="text-[11px] font-semibold text-slate-500 uppercase flex items-center gap-1">
                  <Box className="h-3 w-3" /> Input Tensor Dimensions
                </span>
                <p className="font-mono text-slate-900 font-medium">{model.input_shape}</p>
              </div>
            </div>

            {/* Class Labels List */}
            <div className="rounded-lg border border-slate-200 p-3 bg-white space-y-2">
              <span className="text-[11px] font-semibold text-slate-700 uppercase flex items-center gap-1">
                <Binary className="h-3 w-3" /> Registered Class Labels ({model.class_labels.length})
              </span>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {model.class_labels.map((lbl, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono bg-slate-100 text-slate-800 border border-slate-200"
                  >
                    {typeof lbl === 'string' ? lbl : JSON.stringify(lbl)}
                  </span>
                ))}
              </div>
            </div>

            {/* Target Layers for XAI */}
            {model.target_layers && model.target_layers.length > 0 && (
              <div className="rounded-lg border border-slate-200 p-3 bg-white space-y-2">
                <span className="text-[11px] font-semibold text-slate-700 uppercase flex items-center gap-1">
                  <Layers className="h-3 w-3" /> XAI Convolutional Target Layers ({model.target_layers.length})
                </span>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {model.target_layers.map((lyr, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono bg-purple-50 text-purple-800 border border-purple-200"
                    >
                      {typeof lyr === 'string' ? lyr : JSON.stringify(lyr)}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Security Invariant Callout */}
            <div className="flex items-start gap-2 p-2.5 rounded-lg bg-emerald-50/60 border border-emerald-200 text-[11px] text-emerald-900">
              <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
              <p>
                <strong>Security Invariant Confirmed:</strong> Internal server storage directories, weights filesystem
                paths and server weight artifacts, and host
                infrastructure credentials are explicitly withheld from this API response model.
              </p>
            </div>
          </div>
        ) : null}

        <div className="flex justify-end pt-2 border-t border-slate-100">
          <Button variant="outline" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default AIModelDetailModal;
