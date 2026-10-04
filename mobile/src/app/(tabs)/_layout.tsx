import { Tabs } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSession } from '../../context/Session';
import { colors } from '../../theme';

export default function TabLayout() {
  const doctor = useSession().profile?.role === 'dentist';
  const insets = useSafeAreaInsets();
  return <Tabs screenOptions={{ headerShown: true, headerStyle: { backgroundColor: colors.paper }, headerTintColor: colors.ink, headerShadowVisible: false, tabBarActiveTintColor: colors.teal, tabBarInactiveTintColor: '#92a08d', tabBarStyle: { backgroundColor: colors.paper, borderTopColor: colors.line, height: 72 + insets.bottom, paddingTop: 8, paddingBottom: Math.max(8, insets.bottom) }, tabBarLabelStyle: { fontSize: 10, lineHeight: 14, fontWeight: '500' } }}>
    <Tabs.Screen name="index" options={{ title: 'Home', tabBarIcon: ({ color, size }) => <Feather name="home" size={size - 2} color={color} /> }} />
    <Tabs.Screen name="screenings" options={{ title: doctor ? 'Cases' : 'Screenings', tabBarIcon: ({ color, size }) => <Feather name="activity" size={size - 2} color={color} /> }} />
    <Tabs.Screen name="consultations" options={{ title: 'Consultations', tabBarIcon: ({ color, size }) => <Feather name="video" size={size - 2} color={color} /> }} />
    <Tabs.Screen name="messages" options={{ title: 'Messages', tabBarIcon: ({ color, size }) => <Feather name="message-circle" size={size - 2} color={color} /> }} />
    <Tabs.Screen name="account" options={{ title: 'Account', tabBarIcon: ({ color, size }) => <Feather name="user" size={size - 2} color={color} /> }} />
  </Tabs>;
}
