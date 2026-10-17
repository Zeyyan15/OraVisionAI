import React from 'react';
import { BarChart3, Info } from 'lucide-react';
import { ProbabilityItem } from '../../types/screening';
import { LESION_CLASSES, LesionClassCode } from '../../types/domain';

export interface ProbabilityDistributionChartProps {
  probabilities: ProbabilityItem[];
  predictedCode?: LesionClassCode | null;
  confidence?: number;
}

export const ProbabilityDistributionChart: React.FC<ProbabilityDistributionChartProps> = ({ probabilities }) => {
  const items = [...probabilities].sort((a, b) => b.probability - a.probability);
  return (
    <section className='results-panel h-full flex flex-col' aria-label='Model class scores'>
      <div className='results-panel-heading'>
        <span className='results-icon'><BarChart3 className='h-5 w-5' /></span>
        <div><h3>Model class scores</h3><p>How the seven trained categories compare.</p></div>
        <span className='results-chip ml-auto shrink-0'>7 categories</span>
      </div>
      <ol className='flex-1 space-y-1 py-4' aria-label='7-Class Model Activation Distribution'>
        {items.map((item, index) => {
          const score = Math.min(100, Math.max(0, item.probability * 100));
          const name = LESION_CLASSES[item.class_code as LesionClassCode] || item.class_name;
          const formatted = score > 0 && score < 0.1 ? '<0.1%' : `${score.toFixed(1)}%`;
          return <li key={item.class_code || item.class_name} className={`rounded-xl px-3 py-3 ${index === 0 ? 'border border-emerald-100 bg-emerald-50/70' : ''}`}>
            <div className='mb-2 flex items-center gap-3 text-sm'>
              <span className={`w-5 text-xs tabular-nums ${index === 0 ? 'font-bold text-emerald-700' : 'text-slate-400'}`}>{String(index + 1).padStart(2, '0')}</span>
              <span className={`min-w-0 flex-1 ${index === 0 ? 'font-semibold text-emerald-950' : 'text-slate-700'}`}>{name}</span>
              <span className='shrink-0 font-semibold tabular-nums text-slate-900'>{formatted}</span>
            </div>
            <div className='ml-8 h-1.5 overflow-hidden rounded-full bg-slate-100' role='meter' aria-label={`${name} model score`} aria-valuenow={score} aria-valuemin={0} aria-valuemax={100} aria-valuetext={formatted}>
              <div className={`h-full rounded-full ${index === 0 ? 'bg-[#087f70]' : 'bg-slate-300'}`} style={{width:`${score}%`}} />
            </div>
          </li>;
        })}
      </ol>
      <div className='results-footnote'><Info className='h-4 w-4 shrink-0' /><p>Scores describe model output, not the likelihood of a disease or a confirmed diagnosis.</p></div>
    </section>
  );
};
export default ProbabilityDistributionChart;
