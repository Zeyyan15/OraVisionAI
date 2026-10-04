import React, { useState } from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { useSession } from '../context/Session';
import { firebaseConfigured } from '../config/firebaseConfig';
import { Button, Entrance, Field, Notice, PasswordField, Screen } from '../components/ui';
import { colors, serif, styles } from '../theme';
import { messageOf } from '../utils/consultation';
import { passwordRequirements } from '../utils/password';

export function AuthScreen({ register }: { register: boolean }) {
  const session = useSession();
  const [role, setRole] = useState<'patient' | 'dentist'>('patient');
  const [email, setEmail] = useState(''); const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [first, setFirst] = useState(''); const [last, setLast] = useState('');
  const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null);
  const submit = async () => {
    if (busy) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { setError('Please enter a valid email address.'); return; }
    if (!password || (register && !passwordRequirements(password).every((r) => r.met))) { setError(register ? 'Your password must meet all four security requirements.' : 'Please enter your password.'); return; }
    if (register && password !== confirmation) { setError('Passwords do not match.'); return; }
    if (register && (!first.trim() || !last.trim())) { setError('Please enter your first and last name.'); return; }
    setBusy(true); setError(null);
    try {
      if (register) await session.register(email, password, role, first, last);
      else await session.login(email, password);
    } catch (failure) { setError(messageOf(failure)); }
    finally { setBusy(false); }
  };
  return <SafeAreaView style={styles.page} edges={['top', 'bottom']}><Screen><Entrance>
    <Image source={require('../../assets/logo.png')} resizeMode="contain" style={{ width: 147, height: 42, alignSelf: 'flex-start', marginBottom: 6 }} accessibilityLabel="OraVisionAI" />
    <LinearGradient colors={[colors.forest, '#2c5a43']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ borderRadius: 19, padding: 24, gap: 14, overflow: 'hidden' }}>
      <View style={styles.row}><View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: colors.lime }} /><Text style={[styles.kicker, { color: colors.lime }]}>ORAL HEALTH, IN FOCUS</Text></View>
      <Text style={{ color: colors.white, fontSize: 32, fontWeight: '500', lineHeight: 38, letterSpacing: -.9 }}>Good care starts{ '\n' }with <Text style={{ fontFamily: serif, fontStyle: 'italic', color: colors.lime }}>clarity.</Text></Text>
      <Text style={{ color: '#b2cbb7', fontSize: 12, lineHeight: 20 }}>Your screenings, conversations, and care.{ '\n' }Together in one place.</Text>
      <Feather name="aperture" size={120} color="#b5d4a218" style={{ position: 'absolute', right: -18, bottom: -15 }} />
    </LinearGradient>
    <View style={{ gap: 9, marginTop: 8 }}><Text style={styles.title}>{register ? 'Your next step starts here.' : 'Your care. Your space.'}</Text><Text style={styles.body}>{register ? 'Create your OraVisionAI account.' : 'Welcome back. Sign in to continue your journey.'}</Text></View>
    {!firebaseConfigured && <Notice error message="Firebase configuration is missing. Add the public project settings in mobile/.env and restart Expo." />}
    {!!(error || session.error) && <Notice error message={error || session.error || ''} />}
    {register && <View style={{ gap: 9 }}><Text style={[styles.caption, { color: colors.ink }]}>I am joining as a</Text><View style={styles.row}>{(['patient', 'dentist'] as const).map((value) => <Pressable key={value} accessibilityRole="radio" accessibilityState={{ checked: role === value, disabled: busy }} accessibilityLabel={value === 'patient' ? 'Patient account' : 'Doctor account'} disabled={busy} onPress={() => setRole(value)} style={{ flex: 1, padding: 14, borderRadius: 10, borderWidth: 1, borderColor: role === value ? '#75ac85' : colors.line, backgroundColor: role === value ? colors.mint : colors.white, gap: 7 }}><View style={styles.between}><Feather name={value === 'patient' ? 'user' : 'briefcase'} size={19} color={colors.teal} />{role === value && <Feather name="check-circle" size={15} color={colors.teal} />}</View><Text style={{ color: colors.ink, fontWeight: '600', fontSize: 13 }}>{value === 'patient' ? 'Patient' : 'Doctor'}</Text><Text style={styles.caption}>{value === 'patient' ? 'My oral health' : 'Care for patients'}</Text></Pressable>)}</View>{role === 'dentist' && <Notice message="Practitioner accounts require license verification before clinical consultation features are available." />}</View>}
    {register && <View style={styles.row}><View style={{ flex: 1 }}><Field label="First name" value={first} onChangeText={setFirst} editable={!busy} autoComplete="given-name" /></View><View style={{ flex: 1 }}><Field label="Last name" value={last} onChangeText={setLast} editable={!busy} autoComplete="family-name" /></View></View>}
    <Field label="Email address" value={email} onChangeText={setEmail} autoCapitalize="none" autoCorrect={false} keyboardType="email-address" autoComplete="email" placeholder="you@example.com" editable={!busy} />
    <PasswordField value={password} onChangeText={setPassword} editable={!busy} newPassword={register} />
    {register && <><View style={{gap:6}}>{passwordRequirements(password).map((r) => <Text key={r.label} style={[styles.caption,{color:r.met ? colors.teal : colors.muted}]}>{r.met ? '✓' : '○'} {r.label}</Text>)}</View><PasswordField label="Confirm password" value={confirmation} onChangeText={setConfirmation} editable={!busy} newPassword /></>}
    <Button testID="auth-submit" label={busy ? register ? 'Creating your account...' : 'Signing you in...' : register ? 'Create your account' : 'Sign in to your account'} onPress={() => void submit()} loading={busy} disabled={!firebaseConfigured} icon="arrow-right" />
    {session.identity && !session.profile && <View style={{ gap: 8 }}><Button label="Retry loading my account" variant="outline" onPress={() => void session.retry()} /><Button label="Sign out and try another account" variant="ghost" onPress={() => void session.logout().catch((failure) => setError(messageOf(failure)))} /></View>}
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 7, marginTop: 5 }}><Text style={styles.caption}>{register ? 'Already have an account?' : 'New to OraVisionAI?'}</Text><Pressable accessibilityRole="link" onPress={() => router.replace(register ? '/login' : '/register')}><Text style={[styles.caption, { color: colors.teal, fontWeight: '600' }]}>{register ? 'Sign in' : 'Create your account'} →</Text></Pressable></View>
    <View style={[styles.row, { justifyContent: 'center', marginTop: 10 }]}><Feather name="shield" size={13} color={colors.muted} /><Text style={styles.caption}>Technology to support you. Professionals to guide you.</Text></View>
  </Entrance></Screen></SafeAreaView>;
}
