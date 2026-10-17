export * from '../../../frontend/src/types/domain';
export * from '../../../frontend/src/types/api';
export type { ConsultationResponse, ConsultationListResponse, ConsultationType, ConsultationCreate, ConsultationStart, ConsultationEnd, ConsultationFail, StreamTokenResponse } from '../../../frontend/src/types/consultation';
export * from '../../../frontend/src/types/dentist';
export * from '../../../frontend/src/types/screening';
export * from '../../../frontend/src/types/communication';
export type ScreeningWorkflow = {
  status: 'running' | 'completed' | 'cancelled' | 'failed' | 'idle';
  completed_steps: number;
  description: string;
  warnings: string[];
};
