/**
 * OraVisionAI — Stream Video Teleconsultation Container (Phase 33)
 *
 * Implements real two-way audio/video teleconsultation using the official Stream Video React SDK:
 * - Deterministic Call ID: default:oravisionai-consultation-{consultation_id}
 * - Server-backed tokenProvider for backend-generated token refresh
 * - Single StreamVideoClient instance per session with clean disposal
 * - Professional Pre-Join screen with device previews & permission handling
 * - Live two-way video/audio stage distinguishing local and remote participants
 * - Non-destructive leave flow preserving OraVisionAI consultation & appointment states
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import '@stream-io/video-react-sdk/dist/css/styles.css';
import {
  StreamVideoClient,
  StreamVideo,
  StreamCall,
  StreamTheme,
  VideoPreview,
  ParticipantView,
  CallingState,
  useCallStateHooks,
  useCall,
  Call,
} from '@stream-io/video-react-sdk';
import { ConsultationResponse } from '../../types/consultation';
import { getConsultationStreamToken } from '../../api/consultations';
import { useAuth } from '../../hooks/useAuth';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  PhoneOff,
  PhoneCall,
  AlertTriangle,
  RefreshCw,
  Shield,
  Loader2,
} from 'lucide-react';
import { formatAppointmentDateTime } from '../../utils/dateTimeUtils';

// =============================================================================
// Pre-Join Lobby Component
// =============================================================================

interface PreJoinLobbyProps {
  consultation: ConsultationResponse;
  isDentist: boolean;
  onJoin: () => Promise<void>;
  joining: boolean;
}

const PreJoinLobby: React.FC<PreJoinLobbyProps> = ({
  consultation,
  isDentist,
  onJoin,
  joining,
}) => {
  const call = useCall();
  const { useCameraState, useMicrophoneState } = useCallStateHooks();
  const { isMute: isCameraMute, hasBrowserPermission: hasCameraPermission } = useCameraState();
  const { isMute: isMicMute, hasBrowserPermission: hasMicPermission } = useMicrophoneState();

  const toggleMic = async () => {
    if (!call) return;
    try {
      await call.microphone.toggle();
    } catch {
      // Handled by SDK state
    }
  };

  const toggleCamera = async () => {
    if (!call) return;
    try {
      await call.camera.toggle();
    } catch {
      // Handled by SDK state
    }
  };

  const otherRoleTitle = isDentist ? 'Patient' : 'Treating Dentist';
  const otherParticipantName = isDentist
    ? consultation.patient_name || 'Assigned Patient'
    : consultation.dentist_name || 'Dr. Practitioner';

  return (
    <div className="flex flex-col space-y-4">
      {/* Session Context Header */}
      <div className="bg-slate-900 text-white p-5 rounded-2xl border border-slate-800 shadow-md">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-sky-400">
                Live Video Teleconsultation Lobby
              </span>
              <Badge variant="info">Ready to Connect</Badge>
            </div>
            <h3 className="text-lg font-bold mt-1 text-slate-100">
              Consultation with {otherParticipantName}
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              {consultation.clinic_name ? `${consultation.clinic_name} • ` : ''}
              {consultation.scheduled_start
                ? formatAppointmentDateTime(consultation.scheduled_start)
                : 'Confirmed Appointment'}
            </p>
          </div>

          <div className="flex items-center space-x-2 text-xs text-slate-400 bg-slate-800/80 px-3 py-1.5 rounded-lg border border-slate-700">
            <Shield className="h-4 w-4 text-emerald-400 shrink-0" />
            <span>Encrypted Stream Media Channel</span>
          </div>
        </div>
      </div>

      {/* Permission Warnings */}
      {hasCameraPermission === false && (
        <div className="flex items-start space-x-3 p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-xs">
          <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">Camera Access Restricted</p>
            <p className="text-amber-800 mt-0.5">
              Your browser has blocked camera permissions. Click the lock or camera icon in your browser address bar to allow camera access for this session.
            </p>
          </div>
        </div>
      )}

      {hasMicPermission === false && (
        <div className="flex items-start space-x-3 p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-xs">
          <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">Microphone Access Restricted</p>
            <p className="text-amber-800 mt-0.5">
              Your browser has blocked microphone permissions. Please enable microphone access to allow two-way clinical communication.
            </p>
          </div>
        </div>
      )}

      {/* Media Preview Stage & Join Controls */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Camera Preview Tile (2 Cols) */}
        <div className="md:col-span-2 relative aspect-video bg-slate-950 rounded-2xl overflow-hidden border border-slate-800 shadow-inner flex items-center justify-center">
          <VideoPreview className="w-full h-full object-cover" />

          {/* Device Controls Floating Overlay */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center space-x-3 bg-slate-900/90 backdrop-blur-md px-4 py-2 rounded-full border border-slate-700 shadow-lg z-20">
            <button
              type="button"
              onClick={toggleMic}
              className={`p-2.5 rounded-full transition-colors ${
                isMicMute
                  ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                  : 'bg-slate-700 text-white hover:bg-slate-600'
              }`}
              title={isMicMute ? 'Unmute Microphone' : 'Mute Microphone'}
            >
              {isMicMute ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
            </button>

            <button
              type="button"
              onClick={toggleCamera}
              className={`p-2.5 rounded-full transition-colors ${
                isCameraMute
                  ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                  : 'bg-slate-700 text-white hover:bg-slate-600'
              }`}
              title={isCameraMute ? 'Turn Camera On' : 'Turn Camera Off'}
            >
              {isCameraMute ? <VideoOff className="h-4 w-4" /> : <Video className="h-4 w-4" />}
            </button>
          </div>

          <div className="absolute top-3 left-3 bg-black/50 backdrop-blur-sm text-white/90 text-xs px-2.5 py-1 rounded-md border border-white/10">
            Hardware Self-Preview
          </div>
        </div>

        {/* Readiness Checklist & Join Action (1 Col) */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between space-y-4">
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-slate-800">Connection Checklist</h4>
            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between p-2.5 bg-slate-50 rounded-lg">
                <span className="text-slate-600">Camera</span>
                <span className={`font-semibold ${!isCameraMute ? 'text-emerald-600' : 'text-slate-500'}`}>
                  {!isCameraMute ? 'Active' : 'Disabled'}
                </span>
              </div>
              <div className="flex items-center justify-between p-2.5 bg-slate-50 rounded-lg">
                <span className="text-slate-600">Microphone</span>
                <span className={`font-semibold ${!isMicMute ? 'text-emerald-600' : 'text-slate-500'}`}>
                  {!isMicMute ? 'Active' : 'Muted'}
                </span>
              </div>
              <div className="flex items-center justify-between p-2.5 bg-slate-50 rounded-lg">
                <span className="text-slate-600">{otherRoleTitle}</span>
                <span className="font-semibold text-slate-800 truncate max-w-[130px]" title={otherParticipantName}>
                  {otherParticipantName}
                </span>
              </div>
            </div>
          </div>

          <div className="space-y-2 pt-2 border-t border-slate-100">
            <Button
              variant="primary"
              size="lg"
              className="w-full flex items-center justify-center space-x-2 py-3 bg-clinical-600 hover:bg-clinical-700 text-white font-medium shadow-md shadow-clinical-600/20"
              onClick={onJoin}
              loading={joining}
              disabled={joining}
            >
              <PhoneCall className="h-4 w-4" />
              <span>{joining ? 'Connecting to Call...' : 'Join Consultation'}</span>
            </Button>
            <p className="text-[11px] text-slate-400 text-center leading-tight">
              Media will be shared directly with the authorized session participant.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

// =============================================================================
// Live Consultation Stage Component
// =============================================================================

interface LiveConsultationStageProps {
  consultation: ConsultationResponse;
  isDentist: boolean;
  onLeaveCall: () => Promise<void>;
}

const LiveConsultationStage: React.FC<LiveConsultationStageProps> = ({
  consultation,
  isDentist,
  onLeaveCall,
}) => {
  const call = useCall();
  const {
    useCameraState,
    useMicrophoneState,
    useCallCallingState,
    useLocalParticipant,
    useRemoteParticipants,
  } = useCallStateHooks();

  const callingState = useCallCallingState();
  const localParticipant = useLocalParticipant();
  const remoteParticipants = useRemoteParticipants();

  const { isMute: isCameraMute } = useCameraState();
  const { isMute: isMicMute } = useMicrophoneState();
  const [leaving, setLeaving] = useState<boolean>(false);

  const toggleMic = async () => {
    if (!call) return;
    try {
      await call.microphone.toggle();
    } catch {
      // SDK updates state
    }
  };

  const toggleCamera = async () => {
    if (!call) return;
    try {
      await call.camera.toggle();
    } catch {
      // SDK updates state
    }
  };

  const handleLeave = async () => {
    setLeaving(true);
    try {
      await onLeaveCall();
    } finally {
      setLeaving(false);
    }
  };

  const otherParticipantName = isDentist
    ? consultation.patient_name || 'Patient'
    : consultation.dentist_name || 'Dr. Practitioner';

  const remoteParticipant = remoteParticipants.length > 0 ? remoteParticipants[0] : null;

  return (
    <div className="relative w-full aspect-video bg-slate-950 rounded-2xl overflow-hidden border border-slate-800 shadow-2xl flex flex-col justify-between">
      {/* Top Banner Overlay */}
      <div className="absolute top-3 left-3 right-3 flex items-center justify-between z-20 pointer-events-none">
        <div className="flex items-center space-x-2 bg-slate-900/80 backdrop-blur-md px-3 py-1.5 rounded-lg border border-slate-700 text-xs text-white">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="font-medium">Teleconsultation Active</span>
        </div>

        {callingState === CallingState.RECONNECTING && (
          <div className="flex items-center space-x-1.5 bg-amber-500/90 text-slate-950 px-3 py-1 rounded-md text-xs font-semibold animate-pulse">
            <RefreshCw className="h-3.5 w-3.5 animate-spin" />
            <span>Reconnecting...</span>
          </div>
        )}

        <div className="text-xs bg-slate-900/80 backdrop-blur-md px-3 py-1.5 rounded-lg border border-slate-700 text-slate-300">
          {consultation.clinic_name || 'OraVision Clinical Telehealth'}
        </div>
      </div>

      {/* Main Video Surface */}
      <div className="relative w-full h-full flex items-center justify-center">
        {remoteParticipant ? (
          <div className="w-full h-full relative">
            <ParticipantView
              participant={remoteParticipant}
              className="w-full h-full object-cover"
            />
            <div className="absolute bottom-4 left-4 z-10 bg-black/60 backdrop-blur-md px-3 py-1 rounded-md text-xs text-white border border-white/10 font-medium">
              {otherParticipantName}
            </div>
          </div>
        ) : (
          /* Waiting State When Counterpart Has Not Joined Yet */
          <div className="flex flex-col items-center justify-center p-8 text-center space-y-3 z-10">
            <div className="w-16 h-16 rounded-full bg-slate-800/80 border border-slate-700 flex items-center justify-center text-sky-400">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
            <div>
              <h4 className="text-base font-semibold text-slate-200">
                Waiting for {otherParticipantName} to join
              </h4>
              <p className="text-xs text-slate-400 max-w-sm mt-1 leading-relaxed">
                You are connected to the consultation call. Once the counterpart enters the room, their live audio and video will appear here automatically.
              </p>
            </div>
          </div>
        )}

        {/* Local Participant Picture-In-Picture */}
        {localParticipant && (
          <div className="absolute bottom-20 right-4 w-44 sm:w-56 aspect-video bg-slate-900 rounded-xl overflow-hidden border-2 border-slate-700 shadow-2xl z-20">
            <ParticipantView
              participant={localParticipant}
              className="w-full h-full object-cover"
            />
            <div className="absolute bottom-1.5 left-1.5 bg-black/60 backdrop-blur-sm px-2 py-0.5 rounded text-[10px] text-white/90">
              You ({isDentist ? 'Dentist' : 'Patient'})
            </div>
          </div>
        )}
      </div>

      {/* Floating Call Action Controls */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center space-x-3 bg-slate-900/90 backdrop-blur-md px-5 py-2.5 rounded-full border border-slate-700 shadow-2xl z-30">
        {/* Microphone Toggle */}
        <button
          type="button"
          onClick={toggleMic}
          className={`p-3 rounded-full transition-colors flex items-center justify-center ${
            isMicMute
              ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
              : 'bg-slate-800 text-white hover:bg-slate-700'
          }`}
          title={isMicMute ? 'Unmute Microphone' : 'Mute Microphone'}
        >
          {isMicMute ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
        </button>

        {/* Camera Toggle */}
        <button
          type="button"
          onClick={toggleCamera}
          className={`p-3 rounded-full transition-colors flex items-center justify-center ${
            isCameraMute
              ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
              : 'bg-slate-800 text-white hover:bg-slate-700'
          }`}
          title={isCameraMute ? 'Turn Camera On' : 'Turn Camera Off'}
        >
          {isCameraMute ? <VideoOff className="h-5 w-5" /> : <Video className="h-5 w-5" />}
        </button>

        <div className="h-6 w-px bg-slate-700 mx-1" />

        {/* Leave Consultation Call Button */}
        <button
          type="button"
          onClick={handleLeave}
          disabled={leaving}
          className="flex items-center space-x-2 px-4 py-2.5 rounded-full bg-red-600 hover:bg-red-700 text-white font-medium text-xs shadow-md transition-colors"
          title="Leave consultation room"
        >
          <PhoneOff className="h-4 w-4" />
          <span>{leaving ? 'Leaving...' : 'Leave Call'}</span>
        </button>
      </div>
    </div>
  );
};

// =============================================================================
// Primary Stream Video Teleconsultation Container
// =============================================================================

export interface StreamVideoContainerProps {
  consultation: ConsultationResponse;
  isDentist: boolean;
  onLeave?: () => void;
}

export const StreamVideoContainer: React.FC<StreamVideoContainerProps> = ({
  consultation,
  isDentist,
  onLeave,
}) => {
  const { userProfile } = useAuth();

  const [client, setClient] = useState<StreamVideoClient | null>(null);
  const [call, setCall] = useState<Call | null>(null);
  const [isJoined, setIsJoined] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [joining, setJoining] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const clientRef = useRef<StreamVideoClient | null>(null);
  const callRef = useRef<Call | null>(null);

  // Initialize Stream Video Client and Call instance
  const initStream = useCallback(async () => {
    if (!consultation?.id) return;
    setLoading(true);
    setError(null);

    try {
      // 1. Obtain authoritative, short-lived token from OraVisionAI backend
      const tokenResp = await getConsultationStreamToken(consultation.id);

      // 2. Format user display identity (strictly non-PHI)
      const displayName = isDentist
        ? `Dr. ${userProfile?.first_name || ''} ${userProfile?.last_name || ''}`.trim() || 'Dr. Practitioner'
        : `${userProfile?.first_name || ''} ${userProfile?.last_name || ''}`.trim() || 'Patient';

      const streamUser = {
        id: tokenResp.user_id,
        name: displayName,
        image: userProfile?.avatar_url || undefined,
      };

      // 3. Initialize single StreamVideoClient instance
      const videoClient = new StreamVideoClient({
        apiKey: tokenResp.api_key,
        user: streamUser,
        tokenProvider: async () => {
          const fresh = await getConsultationStreamToken(consultation.id);
          return fresh.token;
        },
      });

      clientRef.current = videoClient;
      setClient(videoClient);

      // 4. Initialize deterministic Call instance (call_type: default)
      const callInstance = videoClient.call(
        tokenResp.call_type || 'default',
        tokenResp.call_id
      );

      // Pre-warm the call room without joining yet
      await callInstance.getOrCreate();

      // Pre-enable devices for pre-join lobby preview with graceful error handling
      try {
        await callInstance.camera.enable();
      } catch {
        // Handled via permission state
      }

      try {
        await callInstance.microphone.enable();
      } catch {
        // Handled via permission state
      }

      callRef.current = callInstance;
      setCall(callInstance);
    } catch (err: unknown) {
      const e = err as Error;
      setError(e.message || 'Failed to initialize teleconsultation media session.');
    } finally {
      setLoading(false);
    }
  }, [consultation?.id, isDentist, userProfile]);

  useEffect(() => {
    initStream();

    // Clean up on component unmount
    return () => {
      if (callRef.current) {
        callRef.current.leave().catch(() => {});
        callRef.current = null;
      }
      if (clientRef.current) {
        clientRef.current.disconnectUser().catch(() => {});
        clientRef.current = null;
      }
    };
  }, [initStream]);

  // Join Call handler
  const handleJoinCall = async () => {
    if (!callRef.current) return;
    setJoining(true);
    try {
      await callRef.current.join({ create: true });
      setIsJoined(true);
    } catch (err: unknown) {
      const e = err as Error;
      setError(e.message || 'Failed to connect to consultation call.');
    } finally {
      setJoining(false);
    }
  };

  // Leave Call handler
  const handleLeaveCall = async () => {
    if (callRef.current) {
      try {
        await callRef.current.leave();
      } catch {
        // Ignore leave errors
      }
    }
    setIsJoined(false);
    if (onLeave) {
      onLeave();
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="w-full aspect-video bg-slate-900 rounded-2xl border border-slate-800 flex flex-col items-center justify-center text-center p-6 space-y-3">
        <Loader2 className="h-8 w-8 text-sky-400 animate-spin" />
        <div>
          <h4 className="text-sm font-semibold text-slate-200">Connecting to Teleconsultation Gateway</h4>
          <p className="text-xs text-slate-400 mt-1">Authenticating Stream media channel...</p>
        </div>
      </div>
    );
  }

  // Error state with retry
  if (error || !client || !call) {
    return (
      <div className="w-full aspect-video bg-slate-900 rounded-2xl border border-slate-800 flex flex-col items-center justify-center text-center p-6 space-y-3">
        <div className="p-3 bg-red-500/20 text-red-400 rounded-full">
          <AlertTriangle className="h-6 w-6" />
        </div>
        <div>
          <h4 className="text-sm font-semibold text-slate-200">Video Gateway Unavailable</h4>
          <p className="text-xs text-red-300 mt-1 max-w-md">{error || 'Could not connect to Stream media.'}</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={initStream}
          className="border-slate-700 text-slate-200 hover:bg-slate-800 text-xs flex items-center space-x-1.5 mt-2"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          <span>Retry Connection</span>
        </Button>
      </div>
    );
  }

  return (
    <StreamVideo client={client}>
      <StreamTheme>
        <StreamCall call={call}>
          {!isJoined ? (
            <PreJoinLobby
              consultation={consultation}
              isDentist={isDentist}
              onJoin={handleJoinCall}
              joining={joining}
            />
          ) : (
            <LiveConsultationStage
              consultation={consultation}
              isDentist={isDentist}
              onLeaveCall={handleLeaveCall}
            />
          )}
        </StreamCall>
      </StreamTheme>
    </StreamVideo>
  );
};
