/**
 * OraVisionAI — Centralized API HTTP Client
 *
 * Features:
 * - Dynamic Firebase Bearer token injection
 * - Automatic JSON and FormData request serialization
 * - Structured parsing of HTTP 422 validation errors
 * - HTTP 429 rate limit parsing with Retry-After header extraction
 * - Binary blob download support for clinical PDF reports
 */

import { auth } from '../config/firebase';
import { env } from '../config/env';
import { ApiError, ApiValidationError, RateLimitError } from './errors';
import { ValidationErrorItem } from '../types/api';

export interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  params?: Record<string, string | number | boolean | undefined>;
}

export class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string = env.apiBaseUrl) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
  }

  /**
   * Injects the active Firebase user ID token if authenticated.
   */
  private async getAuthHeaders(): Promise<Record<string, string>> {
    const headers: Record<string, string> = {};
    const currentUser = auth.currentUser;
    if (currentUser) {
      try {
        const token = await currentUser.getIdToken();
        headers['Authorization'] = `Bearer ${token}`;
      } catch (err) {
        console.warn('Failed to retrieve Firebase ID token:', err);
      }
    }
    return headers;
  }

  /**
   * Core request dispatcher
   */
  public async request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
    const { params, body, headers: customHeaders, ...fetchOptions } = options;

    let url = `${this.baseUrl}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
    if (params) {
      const searchParams = new URLSearchParams();
      for (const [k, v] of Object.entries(params)) {
        if (v !== undefined) {
          searchParams.append(k, String(v));
        }
      }
      const queryStr = searchParams.toString();
      if (queryStr) {
        url += `${url.includes('?') ? '&' : '?'}${queryStr}`;
      }
    }

    const authHeaders = await this.getAuthHeaders();
    const finalHeaders = new Headers();

    for (const [k, v] of Object.entries(authHeaders)) {
      finalHeaders.set(k, v);
    }

    if (customHeaders) {
      const h = new Headers(customHeaders);
      h.forEach((val, key) => finalHeaders.set(key, val));
    }

    let formattedBody: BodyInit | undefined = undefined;

    if (body !== undefined) {
      if (body instanceof FormData) {
        formattedBody = body; // Browser automatically sets multipart/form-data with boundary
      } else {
        finalHeaders.set('Content-Type', 'application/json');
        formattedBody = JSON.stringify(body);
      }
    }

    const response = await fetch(url, {
      ...fetchOptions,
      headers: finalHeaders,
      body: formattedBody,
    });

    if (response.ok) {
      // 204 No Content
      if (response.status === 204) {
        return null as unknown as T;
      }
      return (await response.json()) as T;
    }

    // Handle HTTP 429 Rate Limit
    if (response.status === 429) {
      const retryAfterHeader = response.headers.get('Retry-After');
      const retryAfterSeconds = retryAfterHeader ? parseInt(retryAfterHeader, 10) : 60;
      let errorMsg = 'Rate limit exceeded';
      try {
        const errJson = await response.json();
        if (errJson && errJson.detail) {
          errorMsg = typeof errJson.detail === 'string' ? errJson.detail : JSON.stringify(errJson.detail);
        }
      } catch {
        // use fallback message
      }
      throw new RateLimitError(isNaN(retryAfterSeconds) ? 60 : retryAfterSeconds, errorMsg);
    }

    // Handle HTTP 422 Unprocessable Entity
    if (response.status === 422) {
      let errorList: ValidationErrorItem[] = [];
      try {
        const errJson = await response.json();
        if (Array.isArray(errJson?.detail)) {
          errorList = errJson.detail;
        }
      } catch {
        // unparseable
      }
      throw new ApiValidationError(errorList, 'Validation failed on request parameters or body.');
    }

    // General HTTP 4xx/5xx Error
    let detailMsg = `HTTP Error ${response.status}: ${response.statusText}`;
    let errorDetail: unknown = null;
    try {
      const errJson = await response.json();
      if (errJson) {
        errorDetail = errJson;
        if (typeof errJson.detail === 'string') {
          detailMsg = errJson.detail;
        } else if (errJson.message) {
          detailMsg = errJson.message;
        }
      }
    } catch {
      // response body was not JSON
    }

    throw new ApiError(response.status, detailMsg, errorDetail);
  }

  public get<T>(endpoint: string, options?: RequestOptions): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'GET' });
  }

  public post<T>(endpoint: string, body?: unknown, options?: RequestOptions): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'POST', body });
  }

  public put<T>(endpoint: string, body?: unknown, options?: RequestOptions): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'PUT', body });
  }

  public patch<T>(endpoint: string, body?: unknown, options?: RequestOptions): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'PATCH', body });
  }

  public delete<T>(endpoint: string, options?: RequestOptions): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'DELETE' });
  }

  /**
   * Downloads binary stream (e.g. Clinical PDF Report)
   */
  public async downloadBlob(endpoint: string): Promise<Blob> {
    const url = `${this.baseUrl}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
    const authHeaders = await this.getAuthHeaders();
    const response = await fetch(url, {
      method: 'GET',
      headers: authHeaders,
    });

    if (!response.ok) {
      throw new ApiError(response.status, `Failed to download file from ${endpoint}`);
    }

    return await response.blob();
  }
}

export const apiClient = new ApiClient();
