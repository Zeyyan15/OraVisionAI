/**
 * OraVisionAI - 7-Class Probability Distribution Chart Component (Phase 23)
 *
 * Renders EfficientNetB0 classification scores across all 7 oral lesion categories.
 * Preserves strict semantic discipline: labeled as Model Output / Class Score,
 * avoiding misleading probability or diagnostic claims.
 */

import React from 'react';
import { ProbabilityItem } from '../../types/screening';
import { LESION_CLASSES, LesionClassCode } from '../../types/domain';
import { Badge } from '../ui/Badge';
import { Info, Award } from 'lucide-react';

export interface ProbabilityDistributionChartProps {
  probabilities: ProbabilityItem[];
  predictedCode?: LesionClassCode | null;
  confidence?: number;
}

export const ProbabilityDistributionChart: React.FC<ProbabilityDistributionChartProps> = ({
  probabilities,
  predictedCode,
  confidence,
}) => {
  // Sort descending by model score
  const sortedItems = [...probabilities].sort((a, b) => b.probability - a.probability);

  return (
    <div className='rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4'>
      <div className='flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100'>
        <div>
          <h3 className='text-base font-semibold text-slate-900'>
            Differential Class Distribution
          </h3>
          <p className='text-xs text-slate-500'>
            Relative model activation scores across the 7-class oral lesion taxonomy.
          </p>
        </div>
        {confidence !== undefined && (
          <div className='flex items-center gap-2'>
            <span className='text-xs text-slate-500 font-medium'>Model Confidence:</span>
            <Badge variant='info' className='font-mono'>
              {(confidence * 100).toFixed(1)}% Score
            </Badge>
          </div>
        )}
      </div>

      <div
        className='space-y-3'
        role='region'
        aria-label='7-Class Model Activation Distribution'
      >
        <ol className='space-y-2.5 list-none p-0 m-0'>
          {sortedItems.map((item, index) => {
            const isTopMatch = predictedCode
              ? item.class_code === predictedCode
              : index === 0;
            const fullClassName =
              LESION_CLASSES[item.class_code as LesionClassCode] || item.class_name;
            const scorePercent = Math.min(Math.max(item.probability * 100, 1), 100);

            return (
              <li
                key={item.class_code || item.class_name || index}
                className={'group rounded-lg p-2.5 transition-colors ' +
                  (isTopMatch
                    ? 'bg-clinical-50/60 border border-clinical-200/80'
                    : 'hover:bg-slate-50 border border-transparent')
                }
              >
                <div className='flex items-center justify-between text-xs mb-1.5'>
                  <div className='flex items-center gap-2'>
                    <span
                      className={'inline-flex items-center justify-center w-5 h-5 rounded-full text-[11px] font-bold ' +
                        (isTopMatch
                          ? 'bg-clinical-600 text-white'
                          : 'bg-slate-200 text-slate-600')
                      }
                      aria-label={'Rank #' + (index + 1)}
                    >
                      {index + 1}
                    </span>
                    <Badge
                      variant={isTopMatch ? 'info' : 'neutral'}
                      className='font-mono text-[11px] px-1.5 py-0.5'
                    >
                      {item.class_code}
                    </Badge>
                    <span className={'font-medium ' + (isTopMatch ? 'text-slate-900 font-semibold' : 'text-slate-700')}>
                      {fullClassName}
                    </span>
                    {isTopMatch && (
                      <span className='inline-flex items-center gap-1 text-[11px] text-clinical-700 font-semibold'>
                        <Award className='h-3.5 w-3.5' />
                        Top Finding
                      </span>
                    )}
                  </div>
                  <div className='flex items-center gap-2 font-mono'>
                    <span className='text-slate-500 text-[11px]'>
                      ({(item.probability).toFixed(3)})
                    </span>
                    <span className={'font-bold text-xs ' + (isTopMatch ? 'text-clinical-700' : 'text-slate-700')}>
                      {scorePercent.toFixed(1)}%
                    </span>
                  </div>
                </div>

                <div className='w-full bg-slate-100 rounded-full h-2 overflow-hidden'>
                  <div
                    className={'h-full rounded-full transition-all duration-500 ' +
                      (isTopMatch ? 'bg-clinical-600' : 'bg-slate-300 group-hover:bg-slate-400')
                    }
                    style={{ width: scorePercent + '%' }}
                    role='progressbar'
                    aria-valuenow={Math.round(scorePercent)}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label={fullClassName + ' activation: ' + scorePercent.toFixed(1) + '%'}
                  />
                </div>
              </li>
            );
          })}
        </ol>
      </div>

      <div className='flex items-start gap-2 pt-3 border-t border-slate-100 text-[11px] text-slate-500'>
        <Info className='h-4 w-4 text-slate-400 shrink-0 mt-0.5' />
        <p>
          <span className='font-semibold text-slate-600'>Epistemic Guidance:</span> Model scores reflect normalized
          softmax activation outputs across the seven trained oral cavity lesion categories. They do not represent
          calibrated clinical disease probabilities or a confirmed medical diagnosis.
        </p>
      </div>
    </div>
  );
};

export default ProbabilityDistributionChart;
