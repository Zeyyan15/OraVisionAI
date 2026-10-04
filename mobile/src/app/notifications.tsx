import { useState } from 'react';
import { Text } from 'react-native';
import { api } from '../api';
import { useResource } from '../hooks/useResource';
import { Button, Card, Empty, Notice, ResourceState, Screen } from '../components/ui';
import { styles } from '../theme';
import { messageOf } from '../utils/consultation';
export default function Notifications() {
  const r = useResource(api.notifications); const [error, setError] = useState(''); const [busy, setBusy] = useState('');
  async function read(id: string) { setBusy(id); setError(''); try { await api.readNotification(id); await r.refresh(true); } catch(e) { setError(messageOf(e)); } finally { setBusy(''); } }
  return <Screen onRefresh={() => void r.refresh()} refreshing={r.loading}><Text style={styles.title}>Your updates</Text><ResourceState {...r} retry={() => void r.refresh()} />{!!(error) && <Notice error message={error} />}{r.data?.items.map((n) => <Card key={n.id}><Text style={styles.heading}>{n.title}</Text><Text style={styles.body}>{n.message}</Text><Text style={styles.caption}>{new Date(n.created_at).toLocaleString()}</Text>{!n.is_read && <Button label="Mark as read" variant="ghost" loading={busy === n.id} disabled={!!busy} onPress={() => void read(n.id)} />}</Card>)}{r.data?.items.length === 0 && <Empty title="You're all caught up" message="Updates about your care will appear here." />}</Screen>;
}
