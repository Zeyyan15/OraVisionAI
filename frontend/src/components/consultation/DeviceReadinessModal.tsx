/**
 * OraVisionAI — Local Device Readiness Modal (Phase 25)
 *
 * Provides client-side hardware verification using native HTML5 getUserMedia:
 * - Verifies local camera access with live video mirror
 * - Verifies microphone input with live audio level indicator
 * - Stops and cleans up all media tracks upon modal close
 */

import React, { useState, useEffect, useRef } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Camera, Mic, CheckCircle, AlertCircle, RefreshCw } from 'lucide-react';

interface DeviceReadinessModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DeviceReadinessModal: React.FC<DeviceReadinessModalProps> = ({
  isOpen,
  onClose,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const [cameraStatus, setCameraStatus] = useState<'checking' | 'ready' | 'error'>('checking');
  const [micStatus, setMicStatus] = useState<'checking' | 'ready' | 'error'>('checking');
  const [audioLevel, setAudioLevel] = useState<number>(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const stopMediaTracks = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        track.stop();
      });
      streamRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
  };

  const startDeviceCheck = async () => {
    stopMediaTracks();
    setCameraStatus('checking');
    setMicStatus('checking');
    setErrorMessage(null);

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Media devices API is not supported in this browser.');
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 } },
        audio: true,
      });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setCameraStatus('ready');
      setMicStatus('ready');

      // Setup audio level analyser
      try {
        const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (AudioContextClass) {
          const audioCtx = new AudioContextClass();
          audioContextRef.current = audioCtx;
          const analyser = audioCtx.createAnalyser();
          const source = audioCtx.createMediaStreamSource(stream);
          source.connect(analyser);
          analyser.fftSize = 64;
          const dataArray = new Uint8Array(analyser.frequencyBinCount);

          const updateMeter = () => {
            if (!streamRef.current || audioCtx.state === 'closed') return;
            analyser.getByteFrequencyData(dataArray);
            let sum = 0;
            for (let i = 0; i < dataArray.length; i++) {
              sum += dataArray[i];
            }
            const avg = sum / dataArray.length;
            setAudioLevel(Math.min(100, Math.round((avg / 128) * 100)));
            requestAnimationFrame(updateMeter);
          };
          updateMeter();
        }
      } catch {
        // AudioContext fallback
      }
    } catch (err: unknown) {
      const e = err as Error;
      setCameraStatus('error');
      setMicStatus('error');
      setErrorMessage(e.message || 'Permission denied or no audio/video device detected.');
    }
  };

  useEffect(() => {
    if (isOpen) {
      startDeviceCheck();
    } else {
      stopMediaTracks();
    }
    return () => {
      stopMediaTracks();
    };
  }, [isOpen]);

  const handleClose = () => {
    stopMediaTracks();
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Hardware Readiness Verification"
      maxWidth="md"
    >
      <div className="space-y-4 py-2">
        {/* Local Video Mirror */}
        <div className="relative w-full aspect-video bg-slate-900 rounded-xl overflow-hidden border border-slate-700 flex items-center justify-center">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className={`w-full h-full object-cover scale-x-[-1] ${cameraStatus === 'ready' ? 'block' : 'hidden'}`}
          />
          {cameraStatus !== 'ready' && (
            <div className="text-center text-slate-400 p-4 space-y-2">
              <Camera className="h-10 w-10 mx-auto text-slate-600 animate-pulse" />
              <p className="text-xs">
                {cameraStatus === 'checking' ? 'Connecting to local camera...' : 'Camera unavailable or permission denied'}
              </p>
            </div>
          )}
        </div>

        {/* Device Status Pills */}
        <div className="grid grid-cols-2 gap-3">
          {/* Camera Status */}
          <div className="flex items-center space-x-3 p-3 bg-slate-50 border border-slate-200 rounded-lg">
            <Camera className="h-5 w-5 text-slate-600" />
            <div className="text-xs">
              <p className="font-medium text-slate-700">Webcam</p>
              <div className="flex items-center space-x-1 mt-0.5">
                {cameraStatus === 'ready' ? (
                  <>
                    <CheckCircle className="h-3.5 w-3.5 text-emerald-600" />
                    <span className="text-emerald-700 font-medium">Detected</span>
                  </>
                ) : cameraStatus === 'checking' ? (
                  <span className="text-slate-500">Testing...</span>
                ) : (
                  <>
                    <AlertCircle className="h-3.5 w-3.5 text-red-600" />
                    <span className="text-red-600 font-medium">Unavailable</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Microphone Status */}
          <div className="flex items-center space-x-3 p-3 bg-slate-50 border border-slate-200 rounded-lg">
            <Mic className="h-5 w-5 text-slate-600" />
            <div className="text-xs flex-1">
              <p className="font-medium text-slate-700">Microphone</p>
              <div className="flex items-center space-x-1 mt-0.5">
                {micStatus === 'ready' ? (
                  <>
                    <CheckCircle className="h-3.5 w-3.5 text-emerald-600" />
                    <span className="text-emerald-700 font-medium">Ready</span>
                  </>
                ) : micStatus === 'checking' ? (
                  <span className="text-slate-500">Testing...</span>
                ) : (
                  <>
                    <AlertCircle className="h-3.5 w-3.5 text-red-600" />
                    <span className="text-red-600 font-medium">Unavailable</span>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Live Audio Level Meter */}
        {micStatus === 'ready' && (
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-1.5">
            <div className="flex justify-between text-xs text-slate-600">
              <span>Microphone Volume Level</span>
              <span className="font-mono">{audioLevel}%</span>
            </div>
            <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
              <div
                className="bg-emerald-500 h-full transition-all duration-75"
                style={{ width: `${audioLevel}%` }}
              />
            </div>
          </div>
        )}

        {/* Error message notice */}
        {errorMessage && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-800 text-xs flex items-start space-x-2">
            <AlertCircle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}

        <div className="flex justify-between pt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={startDeviceCheck}
            className="flex items-center space-x-1.5 text-xs"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>Retest Devices</span>
          </Button>

          <Button variant="primary" size="sm" onClick={handleClose}>
            Done
          </Button>
        </div>
      </div>
    </Modal>
  );
};
