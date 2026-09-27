/**
 * OraVisionAI — Accessible Password Input with Visibility Toggle
 *
 * Implements Phase 35 specification:
 * - Default type="password" (hidden)
 * - Eye / EyeOff toggle button (type="button") with accessible aria-label
 * - Keyboard accessible (Space/Enter activates toggle without form submission)
 * - Independent visibility state per instance
 * - Preserves entered value without mutation or clearing
 */

import React, { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { Input, InputProps } from './Input';

export interface PasswordInputProps extends Omit<InputProps, 'type' | 'endAdornment'> {
  showToggle?: boolean;
  toggleAriaLabel?: {
    show?: string;
    hide?: string;
  };
}

export const PasswordInput = React.forwardRef<HTMLInputElement, PasswordInputProps>(
  (
    {
      showToggle = true,
      toggleAriaLabel,
      disabled,
      className,
      ...props
    },
    ref,
  ) => {
    const [isVisible, setIsVisible] = useState(false);

    const showLabel = toggleAriaLabel?.show || 'Show password';
    const hideLabel = toggleAriaLabel?.hide || 'Hide password';

    return (
      <Input
        ref={ref}
        type={isVisible ? 'text' : 'password'}
        disabled={disabled}
        className={className}
        endAdornment={
          showToggle ? (
            <button
              type="button"
              disabled={disabled}
              onClick={() => setIsVisible((prev) => !prev)}
              aria-label={isVisible ? hideLabel : showLabel}
              title={isVisible ? hideLabel : showLabel}
              className="text-slate-400 hover:text-slate-600 focus:outline-none focus-visible:text-clinical-600 focus-visible:ring-2 focus-visible:ring-clinical-500 rounded p-1 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isVisible ? (
                <EyeOff className="h-4 w-4" aria-hidden="true" />
              ) : (
                <Eye className="h-4 w-4" aria-hidden="true" />
              )}
            </button>
          ) : undefined
        }
        {...props}
      />
    );
  },
);

PasswordInput.displayName = 'PasswordInput';
export default PasswordInput;

