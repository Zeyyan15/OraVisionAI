import { router } from 'expo-router';
import { Text, View } from 'react-native';
import { api } from '../../api';
import { useResource } from '../../hooks/useResource';
import { useSession } from '../../context/Session';
import { Button, Card, Empty, IconTile, ResourceState, Screen, StatusPill } from '../../components/ui';
import { styles } from '../../theme';

export default function Consultations() {
  const doctor = useSession().profile?.role === 'dentist';
  const resource = useResource(api.consultations, 10000);
  return <Screen onRefresh={() => void resource.refresh()} refreshing={resource.loading && Boolean(resource.data)}>
    <Text style={styles.kicker}>CARE, WHEREVER YOU ARE</Text><Text style={styles.title}>A conversation{ '\n' }that brings clarity.</Text><Text style={styles.body}>{doctor ? 'Your consultation workspace and patient follow-ups.' : 'Connect with your dental practitioner.'}</Text>
    <Button label="View appointments" variant="outline" icon="calendar" onPress={() => router.push('/appointments')} />
    <ResourceState loading={!resource.data && resource.loading} error={resource.error} retry={() => void resource.refresh()} />
    {resource.data?.items.map((session) => <Card key={session.id}><View style={styles.between}><IconTile name={session.consultation_type === 'audio' ? 'mic' : session.consultation_type === 'chat' ? 'message-circle' : 'video'} /><StatusPill status={session.session_status} /></View><Text style={styles.heading}>{doctor ? session.patient_name || 'Patient consultation' : session.dentist_name || 'Your practitioner'}</Text><Text style={styles.caption}>{session.scheduled_start ? new Date(session.scheduled_start).toLocaleString() : 'Time to be confirmed'} · {session.consultation_type}</Text><Button label={['ended', 'failed'].includes(session.session_status) ? 'View session' : 'Open consultation room'} icon="arrow-right" variant={session.session_status === 'active' ? 'primary' : 'outline'} onPress={() => router.push(`/consultation/${session.id}`)} /></Card>)}
    {resource.data && !resource.data.items.length && <Empty title="Your next conversation awaits" message="Confirmed teleconsultation appointments will appear here when a session is created." icon="video" />}
  </Screen>;
}
