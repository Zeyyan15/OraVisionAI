import { useCallback, useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { CallingState, StreamVideoClient, hasVideo, type Call, type StreamVideoParticipant } from '@stream-io/video-client';
import { api } from '../api';
import { useSession } from '../context/Session';
import { Button, Card, Notice } from './ui';
import { colors, styles } from '../theme';
import { messageOf } from '../utils/consultation';
import { mediaErrorMessage, mediaLogLevel } from '../utils/mediaErrors';
import type { ConsultationResponse } from '../types';

function Participant({ call, participant, audioOnly }: { call: Call; participant: StreamVideoParticipant; audioOnly: boolean }) {
  const video = useRef<HTMLVideoElement>(null);
  const audio = useRef<HTMLAudioElement>(null);
  const [audioBlocked, setAudioBlocked] = useState(false);
  const local = Boolean(participant.isLocalParticipant);
  useEffect(() => {
    const unbindVideo = !audioOnly && video.current ? call.bindVideoElement(video.current, participant.sessionId, 'videoTrack') : undefined;
    const untrack = !audioOnly && video.current ? call.trackElementVisibility(video.current, participant.sessionId, 'videoTrack') : undefined;
    const unbindAudio = !local && audio.current ? call.bindAudioElement(audio.current, participant.sessionId) : undefined;
    const element = audio.current;
    const blocked = () => setAudioBlocked(true);
    const playing = () => setAudioBlocked(false);
    element?.addEventListener('play', playing);
    // Some browsers require an additional click before playing remote audio.
    const timer = setTimeout(() => {
      if (element?.srcObject && element.paused) blocked();
    }, 1500);
    return () => { clearTimeout(timer); element?.removeEventListener('play', playing); unbindVideo?.(); untrack?.(); unbindAudio?.(); };
  }, [call, participant.sessionId, local, audioOnly]);
  return <View style={{ borderRadius: 12, overflow: 'hidden', backgroundColor: colors.forest, gap: 8, paddingBottom: 12 }}>
    {!audioOnly && <video ref={video} autoPlay playsInline muted aria-label={local ? 'Your camera' : `${participant.name || 'Participant'} camera`} style={{ display: hasVideo(participant) ? 'block' : 'none', width: '100%', height: 230, objectFit: 'cover', transform: local ? 'scaleX(-1)' : undefined }} />}
    {(audioOnly || !hasVideo(participant)) && <Text style={{ color: colors.white, textAlign: 'center', padding: 30 }}>{audioOnly ? 'Audio participant' : 'Camera is off'}</Text>}
    <Text style={{ color: colors.white, textAlign: 'center', fontSize: 12 }}>{participant.name || 'Participant'}{local ? ' (You)' : ''}</Text>
    {!local && <audio ref={audio} autoPlay />}
    {audioBlocked && <Button label="Play call audio" variant="outline" onPress={() => { void audio.current?.play().then(() => setAudioBlocked(false)).catch(() => setAudioBlocked(true)); }} />}
  </View>;
}

export default function LiveCall({ session }: { session: ConsultationResponse }) {
  const { profile } = useSession();
  const [call, setCall] = useState<Call | null>(null);
  const [participants, setParticipants] = useState<StreamVideoParticipant[]>([]);
  const [connection, setConnection] = useState(CallingState.IDLE);
  const [cameraOn, setCameraOn] = useState(false);
  const [micOn, setMicOn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [deviceBusy, setDeviceBusy] = useState(false);
  const [error, setError] = useState('');
  const owned = useRef<{ client: StreamVideoClient; call: Call } | null>(null);
  const generation = useRef(0);
  const joining = useRef(false);
  const audioOnly = session.consultation_type === 'audio';

  const dispose = useCallback(() => {
    generation.current++;
    const current = owned.current;
    owned.current = null;
    setCall(null); setParticipants([]); setConnection(CallingState.IDLE);
    if (current) void (async () => {
      try { if (current.call.state.callingState !== CallingState.LEFT) await current.call.leave(); }
      catch { /* Already disconnected. */ }
      finally { await current.client.disconnectUser().catch(() => undefined); }
    })();
  }, []);
  useFocusEffect(useCallback(() => () => dispose(), [dispose]));
  useEffect(() => () => dispose(), [dispose, session.id]);
  useEffect(() => {
    if (!call) return;
    const subscriptions = [
      call.state.participants$.subscribe(setParticipants),
      call.state.callingState$.subscribe(setConnection),
      call.camera.state.status$.subscribe((status) => setCameraOn(status === 'enabled')),
      call.microphone.state.status$.subscribe((status) => setMicOn(status === 'enabled')),
    ];
    return () => subscriptions.forEach((subscription) => subscription.unsubscribe());
  }, [call]);

  async function join() {
    if (joining.current || !profile) return;
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      setError('Camera and microphone require HTTPS or localhost. Open this preview on localhost, or use an HTTPS address on your phone.');
      return;
    }
    joining.current = true; setBusy(true); setError('');
    const attempt = ++generation.current;
    let client: StreamVideoClient | null = null;
    let room: Call | null = null;
    try {
      const credentials = await api.streamToken(session.id);
      if (attempt !== generation.current) return;
      client = new StreamVideoClient({
        apiKey: credentials.api_key,
        user: { id: credentials.user_id, name: `${profile.first_name} ${profile.last_name}` },
        tokenProvider: async () => (await api.streamToken(session.id)).token,
        options: {
          logOptions: {
            devices: { sink: (level, message, ...details: unknown[]) => console[mediaLogLevel(level, message, details)](message, ...details) },
          },
        },
      });
      room = client.call(credentials.call_type, credentials.call_id);
      await room.camera.disable(); await room.microphone.disable();
      await room.join({ create: true });
      if (attempt !== generation.current) { await room.leave(); await client.disconnectUser(); return; }
      owned.current = { client, call: room }; setCall(room);
      // The join button is explicit consent to start the requested call media.
      const problems: string[] = [];
      if (!audioOnly) {
        try { await room.camera.enable(); }
        catch (failure) { problems.push(mediaErrorMessage(failure, 'camera')); }
      }
      if (attempt !== generation.current) return;
      try { await room.microphone.enable(); }
      catch (failure) { problems.push(mediaErrorMessage(failure, 'microphone')); }
      if (attempt === generation.current) setError(problems.join(' '));
    } catch (failure) {
      if (room && room.state.callingState !== CallingState.LEFT) await room.leave().catch(() => undefined);
      if (client) await client.disconnectUser().catch(() => undefined);
      if (attempt === generation.current) setError(messageOf(failure));
    } finally { joining.current = false; setBusy(false); }
  }

  async function toggle(device: 'camera' | 'microphone') {
    if (!call || deviceBusy) return;
    setDeviceBusy(true); setError('');
    try {
      if (call[device].enabled) await call[device].disable({ forceStop: true });
      else await call[device].enable();
    }
    catch (failure) { setError(mediaErrorMessage(failure, device)); }
    finally { setDeviceBusy(false); }
  }

  const connected = connection === CallingState.JOINED;
  return <Card><Text style={styles.heading}>Live {audioOnly ? 'audio' : 'video'} consultation</Text>
    {!!error && <Notice error message={error} />}
    {call ? <>
      <Text style={styles.caption}>{connected ? 'Call connected' : `Call ${connection.replace(/-/g, ' ')}`}</Text>
      {participants.map((participant) => <Participant key={participant.sessionId} call={call} participant={participant} audioOnly={audioOnly} />)}
      {connected && !participants.some((participant) => !participant.isLocalParticipant) && <Notice message="Waiting for the other person. They need to open this same consultation and join the call." />}
      {!audioOnly && <Button label={cameraOn ? 'Turn off camera' : 'Turn on camera'} icon="video" variant="outline" disabled={deviceBusy || !connected} onPress={() => void toggle('camera')} />}
      <Button label={micOn ? 'Mute microphone' : 'Turn on microphone'} icon="mic" variant="outline" disabled={deviceBusy || !connected} onPress={() => void toggle('microphone')} />
      <Button label="Leave call" variant="danger" onPress={dispose} />
    </> : <>
      <Text style={styles.body}>Join this consultation to connect with the other person. Your browser will ask for {audioOnly ? 'microphone' : 'camera and microphone'} access.</Text>
      <Button label={audioOnly ? 'Join audio call' : 'Join video call'} icon="phone" loading={busy} onPress={() => void join()} />
    </>}
    <Text style={styles.caption}>Leaving the call keeps the consultation open. Your practitioner concludes the session separately.</Text>
  </Card>;
}
