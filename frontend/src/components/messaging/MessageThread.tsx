/**
 * OraVisionAI — Message Thread Component (Phase 27 & Phase 34)
 *
 * Displays chronologically ordered (ASC) message stream, load-earlier history pagination,
 * sender distinction bubbles, read receipt indicators, archive/reactivation controls,
 * image/PDF attachment rendering with signed URL access, and clinical report share cards.
 */

import React, { useRef, useEffect, useState } from 'react';
import {
  Check,
  CheckCheck,
  Archive,
  RotateCcw,
  Clock,
  UserCheck,
  AlertTriangle,
  RefreshCw,
  Share2,
  FileText,
  Image as ImageIcon,
  Download,
  ExternalLink,
  Loader2,
  FileCheck,
} from 'lucide-react';
import { ConversationResponse, MessageResponse, MessageAttachmentResponse } from '../../types/communication';
import { UserRole } from '../../types/domain';
import { Button } from '../ui/Button';
import { getAttachmentSignedUrl } from '../../api/communicationEndpoints';
import { downloadReportPdfBlob } from '../../api/screeningEndpoints';
import { ShareReportModal } from './ShareReportModal';

export interface MessageThreadProps {
  conversation: ConversationResponse | null;
  messages: MessageResponse[];
  totalMessages: number;
  loading: boolean;
  hasEarlierMessages: boolean;
  onLoadEarlier: () => void;
  onArchive: () => Promise<unknown>;
  onReactivate: () => Promise<unknown>;
  onReportShared?: (msg: MessageResponse) => void;
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

function formatFileSize(bytes: number): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
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
  onReportShared,
  currentUserId,
  currentRole,
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const prevMessagesLengthRef = useRef<number>(messages.length);

  const [isShareModalOpen, setIsShareModalOpen] = useState<boolean>(false);
  const [openingAttachmentId, setOpeningAttachmentId] = useState<string | null>(null);
  const [downloadingReportId, setDownloadingReportId] = useState<string | null>(null);

  // Auto-scroll to bottom only when a new message is sent/appended
  useEffect(() => {
    if (messages.length > prevMessagesLengthRef.current) {
      if (scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }
    }
    prevMessagesLengthRef.current = messages.length;
  }, [messages.length]);

  const handleAttachmentClick = async (att: MessageAttachmentResponse) => {
    setOpeningAttachmentId(att.id);
    try {
      const res = await getAttachmentSignedUrl(att.id);
      if (res && res.signed_url) {
        window.open(res.signed_url, '_blank', 'noopener,noreferrer');
      }
    } catch (err) {
      console.error('Failed to open attachment signed URL:', err);
      alert('Unable to generate secure download link for this attachment.');
    } finally {
      setOpeningAttachmentId(null);
    }
  };

  const handleDownloadReport = async (reportId: string, reportNumber?: string | null) => {
    setDownloadingReportId(reportId);
    try {
      const blob = await downloadReportPdfBlob(reportId);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = reportNumber ? `${reportNumber}.pdf` : `clinical_report_${reportId.slice(0, 8)}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to download clinical report PDF:', err);
      alert('Failed to download clinical report PDF. Please try again.');
    } finally {
      setDownloadingReportId(null);
    }
  };

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
          {/* Share Report Button for Dentists */}
          {currentRole === 'dentist' && conversation.is_active && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsShareModalOpen(true)}
              className="text-xs flex items-center gap-1.5 text-clinical-700 border-clinical-200 hover:bg-clinical-50"
              title="Share an authorized clinical report with this patient"
            >
              <Share2 className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Share Report</span>
            </Button>
          )}

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
              Send a text message or file attachment below to start this clinical conversation thread.
            </p>
          </div>
        )}

        {/* Chronological Message Bubbles (ASC) */}
        {messages.map((msg) => {
          const isMine = msg.sender_id === currentUserId;
          const isReportShare = msg.message_type === 'report_share' || Boolean(msg.report_id);
          const hasAttachments = Boolean(msg.attachments && msg.attachments.length > 0);

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

              {/* Message Content Container */}
              <div
                className={`max-w-[85%] sm:max-w-[75%] rounded-2xl p-3.5 text-sm shadow-sm leading-relaxed ${
                  isMine
                    ? 'bg-clinical-600 text-white rounded-tr-none'
                    : 'bg-slate-100 text-slate-900 rounded-tl-none border border-slate-200/60'
                }`}
              >
                {/* 1. Clinical Report Card if report_share */}
                {isReportShare && (
                  <div
                    className={`rounded-xl p-3 mb-2 border ${
                      isMine
                        ? 'bg-clinical-700/80 border-clinical-500 text-white'
                        : 'bg-white border-slate-200 text-slate-900'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <div className="flex items-center gap-1.5 font-bold text-xs">
                        <FileCheck className="h-4 w-4 text-emerald-400" />
                        <span>Clinical Report Shared</span>
                      </div>
                      {msg.report_number && (
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-black/10">
                          {msg.report_number}
                        </span>
                      )}
                    </div>
                    <p className={`text-xs ${isMine ? 'text-clinical-100' : 'text-slate-600'} mb-2.5`}>
                      {msg.report_title || 'Oral Health AI Screening Report'}
                    </p>
                    {msg.report_id && (
                      <Button
                        type="button"
                        size="sm"
                        variant={isMine ? 'outline' : 'primary'}
                        onClick={() => handleDownloadReport(msg.report_id!, msg.report_number)}
                        disabled={downloadingReportId === msg.report_id}
                        className={`w-full flex items-center justify-center gap-1.5 text-xs py-1.5 font-medium ${
                          isMine
                            ? 'bg-white !text-clinical-700 border-clinical-200 hover:bg-clinical-50 hover:!text-clinical-800 shadow-sm'
                            : ''
                        }`}
                      >
                        {downloadingReportId === msg.report_id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Download className="h-3.5 w-3.5" />
                        )}
                        <span>{downloadingReportId === msg.report_id ? 'Downloading...' : 'Download PDF Report'}</span>
                      </Button>
                    )}
                  </div>
                )}

                {/* 2. File Attachments Cards */}
                {hasAttachments && (
                  <div className="space-y-2 mb-2">
                    {msg.attachments!.map((att) => {
                      const isImage = att.attachment_type === 'image' || att.mime_type.startsWith('image/');
                      const isOpening = openingAttachmentId === att.id;

                      return (
                        <div
                          key={att.id}
                          className={`rounded-xl p-2.5 flex items-center justify-between gap-3 border transition-colors ${
                            isMine
                              ? 'bg-clinical-700/60 border-clinical-500/60 text-white'
                              : 'bg-white border-slate-200 text-slate-800'
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <div className={`p-2 rounded-lg ${isMine ? 'bg-clinical-800' : 'bg-slate-100'}`}>
                              {isImage ? (
                                <ImageIcon className={`h-4 w-4 ${isMine ? 'text-clinical-200' : 'text-clinical-600'}`} />
                              ) : (
                                <FileText className="h-4 w-4 text-rose-500" />
                              )}
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs font-semibold truncate" title={att.original_filename}>
                                {att.original_filename}
                              </p>
                              <p className={`text-[10px] ${isMine ? 'text-clinical-200' : 'text-slate-400'}`}>
                                {formatFileSize(att.file_size)}
                              </p>
                            </div>
                          </div>

                          <Button
                            type="button"
                            size="sm"
                            variant={isMine ? 'outline' : 'secondary'}
                            onClick={() => handleAttachmentClick(att)}
                            disabled={isOpening}
                            className={`flex-shrink-0 flex items-center gap-1 text-[11px] py-1 px-2.5 ${
                              isMine ? 'border-clinical-400 text-white hover:bg-white/10' : ''
                            }`}
                            title={`Open ${att.original_filename}`}
                          >
                            {isOpening ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : isImage ? (
                              <ExternalLink className="h-3 w-3" />
                            ) : (
                              <Download className="h-3 w-3" />
                            )}
                            <span>{isOpening ? 'Loading...' : isImage ? 'View' : 'Download'}</span>
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* 3. Message Text Content */}
                {msg.content && msg.content.trim() && (
                  <div className="whitespace-pre-wrap break-words">
                    {msg.content}
                  </div>
                )}
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

      {/* Share Report Modal */}
      {conversation.is_active && currentRole === 'dentist' && (
        <ShareReportModal
          isOpen={isShareModalOpen}
          onClose={() => setIsShareModalOpen(false)}
          conversationId={conversation.id}
          onReportShared={(newMsg) => {
            if (onReportShared) {
              onReportShared(newMsg);
            }
          }}
        />
      )}
    </div>
  );
};
