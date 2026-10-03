/**
 * OraVisionAI — Accessible Button Component
 */

import React from 'react';
import { clsx } from 'clsx';
import { Loader2 } from 'lucide-react';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'danger' | 'ghost';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  leftIcon?: React.ComponentType<{ className?: string }>;
  rightIcon?: React.ComponentType<{ className?: string }>;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary: 'border border-transparent bg-[#087f70] text-white hover:bg-[#06685c] focus-visible:ring-[#087f70] shadow-[0_3px_8px_#087f701a] hover:shadow-[0_5px_14px_#087f702b]',
  secondary: 'border border-transparent bg-slate-800 text-white hover:bg-slate-900 focus-visible:ring-slate-500 shadow-sm',
  outline: 'border border-slate-300 bg-white text-slate-700 hover:border-[#8caf9e] hover:bg-[#f3f8f4] focus-visible:ring-[#087f70] shadow-sm',
  danger: 'bg-rose-600 text-white hover:bg-rose-700 focus-visible:ring-rose-500 shadow-sm',
  ghost: 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 focus-visible:ring-slate-500',
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-xs gap-1.5',
  md: 'h-10 px-4 text-sm gap-2',
  lg: 'h-12 px-6 text-base gap-2.5',
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      loading = false,
      leftIcon: LeftIcon,
      rightIcon: RightIcon,
      disabled,
      className,
      children,
      ...props
    },
    ref,
  ) => {
    const isDisabled = disabled || loading;

    return (
      <button
        ref={ref}
        disabled={isDisabled}
        aria-busy={loading}
        className={clsx(
          'cut-corner-button group inline-flex items-center justify-center font-semibold transition-[background-color,border-color,box-shadow,transform] duration-200 enabled:hover:-translate-y-0.5 enabled:active:translate-y-0 enabled:active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 motion-reduce:transform-none motion-reduce:transition-none',
          variant === 'outline' && 'cut-corner-outline',
          size === 'sm' && 'cut-corner-small',
          variantStyles[variant],
          sizeStyles[size],
          className,
        )}
        {...props}
      >
        {loading && <Loader2 className="h-4 w-4 animate-spin shrink-0" />}
        {!loading && LeftIcon && <LeftIcon className="h-4 w-4 shrink-0" />}
        <span className="inline-flex min-w-0 items-center justify-center gap-1.5">{children}</span>
        {!loading && RightIcon && <RightIcon className="h-4 w-4 shrink-0 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" />}
      </button>
    );
  },
);

Button.displayName = 'Button';
export default Button;
