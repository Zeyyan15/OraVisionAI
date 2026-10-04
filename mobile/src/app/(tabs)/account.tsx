import { useState } from 'react';
import { Text, View } from 'react-native';
import { api } from '../../api';
import { useSession } from '../../context/Session';
import { useResource } from '../../hooks/useResource';
import { Button, Card, Field, Notice, ResourceState, Screen, StatusPill } from '../../components/ui';
import { styles } from '../../theme';
import { messageOf } from '../../utils/consultation';
const days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

function ProfessionalAccount() {
  const r = useResource(async () => {
    const profile = await api.dentistProfile();
    const availability = profile.verification_status === 'approved' ? await api.myAvailability() : {items:[],total:0};
    return {profile,availability};
  });
  const [clinic,setClinic] = useState<string | null>(null); const [specialization,setSpecialization] = useState<string | null>(null); const [bio,setBio] = useState<string | null>(null); const [document,setDocument] = useState(''); const [fileName,setFileName] = useState(''); const [day,setDay] = useState(1); const [start,setStart] = useState('09:00'); const [end,setEnd] = useState('12:00'); const [minutes,setMinutes] = useState('30'); const [busy,setBusy] = useState(false); const [error,setError] = useState(''); const [success,setSuccess] = useState('');
  const professional = r.data?.profile;
  async function act(kind: 'save' | 'verify' | 'availability' | 'toggle', target?: {id:string;is_active:boolean}) {
    if (busy) return; setBusy(true); setError(''); setSuccess('');
    try {
      if (kind === 'save') { if (!(specialization ?? professional?.specialization ?? '').trim()) throw new Error('Enter your specialization.'); await api.updateDentistProfile({clinic_name:(clinic ?? professional?.clinic_name ?? '').trim(),specialization:(specialization ?? professional?.specialization ?? '').trim(),bio:(bio ?? professional?.bio ?? '').trim()}); }
      else if (kind === 'verify') { if (!/^https:\/\//.test(document) || !fileName.trim()) throw new Error('Enter a secure HTTPS document URL and its file name.'); await api.submitVerification({document_type:'professional_license',document_url:document.trim(),file_name:fileName.trim()}); }
      else if (kind === 'toggle' && target) await api.setAvailability(target.id,!target.is_active);
      else { if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(start) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(end) || start >= end || !/^\d+$/.test(minutes) || Number(minutes) <= 0 || Number(minutes)>1440) throw new Error('Use valid HH:MM times with the end after the start, and a duration between 1 and 1440 minutes.'); await api.addAvailability({day_of_week:day,start_time:`${start}:00`,end_time:`${end}:00`,slot_duration_minutes:Number(minutes),is_active:true}); }
      setSuccess('Your changes have been saved.'); await r.refresh(true);
    } catch(e) { setError(messageOf(e)); } finally { setBusy(false); }
  }
  return <><ResourceState {...r} retry={() => void r.refresh()} />{!!(error) && <Notice error message={error} />}{!!(success) && <Notice message={success} />}{professional && <><StatusPill status={professional.verification_status} />{professional.verification_status !== 'approved' && <Notice message="Your license needs administrator approval before clinical actions are enabled." />}<Card><Text style={styles.heading}>Professional profile</Text><Field label="Clinic name" value={clinic ?? professional.clinic_name ?? ''} onChangeText={setClinic} maxLength={200} /><Field label="Specialization" value={specialization ?? professional.specialization} onChangeText={setSpecialization} maxLength={150} /><Field label="About your practice" value={bio ?? professional.bio ?? ''} onChangeText={setBio} multiline maxLength={10000} /><Button label="Save professional profile" loading={busy} onPress={() => void act('save')} /></Card>{professional.verification_status !== 'approved' && <Card><Text style={styles.heading}>License verification</Text><Text style={styles.body}>Submit the URL of your uploaded license document for administrator review.</Text><Field label="License document URL (HTTPS)" value={document} onChangeText={setDocument} autoCapitalize="none" /><Field label="Document file name" value={fileName} onChangeText={setFileName} maxLength={255} /><Button label="Submit for verification" loading={busy} onPress={() => void act('verify')} /></Card>}{professional.verification_status === 'approved' && <Card><Text style={styles.heading}>Weekly availability</Text><Text style={styles.caption}>Times use UTC, matching your web schedule.</Text>{r.data?.availability.items.map((w) => <View key={w.id} style={{gap:5}}><Text style={styles.body}>{days[w.day_of_week]} · {w.start_time.slice(0,5)}–{w.end_time.slice(0,5)} · {w.slot_duration_minutes} min</Text><Button label={w.is_active ? 'Pause this window' : 'Activate this window'} variant="outline" disabled={busy} onPress={() => void act('toggle',w)} /></View>)}<View style={{flexDirection:'row',flexWrap:'wrap',gap:6}}>{days.map((d,i) => <Button key={d} label={d.slice(0,3)} variant="outline" disabled={busy} onPress={() => setDay(i)} />)}</View><Text style={styles.caption}>Selected day: {days[day]}</Text><Field label="Start time (HH:MM, UTC)" value={start} onChangeText={setStart} maxLength={5} /><Field label="End time (HH:MM, UTC)" value={end} onChangeText={setEnd} maxLength={5} /><Field label="Slot length in minutes" value={minutes} onChangeText={setMinutes} keyboardType="number-pad" maxLength={4} /><Button label="Add availability window" loading={busy} onPress={() => void act('availability')} /></Card>}</>}</>;
}
export default function Account() {
  const { profile,logout } = useSession(); const [busy,setBusy] = useState(false); const [error,setError] = useState('');
  return <Screen><Text style={styles.title}>Your account</Text><Card><Text style={styles.heading}>{profile?.first_name} {profile?.last_name}</Text><Text style={styles.body}>{profile?.email}</Text><StatusPill status={profile?.role === 'dentist' ? 'Doctor' : 'Patient'} /><Text style={styles.caption}>The same OraVisionAI account you use on the website.</Text></Card>{profile?.role === 'dentist' && <ProfessionalAccount />}{!!(error) && <Notice error message={error} />}<Button label="Sign out" variant="danger" loading={busy} onPress={() => { setBusy(true); void logout().catch((e) => setError(messageOf(e))).finally(() => setBusy(false)); }} /></Screen>;
}
