/**
 * OraVisionAI — Message Composer Component (Phase 27 & Phase 34)
 *
 * Supports text messaging, image and PDF attachments (up to 5 files, 10MB each),
 * client-side MIME/size validation, dismissible preview chips, and keyboard shortcut (Ctrl/Cmd+Enter).
 */

import React, { useRef, useState } from 'react';
import { Send, AlertCircle, Paperclip, X, FileText, Image as ImageIcon } from 'lucide-react';
import { Button } from '../ui/Button';

export interface MessageComposerProps {
  onSendMessage: (content: string) => Promise<unknown>;
  onSendMessageWithAttachments?: (files: File[], content?: string) => Promise<unknown>;
  disabled?: boolean;
}

const MAX_FILES = 5;
const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB
const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.pdf'];
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export const MessageComposer: React.FC<MessageComposerProps> = ({
  onSendMessage,
  onSendMessageWithAttachments,
  disabled = false,
}) => {
  const [content, setContent] = useState<string>('');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [sending, setSending] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const trimmed = content.trim();
  const hasFiles = selectedFiles.length > 0;
  const hasValidText = trimmed.length >= 1 && trimmed.length <= 4000;
  const canSubmit = (hasValidText || hasFiles) && !sending && !disabled;

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    const chosen = e.target.files ? Array.from(e.target.files) : [];
    if (!chosen.length) return;

    if (selectedFiles.length + chosen.length > MAX_FILES) {
      setError(`Maximum ${MAX_FILES} attachments allowed per message.`);
      e.target.value = '';
      return;
    }

    const validated: File[] = [];
    for (const f of chosen) {
      const ext = '.' + f.name.split('.').pop()?.toLowerCase();
      if (!ALLOWED_EXTENSIONS.includes(ext) && !ALLOWED_MIME_TYPES.includes(f.type.toLowerCase())) {
        setError(`"${f.name}" has an unsupported format. Allowed: JPG, PNG, WEBP, PDF.`);
        e.target.value = '';
        return;
      }
      if (f.size > MAX_FILE_BYTES) {
        setError(`"${f.name}" exceeds the maximum 10 MB limit (${formatFileSize(f.size)}).`);
        e.target.value = '';
        return;
      }
      validated.push(f);
    }

    setSelectedFiles((prev) => [...prev, ...validated]);
    e.target.value = '';
  };

  const handleRemoveFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!canSubmit) return;

    setSending(true);
    setError(null);
    try {
      if (hasFiles && onSendMessageWithAttachments) {
        await onSendMessageWithAttachments(selectedFiles, trimmed || undefined);
      } else {
        await onSendMessage(trimmed);
      }
      setContent('');
      setSelectedFiles([]);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to send message';
      setError(msg);
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
    }
  };

  const totalBytes = selectedFiles.reduce((acc, f) => acc + f.size, 0);

  return (
    <div className="border-t border-slate-200 bg-white p-4">
      {error && (
        <div className="mb-2 flex items-center gap-2 rounded-lg bg-rose-50 p-2.5 text-xs text-rose-700 border border-rose-200">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Selected Attachments Chips */}
      {selectedFiles.length > 0 && (
        <div className="mb-2.5 flex flex-wrap gap-2">
          {selectedFiles.map((f, i) => {
            const isPdf = f.name.toLowerCase().endsWith('.pdf') || f.type === 'application/pdf';
            return (
              <div
                key={`${f.name}-${i}`}
                className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs text-slate-700 shadow-sm"
              >
                {isPdf ? (
                  <FileText className="h-3.5 w-3.5 text-rose-600 flex-shrink-0" />
                ) : (
                  <ImageIcon className="h-3.5 w-3.5 text-clinical-600 flex-shrink-0" />
                )}
                <span className="max-w-[140px] truncate font-medium" title={f.name}>
                  {f.name}
                </span>
                <span className="text-[10px] text-slate-400">({formatFileSize(f.size)})</span>
                <button
                  type="button"
                  onClick={() => handleRemoveFile(i)}
                  disabled={sending || disabled}
                  className="ml-0.5 rounded p-0.5 text-slate-400 hover:bg-slate-200 hover:text-slate-600"
                  aria-label={`Remove ${f.name}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            );
          })}
          <div className="flex items-center text-[11px] text-slate-400 pl-1 self-center">
            <span>{selectedFiles.length}/{MAX_FILES} attached ({formatFileSize(totalBytes)})</span>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-2">
        <div className="relative">
          <textarea
            rows={hasFiles ? 2 : 3}
            placeholder={
              disabled
                ? 'Conversation is archived. Reactivate to reply.'
                : hasFiles
                ? 'Add an optional caption... (Ctrl+Enter to send)'
                : 'Write a message... (Ctrl+Enter to send)'
            }
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={disabled || sending}
            maxLength={4000}
            className="w-full rounded-xl border border-slate-200 p-3 text-sm placeholder:text-slate-400 focus:border-clinical-500 focus:outline-none focus:ring-1 focus:ring-clinical-500 disabled:bg-slate-50 disabled:cursor-not-allowed resize-none"
            aria-label="Message text"
          />
        </div>

        {/* Hidden File Input */}
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileSelect}
          multiple
          accept=".jpg,.jpeg,.png,.webp,.pdf,image/jpeg,image/png,image/webp,application/pdf"
          className="hidden"
          disabled={disabled || sending || selectedFiles.length >= MAX_FILES}
        />

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {/* Attachment Button */}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={disabled || sending || selectedFiles.length >= MAX_FILES}
              className="flex items-center gap-1.5 text-xs text-slate-600 hover:text-slate-900 border-slate-200"
              title="Attach images (JPG, PNG, WEBP) or PDFs (max 5, 10MB each)"
            >
              <Paperclip className="h-3.5 w-3.5" />
              <span>Attach</span>
            </Button>

            <span
              className={`text-[11px] font-medium ${
                content.length > 3900 ? 'text-amber-600' : 'text-slate-400'
              }`}
            >
              {content.length} / 4000
            </span>
          </div>

          <Button
            type="submit"
            size="sm"
            disabled={!canSubmit}
            className="flex items-center gap-1.5"
          >
            <Send className="h-3.5 w-3.5" />
            <span>{sending ? 'Sending...' : 'Send'}</span>
          </Button>
        </div>
      </form>
    </div>
  );
};
