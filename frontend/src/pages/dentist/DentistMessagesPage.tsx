/**
 * OraVisionAI — Dentist Clinical Messaging Console (Phase 27)
 *
 * Dedicated two-pane messaging layout for practitioner-patient clinical communication.
 */

import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Stethoscope, ChevronLeft } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useConversations } from '../../hooks/useConversations';
import { ConversationList } from '../../components/messaging/ConversationList';
import { MessageThread } from '../../components/messaging/MessageThread';
import { MessageComposer } from '../../components/messaging/MessageComposer';
import { NewConversationModal } from '../../components/messaging/NewConversationModal';
import { ConversationResponse } from '../../types/communication';

export const DentistMessagesPage: React.FC = () => {
  const { conversationId } = useParams<{ conversationId?: string }>();
  const navigate = useNavigate();
  const { userProfile } = useAuth();

  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [mobileView, setMobileView] = useState<'list' | 'thread'>('list');

  const {
    conversations,
    conversationsLoading,
    selectedConversation,
    messages,
    messagesTotal,
    messagesLoading,
    hasEarlierMessages,
    selectConversation,
    loadEarlierMessages,
    sendMessage,
    archiveCurrentConversation,
    reactivateCurrentConversation,
  } = useConversations();

  useEffect(() => {
    if (conversationId) {
      selectConversation(conversationId);
      setMobileView('thread');
    } else {
      selectConversation(null);
      setMobileView('list');
    }
  }, [conversationId, selectConversation]);

  const handleSelect = (conv: ConversationResponse) => {
    navigate(`/dentist/messages/${conv.id}`);
  };

  const handleConversationCreated = (conv: ConversationResponse) => {
    navigate(`/dentist/messages/${conv.id}`);
  };

  const handleBackToList = () => {
    setMobileView('list');
    navigate('/dentist/messages');
  };

  const currentUserId = userProfile?.id || '';

  return (
    <div className="flex flex-col h-[calc(100vh-5rem)] max-w-7xl mx-auto">
      {/* Breadcrumbs & Header */}
      <div className="mb-3 flex items-center justify-between">
        <div>
          <Link
            to="/dentist/dashboard"
            className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 transition-colors mb-1"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Back to Clinical Workspace</span>
          </Link>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <Stethoscope className="h-5 w-5 text-clinical-600" />
            <span>Patient Communications</span>
          </h1>
        </div>

        {/* Mobile Back Button */}
        {mobileView === 'thread' && (
          <button
            type="button"
            onClick={handleBackToList}
            className="inline-flex items-center gap-1 text-xs font-semibold text-clinical-600 hover:text-clinical-700 md:hidden"
          >
            <ChevronLeft className="h-4 w-4" />
            <span>All Conversations</span>
          </button>
        )}
      </div>

      {/* Two-Pane Messaging Console */}
      <div className="flex-1 flex overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        {/* Left Pane: Conversation Threads */}
        <div
          className={`w-full md:w-80 lg:w-96 flex-shrink-0 ${
            mobileView === 'thread' ? 'hidden md:flex' : 'flex'
          } flex-col h-full`}
        >
          <ConversationList
            conversations={conversations}
            selectedConversationId={selectedConversation?.id || null}
            onSelectConversation={handleSelect}
            onNewConversation={() => setIsModalOpen(true)}
            loading={conversationsLoading}
            currentRole="dentist"
          />
        </div>

        {/* Right Pane: Message Thread & Composer */}
        <div
          className={`flex-1 flex-col h-full ${
            mobileView === 'list' ? 'hidden md:flex' : 'flex'
          }`}
        >
          <div className="flex-1 overflow-hidden">
            <MessageThread
              conversation={selectedConversation}
              messages={messages}
              totalMessages={messagesTotal}
              loading={messagesLoading}
              hasEarlierMessages={hasEarlierMessages}
              onLoadEarlier={loadEarlierMessages}
              onArchive={archiveCurrentConversation}
              onReactivate={() =>
                reactivateCurrentConversation(
                  selectedConversation?.patient_id || '',
                  'dentist',
                )
              }
              currentUserId={currentUserId}
              currentRole="dentist"
            />
          </div>

          {selectedConversation && selectedConversation.is_active && (
            <MessageComposer
              onSendMessage={sendMessage}
              disabled={!selectedConversation.is_active}
            />
          )}
        </div>
      </div>

      {/* New Conversation Modal */}
      <NewConversationModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onConversationCreated={handleConversationCreated}
        currentRole="dentist"
      />
    </div>
  );
};
