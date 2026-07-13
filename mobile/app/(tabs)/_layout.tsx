import { Redirect, Tabs } from 'expo-router';
import { useAuthStore } from '../../src/store/auth.store';
import { TabBar } from '../../src/components/TabBar';

export default function TabsLayout() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const profile = useAuthStore((state) => state.profile);

  if (!isAuthenticated) {
    return <Redirect href="/(auth)" />;
  }

  // Gate soft: se il profilo non è ancora caricato (es. restore offline) non blocchiamo.
  if (profile && !profile.onboardingDone) {
    return <Redirect href="/onboarding/climate" />;
  }

  return (
    <Tabs screenOptions={{ headerShown: false }} tabBar={(props) => <TabBar {...props} />}>
      <Tabs.Screen name="index" />
      <Tabs.Screen name="plants" />
      <Tabs.Screen name="vasi" />
      <Tabs.Screen name="settings" />
    </Tabs>
  );
}
