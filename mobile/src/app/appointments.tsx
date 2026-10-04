import { useState } from 'react';
import { Text, View } from 'react-native';
import { router } from 'expo-router';
import { api } from '../api';
import { ApiError } from '../api/http';
import { useSession } from '../context/Session';
import { useResource } from '../hooks/useResource';
import { Button, Card, Empty, Field, Notice, ResourceState, Screen, StatusPill } from '../components/ui';
import { styles } from '../theme';
import { messageOf } from '../utils/consultation';
import type { Appointment } from '../types';
export default function Appointments() {
  const doctor = useSession().profile?.role === 'dentist'; const r = useResource(api.appointments);
  const [busy, setBusy] = useState(''); const [error, setError] = useState(''); const [reason, setReason] = useState(''); const [cancelling, setCancelling] = useState<Appointment | null>(null);
  async function act(a: Appointment, action: 'confirm' | 'cancel' | 'call' | 'message') {
    if (busy) return; setBusy(a.id); setError('');
    try {
      if (action === 'call') {
        let c; try { c = await api.appointmentConsultation(a.id); } catch(e) {
          if (!(e instanceof ApiError && e.status === 404)) throw e;
          if (!doctor) throw new Error('Your practitioner has not opened this consultation yet. Please try again shortly.');
          c = await api.createConsultation(a.id, a.appointment_type === 'audio_teleconsultation' ? 'audio' : 'video');
        }
        router.push({ pathname: '/consultation/[id]', params: { id: c.id } });
      } else if (action === 'message') { const c = await api.startConversation(doctor ? a.patient_id : a.dentist_id, doctor ? 'dentist' : 'patient'); router.push({ pathname: '/conversation/[id]', params: { id: c.id } }); }
      else { if (action === 'cancel') { if (!reason.trim()) throw new Error('Please give a reason for cancellation.'); await api.cancelAppointment(a.id, reason.trim()); setCancelling(null); setReason(''); } else await api.confirmAppointment(a.id); await r.refresh(true); }
    } catch(e) { setError(messageOf(e)); } finally { setBusy(''); }
  }
  return <Screen onRefresh={() => void r.refresh()} refreshing={r.loading}><Text style={styles.title}>Your schedule</Text><Text style={styles.body}>Appointments, all in one place. Times shown in your device timezone.</Text>{!doctor && <Button label="Book a consultation" icon="plus" onPress={() => router.push('/dentists')} />}<ResourceState {...r} retry={() => void r.refresh()} />{!!(error) && <Notice error message={error} />}{r.data?.items.map((a) => <Card key={a.id}><View style={styles.row}><Text style={[styles.heading, { flex: 1 }]}>{doctor ? a.patient_name || 'Patient' : a.dentist_name || 'Dentist'}</Text><StatusPill status={a.status} /></View><Text style={styles.body}>{new Date(a.scheduled_start).toLocaleString()}</Text><Text style={styles.caption}>{a.appointment_type.replace(/_/g, ' ')}</Text>{!!(a.patient_notes) && <Text style={styles.body}>{a.patient_notes}</Text>}{!!(a.cancellation_reason) && <Notice message={a.cancellation_reason} />}{doctor && a.status === 'requested' && <Button label="Confirm appointment" loading={busy === a.id} disabled={!!busy} onPress={() => void act(a, 'confirm')} />}{['confirmed', 'in_progress'].includes(a.status) && ['video_teleconsultation','audio_teleconsultation'].includes(a.appointment_type) && <Button label="Open consultation room" icon="video" loading={busy === a.id} disabled={!!busy} onPress={() => void act(a, 'call')} />}<Button label="Message" variant="outline" disabled={!!busy} onPress={() => void act(a, 'message')} />{['requested','confirmed'].includes(a.status) && <Button label="Cancel appointment" variant="danger" disabled={!!busy} onPress={() => { setCancelling(a); setReason(''); }} />}{cancelling?.id === a.id && <><Field label="Cancellation reason" value={reason} onChangeText={setReason} multiline maxLength={2000} /><Button label="Confirm cancellation" variant="danger" loading={busy === a.id} onPress={() => void act(a, 'cancel')} /><Button label="Keep appointment" variant="ghost" disabled={!!busy} onPress={() => setCancelling(null)} /></>}</Card>)}{r.data?.items.length === 0 && <Empty title="No appointments yet" message="Your requested and confirmed appointments will appear here." icon="calendar" />}</Screen>;
}
