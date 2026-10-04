import { useCallback, useRef, useState } from 'react';
import { PermissionsAndroid, Platform, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { CallContent, StreamCall, StreamVideo, StreamVideoClient, ToggleAudioPublishingButton, HangUpCallButton, type Call, type CallControlProps } from '@stream-io/video-react-native-sdk';
import { api } from '../api';
import { useSession } from '../context/Session';
import { Button, Card, Notice } from './ui';
import { messageOf } from '../utils/consultation';
import { colors, styles } from '../theme';
import type { ConsultationResponse } from '../types';

function AudioControls({ onHangupCallHandler }: CallControlProps) {
  return <View style={{flexDirection:'row',justifyContent:'space-evenly',padding:16}}><ToggleAudioPublishingButton /><HangUpCallButton onHangupCallHandler={onHangupCallHandler} /></View>;
}

export default function LiveCall({ session }: { session: ConsultationResponse }) {
  const { profile } = useSession(); const [client, setClient] = useState<StreamVideoClient | null>(null);
  const [call, setCall] = useState<Call | null>(null); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const owned = useRef<{ client: StreamVideoClient; call: Call } | null>(null); const generation = useRef(0); const joining = useRef(false);
  const dispose = useCallback(() => {
    generation.current++; const current = owned.current; owned.current = null;
    setCall(null); setClient(null);
    if (current) void (async () => { try { await current.call.leave(); } catch { /* Already disconnected. */ } finally { await current.client.disconnectUser().catch(() => undefined); } })();
  }, []);
  useFocusEffect(useCallback(() => () => dispose(), [dispose]));
  async function join() {
    if (joining.current || !profile) return;
    joining.current = true; setBusy(true); setError(''); const attempt = ++generation.current;
    let next: StreamVideoClient | null = null; let room: Call | null = null;
    try {
      if (Platform.OS === 'android') {
        const permissions = [PermissionsAndroid.PERMISSIONS.RECORD_AUDIO, ...(session.consultation_type === 'video' ? [PermissionsAndroid.PERMISSIONS.CAMERA] : [])];
        const result = await PermissionsAndroid.requestMultiple(permissions);
        if (permissions.some((p) => result[p] !== 'granted')) throw new Error('Allow microphone and camera access in Settings to join this consultation.');
        if (Number(Platform.Version) >= 31) await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT);
      }
      const credentials = await api.streamToken(session.id);
      if (attempt !== generation.current) return;
      next = new StreamVideoClient({ apiKey: credentials.api_key, user: { id: credentials.user_id, name: `${profile.first_name} ${profile.last_name}` }, tokenProvider: async () => (await api.streamToken(session.id)).token });
      room = next.call(credentials.call_type, credentials.call_id);
      // Both participants use the same backend-issued room ID. Create it if neither has joined yet.
      await room.getOrCreate();
      await room.camera.disable(); await room.microphone.disable();
      await room.join({ create: false });
      if (attempt !== generation.current) { await room.leave(); await next.disconnectUser(); return; }
      owned.current = { client: next, call: room }; setClient(next); setCall(room);
    } catch (e) {
      if (room) await room.leave().catch(() => undefined);
      if (next) await next.disconnectUser().catch(() => undefined);
      if (attempt === generation.current) setError(messageOf(e));
    } finally { joining.current = false; setBusy(false); }
  }
  return <Card><Text style={styles.heading}>Live consultation</Text>{!!(error) && <Notice error message={error} />}
    {client && call ? <><View style={{ height: 430, borderRadius: 14, overflow: 'hidden' }}><StreamVideo client={client} style={{callContent:{container:{backgroundColor:colors.forest}},callControls:{container:{backgroundColor:colors.forest}}}}><StreamCall call={call}><CallContent CallControls={session.consultation_type === 'audio' ? AudioControls : undefined} onHangupCallHandler={(e) => { if (e) setError(messageOf(e)); else dispose(); }} /></StreamCall></StreamVideo></View><Button label="Leave call" variant="danger" onPress={dispose} /></> : <><Text style={styles.body}>Join with camera and microphone off. Enable them using the call controls when you are ready.</Text><Button label={session.consultation_type === 'audio' ? 'Join audio call' : 'Join video call'} icon="phone" loading={busy} onPress={() => void join()} /></>}
    <Text style={styles.caption}>Leaving the call keeps your appointment open. Your practitioner concludes the consultation and saves the clinical summary.</Text>
  </Card>;
}
