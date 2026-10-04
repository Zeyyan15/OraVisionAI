import { useEffect, useState } from 'react';
import { Linking, Text, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { useLocalSearchParams } from 'expo-router';
import { api } from '../../api';
import { useSession } from '../../context/Session';
import { useResource } from '../../hooks/useResource';
import { Button, Card, Field, Notice, ResourceState, Screen } from '../../components/ui';
import { colors, styles } from '../../theme';
import { messageOf } from '../../utils/consultation';
import { uploadBlob } from '../../utils/uploadFile';
import type { ShareableReportItem } from '../../types';
export default function Conversation() {
  const { id } = useLocalSearchParams<{ id:string }>(); const { profile } = useSession(); const [draft,setDraft] = useState(''); const [busy,setBusy] = useState(false); const [error,setError] = useState(''); const [offset,setOffset] = useState<number | null>(null);
  const r = useResource(async (signal) => { const [conversation,first] = await Promise.all([api.conversation(id),api.messages(id,offset ?? 0,signal)]); const page = offset === null && first.total > 100 ? await api.messages(id,Math.max(0,first.total-100),signal) : first; if (!signal?.aborted) await api.readMessages(id); return { conversation,page }; },5000);
  const refresh = r.refresh;
  const [reports,setReports] = useState<ShareableReportItem[] | null>(null);
  useEffect(() => { void refresh(true); }, [offset, refresh]);
  async function send() { if (busy || !draft.trim()) return; setBusy(true); setError(''); try { await api.sendMessage(id,draft.trim()); setDraft(''); setOffset(null); await r.refresh(true); } catch(e) { setError(messageOf(e)); } finally { setBusy(false); } }
  async function older() { if (!r.data) return; setOffset(Math.max(0,r.data.page.offset-100)); }
  async function attach() {
    if (busy) return;
    setError('');
    try {
      const selected = await DocumentPicker.getDocumentAsync({ type:['image/jpeg','image/png','image/webp','application/pdf'],multiple:false,copyToCacheDirectory:true });
      if (selected.canceled) return;
      const file = selected.assets[0];
      if ((file.size || 0) > 10*1024*1024) throw new Error('Choose a file smaller than 10 MB.');
      setBusy(true); const body = new FormData();
      body.append('files',await uploadBlob(file),file.name);
      if (draft.trim()) body.append('content',draft.trim());
      await api.uploadMessage(id,body); setDraft(''); setOffset(null); await refresh(true);
    } catch(e) { setError(messageOf(e)); } finally { setBusy(false); }
  }
  async function report(value?: string) {
    if (busy) return; setBusy(true); setError('');
    try { if (value) { await api.shareReport(id,value); setReports(null); setOffset(null); await refresh(true); } else setReports(await api.shareableReports(id)); }
    catch(e) { setError(messageOf(e)); } finally { setBusy(false); }
  }
  const conversation = r.data?.conversation;
  return <Screen onRefresh={() => void r.refresh()} refreshing={r.loading}><Text style={styles.title}>{profile?.role === 'dentist' ? conversation?.patient_name || 'Patient' : conversation?.dentist_name || 'Your practitioner'}</Text><ResourceState loading={r.loading && !r.data} error={r.error} retry={() => void r.refresh()} />{!!(error) && <Notice error message={error} />}{r.data && r.data.page.offset > 0 && <Button label="Earlier messages" variant="outline" onPress={() => void older()} />}{offset !== null && <Button label="Latest messages" variant="ghost" onPress={() => setOffset(null)} />}{r.data?.page.items.map((m) => <View key={m.id} style={{alignSelf:m.sender_id === profile?.id ? 'flex-end' : 'flex-start',maxWidth:'92%'}}><Card style={{backgroundColor:m.sender_id === profile?.id ? colors.mint : colors.white}}><Text style={styles.caption}>{m.sender_name || m.sender_role || 'Care team'}</Text><Text style={[styles.body,{color:colors.ink}]}>{m.content}</Text><Text style={styles.caption}>{new Date(m.created_at).toLocaleString()}</Text>{m.attachments?.map((a) => <Button key={a.id} label={`View ${a.original_filename}`} variant="outline" onPress={() => void api.messageAttachment(a.id).then((v) => Linking.openURL(v.signed_url)).catch((e) => setError(messageOf(e)))} />)}</Card></View>)}{conversation?.is_active && <><Field label="Message" multiline value={draft} onChangeText={setDraft} maxLength={4000} editable={!busy} placeholder="Write to your care team…" /><Button label="Send message" icon="send" loading={busy} disabled={!draft.trim()} onPress={() => void send()} /><Button label="Attach image or PDF" variant="outline" icon="paperclip" disabled={busy} onPress={() => void attach()} />{profile?.role === 'dentist' && <Button label="Share clinical report" variant="outline" icon="file-text" disabled={busy} onPress={() => void report()} />}{reports && <Card><Text style={styles.heading}>Share a report</Text>{reports.length === 0 && <Text style={styles.body}>No reports are available for this patient yet.</Text>}{reports.map((item) => <Button key={item.id} label={item.report_title || item.report_number} variant="outline" disabled={busy} onPress={() => void report(item.id)} />)}<Button label="Close report selection" variant="ghost" onPress={() => setReports(null)} /></Card>}</>}{conversation && !conversation.is_active && <Notice message="This conversation is archived. Existing messages remain available." />}</Screen>;
}
