import { Text, View } from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { api } from '../../api';
import { useSession } from '../../context/Session';
import { useResource } from '../../hooks/useResource';
import { Button, Card, Empty, Entrance, IconTile, ResourceState, Screen, StatusPill } from '../../components/ui';
import { colors, styles } from '../../theme';

export default function Home() {
  const { profile } = useSession(); const doctor = profile?.role === 'dentist';
  const resource = useResource(api.appointments);
  const upcoming = resource.data?.items.filter((a) => ['requested', 'confirmed', 'in_progress'].includes(a.status)).sort((a,b) => Date.parse(a.scheduled_start)-Date.parse(b.scheduled_start));
  return <Screen onRefresh={() => void resource.refresh()} refreshing={resource.loading}><Entrance>
    <View style={styles.row}><View style={{ flex: 1 }}><Text style={styles.caption}>YOUR CARE SPACE</Text><Text style={styles.title}>Hello, {doctor ? 'Dr. ' : ''}{profile?.first_name}.</Text></View><Button label="Updates" variant="ghost" icon="bell" onPress={() => router.push('/notifications')} /></View>
    <LinearGradient colors={[colors.forest, '#325a43']} style={{ padding: 25, borderRadius: 20, gap: 16 }}><IconTile name={doctor ? 'heart' : 'aperture'} dark /><Text style={[styles.title, { color: colors.white, fontSize: 30 }]}>{doctor ? 'Care, with a clearer picture.' : 'A little attention.\nA healthier smile.'}</Text><Text style={[styles.body, { color: '#c4d7bf' }]}>{doctor ? 'Review your patient cases and connect through a consultation.' : 'Keep your screenings, appointments and conversations together.'}</Text><Button label={doctor ? 'Review patient cases' : 'Start a screening'} icon="arrow-up-right" onPress={() => router.push(doctor ? '/(tabs)/screenings' : '/screening/new')} /></LinearGradient>
    <View style={{ flexDirection: 'row', gap: 12 }}><Card style={{ flex: 1 }}><IconTile name="calendar" /><Text style={styles.heading}>Appointments</Text><Button label="View schedule" variant="ghost" onPress={() => router.push('/appointments')} /></Card><Card style={{ flex: 1 }}><IconTile name={doctor ? 'message-circle' : 'users'} /><Text style={styles.heading}>{doctor ? 'Conversations' : 'Find a dentist'}</Text><Button label={doctor ? 'Open messages' : 'Explore doctors'} variant="ghost" onPress={() => router.push(doctor ? '/(tabs)/messages' : '/dentists')} /></Card></View>
    <Text style={styles.heading}>Coming up</Text><ResourceState loading={resource.loading && !resource.data} error={resource.error} retry={() => void resource.refresh()} />
    {upcoming?.slice(0, 3).map((a) => <Card key={a.id}><View style={styles.row}><Text style={[styles.heading, { flex: 1 }]}>{doctor ? a.patient_name || 'Patient' : a.dentist_name || 'Dentist'}</Text><StatusPill status={a.status} /></View><Text style={styles.body}>{new Date(a.scheduled_start).toLocaleString()}</Text><Text style={styles.caption}>{a.appointment_type.replace(/_/g, ' ')}</Text><Button label="View appointment" variant="outline" onPress={() => router.push('/appointments')} /></Card>)}
    {upcoming?.length === 0 && <Empty title="Room for your next step" message="Your upcoming appointments will appear here." icon="calendar" />}
  </Entrance></Screen>;
}
