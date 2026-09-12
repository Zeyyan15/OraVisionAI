/**
 * OraVisionAI — AI Model Version Registry Page (Phase 26)
 *
 * Implements read-only catalog inspection of versioned AIModel entities
 * and safe architectural parameters inspection with zero server filesystem exposure.
 */

import React, { useState } from 'react';
import { useAIModels } from '../../hooks/useAdminAnalytics';
import { AIModelCatalogTable } from '../../components/admin/AIModelCatalogTable';
import { AIModelDetailModal } from '../../components/admin/AIModelDetailModal';
import { AIModelResponse } from '../../types/admin';
import { ErrorState } from '../../components/feedback/ErrorState';
import { Badge } from '../../components/ui/Badge';

export const AdminAIModelsPage: React.FC = () => {
  const { data, loading, error, refetch } = useAIModels();
  const [selectedModel, setSelectedModel] = useState<AIModelResponse | null>(null);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);

  const handleSelectModel = (model: AIModelResponse) => {
    setSelectedModel(model);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedModel(null);
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              AI Model Version Registry
            </h1>
            <Badge variant="neutral" className="text-xs uppercase font-mono">
              Model Governance
            </Badge>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Registered versioned neural network model artifacts, input dimensions, and explainability target layers.
          </p>
        </div>
      </div>

      {error ? (
        <ErrorState
          title="Failed to Load AI Model Registry"
          message={error}
          onRetry={refetch}
        />
      ) : (
        <AIModelCatalogTable
          data={data}
          loading={loading}
          onSelectModel={handleSelectModel}
          onRefresh={refetch}
        />
      )}

      {/* Architecture Detail Modal */}
      <AIModelDetailModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        modelId={selectedModel ? selectedModel.id : null}
        initialModel={selectedModel}
      />
    </div>
  );
};

export default AdminAIModelsPage;
