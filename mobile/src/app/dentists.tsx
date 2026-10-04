import { useState } from 'react';
import { Text } from 'react-native';
import { router } from 'expo-router';
import { api } from '../api';
import { useResource } from '../hooks/useResource';
import { Button, Card, Empty, Field, ResourceState, Screen, StatusPill } from '../components/ui';
import { styles } from '../theme';
export default function Dentists() {
  const r = useResource(api.dentists); const [search, setSearch] = useState('');
  const items = r.data?.filter((d) => d.verification_status === 'approved' && `${d.first_name} ${d.last_name} ${d.specialization} ${d.clinic_name}`.toLowerCase().includes(search.toLowerCase()));
  return <Screen refreshing={r.loading} onRefresh={() => void r.refresh()}><Text style={styles.title}>Find your practitioner.</Text><Text style={styles.body}>Connect with a verified dental professional.</Text><Field label="Search dentists" value={search} onChangeText={setSearch} placeholder="Name, clinic or specialty" /><ResourceState {...r} retry={() => void r.refresh()} />{items?.map((d) => <Card key={d.id}><StatusPill status="verified" /><Text style={styles.heading}>Dr. {d.first_name} {d.last_name}</Text><Text style={styles.body}>{d.specialization}</Text><Text style={styles.caption}>{d.clinic_name || 'Independent practitioner'} · {d.years_of_experience} years of experience</Text><Button label="View profile & book" variant="outline" icon="arrow-up-right" onPress={() => router.push({ pathname: '/dentist/[id]', params: { id: d.id } })} /></Card>)}{items?.length === 0 && <Empty title="No dentists found" message="Try another search or check back when a practitioner becomes available." />}</Screen>;
}
