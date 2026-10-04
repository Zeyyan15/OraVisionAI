import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, Linking, Text, View } from 'react-native';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { api, http } from '../../api';
import { useSession } from '../../context/Session';
import { Button, Card, Field, Notice, Screen } from '../../components/ui';
import { colors, styles } from '../../theme';
import { messageOf } from '../../utils/consultation';
import { uploadBlob } from '../../utils/uploadFile';
import { ScreeningRun } from '../../utils/screeningRun';
import type { ScreeningReviewResponse, ScreeningWorkflow } from '../../types';

const steps = [
  ['Image upload', 'Save and validate your oral photo.'],
  ['AI analysis', 'Analyse the image and save screening findings.'],
  ['Explanations and report', 'Generate the visual explanation, next-step guidance, and PDF from available results.'],
];

export default function NewScreening() {
  const patient = useSession().profile?.role === 'patient';
  const [image, setImage] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [notes, setNotes] = useState(''); const [busy, setBusy] = useState(false);
  const [cancelling, setCancelling] = useState(false); const [error, setError] = useState('');
  const [progress, setProgress] = useState<ScreeningWorkflow | null>(null);
  const [review, setReview] = useState<ScreeningReviewResponse | null>(null);
  const [explanations, setExplanations] = useState<{ path: string; url: string }[]>([]);
  const [reportPath, setReportPath] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const run = useRef<ScreeningRun | null>(null); const alive = useRef(true); const locked = useRef(false);
  useEffect(() => { alive.current = true; return () => { alive.current = false; void run.current?.cancel().catch(() => {}); }; }, []);

  async function choose(camera: boolean) {
    setError('');
    try {
      if (camera) { const permission = await ImagePicker.requestCameraPermissionsAsync(); if (!permission.granted) throw new Error('Allow camera access in Settings to take an image.'); }
      const result = camera ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: .9 }) : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: .9, allowsMultipleSelection: false });
      if (!result.canceled) {
        const asset = result.assets[0];
        if ((asset.fileSize || 0) > 15*1024*1024) throw new Error('Choose an image smaller than 15 MB.');
        if (asset.mimeType && !['image/jpeg','image/png','image/webp'].includes(asset.mimeType)) throw new Error('Choose a JPG, PNG or WebP image.');
        setImage(asset); setProgress(null); setReview(null); setExplanations([]); setReportPath(null); setSessionId(null); run.current = null;
      }
    } catch (e) { setError(messageOf(e)); }
  }

  async function loadResults(id: string, signal: AbortSignal) {
    const current = await http.get<ScreeningReviewResponse>(`/api/screenings/${encodeURIComponent(id)}/review`, signal);
    if (!alive.current || signal.aborted) return;
    setReview(current);
    const paths = current.xai_results.filter((x) => x.is_primary_user_facing).map((x) => x.overlay_image_storage_path);
    const urls = await Promise.allSettled(paths.map(async (path) => ({ path, url: (await api.signedArtifact(id, path, signal)).signed_url })));
    if (alive.current && !signal.aborted) setExplanations(urls.flatMap((v) => v.status === 'fulfilled' ? [v.value] : []));
    try { const report = await http.get<{ pdf_storage_path: string | null }>(`/api/screenings/${encodeURIComponent(id)}/report`, signal); if (alive.current && !signal.aborted) setReportPath(report.pdf_storage_path); } catch { /* A report may not exist yet. */ }
  }

  async function submit() {
    if (!image || locked.current || busy || cancelling || !patient) return;
    locked.current = true;
    setBusy(true); setError(''); setReview(null); setExplanations([]); setReportPath(null); setSessionId(null);
    const task = new ScreeningRun({
      create: async () => { const created = await api.createScreening(notes.trim()); if (alive.current) setSessionId(created.id); return created; },
      prepare: async () => { const body = new FormData(); body.append('file', await uploadBlob({ ...image, mimeType: image.mimeType || 'image/jpeg' }), image.fileName || 'oral-screening.jpg'); return body; },
      start: api.startScreeningWorkflow, status: api.screeningWorkflow, cancel: api.cancelScreeningWorkflow,
      progress: (state) => { if (alive.current) setProgress(state); },
      results: loadResults,
    });
    run.current = task;
    try { await task.start(); }
    catch (e) {
      if (!task.controller.signal.aborted) {
        if (alive.current) setError(messageOf(e));
        // If a start response was lost, stop the worker before offering a retry.
        try { const state = await task.cancel(); if (alive.current) setProgress(state || { status: 'failed', completed_steps: 0, description: 'Screening could not start. Please try again.', warnings: [] }); }
        catch { if (alive.current) setError('Could not confirm that screening stopped. Tap Cancel again.'); }
      }
    } finally { locked.current = false; if (alive.current) setBusy(false); }
  }

  async function cancel() {
    if (!run.current || cancelling) return;
    setCancelling(true); setError('');
    try {
      const state = await run.current.cancel();
      if (alive.current) setProgress(state || { status: 'cancelled', completed_steps: 0, description: 'Screening cancelled.', warnings: [] });
      // One read after stopping includes outputs committed between progress polls.
      if (run.current.id && (state?.completed_steps || 0) > 0) {
        try { await loadResults(run.current.id, new AbortController().signal); }
        catch { if (alive.current) setError('Screening stopped. Open saved results to reload the available findings.'); }
      }
    }
    catch (e) { if (alive.current) setError(`Could not confirm cancellation. ${messageOf(e)} Tap Cancel again.`); }
    finally { if (alive.current) { setCancelling(false); setBusy(false); } }
  }

  async function openReport() {
    if (!run.current?.id || !reportPath) return;
    try { await Linking.openURL((await api.signedArtifact(run.current.id, reportPath)).signed_url); }
    catch (e) { setError(messageOf(e)); }
  }

  if (!patient) return <Screen><Notice message="Patients create their own screenings. Review assigned patient cases from the Cases tab." /></Screen>;
  const active = busy || cancelling || progress?.status === 'running';
  return <Screen>
    <Text style={styles.title}>Start with a clear image.</Text>
    <Text style={styles.body}>Use good lighting and keep the oral area in focus.</Text>
    <Card>{image ? <Image source={{ uri: image.uri }} accessibilityLabel="Selected oral image" resizeMode="contain" style={{ width: '100%', height: 230, borderRadius: 12 }} /> : <Text style={[styles.body, { textAlign: 'center', paddingVertical: 45 }]}>Your image preview will appear here.</Text>}
      <Button label="Choose from photos" variant="outline" icon="image" disabled={active} onPress={() => void choose(false)} />
      <Button label="Take a photo" variant="outline" icon="camera" disabled={active} onPress={() => void choose(true)} />
    </Card>
    <Field label="Symptoms or notes (optional)" multiline value={notes} onChangeText={setNotes} editable={!active} maxLength={2000} />
    {progress && <Card>
      <Text style={styles.heading} accessibilityLiveRegion="polite">{progress.completed_steps}/3 steps done</Text>
      <Text style={styles.body}>{cancelling ? 'Cancelling all remaining work...' : progress.description}</Text>
      {steps.map(([title, description], index) => <View key={title} style={{ gap: 5 }}>
        <Text style={[styles.caption, { color: index < progress.completed_steps ? colors.teal : colors.muted }]}>{index + 1}. {title} - {index < progress.completed_steps ? 'Done' : active && index === progress.completed_steps ? 'In progress' : progress.status === 'cancelled' ? 'Cancelled' : progress.status === 'failed' ? 'Not completed' : 'Waiting'}</Text>
        <Text style={styles.caption}>{description}</Text>
      </View>)}
      {active && <ActivityIndicator color={colors.teal} />}
      {progress.warnings.map((warning) => <Notice key={warning} message={warning} />)}
    </Card>}
    {review?.primary_prediction && <Card><Text style={styles.kicker}>AVAILABLE SCREENING FINDINGS</Text><Text style={styles.heading}>{review.primary_prediction.predicted_class}</Text><Text style={styles.body}>Model confidence: {(review.primary_prediction.confidence * 100).toFixed(1)}%. This score is not a disease probability.</Text></Card>}
    {review?.risk_assessment && <Card><Text style={styles.heading}>Recommended next step</Text><Text style={styles.body}>{review.risk_assessment.summary}</Text><Text style={styles.body}>{review.risk_assessment.recommended_action}</Text></Card>}
    {explanations.map((item) => <Card key={item.path}><Text style={styles.heading}>Visual explanation</Text><Image source={{ uri: item.url }} resizeMode="contain" style={{ width: '100%', height: 230 }} /></Card>)}
    {!!reportPath && <Button label="Open generated PDF report" variant="outline" onPress={() => void openReport()} />}
    <Notice message="AI findings support screening and need professional review. They are not a clinical diagnosis." />
    {!!error && <Notice error message={error} />}
    {active ? <Button label={cancelling ? 'Stopping screening...' : 'Cancel screening'} variant="danger" loading={cancelling} onPress={() => void cancel()} /> : <Button label={progress ? 'Start a new screening' : 'Upload & analyse'} disabled={!image} icon="arrow-up-right" onPress={() => void submit()} />}
    {!!sessionId && !active && <Button label="View all saved results" variant="outline" onPress={() => router.push({ pathname: '/screening/[id]', params: { id: sessionId } })} />}
  </Screen>;
}
