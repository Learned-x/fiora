import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useTheme } from '../../src/theme/useTheme';
import { useAuthStore } from '../../src/store/auth.store';
import { updateMe, requestAccountDeletion } from '../../src/services/user.api';
import {
  disablePushNotifications,
  registerForPushNotifications,
} from '../../src/hooks/usePushNotifications';
import type { Clima } from '../../src/types/models';

const CLIMA_LABELS: Record<Clima, string> = {
  freddo: 'Freddo',
  temperato: 'Temperato',
  appartamento: 'Appartamento riscaldato',
  mediterraneo: 'Mediterraneo',
  tropicale: 'Tropicale',
};

// Coerente con le opzioni seed 'orario_reminder' del backend.
const ORARIO_LABELS: Record<string, string> = {
  mattina_9: 'Mattina (9:00)',
  pomeriggio_15: 'Pomeriggio (15:00)',
  sera_19: 'Sera (19:00)',
};

export default function SettingsScreen() {
  const theme = useTheme();
  const { user, profile, logout, refreshProfile } = useAuthStore();
  const [togglingPush, setTogglingPush] = useState(false);
  const pushEnabled = profile?.pushToken != null;

  async function handleTogglePush(value: boolean) {
    if (togglingPush) return;
    setTogglingPush(true);
    try {
      if (value) {
        const token = await registerForPushNotifications();
        if (!token) {
          Alert.alert(
            'Notifiche non disponibili',
            'Consenti le notifiche dalle Impostazioni di sistema, oppure usa un dispositivo reale.'
          );
        }
      } else {
        await disablePushNotifications();
      }
    } catch {
      Alert.alert('Errore', 'Aggiornamento non riuscito, riprova.');
    } finally {
      setTogglingPush(false);
    }
  }

  function handleChangeOrario() {
    const options = Object.keys(ORARIO_LABELS).map((orario) => ({
      text: ORARIO_LABELS[orario] + (profile?.orarioReminder === orario ? ' ✓' : ''),
      onPress: async () => {
        if (profile?.orarioReminder === orario) return;
        try {
          await updateMe({ orarioReminder: orario });
          await refreshProfile();
        } catch {
          Alert.alert('Errore', 'Aggiornamento non riuscito, riprova.');
        }
      },
    }));
    Alert.alert('Orario promemoria', 'Quando vuoi ricevere le notifiche delle cure?', [
      ...options,
      { text: 'Annulla', style: 'cancel' },
    ]);
  }

  function handleDeleteAccount() {
    Alert.alert(
      'Elimina account',
      "L'account verrà eliminato definitivamente tra 30 giorni. Potrai annullare l'operazione accedendo di nuovo entro quel periodo.",
      [
        { text: 'Annulla', style: 'cancel' },
        {
          text: 'Elimina account',
          style: 'destructive',
          onPress: async () => {
            try {
              await requestAccountDeletion();
              await refreshProfile();
            } catch {
              Alert.alert('Errore', 'Operazione non riuscita, riprova.');
            }
          },
        },
      ]
    );
  }

  function handleLogout() {
    Alert.alert('Esci', 'Vuoi uscire dal tuo account?', [
      { text: 'Annulla', style: 'cancel' },
      {
        text: 'Esci',
        style: 'destructive',
        onPress: async () => {
          await logout();
          router.replace('/(auth)');
        },
      },
    ]);
  }

  function handleChangeClima() {
    const options = (Object.keys(CLIMA_LABELS) as Clima[]).map((clima) => ({
      text: CLIMA_LABELS[clima] + (profile?.clima === clima ? ' ✓' : ''),
      onPress: async () => {
        if (profile?.clima === clima) return;
        try {
          await updateMe({ clima });
          await refreshProfile();
        } catch {
          Alert.alert('Errore', 'Aggiornamento non riuscito, riprova.');
        }
      },
    }));
    Alert.alert('Clima', 'Le scadenze di annaffiatura si adattano al tuo clima.', [
      ...options,
      { text: 'Annulla', style: 'cancel' },
    ]);
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.title, { color: theme.t1 }]}>Impostazioni</Text>

        {/* Profilo */}
        <View style={[styles.profile, { backgroundColor: theme.card }]}>
          <View style={[styles.avatar, { backgroundColor: theme.acc }]}>
            <Text style={{ fontSize: 22 }}>🌿</Text>
          </View>
          <View>
            <Text style={[styles.profileName, { color: theme.t1 }]}>
              {profile?.name ?? user?.name ?? 'Utente Fiora'}
            </Text>
            <Text style={[styles.profileEmail, { color: theme.t2 }]}>
              {profile?.email ?? user?.email ?? '—'}
            </Text>
          </View>
        </View>

        {/* Preferenze */}
        <Text style={[styles.sectionLabel, { color: theme.t2 }]}>Preferenze</Text>
        <View style={[styles.card, { backgroundColor: theme.card }]}>
          <Pressable onPress={handleChangeClima} style={[styles.row, { borderBottomWidth: 1, borderBottomColor: theme.bord }]}>
            <View>
              <Text style={[styles.rowTitle, { color: theme.t1 }]}>Clima</Text>
              <Text style={[styles.rowSub, { color: theme.t2 }]}>Adatta le scadenze di annaffiatura</Text>
            </View>
            <Text style={[styles.rowValue, { color: theme.t2 }]}>
              {profile ? CLIMA_LABELS[profile.clima] : '—'}
            </Text>
          </Pressable>
          <Pressable onPress={handleChangeOrario} style={[styles.row, { borderBottomWidth: 1, borderBottomColor: theme.bord }]}>
            <View>
              <Text style={[styles.rowTitle, { color: theme.t1 }]}>Orario promemoria</Text>
              <Text style={[styles.rowSub, { color: theme.t2 }]}>Quando ricevere le notifiche</Text>
            </View>
            <Text style={[styles.rowValue, { color: theme.t2 }]}>
              {profile ? ORARIO_LABELS[profile.orarioReminder] ?? '—' : '—'}
            </Text>
          </Pressable>
          <View style={styles.row}>
            <View>
              <Text style={[styles.rowTitle, { color: theme.t1 }]}>Modalità scura</Text>
              <Text style={[styles.rowSub, { color: theme.t2 }]}>Segue le impostazioni di sistema</Text>
            </View>
            <Text style={[styles.rowValue, { color: theme.t2 }]}>Automatica</Text>
          </View>
        </View>

        {/* Dispositivi */}
        <Text style={[styles.sectionLabel, { color: theme.t2 }]}>Dispositivi</Text>
        <View style={[styles.card, { backgroundColor: theme.card }]}>
          <View style={[styles.row, { borderBottomWidth: 1, borderBottomColor: theme.bord }]}>
            <Text style={[styles.rowTitle, { color: theme.t1 }]}>Vasi Smart</Text>
            <Text style={[styles.rowValue, { color: theme.t3 }]}>Prossimamente</Text>
          </View>
          <View style={styles.row}>
            <View>
              <Text style={[styles.rowTitle, { color: theme.t1 }]}>Notifiche</Text>
              <Text style={[styles.rowSub, { color: theme.t2 }]}>Promemoria delle cure del giorno</Text>
            </View>
            <Switch
              value={pushEnabled}
              disabled={togglingPush}
              onValueChange={handleTogglePush}
              trackColor={{ true: theme.acc }}
            />
          </View>
        </View>

        {/* Account */}
        <Text style={[styles.sectionLabel, { color: theme.t2 }]}>Account</Text>
        <View style={[styles.card, { backgroundColor: theme.card }]}>
          {!!profile?.email && (
            <Pressable
              onPress={() => router.push('/change-email')}
              style={[styles.row, { borderBottomWidth: 1, borderBottomColor: theme.bord }]}
            >
              <Text style={[styles.rowTitle, { color: theme.t1 }]}>Cambia email</Text>
            </Pressable>
          )}
          <Pressable
            onPress={() => router.push('/change-password')}
            style={[styles.row, { borderBottomWidth: 1, borderBottomColor: theme.bord }]}
          >
            <Text style={[styles.rowTitle, { color: theme.t1 }]}>Cambia password</Text>
          </Pressable>
          <Pressable
            onPress={handleLogout}
            style={[styles.row, { borderBottomWidth: 1, borderBottomColor: theme.bord }]}
          >
            <Text style={[styles.rowTitle, { color: theme.red }]}>Esci dall'account</Text>
          </Pressable>
          <Pressable onPress={handleDeleteAccount} style={styles.row}>
            <Text style={[styles.rowTitle, { color: theme.red }]}>Elimina account</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 24 },
  title: { fontSize: 30, fontWeight: '700', letterSpacing: -0.6, marginBottom: 20 },
  profile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderRadius: 14,
    padding: 16,
    marginBottom: 24,
  },
  avatar: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  profileName: { fontSize: 17, fontWeight: '600', marginBottom: 1 },
  profileEmail: { fontSize: 14 },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  card: { borderRadius: 14, overflow: 'hidden', marginBottom: 20 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  rowTitle: { fontSize: 16, marginBottom: 1 },
  rowSub: { fontSize: 13 },
  rowValue: { fontSize: 15 },
});
