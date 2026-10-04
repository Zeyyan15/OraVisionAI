import { Text, View } from 'react-native';
import { router } from 'expo-router';
import { api } from '../../api';
import { useSession } from '../../context/Session';
import { useResource } from '../../hooks/useResource';
import { Button, Card, Empty, ResourceState, Screen, StatusPill } from '../../components/ui';
import { styles } from '../../theme';
export default function Messages() {
  const doctor = useSession().profile?.role === 'dentist'; const r = useResource(api.conversations, 10000);
  return <Screen onRefresh={() => void r.refresh()} refreshing={r.loading}><Text style={styles.title}>A conversation away.</Text><Text style={styles.body}>Stay connected with your care team.</Text><ResourceState {...r} retry={() => void r.refresh()} />{r.data?.items.map((c) => <Card key={c.id}><View style={styles.row}><Text style={[styles.heading, { flex: 1 }]}>{doctor ? c.patient_name || 'Patient' : c.dentist_name || 'Dentist'}</Text>{c.unread_count > 0 && <StatusPill status={`${c.unread_count} unread`} />}</View><Text style={styles.caption}>{c.clinic_name || 'Direct conversation'}</Text><Button label="Open conversation" variant="outline" onPress={() => router.push({ pathname: '/conversation/[id]', params: { id: c.id } })} /></Card>)}{r.data?.items.length === 0 && <Empty title="No conversations yet" message={doctor ? 'Start a conversation from an appointment.' : 'Find a dentist to start a conversation.'} />}{!doctor && <Button label="Find a dentist" variant="outline" onPress={() => router.push('/dentists')} />}</Screen>;
}
