/**
 * OraVisionAI — Message Composer Component (Phase 27)
 *
 * Text-only input supporting 1 to 4000 characters, whitespace trimming,
 * character counter, submit state, and keyboard shortcut (Ctrl/Cmd+Enter).
 */

import React, { useState } from 'react';
import { Send, AlertCircle } from 'lucide-react';
import { Button } from '../ui/Button';

export interface MessageComposerProps {
  onSendMessage: (content: string) => Promise<unknown>;
  disabled?: boolean;
}

export const MessageComposer: React.FC<MessageComposerProps> = ({
  onSendMessage,
  disabled = false,
}) => {
  const [content, setContent] = useState<string>('');
  const [sending, setSending] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const trimmed = content.trim();
  const isValid = trimmed.length >= 1 && trimmed.length <= 4000;

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!isValid || sending || disabled) return;

    setSending(true);
    setError(null);
    try {
      await onSendMessage(trimmed);
      setContent('');
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

  return (
    <div className="border-t border-slate-200 bg-white p-4">
      {error && (
        <div className="mb-2 flex items-center gap-2 rounded-lg bg-rose-50 p-2.5 text-xs text-rose-700 border border-rose-200">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-2">
        <div className="relative">
          <textarea
            rows={3}
            placeholder={
              disabled
                ? 'Conversation is archived. Reactivate to reply.'
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

        <div className="flex items-center justify-between">
          <span
            className={`text-[11px] font-medium ${
              content.length > 3900 ? 'text-amber-600' : 'text-slate-400'
            }`}
          >
            {content.length} / 4000
          </span>

          <Button
            type="submit"
            size="sm"
            disabled={!isValid || sending || disabled}
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
