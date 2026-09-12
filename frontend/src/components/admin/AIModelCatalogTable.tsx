/**
 * OraVisionAI — AI Model Registry Catalog Table (Phase 26)
 *
 * Renders the read-only catalog of registered versioned AIModel entities.
 * Strictly excludes server weights_path or private infrastructure details.
 */

import React from 'react';
import { AIModelResponse, AIModelListResponse } from '../../types/admin';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { LoadingSkeleton } from '../feedback/LoadingSkeleton';
import { EmptyState } from '../feedback/EmptyState';
import {
  RefreshCw,
  Eye,
  ShieldCheck,
  CheckCircle2,
  XCircle,
} from 'lucide-react';

export interface AIModelCatalogTableProps {
  data: AIModelListResponse | null;
  loading: boolean;
  onSelectModel: (model: AIModelResponse) => void;
  onRefresh: () => void;
}

export const AIModelCatalogTable: React.FC<AIModelCatalogTableProps> = ({
  data,
  loading,
  onSelectModel,
  onRefresh,
}) => {
  return (
    <div className="space-y-6">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-white rounded-xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-base font-semibold text-slate-900">AI Model Version Registry</h2>
          <p className="text-xs text-slate-500">
            Immutable registry catalog of registered deep learning model artifacts for clinical reproducibility.
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
          Refresh Catalog
        </Button>
      </div>

      {/* Model Governance Banner */}
      <div className="flex items-start gap-2.5 p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-600">
        <ShieldCheck className="h-4 w-4 text-indigo-600 shrink-0 mt-0.5" />
        <p>
          <strong>Read-Only Administrative Catalog:</strong> Model training, weight artifacts, and activation
          lifecycle changes are governed by offline MLOps protocols. No model upload or activation mutation endpoints
          exist on the client interface.
        </p>
      </div>

      {/* Models Table */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-6">
            <LoadingSkeleton variant="table" count={3} />
          </div>
        ) : !data || data.items.length === 0 ? (
          <div className="p-8">
            <EmptyState
              title="No AI Models Registered"
              description="No registered neural network model entities were found in the database registry."
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse" aria-label="AI Model Registry Table">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
                  <th scope="col" className="py-3 px-4">Model Name</th>
                  <th scope="col" className="py-3 px-4">Type</th>
                  <th scope="col" className="py-3 px-4">Version</th>
                  <th scope="col" className="py-3 px-4">Architecture</th>
                  <th scope="col" className="py-3 px-4">Input Tensor</th>
                  <th scope="col" className="py-3 px-4">Status</th>
                  <th scope="col" className="py-3 px-4">Registered Date</th>
                  <th scope="col" className="py-3 px-4 text-right">Architecture</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {data.items.map((model) => (
                  <tr
                    key={model.id}
                    className="hover:bg-slate-50/80 transition-colors group cursor-pointer"
                    onClick={() => onSelectModel(model)}
                  >
                    <td className="py-3 px-4 font-semibold text-slate-900 whitespace-nowrap">
                      {model.name}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <Badge variant="neutral" className="capitalize text-[10px]">
                        {model.model_type}
                      </Badge>
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-800 whitespace-nowrap font-medium">
                      {model.version}
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-700 whitespace-nowrap">
                      {model.architecture}
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-600 whitespace-nowrap">
                      {model.input_shape}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      {model.is_active ? (
                        <Badge variant="success" className="text-[10px] flex items-center gap-1 w-fit">
                          <CheckCircle2 className="h-3 w-3" /> Active
                        </Badge>
                      ) : (
                        <Badge variant="neutral" className="text-[10px] flex items-center gap-1 w-fit">
                          <XCircle className="h-3 w-3" /> Inactive
                        </Badge>
                      )}
                    </td>
                    <td className="py-3 px-4 text-slate-500 whitespace-nowrap">
                      {new Date(model.created_at).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap text-right">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-xs text-indigo-600 hover:text-indigo-900 hover:bg-indigo-50 p-1"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectModel(model);
                        }}
                        leftIcon={Eye}
                      >
                        Inspect
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default AIModelCatalogTable;
