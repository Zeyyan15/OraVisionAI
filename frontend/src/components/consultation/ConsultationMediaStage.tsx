/**
 * OraVisionAI — Teleconsultation Media Stage (Phase 25)
 *
 * Provides the clinical visual container for consultation sessions, displaying:
 * - Real-time session status badges (scheduled, active, ended, failed)
 * - Honest media integration disclosure banner (Stream gateway boundary)
 * - Elapsed session timer synchronized via parent hook
 * - Participant identification (Patient & Approved Dentist)
 * - Device readiness test launcher
 */

import React from 'react';
import { ConsultationResponse } from '../../types/consultation';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import {
  Video,
  Mic,
  MessageSquare,
  Clock,
  Shield,
  VideoOff,
  Settings,
  User,
  Building,
} from 'lucide-react';

interface ConsultationMediaStageProps {
  consultation: ConsultationResponse;
  elapsedSeconds: number;
  onOpenDeviceCheck: () => void;
  isDentist?: boolean;
}

export const ConsultationMediaStage: React.FC<ConsultationMediaStageProps> = ({
  consultation,
  elapsedSeconds,
  onOpenDeviceCheck,
  isDentist = false,
}) => {
  const formatDuration = (secs: number) => {
    const hrs = Math.floor(secs / 3600);
    const mins = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    if (hrs > 0) {
      return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }
    return `${mins.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const getStatusBadge = () => {
    switch (consultation.session_status) {
      case 'active':
        return <Badge variant="success">Session Active</Badge>;
      case 'scheduled':
        return <Badge variant="info">Consultation Scheduled</Badge>;
      case 'ended':
        return <Badge variant="neutral">Consultation Concluded</Badge>;
      case 'failed':
        return <Badge variant="danger">Session Closed</Badge>;
      default:
        return <Badge variant="neutral">{consultation.session_status}</Badge>;
    }
  };

  const getModalityIcon = () => {
    switch (consultation.consultation_type) {
      case 'video':
        return <Video className="h-4 w-4 text-blue-600" />;
      case 'audio':
        return <Mic className="h-4 w-4 text-emerald-600" />;
      case 'chat':
        return <MessageSquare className="h-4 w-4 text-purple-600" />;
      default:
        return <Video className="h-4 w-4 text-slate-600" />;
    }
  };

  return (
    <div className="flex flex-col space-y-4">
      {/* Session Top Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-slate-100 rounded-lg">
            {getModalityIcon()}
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-lg font-semibold text-slate-800 capitalize">
                {consultation.consultation_type} Teleconsultation
              </h2>
              {getStatusBadge()}
            </div>
            <p className="text-xs text-slate-500">
              {consultation.clinic_name ? `${consultation.clinic_name} • ` : ''}
              Ref: {consultation.stream_call_id.substring(0, 16)}...
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          {/* Duration Timer */}
          <div className="flex items-center space-x-1.5 px-3 py-1.5 bg-slate-100 rounded-lg text-slate-700 font-mono text-sm">
            <Clock className="h-4 w-4 text-slate-500" />
            <span>{formatDuration(elapsedSeconds)}</span>
          </div>

          {/* Device Readiness Tool */}
          <Button
            variant="outline"
            size="sm"
            onClick={onOpenDeviceCheck}
            className="flex items-center space-x-1.5 text-xs"
          >
            <Settings className="h-3.5 w-3.5" />
            <span>Device Check</span>
          </Button>
        </div>
      </div>

      {/* Honest Media Status Disclosure Banner */}
      <div className="flex items-start space-x-3 p-3.5 bg-sky-50 border border-sky-200 rounded-xl text-sky-900 text-xs leading-relaxed">
        <Shield className="h-4 w-4 text-sky-600 shrink-0 mt-0.5" />
        <div>
          <span className="font-semibold">Media Architecture Notice: </span>
          {consultation.session_status === 'active' ? (
            <span>
              Consultation Session Active — Live media streaming gateway pending Stream backend infrastructure authorization.
              Audio/video transport relies on local hardware readiness verification and direct clinical communication.
            </span>
          ) : consultation.session_status === 'scheduled' ? (
            <span>
              Consultation Scheduled — Waiting for practitioner to initiate session. Live media streaming gateway pending Stream backend infrastructure authorization.
            </span>
          ) : consultation.session_status === 'ended' ? (
            <span>
              Consultation Concluded — Session ended and clinical summary recorded to appointment documentation.
            </span>
          ) : (
            <span>
              Consultation Session Closed — This session has been cancelled or marked as failed.
            </span>
          )}
        </div>
      </div>

      {/* Video / Media Stage Frame */}
      <div className="relative w-full aspect-video bg-slate-900 rounded-2xl overflow-hidden border border-slate-800 shadow-inner flex flex-col justify-between p-6">
        {/* Top Controls Overlay */}
        <div className="flex items-center justify-between text-white/80 z-10">
          <div className="flex items-center space-x-2 bg-black/40 backdrop-blur-md px-3 py-1.5 rounded-lg text-xs">
            <div className={`w-2 h-2 rounded-full ${consultation.session_status === 'active' ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
            <span>{consultation.session_status === 'active' ? 'Room Active' : 'Waiting Room'}</span>
          </div>

          <div className="text-xs bg-black/40 backdrop-blur-md px-3 py-1.5 rounded-lg">
            Privacy-Focused & Authorization-Enforced
          </div>
        </div>

        {/* Center Stage Presentation */}
        <div className="flex flex-col items-center justify-center my-auto text-center space-y-4">
          <div className="w-20 h-20 rounded-full bg-slate-800 border-2 border-slate-700 flex items-center justify-center shadow-xl">
            {consultation.session_status === 'active' ? (
              <Video className="h-9 w-9 text-emerald-400" />
            ) : consultation.session_status === 'scheduled' ? (
              <Clock className="h-9 w-9 text-sky-400 animate-pulse" />
            ) : (
              <VideoOff className="h-9 w-9 text-slate-500" />
            )}
          </div>

          <div className="max-w-md space-y-1.5">
            <h3 className="text-white font-medium text-base">
              {consultation.session_status === 'active'
                ? 'Clinical Evaluation in Progress'
                : consultation.session_status === 'scheduled'
                ? (isDentist ? 'Ready to Begin Consultation' : 'Waiting for Dental Practitioner')
                : 'Session Terminated'}
            </h3>
            <p className="text-slate-400 text-xs">
              {consultation.session_status === 'active'
                ? 'Active consultation room. Treating dentist may review oral screening images and document clinical findings.'
                : consultation.session_status === 'scheduled'
                ? (isDentist
                    ? 'Review the attached clinical diagnostic panel and click Start Consultation when ready.'
                    : 'Your treating dentist will initiate the consultation session shortly. Please remain on this page.')
                : 'This teleconsultation session has ended. Clinical records are preserved in the patient chart.'}
            </p>
          </div>
        </div>

        {/* Bottom Participant Badges */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 z-10">
          {/* Patient Card */}
          <div className="flex items-center space-x-3 bg-black/50 backdrop-blur-md p-3 rounded-xl border border-white/10 text-white">
            <div className="w-8 h-8 rounded-full bg-indigo-600/80 flex items-center justify-center text-xs font-semibold">
              <User className="h-4 w-4" />
            </div>
            <div className="text-xs overflow-hidden">
              <p className="font-medium truncate">{consultation.patient_name || 'Patient'}</p>
              <p className="text-slate-400 text-[11px]">Patient Participant</p>
            </div>
          </div>

          {/* Dentist Card */}
          <div className="flex items-center space-x-3 bg-black/50 backdrop-blur-md p-3 rounded-xl border border-white/10 text-white">
            <div className="w-8 h-8 rounded-full bg-emerald-600/80 flex items-center justify-center text-xs font-semibold">
              <Building className="h-4 w-4" />
            </div>
            <div className="text-xs overflow-hidden">
              <div className="flex items-center space-x-1.5">
                <p className="font-medium truncate">{consultation.dentist_name || 'Treating Dentist'}</p>
                <span className="px-1.5 py-0.5 bg-emerald-950 text-emerald-300 rounded text-[10px] font-medium">
                  Approved Dentist
                </span>
              </div>
              <p className="text-slate-400 text-[11px] truncate">{consultation.clinic_name || 'Dental Practitioner'}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
