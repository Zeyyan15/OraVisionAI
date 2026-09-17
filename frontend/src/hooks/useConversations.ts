/**
 * OraVisionAI — Conversations & Messaging Custom Hook (Phase 27)
 *
 * Provides reactive management of conversation threads, active message streams,
 * chronological ASC pagination, sending, archival, reactivation, and atomic read state receipts.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  ConversationResponse,
  ConversationQueryParams,
  MessageResponse,
} from '../types/communication';
import {
  listConversations,
  getConversation,
  listMessages,
  sendMessage as apiSendMessage,
  archiveConversation as apiArchiveConversation,
  markMessagesRead as apiMarkMessagesRead,
  initiateDentistConversation,
  initiatePatientConversation,
} from '../api/communicationEndpoints';

export interface UseConversationsOptions {
  initialParams?: ConversationQueryParams;
  enableMessagePolling?: boolean;
  messagePollIntervalMs?: number; // Default: 15,000ms (15s)
}

export function useConversations(options: UseConversationsOptions = {}) {
  const {
    initialParams = {},
    enableMessagePolling = true,
    messagePollIntervalMs = 15000,
  } = options;

  const [conversations, setConversations] = useState<ConversationResponse[]>([]);
  const [conversationsLoading, setConversationsLoading] = useState<boolean>(true);
  const [conversationsError, setConversationsError] = useState<string | null>(null);

  const [selectedConversation, setSelectedConversation] = useState<ConversationResponse | null>(null);
  const [messages, setMessages] = useState<MessageResponse[]>([]);
  const [messagesTotal, setMessagesTotal] = useState<number>(0);
  const [messagesLoading, setMessagesLoading] = useState<boolean>(false);
  const [messagesError, setMessagesError] = useState<string | null>(null);

  const [sending, setSending] = useState<boolean>(false);
  const [earliestOffset, setEarliestOffset] = useState<number>(0);

  const isMountedRef = useRef<boolean>(true);
  const initialParamsRef = useRef<ConversationQueryParams>(initialParams);
  initialParamsRef.current = initialParams;

  const conversationsRef = useRef<ConversationResponse[]>(conversations);
  conversationsRef.current = conversations;

  // Fetch all conversation threads
  const fetchConversations = useCallback(
    async (customParams?: ConversationQueryParams) => {
      setConversationsLoading(true);
      setConversationsError(null);
      try {
        const res = await listConversations(customParams || initialParamsRef.current);
        if (isMountedRef.current) {
          setConversations(res?.items || []);
        }
      } catch (err: unknown) {
        if (isMountedRef.current) {
          const msg = err instanceof Error ? err.message : 'Failed to retrieve conversation list';
          setConversationsError(msg);
        }
      } finally {
        if (isMountedRef.current) {
          setConversationsLoading(false);
        }
      }
    },
    [],
  );

  // Load messages for the selected thread with reverse chronological offset alignment
  const loadInitialMessages = useCallback(async (conversationId: string) => {
    setMessagesLoading(true);
    setMessagesError(null);
    try {
      // 1. Probe total count with initial query
      const probeRes = await listMessages(conversationId, { limit: 50, offset: 0 });
      if (!isMountedRef.current) return;

      const totalCount = probeRes.total;
      setMessagesTotal(totalCount);

      if (totalCount <= 50) {
        // All messages fit in the initial slice
        setMessages(probeRes.items);
        setEarliestOffset(0);
      } else {
        // Backend orders created_at ASC. To display latest messages, calculate tail offset
        const tailOffset = totalCount - 50;
        const tailRes = await listMessages(conversationId, { limit: 50, offset: tailOffset });
        if (isMountedRef.current) {
          setMessages(tailRes.items);
          setEarliestOffset(tailOffset);
        }
      }
    } catch (err: unknown) {
      if (isMountedRef.current) {
        const msg = err instanceof Error ? err.message : 'Failed to retrieve message thread';
        setMessagesError(msg);
      }
    } finally {
      if (isMountedRef.current) {
        setMessagesLoading(false);
      }
    }
  }, []);

  // Mark unread messages in conversation as read
  const markThreadRead = useCallback(async (conversationId: string) => {
    try {
      const res = await apiMarkMessagesRead(conversationId);
      if (isMountedRef.current && res.marked_read_count > 0) {
        // Locally update unread_count for the conversation
        setConversations((prev) =>
          prev.map((c) => (c.id === conversationId ? { ...c, unread_count: 0 } : c)),
        );
        setSelectedConversation((prev) =>
          prev && prev.id === conversationId ? { ...prev, unread_count: 0 } : prev,
        );
        // Mark counterpart messages in memory as read
        setMessages((prev) => prev.map((m) => ({ ...m, is_read: true })));
      }
    } catch {
      // Admin or permissions failure is handled safely
    }
  }, []);

  // Select active conversation thread
  const selectConversation = useCallback(
    async (conversationOrId: ConversationResponse | string | null) => {
      if (!conversationOrId) {
        setSelectedConversation(null);
        setMessages([]);
        setMessagesTotal(0);
        setEarliestOffset(0);
        return;
      }

      let conv: ConversationResponse | null = null;
      if (typeof conversationOrId === 'string') {
        conv = conversationsRef.current.find((c) => c.id === conversationOrId) || null;
        if (!conv) {
          try {
            conv = await getConversation(conversationOrId);
          } catch {
            conv = null;
          }
        }
      } else {
        conv = conversationOrId;
      }

      if (conv) {
        setSelectedConversation(conv);
        await loadInitialMessages(conv.id);
        if (conv.unread_count > 0) {
          await markThreadRead(conv.id);
        }
      }
    },
    [loadInitialMessages, markThreadRead],
  );

  // Load earlier messages (paginating backwards in time)
  const loadEarlierMessages = useCallback(async () => {
    if (!selectedConversation || earliestOffset <= 0 || messagesLoading) return;

    const fetchCount = Math.min(50, earliestOffset);
    const newOffset = earliestOffset - fetchCount;

    setMessagesLoading(true);
    try {
      const res = await listMessages(selectedConversation.id, {
        limit: fetchCount,
        offset: newOffset,
      });
      if (isMountedRef.current) {
        // Prepend earlier messages in chronological ASC order
        setMessages((prev) => [...res.items, ...prev]);
        setEarliestOffset(newOffset);
      }
    } catch (err: unknown) {
      if (isMountedRef.current) {
        const msg = err instanceof Error ? err.message : 'Failed to load earlier messages';
        setMessagesError(msg);
      }
    } finally {
      if (isMountedRef.current) {
        setMessagesLoading(false);
      }
    }
  }, [selectedConversation, earliestOffset, messagesLoading]);

  // Send a text message
  const sendMessage = useCallback(
    async (content: string): Promise<MessageResponse | null> => {
      if (!selectedConversation) return null;

      const trimmed = content.trim();
      if (!trimmed) {
        throw new Error('Message content cannot be empty or whitespace only.');
      }
      if (trimmed.length > 4000) {
        throw new Error('Message content cannot exceed 4000 characters.');
      }
      if (!selectedConversation.is_active) {
        throw new Error('Cannot send messages in an archived conversation.');
      }

      setSending(true);
      try {
        const sent = await apiSendMessage(selectedConversation.id, { content: trimmed });
        if (isMountedRef.current) {
          // Append sent message
          setMessages((prev) => [...prev, sent]);
          setMessagesTotal((prev) => prev + 1);

          // Update conversation last_message_at and re-sort list
          const updatedConv = {
            ...selectedConversation,
            last_message_at: sent.created_at,
          };
          setSelectedConversation(updatedConv);
          setConversations((prev) => {
            const others = prev.filter((c) => c.id !== selectedConversation.id);
            return [updatedConv, ...others];
          });
        }
        return sent;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Failed to send message';
        throw new Error(msg);
      } finally {
        if (isMountedRef.current) {
          setSending(false);
        }
      }
    },
    [selectedConversation],
  );

  // Archive current conversation thread
  const archiveCurrentConversation = useCallback(async () => {
    if (!selectedConversation) return;
    try {
      const updated = await apiArchiveConversation(selectedConversation.id);
      if (isMountedRef.current) {
        setSelectedConversation(updated);
        setConversations((prev) =>
          prev.map((c) => (c.id === selectedConversation.id ? updated : c)),
        );
      }
      return updated;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to archive conversation';
      throw new Error(msg);
    }
  }, [selectedConversation]);

  // Reactivate conversation thread
  const reactivateCurrentConversation = useCallback(
    async (counterpartId: string, role: 'patient' | 'dentist') => {
      try {
        let updated: ConversationResponse;
        if (role === 'patient') {
          updated = await initiateDentistConversation(counterpartId);
        } else {
          updated = await initiatePatientConversation(counterpartId);
        }
        if (isMountedRef.current) {
          setSelectedConversation(updated);
          setConversations((prev) => {
            const others = prev.filter((c) => c.id !== updated.id);
            return [updated, ...others];
          });
        }
        return updated;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Failed to reactivate conversation';
        throw new Error(msg);
      }
    },
    [],
  );

  // Initial load of conversations
  useEffect(() => {
    isMountedRef.current = true;
    fetchConversations();
    return () => {
      isMountedRef.current = false;
    };
  }, [fetchConversations]);

  const selectedConversationId = selectedConversation?.id;

  // Periodic polling for active message thread while mounted and visible
  useEffect(() => {
    if (!enableMessagePolling || !selectedConversationId) return;

    let timer: ReturnType<typeof setInterval> | null = null;

    const pollNewMessages = async () => {
      if (document.visibilityState !== 'visible') return;
      try {
        // Check total count
        const checkRes = await listMessages(selectedConversationId, { limit: 10, offset: 0 });
        if (checkRes.total > messagesTotal && isMountedRef.current) {
          // New messages have arrived
          const tailOffset = Math.max(0, checkRes.total - 50);
          const tailRes = await listMessages(selectedConversationId, {
            limit: 50,
            offset: tailOffset,
          });
          if (isMountedRef.current) {
            setMessages(tailRes.items);
            setMessagesTotal(checkRes.total);
            setEarliestOffset(tailOffset);
            await markThreadRead(selectedConversationId);
          }
        }
      } catch {
        // Silently ignore polling errors
      }
    };

    timer = setInterval(pollNewMessages, messagePollIntervalMs);

    return () => {
      if (timer) clearInterval(timer);
    };
  }, [
    enableMessagePolling,
    messagePollIntervalMs,
    selectedConversationId,
    messagesTotal,
    markThreadRead,
  ]);

  return {
    conversations,
    conversationsLoading,
    conversationsError,
    selectedConversation,
    messages,
    messagesTotal,
    messagesLoading,
    messagesError,
    sending,
    hasEarlierMessages: earliestOffset > 0,
    earliestOffset,
    fetchConversations,
    selectConversation,
    loadEarlierMessages,
    sendMessage,
    archiveCurrentConversation,
    reactivateCurrentConversation,
    markThreadRead,
    refetchConversations: fetchConversations,
  };
}
