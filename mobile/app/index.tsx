import { Redirect } from 'expo-router';
import { useAuthStore } from '../src/store/auth.store';

export default function Index() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  return <Redirect href={isAuthenticated ? '/home' : '/(auth)/climate'} />;
}
