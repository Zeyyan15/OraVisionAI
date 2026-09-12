/**
 * OraVisionAI — Message Thread Component (Phase 27)
 *
 * Displays chronologically ordered (ASC) message stream, load-earlier history pagination,
 * sender distinction bubbles, read receipt indicators, and archive/reactivation controls.
 */

import React, { useRef, useEffect } from 'react';
import {
  Check,
  CheckCheck,
  Archive,
  RotateCcw,
  Clock,
  UserCheck,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react';
import { ConversationResponse, MessageResponse } from '../../types/communication';
import { UserRole } from '../../types/domain';
import { Button } from '../ui/Button';

export interface MessageThreadProps {
  conversation: ConversationResponse | null;
  messages: MessageResponse[];
  totalMessages: number;
  loading: boolean;
  hasEarlierMessages: boolean;
  onLoadEarlier: () => void;
  onArchive: () => Promise<unknown>;
  onReactivate: () => Promise<unknown>;
  currentUserId: string;
  currentRole: UserRole;
}

function formatMessageTime(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

export const MessageThread: React.FC<MessageThreadProps> = ({
  conversation,
  messages,
  totalMessages,
  loading,
  hasEarlierMessages,
  onLoadEarlier,
  onArchive,
  onReactivate,
  currentUserId,
  currentRole,
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const prevMessagesLengthRef = useRef<number>(messages.length);

  // Auto-scroll to bottom only when a new message is sent/appended
  useEffect(() => {
    if (messages.length > prevMessagesLengthRef.current) {
      if (scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }
    }
    prevMessagesLengthRef.current = messages.length;
  }, [messages.length]);

  if (!conversation) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-8 text-center bg-slate-50/50">
        <div className="h-12 w-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-3">
          <Clock className="h-6 w-6" />
        </div>
        <h3 className="text-sm font-bold text-slate-800">Select a Conversation</h3>
        <p className="mt-1 text-xs text-slate-500 max-w-sm">
          Choose an existing direct conversation from the list or initiate a new clinical chat with an authorized counterpart.
        </p>
      </div>
    );
  }

  const counterpartName =
    (currentRole === 'patient' ? conversation.dentist_name : conversation.patient_name) ||
    (currentRole === 'patient' ? 'Dentist' : 'Patient');

  return (
    <div className="flex h-full flex-col bg-white">
      {/* Thread Header */}
      <div className="flex items-center justify-between border-b border-slate-200 px-6 py-3.5 bg-white">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-bold text-slate-900">{counterpartName}</h3>
            {!conversation.is_active && (
              <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                Archived
              </span>
            )}
          </div>
          {currentRole === 'patient' && conversation.clinic_name && (
            <p className="text-xs text-slate-500">{conversation.clinic_name}</p>
          )}
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {conversation.is_active ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onArchive()}
              className="text-xs flex items-center gap-1.5 text-slate-600 hover:text-slate-900"
              title="Archive conversation"
            >
              <Archive className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Archive</span>
            </Button>
          ) : (
            <Button
              variant="primary"
              size="sm"
              onClick={() => onReactivate()}
              className="text-xs flex items-center gap-1.5"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>Reactivate</span>
            </Button>
          )}
        </div>
      </div>

      {/* Message History Stream */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-4">
        {/* Load Earlier Messages Button */}
        {hasEarlierMessages && (
          <div className="text-center py-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onLoadEarlier}
              disabled={loading}
              className="text-xs inline-flex items-center gap-1.5 text-slate-600"
            >
              <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
              <span>Load earlier messages ({totalMessages - messages.length} earlier)</span>
            </Button>
          </div>
        )}

        {messages.length === 0 && !loading && (
          <div className="py-12 text-center">
            <UserCheck className="mx-auto h-8 w-8 text-slate-300" />
            <p className="mt-2 text-xs font-semibold text-slate-700">No messages yet</p>
            <p className="mt-0.5 text-[11px] text-slate-400">
              Send a text message below to start this clinical conversation thread.
            </p>
          </div>
        )}

        {/* Chronological Message Bubbles (ASC) */}
        {messages.map((msg) => {
          const isMine = msg.sender_id === currentUserId;

          return (
            <div
              key={msg.id}
              className={`flex flex-col ${isMine ? 'items-end' : 'items-start'}`}
            >
              {/* Sender Name & Role if incoming */}
              {!isMine && (
                <span className="text-[11px] font-semibold text-slate-500 mb-1 pl-1">
                  {msg.sender_name || counterpartName}
                </span>
              )}

              {/* Message Bubble */}
              <div
                className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm shadow-sm leading-relaxed whitespace-pre-wrap break-words ${
                  isMine
                    ? 'bg-clinical-600 text-white rounded-tr-none'
                    : 'bg-slate-100 text-slate-900 rounded-tl-none border border-slate-200/60'
                }`}
              >
                {msg.content}
              </div>

              {/* Timestamp & Read Receipt */}
              <div className="mt-1 flex items-center gap-1 text-[10px] text-slate-400 px-1">
                <span>{formatMessageTime(msg.created_at)}</span>
                {isMine && (
                  <span className="flex items-center ml-0.5" title={msg.is_read ? 'Read' : 'Sent'}>
                    {msg.is_read ? (
                      <CheckCheck className="h-3.5 w-3.5 text-clinical-500" />
                    ) : (
                      <Check className="h-3.5 w-3.5 text-slate-400" />
                    )}
                    <span className="sr-only">{msg.is_read ? 'Read' : 'Sent'}</span>
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Archived Banner if inactive */}
      {!conversation.is_active && (
        <div className="border-t border-amber-200 bg-amber-50 p-4 text-center">
          <div className="flex items-center justify-center gap-2 text-amber-800 text-xs font-medium">
            <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0" />
            <span>
              This conversation is archived. New messages cannot be sent.
            </span>
          </div>
          <p className="text-[11px] text-amber-700 mt-1">
            To send a new message, click the <strong>Reactivate</strong> button above.
          </p>
        </div>
      )}
    </div>
  );
};
