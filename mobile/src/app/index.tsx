import { Redirect } from 'expo-router';
import { useSession } from '../context/Session';
export default function Index() { const { profile } = useSession(); return <Redirect href={profile ? '/(tabs)' : '/login'} />; }
