/**
 * OraVisionAI — Standardized API Error Classes
 *
 * Accurately represents HTTP 422 validation details and HTTP 429 rate limit cooldowns.
 */

import { ValidationErrorItem } from '../types/api';

export class ApiError extends Error {
  public readonly statusCode: number;
  public readonly details: unknown;

  constructor(statusCode: number, message: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.details = details;
  }
}

export class ApiValidationError extends ApiError {
  public readonly errors: ValidationErrorItem[];

  constructor(errors: ValidationErrorItem[], message = 'Validation failed') {
    super(422, message, errors);
    this.name = 'ApiValidationError';
    this.errors = errors;
  }

  /**
   * Helper to format field errors into a key-value record for form field binding.
   */
  public getFieldErrors(): Record<string, string> {
    const fieldMap: Record<string, string> = {};
    for (const err of this.errors) {
      const field = err.loc[err.loc.length - 1];
      if (typeof field === 'string') {
        fieldMap[field] = err.msg;
      }
    }
    return fieldMap;
  }
}

export class RateLimitError extends ApiError {
  public readonly retryAfterSeconds: number;

  constructor(retryAfterSeconds: number, message = 'Rate limit exceeded') {
    super(429, message, { retryAfterSeconds });
    this.name = 'RateLimitError';
    this.retryAfterSeconds = retryAfterSeconds;
  }

  public getWaitMessage(): string {
    return `Too many requests. Please wait ${this.retryAfterSeconds} seconds before retrying.`;
  }
}
