import { useEffect } from 'react';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import { updateMe } from '../services/user.api';
import { useAuthStore } from '../store/auth.store';

// Notifica ricevuta con app in foreground: mostra il banner senza suono.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

// Registra il device alle push: permessi → token Expo → PATCH /users/me.
// Ritorna il token, o null se non disponibile (simulatore, permesso negato).
export async function registerForPushNotifications(): Promise<string | null> {
  if (!Device.isDevice) return null;

  const { status: existing } = await Notifications.getPermissionsAsync();
  let status = existing;
  if (status !== 'granted') {
    ({ status } = await Notifications.requestPermissionsAsync());
  }
  if (status !== 'granted') return null;

  const projectId = Constants.expoConfig?.extra?.eas?.projectId as string | undefined;
  const { data: token } = await Notifications.getExpoPushTokenAsync(
    projectId ? { projectId } : undefined
  );

  await updateMe({ pushToken: token });
  await useAuthStore.getState().refreshProfile();
  return token;
}

// Disattiva le push lato server (il toggle in Impostazioni usa pushToken null).
export async function disablePushNotifications(): Promise<void> {
  await updateMe({ pushToken: null });
  await useAuthStore.getState().refreshProfile();
}

function navigateFromNotification(response: Notifications.NotificationResponse | null) {
  const url = response?.notification.request.content.data?.url;
  if (typeof url === 'string' && url.length > 0) {
    router.push(url as never);
  }
}

// Listener per il tap sulle notifiche: naviga verso data.url ('/plant/<id>' o '/').
// Gestisce anche il cold start (app aperta dal tap).
export function useNotificationObserver() {
  useEffect(() => {
    let mounted = true;

    Notifications.getLastNotificationResponseAsync().then((response) => {
      if (mounted) navigateFromNotification(response);
    });

    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      navigateFromNotification(response);
    });

    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);
}
