import { Redirect, Tabs } from 'expo-router';
import { useAuthStore } from '../../src/store/auth.store';
import { TabBar } from '../../src/components/TabBar';

export default function TabsLayout() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  if (!isAuthenticated) {
    return <Redirect href="/(auth)/climate" />;
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
