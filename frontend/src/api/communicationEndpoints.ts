/**
 * OraVisionAI — Communication & Notification API Callers (Phase 27)
 *
 * Provides typed async callers for all 9 Phase 16 operations and 5 Phase 17 operations
 * via the centralized apiClient.
 */

import { apiClient } from './client';
import { API_PATHS } from './endpoints';
import {
  ConversationResponse,
  ConversationListResponse,
  ConversationQueryParams,
  ConversationCreate,
  ConversationArchive,
  MessageResponse,
  MessageListResponse,
  MessageQueryParams,
  MessageCreate,
  MessageReadResponse,
  NotificationResponse,
  NotificationListResponse,
  NotificationUnreadCountResponse,
  NotificationReadAllResponse,
  NotificationQueryParams,
} from '../types/communication';

// ============================================================================
// 1. Phase 16: Conversations & Messaging
// ============================================================================

/**
 * Initiate or reactivate a direct conversation with a target dentist (Patient only).
 * Server validates active PatientDentistRelationship.
 */
export async function initiateDentistConversation(
  dentistId: string,
  data: ConversationCreate = {},
): Promise<ConversationResponse> {
  return apiClient.post<ConversationResponse>(API_PATHS.DENTIST_CONVERSATIONS(dentistId), data);
}

/**
 * Initiate or reactivate a direct conversation with a target patient (Dentist only).
 * Server validates active PatientDentistRelationship and approved dentist credentials.
 */
export async function initiatePatientConversation(
  patientId: string,
  data: ConversationCreate = {},
): Promise<ConversationResponse> {
  return apiClient.post<ConversationResponse>(API_PATHS.PATIENT_CONVERSATIONS(patientId), data);
}

/**
 * List conversation threads scoped to the authenticated caller.
 */
export async function listConversations(
  params?: ConversationQueryParams,
): Promise<ConversationListResponse> {
  return apiClient.get<ConversationListResponse>(API_PATHS.CONVERSATIONS, {
    params: params as Record<string, string | number | boolean | undefined>,
  });
}

/**
 * Retrieve details of a specific conversation. Restricted to participants or admin.
 */
export async function getConversation(conversationId: string): Promise<ConversationResponse> {
  return apiClient.get<ConversationResponse>(API_PATHS.CONVERSATION_DETAIL(conversationId));
}

/**
 * Archive a conversation thread (unconditionally marks is_active = False).
 */
export async function archiveConversation(
  conversationId: string,
  data: ConversationArchive = {},
): Promise<ConversationResponse> {
  return apiClient.patch<ConversationResponse>(API_PATHS.CONVERSATION_ARCHIVE(conversationId), data);
}

/**
 * Send a text message in an active conversation thread.
 * Senders cannot manipulate identity. Admins forbidden (403).
 */
export async function sendMessage(
  conversationId: string,
  data: MessageCreate,
): Promise<MessageResponse> {
  return apiClient.post<MessageResponse>(API_PATHS.CONVERSATION_MESSAGES(conversationId), {
    content: data.content,
    message_type: 'text',
  });
}

/**
 * List messages within a conversation ordered chronologically (created_at ASC).
 */
export async function listMessages(
  conversationId: string,
  params?: MessageQueryParams,
): Promise<MessageListResponse> {
  return apiClient.get<MessageListResponse>(API_PATHS.CONVERSATION_MESSAGES(conversationId), {
    params: params as Record<string, string | number | boolean | undefined>,
  });
}

/**
 * Retrieve details of a single message record.
 */
export async function getMessage(
  conversationId: string,
  messageId: string,
): Promise<MessageResponse> {
  return apiClient.get<MessageResponse>(
    API_PATHS.CONVERSATION_MESSAGE_DETAIL(conversationId, messageId),
  );
}

/**
 * Mark all unread incoming messages from the counterpart as read via single atomic update.
 * Admins forbidden (403).
 */
export async function markMessagesRead(conversationId: string): Promise<MessageReadResponse> {
  return apiClient.patch<MessageReadResponse>(API_PATHS.CONVERSATION_READ(conversationId));
}

// ============================================================================
// 2. Phase 17: In-App Notifications
// ============================================================================

/**
 * List notifications owned by the authenticated caller with limit/offset pagination.
 * Ordered newest first (created_at DESC).
 */
export async function listNotifications(
  params?: NotificationQueryParams,
): Promise<NotificationListResponse> {
  return apiClient.get<NotificationListResponse>(API_PATHS.NOTIFICATIONS, {
    params: params as Record<string, string | number | boolean | undefined>,
  });
}

/**
 * Get scalar count of unread notifications for badge display.
 */
export async function getUnreadNotificationCount(): Promise<NotificationUnreadCountResponse> {
  return apiClient.get<NotificationUnreadCountResponse>(API_PATHS.NOTIFICATIONS_UNREAD_COUNT);
}

/**
 * Retrieve a specific notification owned by the authenticated caller.
 */
export async function getNotification(id: string): Promise<NotificationResponse> {
  return apiClient.get<NotificationResponse>(API_PATHS.NOTIFICATION_DETAIL(id));
}

/**
 * Mark an individual notification as read idempotently.
 */
export async function markNotificationRead(id: string): Promise<NotificationResponse> {
  return apiClient.patch<NotificationResponse>(API_PATHS.NOTIFICATION_READ(id));
}

/**
 * Mark all unread notifications owned by the authenticated caller as read via atomic SQL update.
 */
export async function markAllNotificationsRead(): Promise<NotificationReadAllResponse> {
  return apiClient.patch<NotificationReadAllResponse>(API_PATHS.NOTIFICATIONS_READ_ALL);
}
