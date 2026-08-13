import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import { useAuthStore } from '../src/store/auth.store';
import { useTheme } from '../src/theme/useTheme';
import { useNotificationObserver } from '../src/hooks/usePushNotifications';

export default function RootLayout() {
  const { isRestoring, restoreSession } = useAuthStore();
  const theme = useTheme();

  useNotificationObserver();

  useEffect(() => {
    restoreSession();
  }, [restoreSession]);

  if (isRestoring) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.bg }}>
        <ActivityIndicator color={theme.primary} />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      {/* Push/pop stile iOS: durata 380ms (onorata da native-stack solo su iOS; Android
          usa la curva nativa di piattaforma, native-stack non espone easing/offset custom da JS). */}
      <Stack screenOptions={{ headerShown: false, animation: 'default', animationDuration: 380 }} />
    </SafeAreaProvider>
  );
}
