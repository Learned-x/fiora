import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useAuthStore } from '../src/store/auth.store';
import { useTheme, useIsDark } from '../src/theme/useTheme';
import { useNotificationObserver } from '../src/hooks/usePushNotifications';

export default function RootLayout() {
  const { isRestoring, restoreSession } = useAuthStore();
  const theme = useTheme();
  const dark = useIsDark();

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
      {/* style inverso allo sfondo (bg bianco/nero puro): icone scure su sfondo chiaro
          e viceversa. Su Android senza questo l'icona resta al default di sistema e
          può risultare illeggibile contro card/header scuri. */}
      <StatusBar style={dark ? 'light' : 'dark'} />
      {/* Push/pop stile iOS: durata 380ms (onorata da native-stack solo su iOS; Android
          usa la curva nativa di piattaforma, native-stack non espone easing/offset custom da JS). */}
      <Stack screenOptions={{ headerShown: false, animation: 'default', animationDuration: 380 }} />
    </SafeAreaProvider>
  );
}
