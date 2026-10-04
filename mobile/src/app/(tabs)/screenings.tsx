import { Text, View } from 'react-native';
import { router } from 'expo-router';
import { api } from '../../api';
import { useSession } from '../../context/Session';
import { useResource } from '../../hooks/useResource';
import { Button, Card, Empty, ResourceState, Screen, StatusPill } from '../../components/ui';
import { styles } from '../../theme';

export default function Screenings() {
  const doctor = useSession().profile?.role === 'dentist';
  const resource = useResource(async () => doctor ? (await api.patientCases()).items.map((a) => ({ id: a.screening_id, name: a.patient_name, date: a.screening_date, status: a.review_status, finding: a.ai_class })) : (await api.screenings()).items.map((a) => ({ id: a.id, name: 'Oral health screening', date: a.created_at, status: a.status, finding: a.clinical_notes })));
  return <Screen refreshing={resource.loading} onRefresh={() => void resource.refresh()}><Text style={styles.title}>{doctor ? 'Patient cases' : 'Your screenings'}</Text><Text style={styles.body}>{doctor ? 'Assigned cases and professional reviews.' : 'A clear record of every step in your oral care.'}</Text>{!doctor && <Button label="New screening" icon="plus" onPress={() => router.push('/screening/new')} />}<ResourceState {...resource} retry={() => void resource.refresh()} />{resource.data?.map((s) => <Card key={s.id}><View style={styles.row}><Text style={[styles.heading, { flex: 1 }]}>{s.name}</Text><StatusPill status={s.status} /></View><Text style={styles.caption}>{new Date(s.date).toLocaleDateString()}</Text>{!!(s.finding) && <Text style={styles.body}>{s.finding}</Text>}<Button label={doctor ? 'Review case' : 'View screening'} variant="outline" onPress={() => router.push({ pathname: '/screening/[id]', params: { id: s.id } })} /></Card>)}{resource.data?.length === 0 && <Empty title={doctor ? 'No assigned cases' : 'Your journey starts here'} message={doctor ? 'Patient review requests and linked screenings will appear here.' : 'Add an oral image to start your first screening.'} />}</Screen>;
}
