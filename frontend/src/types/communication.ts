/**
 * OraVisionAI — Communication & Notification Domain Types (Phase 27)
 *
 * Strictly derived from frozen Phase 16 & Phase 17 backend schemas:
 * - app/schemas/conversation.py
 * - app/schemas/message.py
 * - app/schemas/notification.py
 */

// ============================================================================
// 1. Conversation Types (Phase 16)
// ============================================================================

export type ConversationType = 'direct';

export interface ConversationCreate {
  // Empty payload: conversation_type is strictly server-assigned as 'direct'
}

export interface ConversationArchive {
  // Empty payload: server unconditionally marks is_active = False
}

export interface ConversationResponse {
  id: string;
  patient_id: string;
  dentist_id: string;
  stream_channel_id: string;
  conversation_type: string;
  is_active: boolean;
  last_message_at?: string | null;
  created_at: string;
  updated_at: string;
  patient_name?: string | null;
  dentist_name?: string | null;
  clinic_name?: string | null;
  unread_count: number;
}

export interface ConversationListResponse {
  total: number;
  items: ConversationResponse[];
}

export interface ConversationQueryParams {
  is_active?: boolean;
  patient_id?: string;
  dentist_id?: string;
}

// ============================================================================
// 2. Message Types (Phase 16)
// ============================================================================

export interface MessageCreate {
  content: string; // 1 to 4000 characters
  message_type?: 'text';
}

export interface MessageResponse {
  id: string;
  conversation_id: string;
  sender_id: string;
  stream_message_id?: string | null;
  message_type: string;
  content: string;
  attachment_storage_path?: string | null;
  is_read: boolean;
  read_at?: string | null;
  created_at: string;
  sender_name?: string | null;
  sender_role?: string | null;
}

export interface MessageListResponse {
  total: number;
  limit: number;
  offset: number;
  items: MessageResponse[];
}

export interface MessageReadResponse {
  marked_read_count: number;
  conversation_id: string;
}

export interface MessageQueryParams {
  limit?: number; // 1 to 100, default 50
  offset?: number; // >= 0, default 0
}

// ============================================================================
// 3. Notification Types (Phase 17)
// ============================================================================

export type NotificationType =
  | 'screening_completed'
  | 'screening_failed'
  | 'appointment_booked'
  | 'appointment_confirmed'
  | 'appointment_cancelled'
  | 'dentist_verified'
  | 'dentist_assessment_added'
  | 'new_message'
  | 'system_alert';

export interface NotificationResponse {
  id: string;
  user_id: string;
  notification_type: NotificationType | string;
  title: string;
  message: string;
  action_url?: string | null;
  is_read: boolean;
  read_at?: string | null;
  created_at: string;
}

export interface NotificationListResponse {
  items: NotificationResponse[];
  total: number;
  limit: number;
  offset: number;
  unread_count: number;
}

export interface NotificationUnreadCountResponse {
  unread_count: number;
}

export interface NotificationReadAllResponse {
  marked_read_count: number;
}

export interface NotificationQueryParams {
  is_read?: boolean;
  limit?: number; // 1 to 100, default 50
  offset?: number; // >= 0, default 0
}
