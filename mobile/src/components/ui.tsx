import React, { useEffect, useState } from 'react';
import { ActivityIndicator, AccessibilityInfo, Animated, KeyboardAvoidingView, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import type { TextInputProps, ViewStyle, StyleProp } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { colors, styles } from '../theme';

export function Screen({ children, refreshing, onRefresh }: { children: React.ReactNode; refreshing?: boolean; onRefresh?: () => void }) {
  return <SafeAreaView style={styles.page} edges={['left', 'right']}><KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content} refreshControl={onRefresh ? <RefreshControl refreshing={refreshing ?? false} onRefresh={onRefresh} tintColor={colors.teal} /> : undefined}>{children}</ScrollView></KeyboardAvoidingView></SafeAreaView>;
}

export function Entrance({ children }: { children: React.ReactNode }) {
  const [opacity] = useState(() => new Animated.Value(1));
  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled().then((reduced) => {
      if (!alive || reduced) return;
      opacity.setValue(0);
      Animated.timing(opacity, { toValue: 1, duration: 420, useNativeDriver: Platform.OS !== 'web' }).start();
    });
    return () => { alive = false; opacity.stopAnimation(); };
  }, [opacity]);
  return <Animated.View style={{ opacity, gap: 18 }}>{children}</Animated.View>;
}

export function Button({ label, onPress, variant = 'primary', loading = false, disabled = false, icon, style, testID }: {
  label: string; onPress: () => void; variant?: 'primary' | 'outline' | 'danger' | 'ghost';
  loading?: boolean; disabled?: boolean; icon?: React.ComponentProps<typeof Feather>['name']; style?: StyleProp<ViewStyle>; testID?: string;
}) {
  const primary = variant === 'primary';
  const ink = primary ? colors.white : variant === 'danger' ? colors.danger : colors.teal;
  return <Pressable testID={testID} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled: disabled || loading, busy: loading }} disabled={disabled || loading} onPress={onPress} style={({ pressed }) => [ui.button, primary ? { backgroundColor: colors.teal } : variant === 'outline' ? ui.outline : variant === 'danger' ? { backgroundColor: colors.dangerBg } : { backgroundColor: 'transparent' }, { opacity: disabled || loading ? .55 : pressed ? .8 : 1 }, style]}>
    {loading && <ActivityIndicator size="small" color={ink} />}
    <Text style={[ui.buttonText, { color: ink }]}>{label}</Text>
    {icon && !loading && <Feather name={icon} size={17} color={ink} />}
  </Pressable>;
}

export function Field({ label, error, ...props }: TextInputProps & { label: string; error?: string }) {
  return <View style={{ gap: 7 }}><Text style={ui.label}>{label}</Text><TextInput {...props} accessibilityLabel={label} placeholderTextColor="#a0aea0" style={[ui.input, props.multiline && { minHeight: 110, textAlignVertical: 'top' }, props.style]} />{!!(error) && <Text style={{ color: colors.danger, fontSize: 12 }}>{error}</Text>}</View>;
}

export function PasswordField(props: { label?: string; value: string; onChangeText: (value: string) => void; editable?: boolean; newPassword?: boolean }) {
  const [visible, setVisible] = useState(false);
  return <View style={{ position: 'relative' }}><Field label={props.label || 'Password'} value={props.value} onChangeText={props.onChangeText} editable={props.editable} secureTextEntry={!visible} autoCapitalize="none" autoCorrect={false} autoComplete={props.newPassword ? 'new-password' : 'current-password'} placeholder="Enter your password" style={{ paddingRight: 50 }} /><Pressable onPress={() => setVisible((value) => !value)} disabled={props.editable === false} accessibilityRole="button" accessibilityLabel={visible ? 'Hide password' : 'Show password'} style={{ position: 'absolute', right: 8, bottom: 4, padding: 12 }}><Feather name={visible ? 'eye-off' : 'eye'} size={18} color={colors.muted} /></Pressable></View>;
}

export function Card({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) { return <View style={[styles.card, style]}>{children}</View>; }
export function IconTile({ name, dark = false }: { name: React.ComponentProps<typeof Feather>['name']; dark?: boolean }) { return <View style={{ width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: dark ? '#315b49' : colors.mint }}><Feather name={name} size={21} color={dark ? colors.lime : colors.teal} /></View>; }
export function StatusPill({ status }: { status: string }) {
  const problem = ['failed', 'cancelled', 'critical', 'high', 'rejected'].includes(status);
  return <View style={{ alignSelf: 'flex-start', paddingHorizontal: 9, paddingVertical: 5, borderRadius: 6, backgroundColor: problem ? colors.dangerBg : colors.mint }}><Text style={{ color: problem ? colors.danger : colors.teal, fontSize: 10, lineHeight: 14, fontWeight: '600', textTransform: 'capitalize' }}>{status.replace(/_/g, ' ')}</Text></View>;
}
export function Notice({ message, error = false }: { message: string; error?: boolean }) { return <View accessibilityRole={error ? 'alert' : undefined} style={{ backgroundColor: error ? colors.dangerBg : colors.mint, borderRadius: 10, padding: 14, flexDirection: 'row', gap: 9 }}><Feather name={error ? 'alert-circle' : 'info'} size={17} color={error ? colors.danger : colors.teal} /><Text style={{ color: error ? colors.danger : colors.ink, fontSize: 12, lineHeight: 19, flex: 1 }}>{message}</Text></View>; }
export function Empty({ title, message, icon = 'inbox' }: { title: string; message: string; icon?: React.ComponentProps<typeof Feather>['name'] }) { return <Card style={{ alignItems: 'center', paddingVertical: 35 }}><IconTile name={icon} /><Text style={[styles.heading, { textAlign: 'center' }]}>{title}</Text><Text style={[styles.body, { textAlign: 'center' }]}>{message}</Text></Card>; }
export function Loading() { return <View style={{ padding: 40, alignItems: 'center', gap: 15 }}><ActivityIndicator color={colors.teal} /><Text style={styles.caption}>Loading your care space...</Text></View>; }
export function ResourceState({ loading, error, retry }: { loading: boolean; error: string | null; retry: () => void }) { if (loading) return <Loading />; return error ? <Card><Notice error message={error} /><Button label="Try again" variant="outline" onPress={retry} /></Card> : null; }

const ui = StyleSheet.create({
  button: { minHeight: 52, minWidth: 0, maxWidth: '100%', flexShrink: 0, paddingHorizontal: 18, paddingVertical: 13, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, borderRadius: 9 },
  outline: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line },
  buttonText: { fontSize: 13, lineHeight: 20, fontWeight: '600', flexShrink: 1, textAlign: 'center', includeFontPadding: false },
  label: { color: '#526958', fontSize: 12, fontWeight: '500' },
  input: { minHeight: 49, borderWidth: 1, borderColor: colors.line, borderRadius: 9, paddingHorizontal: 14, paddingVertical: 12, backgroundColor: colors.white, color: colors.ink, fontSize: 14 },
});
