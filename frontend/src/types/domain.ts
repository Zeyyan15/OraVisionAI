/**
 * OraVisionAI — Core Domain Types & Enums
 *
 * Strictly derived from the frozen Phase 21 backend contract.
 * Preserves the 7 AI classes, 4 risk levels, 4 consultation statuses,
 * and primary/secondary XAI catalog.
 */

// ============================================================================
// 1. Oral Disease AI Taxonomy (Frozen 7 Classes)
// ============================================================================

export const LESION_CLASSES = {
  CaS: 'Canker Sore',
  CoS: 'Cold Sore',
  Gum: 'Gum Disease',
  MC: 'Mucocele',
  OC: 'Oral Cancer',
  OLP: 'Oral Lichen Planus',
  OT: 'Oral Thrush',
} as const;

export type LesionClassCode = keyof typeof LESION_CLASSES;
export type LesionClassName = (typeof LESION_CLASSES)[LesionClassCode];

// ============================================================================
// 2. Risk Tiers & Technical Tier Indices (Phase 12 Semantic Rule)
//
// CRITICAL SEMANTIC INVARIANT:
// 25.00, 50.00, 75.00, and 100.00 are technical ordinal tier indices for categorical
// ranking and sorting. They are NOT disease probabilities or clinical percentages.
// Frontend components must display them as tier rank numbers or ordinal categories
// (Low, Moderate, High, Critical), and NEVER format them with a '%' symbol or
// present them as calibrated probabilities of disease.
// ============================================================================

export type RiskLevel = 'low' | 'moderate' | 'high' | 'critical';

export interface RiskTierConfig {
  tierIndex: number;
  label: string;
  variant: 'success' | 'warning' | 'danger';
  description: string;
}

export const RISK_LEVEL_CONFIG: Record<RiskLevel, RiskTierConfig> = {
  low: {
    tierIndex: 25.0,
    label: 'Low Risk',
    variant: 'success',
    description: 'Low clinical urgency based on ordinal tier ranking.',
  },
  moderate: {
    tierIndex: 50.0,
    label: 'Moderate Risk',
    variant: 'warning',
    description: 'Moderate clinical urgency based on ordinal tier ranking.',
  },
  high: {
    tierIndex: 75.0,
    label: 'High Risk',
    variant: 'danger',
    description: 'Elevated clinical urgency requiring professional review.',
  },
  critical: {
    tierIndex: 100.0,
    label: 'Critical Risk',
    variant: 'danger',
    description: 'Highest ordinal tier requiring immediate clinical evaluation.',
  },
};

// ============================================================================
// 3. Screening Lifecycle States
// ============================================================================

export type ScreeningStatus = 'pending' | 'uploading' | 'processing' | 'completed' | 'failed';

// ============================================================================
// 4. Consultation Lifecycle States
// ============================================================================

export type ConsultationStatus = 'scheduled' | 'active' | 'ended' | 'failed';

// ============================================================================
// 5. XAI Explainability Catalog
// ============================================================================

export type PrimaryXaiMethod = 'occlusion_sensitivity' | 'grad_cam';

export type SecondaryXaiMethod =
  | 'grad_cam_plus_plus'
  | 'layer_cam'
  | 'score_cam'
  | 'integrated_gradients';

export type XaiMethod = PrimaryXaiMethod | SecondaryXaiMethod;

// ============================================================================
// 6. User Roles & Account Verification
// ============================================================================

export type UserRole = 'patient' | 'dentist' | 'admin';

export type DentistVerificationStatus = 'pending' | 'approved' | 'rejected';
