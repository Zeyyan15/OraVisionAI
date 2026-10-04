import { useEffect, useState, type ComponentType } from 'react';
import { Text } from 'react-native';
import { isRunningInExpoGo } from 'expo';
import { Card, Loading, Notice } from './ui';
import { styles } from '../theme';
import type { ConsultationResponse } from '../types';

type Props = { session: ConsultationResponse };
const expoGo = isRunningInExpoGo();

export default function LiveCall(props: Props) {
  const [NativeCall, setNativeCall] = useState<ComponentType<Props> | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (expoGo) return;
    let active = true;
    // Never evaluate the WebRTC SDK while Expo Router discovers routes in Expo Go.
    // Catch an outdated development build's missing module without breaking navigation.
    import('./NativeLiveCall').then((module) => {
      if (active) setNativeCall(() => module.default);
    }).catch(() => { if (active) setFailed(true); });
    return () => { active = false; };
  }, []);

  if (expoGo) return <Card><Text style={styles.heading}>Live consultation</Text><Notice message="You can browse your consultation and messages in Expo Go. Live audio and video need the installed OraVisionAI development app, or the browser app over HTTPS." /></Card>;
  if (failed) return <Notice error message="This installed app is missing the video-call module. Install a new OraVisionAI development build to enable live calls. Your consultation and messages remain available." />;
  return NativeCall ? <NativeCall {...props} /> : <Loading />;
}
