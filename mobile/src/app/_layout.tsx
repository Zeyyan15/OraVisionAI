import React from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { SessionProvider, useSession } from '../context/Session';
import { Loading } from '../components/ui';
import { colors } from '../theme';

function Navigator() {
  const { profile, loading } = useSession();
  if (loading) return <Loading />;
  return <Stack screenOptions={{ headerStyle: { backgroundColor: colors.paper }, headerTintColor: colors.ink, headerShadowVisible: false, headerTitleStyle: { fontSize: 16, fontWeight: '600' }, contentStyle: { backgroundColor: colors.background } }}>
    <Stack.Screen name="index" options={{ headerShown: false }} />
    <Stack.Protected guard={!profile}>
      <Stack.Screen name="login" options={{ headerShown: false }} />
      <Stack.Screen name="register" options={{ headerShown: false }} />
    </Stack.Protected>
    <Stack.Protected guard={Boolean(profile)}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="consultation/[id]" options={{ title: 'Consultation room' }} />
      <Stack.Screen name="appointments" options={{ title: 'Appointments' }} />
      <Stack.Screen name="screening/new" options={{ title: 'New screening' }} />
      <Stack.Screen name="screening/[id]" options={{ title: 'Screening details' }} />
      <Stack.Screen name="dentists" options={{ title: 'Find your practitioner' }} />
      <Stack.Screen name="dentist/[id]" options={{ title: 'Book a consultation' }} />
      <Stack.Screen name="conversation/[id]" options={{ title: 'Your conversation' }} />
      <Stack.Screen name="notifications" options={{ title: 'Updates' }} />
    </Stack.Protected>
  </Stack>;
}
export default function RootLayout() { return <GestureHandlerRootView style={{ flex: 1 }}><SafeAreaProvider><SessionProvider><StatusBar style="dark" /><Navigator /></SessionProvider></SafeAreaProvider></GestureHandlerRootView>; }
