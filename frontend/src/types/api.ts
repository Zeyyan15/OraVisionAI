/**
 * OraVisionAI — API Envelopes & Request/Response Schemas
 *
 * Maps directly to FastAPI Pydantic schemas in backend/app/schemas/
 */

import { UserRole } from './domain';

export interface UserResponse {
  id: string; // UUID
  firebase_uid: string;
  email: string;
  role: UserRole;
  first_name: string;
  last_name: string;
  phone_number?: string | null;
  avatar_url?: string | null;
  is_active: boolean;
  is_email_verified: boolean;
  created_at: string; // ISO 8601
  updated_at: string; // ISO 8601
}

export interface AuthIdentityResponse {
  authenticated: boolean;
  firebase_uid: string;
  email?: string | null;
  email_verified: boolean;
}

export interface RoleAccessResponse {
  access: string; // 'granted'
  role: string;
  user_id: string; // UUID
}

export interface ValidationErrorItem {
  loc: (string | number)[];
  msg: string;
  type: string;
}

export interface HTTPValidationError {
  detail: ValidationErrorItem[];
}

export interface GenericApiErrorResponse {
  detail: string;
}
