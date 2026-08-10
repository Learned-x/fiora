import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useTheme } from '../../src/theme/useTheme';
import { typography } from '../../src/theme/typography';
import { spacing } from '../../src/theme/spacing';
import { radius } from '../../src/theme/radius';
import { Card } from '../../src/components/Card';
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
        <Text style={[styles.title, { color: theme.onSurface }]}>Impostazioni</Text>

        {/* Profilo */}
        <Card variant="elevated" style={styles.profile}>
          <View style={[styles.avatar, { backgroundColor: theme.primaryContainer }]}>
            <Text style={{ fontSize: 22 }}>🌿</Text>
          </View>
          <View style={{ flexShrink: 1 }}>
            <Text style={[styles.profileName, { color: theme.onSurface }]}>
              {profile?.name ?? user?.name ?? 'Utente Fiora'}
            </Text>
            <Text style={[styles.profileEmail, { color: theme.onSurfaceVariant }]}>
              {profile?.email ?? user?.email ?? '—'}
            </Text>
          </View>
        </Card>

        {/* Preferenze */}
        <Text style={[styles.sectionLabel, { color: theme.onSurfaceVariant }]}>Preferenze</Text>
        <Card variant="flat" style={styles.card}>
          <Pressable
            onPress={handleChangeClima}
            accessibilityRole="button"
            accessibilityLabel={`Clima: ${profile ? CLIMA_LABELS[profile.clima] : 'non impostato'}`}
            style={({ pressed }) => [
              styles.row,
              { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.outlineVariant },
              pressed && { opacity: 0.7 },
            ]}
          >
            <View style={{ flexShrink: 1 }}>
              <Text style={[styles.rowTitle, { color: theme.onSurface }]}>Clima</Text>
              <Text style={[styles.rowSub, { color: theme.onSurfaceVariant }]}>Adatta le scadenze di annaffiatura</Text>
            </View>
            <Text style={[styles.rowValue, { color: theme.onSurfaceVariant }]}>
              {profile ? CLIMA_LABELS[profile.clima] : '—'}
            </Text>
          </Pressable>
          <Pressable
            onPress={handleChangeOrario}
            accessibilityRole="button"
            accessibilityLabel={`Orario promemoria: ${profile ? ORARIO_LABELS[profile.orarioReminder] ?? 'non impostato' : 'non impostato'}`}
            style={({ pressed }) => [
              styles.row,
              { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.outlineVariant },
              pressed && { opacity: 0.7 },
            ]}
          >
            <View style={{ flexShrink: 1 }}>
              <Text style={[styles.rowTitle, { color: theme.onSurface }]}>Orario promemoria</Text>
              <Text style={[styles.rowSub, { color: theme.onSurfaceVariant }]}>Quando ricevere le notifiche</Text>
            </View>
            <Text style={[styles.rowValue, { color: theme.onSurfaceVariant }]}>
              {profile ? ORARIO_LABELS[profile.orarioReminder] ?? '—' : '—'}
            </Text>
          </Pressable>
          <View style={styles.row}>
            <View style={{ flexShrink: 1 }}>
              <Text style={[styles.rowTitle, { color: theme.onSurface }]}>Modalità scura</Text>
              <Text style={[styles.rowSub, { color: theme.onSurfaceVariant }]}>Segue le impostazioni di sistema</Text>
            </View>
            <Text style={[styles.rowValue, { color: theme.onSurfaceVariant }]}>Automatica</Text>
          </View>
        </Card>

        {/* Dispositivi */}
        <Text style={[styles.sectionLabel, { color: theme.onSurfaceVariant }]}>Dispositivi</Text>
        <Card variant="flat" style={styles.card}>
          <View style={[styles.row, { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.outlineVariant }]}>
            <Text style={[styles.rowTitle, { color: theme.onSurface }]}>Vasi Smart</Text>
            <Text style={[styles.rowValue, { color: theme.onSurfaceVariant }]}>Prossimamente</Text>
          </View>
          <View style={styles.row}>
            <View style={{ flexShrink: 1 }}>
              <Text style={[styles.rowTitle, { color: theme.onSurface }]}>Notifiche</Text>
              <Text style={[styles.rowSub, { color: theme.onSurfaceVariant }]}>Promemoria delle cure del giorno</Text>
            </View>
            <Switch
              value={pushEnabled}
              disabled={togglingPush}
              onValueChange={handleTogglePush}
              trackColor={{ true: theme.primary, false: theme.outlineVariant }}
              thumbColor={theme.surface}
              accessibilityLabel="Notifiche cure del giorno"
            />
          </View>
        </Card>

        {/* Account */}
        <Text style={[styles.sectionLabel, { color: theme.onSurfaceVariant }]}>Account</Text>
        <Card variant="flat" style={styles.card}>
          {!!profile?.email && (
            <Pressable
              onPress={() => router.push('/change-email')}
              accessibilityRole="button"
              accessibilityLabel="Cambia email"
              style={({ pressed }) => [
                styles.row,
                { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.outlineVariant },
                pressed && { opacity: 0.7 },
              ]}
            >
              <Text style={[styles.rowTitle, { color: theme.onSurface }]}>Cambia email</Text>
            </Pressable>
          )}
          <Pressable
            onPress={() => router.push('/change-password')}
            accessibilityRole="button"
            accessibilityLabel="Cambia password"
            style={({ pressed }) => [
              styles.row,
              { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.outlineVariant },
              pressed && { opacity: 0.7 },
            ]}
          >
            <Text style={[styles.rowTitle, { color: theme.onSurface }]}>Cambia password</Text>
          </Pressable>
          <Pressable
            onPress={handleLogout}
            accessibilityRole="button"
            accessibilityLabel="Esci dall'account"
            style={({ pressed }) => [
              styles.row,
              { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.outlineVariant },
              pressed && { opacity: 0.7 },
            ]}
          >
            <Text style={[styles.rowTitle, { color: theme.error }]}>Esci dall'account</Text>
          </Pressable>
          <Pressable
            onPress={handleDeleteAccount}
            accessibilityRole="button"
            accessibilityLabel="Elimina account"
            style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}
          >
            <Text style={[styles.rowTitle, { color: theme.error }]}>Elimina account</Text>
          </Pressable>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: spacing.md16, paddingBottom: spacing.lg24 },
  title: { ...typography.headlineMedium, marginBottom: spacing.md20 },
  profile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm12,
    padding: spacing.md16,
    marginBottom: spacing.lg24,
  },
  avatar: { width: 52, height: 52, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
  profileName: { ...typography.titleMedium, marginBottom: 1 },
  profileEmail: { ...typography.bodyMedium },
  sectionLabel: {
    ...typography.labelMedium,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.xs8,
    paddingHorizontal: spacing.xs4,
  },
  card: { overflow: 'hidden', marginBottom: spacing.md20 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm12 + 2,
    paddingHorizontal: spacing.md16,
    minHeight: 44,
    gap: spacing.sm12,
  },
  rowTitle: { ...typography.bodyLarge, marginBottom: 1 },
  rowSub: { ...typography.bodySmall },
  rowValue: { ...typography.bodyMedium },
});
