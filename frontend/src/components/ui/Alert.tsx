/**
 * OraVisionAI — Accessible Alert Component
 */

import React from 'react';
import { AlertCircle, CheckCircle2, AlertTriangle, Info, X } from 'lucide-react';
import { clsx } from 'clsx';

export type AlertVariant = 'info' | 'success' | 'warning' | 'danger';

export interface AlertProps {
  variant?: AlertVariant;
  title?: string;
  children: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
  onClose?: () => void;
  className?: string;
}

const variantStyles: Record<AlertVariant, { container: string; title: string; icon: React.ComponentType<{ className?: string }> }> = {
  info: {
    container: 'bg-clinical-50 border-clinical-200 text-clinical-900',
    title: 'text-clinical-950 font-semibold',
    icon: Info,
  },
  success: {
    container: 'bg-emerald-50 border-emerald-200 text-emerald-900',
    title: 'text-emerald-950 font-semibold',
    icon: CheckCircle2,
  },
  warning: {
    container: 'bg-amber-50 border-amber-200 text-amber-900',
    title: 'text-amber-950 font-semibold',
    icon: AlertTriangle,
  },
  danger: {
    container: 'bg-rose-50 border-rose-200 text-rose-900',
    title: 'text-rose-950 font-semibold',
    icon: AlertCircle,
  },
};

export const Alert: React.FC<AlertProps> = ({
  variant = 'info',
  title,
  children,
  icon: CustomIcon,
  onClose,
  className,
}) => {
  const styles = variantStyles[variant];
  const IconComponent = CustomIcon || styles.icon;

  return (
    <div
      role="alert"
      className={clsx(
        'relative flex items-start gap-3 rounded-lg border p-4 text-sm shadow-sm transition-all',
        styles.container,
        className,
      )}
    >
      <IconComponent className="h-5 w-5 shrink-0 mt-0.5" />
      <div className="flex-1">
        {title && <h4 className={clsx('mb-1', styles.title)}>{title}</h4>}
        <div className="text-sm opacity-90">{children}</div>
      </div>
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          aria-label="Dismiss alert"
          className="shrink-0 rounded p-1 hover:bg-black/5"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
};

export default Alert;
