import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Slot } from 'expo-router';
import { useAuthStore } from '../src/store/auth.store';
import { useTheme } from '../src/theme/useTheme';

export default function RootLayout() {
  const { isRestoring, restoreSession } = useAuthStore();
  const theme = useTheme();

  useEffect(() => {
    restoreSession();
  }, [restoreSession]);

  if (isRestoring) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.bg }}>
        <ActivityIndicator color={theme.acc} />
      </View>
    );
  }

  return <Slot />;
}
