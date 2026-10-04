import React, { useEffect, useState } from 'react';
import { Modal, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import LiveCall from '../../components/LiveCall';
import { api } from '../../api';
import { useResource } from '../../hooks/useResource';
import { useSession } from '../../context/Session';
import { Button, Card, Field, IconTile, Notice, ResourceState, Screen, StatusPill } from '../../components/ui';
import { colors, styles } from '../../theme';
import { consultationActions, elapsedSeconds, formatDuration, messageOf } from '../../utils/consultation';
import type { Appointment, DentistProfile } from '../../types';

export default function ConsultationRoom() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { profile } = useSession();
  const resource = useResource((signal) => api.consultation(id, signal), 4000);
  const [appointment, setAppointment] = useState<Appointment | null>(null);
  const [doctorProfile, setDoctorProfile] = useState<DentistProfile | null>(null);
  const [summary, setSummary] = useState(''); const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null); const [now, setNow] = useState(() => Date.now());
  const [confirm, setConfirm] = useState<'end' | 'cancel'>('end');
  const [confirmationVisible, setConfirmationVisible] = useState(false);
  const session = resource.data;
  const doctor = profile?.role === 'dentist';
  useEffect(() => {
    if (!session?.appointment_id) return;
    let alive = true;
    api.appointment(session.appointment_id).then((value) => { if (alive) setAppointment(value); }).catch((failure) => { if (alive) setError(messageOf(failure)); });
    return () => { alive = false; };
  }, [session?.appointment_id]);
  useEffect(() => { if (doctor) api.dentistProfile().then(setDoctorProfile).catch((failure) => setError(messageOf(failure))); }, [doctor]);
  useEffect(() => { if (session?.session_status !== 'active') return; const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer); }, [session?.session_status]);
  const actions = consultationActions(profile?.role || '', session?.session_status || '', doctorProfile?.verification_status === 'approved');
  const mutate = async (action: 'start' | 'end' | 'cancel') => {
    if (busy) return;
    setBusy(true); setError(null);
    try { const updated = action === 'start' ? await api.startConsultation(id) : action === 'end' ? await api.endConsultation(id, summary.trim()) : await api.failConsultation(id); resource.setData(updated); setConfirmationVisible(false); }
    catch (failure) { setError(messageOf(failure)); } finally { setBusy(false); }
  };
  return <Screen><ResourceState loading={!session && resource.loading} error={resource.error} retry={() => void resource.refresh()} />{session && <>
    <View style={styles.between}><View style={{ flex: 1 }}><Text style={styles.kicker}>YOUR CONSULTATION</Text><Text style={[styles.heading, { marginTop: 7 }]}>{doctor ? session.patient_name || 'Patient' : session.dentist_name || 'Your practitioner'}</Text></View><StatusPill status={session.session_status} /></View>
    {!!(error) && <Notice error message={error} />}
    <View style={{ minHeight: 255, borderRadius: 18, padding: 21, backgroundColor: colors.forest, gap: 19, alignItems: 'center', justifyContent: 'center' }}>
      <View style={[styles.between, { alignSelf: 'stretch' }]}><Text style={{ color: '#b9d0b7', fontSize: 11 }}>{session.session_status === 'active' ? 'Session active' : session.session_status === 'scheduled' ? 'Waiting room' : 'Session closed'}</Text><Text style={{ color: colors.lime, fontSize: 14, fontVariant: ['tabular-nums'] }}>{formatDuration(elapsedSeconds(session, now))}</Text></View>
      <IconTile name={session.session_status === 'scheduled' ? 'clock' : 'video'} dark />
      <Text style={{ color: colors.white, fontWeight: '600', fontSize: 20, textAlign: 'center' }}>{session.session_status === 'scheduled' ? doctor ? 'Ready when you are.' : 'Your practitioner will begin shortly.' : session.session_status === 'active' ? 'Your care, in conversation.' : 'Your session has concluded.'}</Text>
      <Text style={{ color: '#abc5b1', fontSize: 12, lineHeight: 20, textAlign: 'center' }}>Your consultation, connected through the same OraVisionAI care platform.</Text>
    </View>
    {['scheduled', 'active'].includes(session.session_status) && session.consultation_type !== 'chat' && <LiveCall session={session} />}
    <Card><Text style={styles.heading}>The people in your care</Text><Text style={styles.body}>Patient · {session.patient_name || 'Patient'}</Text><Text style={styles.body}>Practitioner · {session.dentist_name || 'Assigned dentist'}</Text>{!!(session.clinic_name) && <Text style={styles.caption}>{session.clinic_name}</Text>}{!!(session.scheduled_start) && <Text style={styles.caption}>{new Date(session.scheduled_start).toLocaleString()}</Text>}</Card>
    {!!(appointment?.screening_id) && <Button label="View attached screening" variant="outline" icon="file-text" onPress={() => router.push(`/screening/${appointment.screening_id}`)} />}
    {!!(session.clinical_summary) && <Card><Text style={styles.heading}>Clinical summary</Text><Text style={styles.body}>{session.clinical_summary}</Text></Card>}
    {actions.start && <Button label="Start consultation" icon="play" loading={busy} onPress={() => void mutate('start')} />}
    {actions.end && <><Field label="Clinical summary" multiline value={summary} onChangeText={setSummary} maxLength={10000} placeholder="Record your observations and next steps." editable={!busy} /><Button label="Conclude consultation" loading={busy} icon="check-circle" onPress={() => { setConfirm('end'); setConfirmationVisible(true); }} /></>}
    {actions.cancel && <Button label="Cancel this session" variant="danger" disabled={busy} onPress={() => { setConfirm('cancel'); setConfirmationVisible(true); }} />}
    <Button label="Open messages" variant="outline" icon="message-circle" onPress={() => router.push('/(tabs)/messages')} />
  </>}
  <Modal visible={confirmationVisible} transparent animationType="fade" onRequestClose={() => { if (!busy) setConfirmationVisible(false); }}><View style={{ flex: 1, backgroundColor: '#102f2acc', alignItems: 'center', justifyContent: 'center', padding: 24 }}><Card style={{ width: '100%', maxWidth: 440 }}><Text style={styles.heading}>{confirm === 'end' ? 'Conclude this consultation?' : 'Cancel this session?'}</Text><Text style={styles.body}>{confirm === 'end' ? 'The summary will be saved with this consultation.' : 'This session will close for both participants.'}</Text>{!!(error) && <Notice error message={error} />}<Button label={confirm === 'end' ? 'Save and conclude' : 'Confirm cancellation'} variant={confirm === 'end' ? 'primary' : 'danger'} loading={busy} onPress={() => void mutate(confirm === 'end' ? 'end' : 'cancel')} /><Button label="Keep session open" variant="outline" disabled={busy} onPress={() => setConfirmationVisible(false)} /></Card></View></Modal>
  </Screen>;
}
