import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useTheme } from '../../src/theme/useTheme';
import { useAuthStore } from '../../src/store/auth.store';
import { updateMe } from '../../src/services/user.api';
import type { Clima } from '../../src/types/models';

const CLIMA_LABELS: Record<Clima, string> = {
  freddo: 'Freddo',
  temperato: 'Temperato',
  appartamento: 'Appartamento riscaldato',
  mediterraneo: 'Mediterraneo',
  tropicale: 'Tropicale',
};

export default function SettingsScreen() {
  const theme = useTheme();
  const { user, profile, logout, refreshProfile } = useAuthStore();

  function handleLogout() {
    Alert.alert('Esci', 'Vuoi uscire dal tuo account?', [
      { text: 'Annulla', style: 'cancel' },
      {
        text: 'Esci',
        style: 'destructive',
        onPress: async () => {
          await logout();
          router.replace('/(auth)/climate');
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
            <Text style={[styles.rowTitle, { color: theme.t1 }]}>Notifiche</Text>
            <Text style={[styles.rowValue, { color: theme.t3 }]}>Prossimamente</Text>
          </View>
        </View>

        {/* Account */}
        <Text style={[styles.sectionLabel, { color: theme.t2 }]}>Account</Text>
        <View style={[styles.card, { backgroundColor: theme.card }]}>
          <Pressable
            onPress={() => router.push('/change-password')}
            style={[styles.row, { borderBottomWidth: 1, borderBottomColor: theme.bord }]}
          >
            <Text style={[styles.rowTitle, { color: theme.t1 }]}>Cambia password</Text>
          </Pressable>
          <Pressable onPress={handleLogout} style={styles.row}>
            <Text style={[styles.rowTitle, { color: theme.red }]}>Esci dall'account</Text>
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
