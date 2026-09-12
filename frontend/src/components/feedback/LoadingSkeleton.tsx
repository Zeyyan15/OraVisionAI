/**
 * OraVisionAI — Accessible Loading Skeleton
 */

import React from 'react';
import { clsx } from 'clsx';

export type SkeletonVariant = 'text' | 'card' | 'table' | 'avatar';

export interface LoadingSkeletonProps {
  variant?: SkeletonVariant;
  count?: number;
  className?: string;
}

export const LoadingSkeleton: React.FC<LoadingSkeletonProps> = ({
  variant = 'text',
  count = 1,
  className,
}) => {
  const items = Array.from({ length: count });

  if (variant === 'card') {
    return (
      <div className="space-y-4 w-full" aria-busy="true">
        {items.map((_, i) => (
          <div key={i} className={clsx('rounded-xl border border-slate-200 bg-white p-6 shadow-sm animate-pulse space-y-4', className)}>
            <div className="h-5 w-1/3 bg-slate-200 rounded" />
            <div className="h-4 w-full bg-slate-100 rounded" />
            <div className="h-4 w-2/3 bg-slate-100 rounded" />
          </div>
        ))}
      </div>
    );
  }

  if (variant === 'avatar') {
    return (
      <div className="flex gap-2" aria-busy="true">
        {items.map((_, i) => (
          <div key={i} className={clsx('h-10 w-10 rounded-full bg-slate-200 animate-pulse', className)} />
        ))}
      </div>
    );
  }

  if (variant === 'table') {
    return (
      <div className="space-y-2 w-full" aria-busy="true">
        {items.map((_, i) => (
          <div key={i} className={clsx('h-10 w-full bg-slate-100 rounded animate-pulse', className)} />
        ))}
      </div>
    );
  }

  // Default: text lines
  return (
    <div className="space-y-2.5 w-full" aria-busy="true">
      {items.map((_, i) => (
        <div key={i} className={clsx('h-4 bg-slate-200 rounded animate-pulse w-full', className)} />
      ))}
    </div>
  );
};

export default LoadingSkeleton;
