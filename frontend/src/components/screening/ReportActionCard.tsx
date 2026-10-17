/**
 * OraVisionAI - Clinical Report Action Card Component (Phase 23)
 *
 * Handles clinical report compilation and authenticated PDF streaming download.
 * Terminology: 'Clinical Report (PDF)' (no unverified claims).
 */

import React from 'react';
import { ReportResponse } from '../../types/screening';
import { FileDown, FileText, CheckCircle2, Loader2, Calendar } from 'lucide-react';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';

export interface ReportActionCardProps {
  report?: ReportResponse | null;
  isGenerating?: boolean;
  isDownloading?: boolean;
  onGenerateReport: () => Promise<void>;
  onDownloadReport: (reportId: string, filename: string) => Promise<void>;
  isScreeningCompleted: boolean;
}

export const ReportActionCard: React.FC<ReportActionCardProps> = ({
  report,
  isGenerating = false,
  isDownloading = false,
  onGenerateReport,
  onDownloadReport,
  isScreeningCompleted,
}) => {
  return (
    <div className='rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4'>
      <div className='flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100'>
        <div className='flex items-center gap-2'>
          <FileText className='h-5 w-5 text-clinical-600' />
          <div>
            <h3 className='text-base font-semibold text-slate-900'>
              Clinical Report (PDF)
            </h3>
            <p className='text-xs text-slate-500'>
              Save a printable copy of your findings and reviews.
            </p>
          </div>
        </div>
        <Badge variant={report ? 'success' : 'neutral'}>
          {report ? 'Ready to download' : 'Not generated'}
        </Badge>
      </div>

      {report ? (
        <div className='rounded-lg border border-slate-200 bg-slate-50/60 p-4 space-y-3'>
          <div className='flex flex-col sm:flex-row sm:items-center justify-between gap-2'>
            <div>
              <div className='flex items-center gap-2'>
                <CheckCircle2 className='h-4 w-4 text-emerald-600 shrink-0' />
                <span className='text-sm font-bold text-slate-900'>
                  {report.report_number}
                </span>
              </div>
              <p className='text-xs text-slate-600 mt-1 font-medium'>
                {report.report_title || 'Oral Health AI Screening Report'}
              </p>
              <div className='flex items-center gap-1.5 text-[11px] text-slate-400 mt-1'>
                <Calendar className='h-3.5 w-3.5' />
                <span>Compiled: {new Date(report.created_at).toLocaleString()}</span>
              </div>
            </div>

            <Button
              type='button'
              variant='primary'
              size='sm'
              onClick={() => onDownloadReport(report.id, report.report_number)}
              disabled={isDownloading}
              className='shrink-0'
            >
              {isDownloading ? (
                <>
                  <Loader2 className='h-3.5 w-3.5 animate-spin mr-1.5' />
                  Downloading...
                </>
              ) : (
                <>
                  <FileDown className='h-3.5 w-3.5 mr-1.5' />
                  Download PDF
                </>
              )}
            </Button>
          </div>

          <p className='text-[11px] text-slate-500 leading-relaxed border-t border-slate-200/60 pt-2'>
            Includes screening findings, visual evidence, urgency assessment and any available dentist reviews.
          </p>
        </div>
      ) : (
        <div className='rounded-xl bg-slate-50 p-6 text-center space-y-4'>
          <span className='results-icon mx-auto'><FileDown className='h-5 w-5' /></span>
          <h4 className='text-base font-semibold text-slate-800'>Keep your findings in one place</h4>
          <p className='text-xs text-slate-500 max-w-sm mx-auto'>
            {isScreeningCompleted
              ? 'Generate a PDF to save for your records or share with your dentist.'
              : 'Clinical report compilation becomes available once AI inference has successfully completed.'}
          </p>

          <Button
            type='button'
            variant='primary'
            size='sm'
            onClick={onGenerateReport}
            disabled={!isScreeningCompleted || isGenerating}
          >
            {isGenerating ? (
              <>
                <Loader2 className='h-3.5 w-3.5 animate-spin mr-1.5' />
                Compiling Report...
              </>
            ) : (
              <>
                <FileText className='h-3.5 w-3.5 mr-1.5' />
                Generate PDF report
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );
};

export default ReportActionCard;
