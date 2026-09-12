/**
 * OraVisionAI — Conversation List Component (Phase 27)
 *
 * Master list of direct conversation threads with active/archived tabs,
 * counterpart name & clinic info, unread counters, and search filtering.
 */

import React, { useState, useMemo } from 'react';
import { Search, Plus, MessageSquare, Archive, CheckCircle2 } from 'lucide-react';
import { ConversationResponse } from '../../types/communication';
import { UserRole } from '../../types/domain';
import { Button } from '../ui/Button';

export interface ConversationListProps {
  conversations: ConversationResponse[];
  selectedConversationId: string | null;
  onSelectConversation: (conv: ConversationResponse) => void;
  onNewConversation: () => void;
  loading: boolean;
  currentRole: UserRole;
}

function formatRelativeTime(dateStr?: string | null): string {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    const now = new Date();
    const diffSec = Math.floor((now.getTime() - d.getTime()) / 1000);

    if (diffSec < 60) return 'Just now';
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays}d ago`;

    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  } catch {
    return '';
  }
}

export const ConversationList: React.FC<ConversationListProps> = ({
  conversations,
  selectedConversationId,
  onSelectConversation,
  onNewConversation,
  loading,
  currentRole,
}) => {
  const [tab, setTab] = useState<'active' | 'archived'>('active');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const filteredConversations = useMemo(() => {
    return conversations
      .filter((c) => (tab === 'active' ? c.is_active : !c.is_active))
      .filter((c) => {
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase();
        const name = (currentRole === 'patient' ? c.dentist_name : c.patient_name) || '';
        const clinic = c.clinic_name || '';
        return name.toLowerCase().includes(q) || clinic.toLowerCase().includes(q);
      });
  }, [conversations, tab, searchQuery, currentRole]);

  return (
    <div className="flex h-full flex-col border-r border-slate-200 bg-white">
      {/* Header */}
      <div className="border-b border-slate-200 p-4">
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-clinical-600" />
            <h2 className="text-lg font-bold text-slate-900">Conversations</h2>
          </div>
          <Button
            size="sm"
            onClick={onNewConversation}
            className="flex items-center gap-1.5 text-xs"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>New Chat</span>
          </Button>
        </div>

        {/* Search */}
        <div className="relative mb-3">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder={
              currentRole === 'patient'
                ? 'Search dentists or clinics...'
                : 'Search patients...'
            }
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-lg border border-slate-200 pl-9 pr-3 py-1.5 text-xs placeholder:text-slate-400 focus:border-clinical-500 focus:outline-none focus:ring-1 focus:ring-clinical-500"
          />
        </div>

        {/* Tabs */}
        <div className="flex rounded-lg bg-slate-100 p-0.5 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setTab('active')}
            className={`flex-1 rounded-md py-1 text-center transition-colors ${
              tab === 'active'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Active
          </button>
          <button
            type="button"
            onClick={() => setTab('archived')}
            className={`flex-1 rounded-md py-1 text-center transition-colors ${
              tab === 'archived'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Archived
          </button>
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
        {loading && conversations.length === 0 ? (
          <div className="p-4 space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex gap-3 animate-pulse">
                <div className="h-10 w-10 rounded-full bg-slate-200" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-3/4 rounded bg-slate-200" />
                  <div className="h-3 w-1/2 rounded bg-slate-100" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredConversations.length === 0 ? (
          <div className="py-12 px-4 text-center">
            {tab === 'active' ? (
              <>
                <MessageSquare className="mx-auto h-8 w-8 text-slate-300" />
                <p className="mt-2 text-xs font-semibold text-slate-700">No active conversations</p>
                <p className="mt-0.5 text-[11px] text-slate-400">
                  {currentRole === 'patient'
                    ? 'Connect with an authorized dentist to begin messaging.'
                    : 'Start a direct chat with an authorized patient.'}
                </p>
              </>
            ) : (
              <>
                <Archive className="mx-auto h-8 w-8 text-slate-300" />
                <p className="mt-2 text-xs font-semibold text-slate-700">No archived conversations</p>
                <p className="mt-0.5 text-[11px] text-slate-400">
                  Archived threads will appear here.
                </p>
              </>
            )}
          </div>
        ) : (
          filteredConversations.map((conv) => {
            const isSelected = selectedConversationId === conv.id;
            const counterpartName =
              (currentRole === 'patient' ? conv.dentist_name : conv.patient_name) ||
              (currentRole === 'patient' ? 'Dentist' : 'Patient');
            const initials = counterpartName
              .replace('Dr. ', '')
              .split(' ')
              .map((n) => n[0])
              .slice(0, 2)
              .join('')
              .toUpperCase();

            return (
              <div
                key={conv.id}
                onClick={() => onSelectConversation(conv)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onSelectConversation(conv);
                  }
                }}
                className={`flex items-start gap-3 p-3.5 transition-colors cursor-pointer focus:outline-none ${
                  isSelected
                    ? 'bg-clinical-50/80 border-l-4 border-clinical-600'
                    : 'hover:bg-slate-50'
                }`}
              >
                {/* Avatar Badge */}
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-clinical-100 text-xs font-bold text-clinical-800">
                  {initials || 'OV'}
                </div>

                {/* Details */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <p
                      className={`truncate text-sm ${
                        isSelected || conv.unread_count > 0
                          ? 'font-bold text-slate-900'
                          : 'font-semibold text-slate-700'
                      }`}
                    >
                      {counterpartName}
                    </p>
                    <span className="text-[10px] text-slate-400 flex-shrink-0">
                      {formatRelativeTime(conv.last_message_at || conv.created_at)}
                    </span>
                  </div>

                  {currentRole === 'patient' && conv.clinic_name && (
                    <p className="truncate text-xs text-slate-500 mt-0.5">
                      {conv.clinic_name}
                    </p>
                  )}

                  <div className="mt-1.5 flex items-center justify-between">
                    <span className="text-[10px] font-medium text-slate-400 flex items-center gap-1">
                      {conv.is_active ? (
                        <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                      ) : (
                        <Archive className="h-3 w-3 text-slate-400" />
                      )}
                      <span>{conv.is_active ? 'Active thread' : 'Archived'}</span>
                    </span>

                    {conv.unread_count > 0 && (
                      <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-clinical-600 px-1 text-[10px] font-bold text-white">
                        {conv.unread_count}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
