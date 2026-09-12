/**
 * OraVisionAI — Privacy-Safe Audit Log Inspector Modal (Phase 26)
 *
 * Displays full audit event record with formatted JSON details viewer.
 * Confirms sensitive credentials remain redacted by server-side safeguards.
 */

import React, { useState, useEffect } from 'react';
import { AdminAuditLogResponse } from '../../types/admin';
import { getAuditLogDetail } from '../../api/adminEndpoints';
import { Modal } from '../ui/Modal';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { LoadingSkeleton } from '../feedback/LoadingSkeleton';
import {
  ShieldCheck,
  User,
  Activity,
  Globe,
  Monitor,
  Code,
  AlertCircle,
  Copy,
  Check,
} from 'lucide-react';

export interface AuditLogDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  auditLogId: string | null;
  initialLog?: AdminAuditLogResponse | null;
}

export const AuditLogDetailModal: React.FC<AuditLogDetailModalProps> = ({
  isOpen,
  onClose,
  auditLogId,
  initialLog,
}) => {
  const [log, setLog] = useState<AdminAuditLogResponse | null>(initialLog || null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<boolean>(false);

  useEffect(() => {
    if (!isOpen || !auditLogId) return;

    // If initialLog matches current auditLogId, use it directly
    if (initialLog && initialLog.id === auditLogId) {
      setLog(initialLog);
      return;
    }

    let isMounted = true;
    const fetchDetail = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await getAuditLogDetail(auditLogId);
        if (isMounted) setLog(res);
      } catch (err: unknown) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'Failed to retrieve audit log details');
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchDetail();
    return () => {
      isMounted = false;
    };
  }, [isOpen, auditLogId, initialLog]);

  const handleCopyJson = () => {
    if (log?.details) {
      navigator.clipboard.writeText(JSON.stringify(log.details, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Audit Log Entry Inspection" maxWidth="lg">
      <div className="space-y-4">
        {loading ? (
          <div className="p-4">
            <LoadingSkeleton variant="card" count={2} />
          </div>
        ) : error ? (
          <div className="p-4 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        ) : log ? (
          <div className="space-y-4 text-xs">
            {/* Header info bar */}
            <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-slate-50 rounded-lg border border-slate-200">
              <div className="flex items-center gap-2">
                <span className="font-mono text-slate-800 font-bold">{log.action}</span>
                <Badge variant={log.actor_role === 'admin' ? 'info' : log.actor_role === 'dentist' ? 'success' : 'neutral'}>
                  {log.actor_role || 'System'}
                </Badge>
              </div>
              <div className="text-[11px] font-mono text-slate-500">
                {new Date(log.timestamp).toISOString()}
              </div>
            </div>

            {/* Metadata Fields Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="p-3 rounded-lg border border-slate-100 bg-white space-y-1">
                <span className="text-[11px] font-semibold text-slate-500 uppercase flex items-center gap-1">
                  <User className="h-3 w-3" /> Actor Information
                </span>
                <p className="text-slate-900 font-medium">{log.actor_email || 'System / Background Service'}</p>
                {log.user_id && (
                  <p className="text-[10px] font-mono text-slate-400">User ID: {log.user_id}</p>
                )}
              </div>

              <div className="p-3 rounded-lg border border-slate-100 bg-white space-y-1">
                <span className="text-[11px] font-semibold text-slate-500 uppercase flex items-center gap-1">
                  <Activity className="h-3 w-3" /> Target Resource
                </span>
                <p className="text-slate-900 font-medium capitalize">{log.resource_type}</p>
                {log.resource_id && (
                  <p className="text-[10px] font-mono text-slate-400">Resource ID: {log.resource_id}</p>
                )}
              </div>

              <div className="p-3 rounded-lg border border-slate-100 bg-white space-y-1">
                <span className="text-[11px] font-semibold text-slate-500 uppercase flex items-center gap-1">
                  <Globe className="h-3 w-3" /> Client Network IP
                </span>
                <p className="font-mono text-slate-800 font-medium">{log.ip_address || 'Not Recorded'}</p>
              </div>

              <div className="p-3 rounded-lg border border-slate-100 bg-white space-y-1">
                <span className="text-[11px] font-semibold text-slate-500 uppercase flex items-center gap-1">
                  <Monitor className="h-3 w-3" /> Client User Agent
                </span>
                <p className="text-slate-700 text-[11px] truncate" title={log.user_agent || undefined}>
                  {log.user_agent || 'Not Available'}
                </p>
              </div>
            </div>

            {/* Redacted JSON Details Block */}
            <div className="rounded-lg border border-slate-200 overflow-hidden">
              <div className="flex items-center justify-between px-3 py-2 bg-slate-100 border-b border-slate-200">
                <div className="flex items-center gap-1.5 font-medium text-slate-700">
                  <Code className="h-3.5 w-3.5 text-slate-500" />
                  <span>Audit Context Details</span>
                </div>
                {log.details && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleCopyJson}
                    className="text-[10px] text-slate-600 hover:text-slate-900 p-1 h-auto"
                    leftIcon={copied ? Check : Copy}
                  >
                    {copied ? 'Copied' : 'Copy JSON'}
                  </Button>
                )}
              </div>
              <pre className="p-3 bg-slate-900 text-slate-100 text-[11px] font-mono max-h-56 overflow-y-auto whitespace-pre-wrap">
                {log.details ? JSON.stringify(log.details, null, 2) : '// No contextual details payload recorded'}
              </pre>
            </div>

            {/* Epistemic & Privacy Notice */}
            <div className="flex items-start gap-2 p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-[11px] text-slate-500">
              <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
              <p>
                <strong className="text-slate-700">Compliance Invariant:</strong> This entry is stored in an immutable,
                append-only PostgreSQL audit log. Authentication tokens, passwords, and private keys are scrubbed by server-side redaction.
              </p>
            </div>
          </div>
        ) : null}

        <div className="flex justify-end pt-2 border-t border-slate-100">
          <Button variant="outline" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default AuditLogDetailModal;
