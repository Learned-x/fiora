import { Redirect, Stack } from 'expo-router';
import { useAuthStore } from '../../src/store/auth.store';

// Onboarding post-auth (scelta clima): solo per utenti autenticati
// che non hanno ancora completato l'onboarding.
export default function OnboardingLayout() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const profile = useAuthStore((s) => s.profile);

  if (!isAuthenticated) {
    return <Redirect href="/(auth)" />;
  }
  if (profile?.onboardingDone) {
    return <Redirect href="/(tabs)" />;
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}
