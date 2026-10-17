import React from 'react';
import { useFonts } from 'expo-font';
import { ActivityIndicator, View } from 'react-native';
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
  return <Stack screenOptions={{ headerStyle: { backgroundColor: colors.paper }, headerTintColor: colors.ink, headerShadowVisible: false, headerTitleStyle: { fontFamily: 'JakartaBold', fontSize: 16, fontWeight: 'normal' }, contentStyle: { backgroundColor: colors.background } }}>
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
export default function RootLayout() {
  const [loaded, error] = useFonts({
    JakartaRegular: require('../../assets/fonts/PlusJakartaSans-400.ttf'),
    JakartaMedium: require('../../assets/fonts/PlusJakartaSans-500.ttf'),
    JakartaSemiBold: require('../../assets/fonts/PlusJakartaSans-600.ttf'),
    JakartaBold: require('../../assets/fonts/PlusJakartaSans-700.ttf'),
    JakartaExtraBold: require('../../assets/fonts/PlusJakartaSans-800.ttf'),
  });
  if (!loaded && !error) return <View style={{ flex: 1, justifyContent: 'center', backgroundColor: colors.background }}><ActivityIndicator color={colors.teal} /></View>;
  return <GestureHandlerRootView style={{ flex: 1 }}><SafeAreaProvider><SessionProvider><StatusBar style="dark" /><Navigator /></SessionProvider></SafeAreaProvider></GestureHandlerRootView>;
}
