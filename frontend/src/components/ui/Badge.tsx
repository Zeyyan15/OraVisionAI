/**
 * OraVisionAI — Clinical Status & Risk Tier Badge
 *
 * NOTE: When displaying risk tiers (Low, Moderate, High, Critical), values represent
 * ordinal ranking tiers (25, 50, 75, 100), NOT disease probabilities or percentages.
 */

import React from 'react';
import { clsx } from 'clsx';

export type BadgeVariant = 'neutral' | 'info' | 'success' | 'warning' | 'danger';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  children: React.ReactNode;
}

const variantClasses: Record<BadgeVariant, string> = {
  neutral: 'bg-slate-100 text-slate-800 border-slate-200',
  info: 'bg-clinical-50 text-clinical-700 border-clinical-200',
  success: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  warning: 'bg-amber-50 text-amber-700 border-amber-200',
  danger: 'bg-rose-50 text-rose-700 border-rose-200',
};

export const Badge: React.FC<BadgeProps> = ({
  variant = 'neutral',
  children,
  className,
  ...props
}) => {
  return (
    <span
      className={clsx(
        'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold tracking-wide transition-colors',
        variantClasses[variant],
        className,
      )}
      {...props}
    >
      {children}
    </span>
  );
};

export default Badge;
