import { useState } from 'react';
import { Alert, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '../../src/theme/useTheme';
import { Button } from '../../src/components/Button';
import { useAuthStore } from '../../src/store/auth.store';
import { updateMe } from '../../src/services/user.api';
import { registerForPushNotifications } from '../../src/hooks/usePushNotifications';
import type { Clima } from '../../src/types/models';
import { spacing } from '../../src/theme/spacing';
import { typography } from '../../src/theme/typography';

const CLIMATES: { id: Clima; label: string; desc: string }[] = [
  { id: 'temperato', label: 'Temperato', desc: 'Nord Italia, Europa centrale' },
  { id: 'mediterraneo', label: 'Mediterraneo', desc: 'Centro-Sud Italia, Spagna' },
  { id: 'tropicale', label: 'Tropicale', desc: 'Caldo e umido tutto l’anno' },
  { id: 'freddo', label: 'Freddo', desc: 'Inverni rigidi, climi continentali' },
  { id: 'appartamento', label: 'Appartamento riscaldato', desc: 'Stagionalità ridotta' },
];

export default function OnboardingClimateScreen() {
  const theme = useTheme();
  const refreshProfile = useAuthStore((s) => s.refreshProfile);
  const [selected, setSelected] = useState<Clima | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleContinue() {
    if (!selected) return;
    setSaving(true);
    try {
      await updateMe({ clima: selected, onboardingDone: true });
      await refreshProfile();
      // Prompt permessi push subito dopo l'onboarding, best-effort.
      registerForPushNotifications().catch(() => {});
      router.replace('/(tabs)');
    } catch {
      Alert.alert('Errore', 'Impossibile salvare il clima. Riprova.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={[styles.progress, { color: theme.onSurfaceVariant }]}>Ultimo passaggio</Text>
        <Text style={[styles.title, { color: theme.onSurface }]}>Dove vivi?</Text>
        <Text style={[styles.subtitle, { color: theme.onSurfaceVariant }]}>Adattiamo la cura al tuo clima.</Text>

        <View style={styles.list}>
          {CLIMATES.map((climate) => {
            const isSelected = selected === climate.id;
            return (
              <Pressable
                key={climate.id}
                onPress={() => setSelected(climate.id)}
                accessibilityRole="button"
                accessibilityLabel={`${climate.label}, ${climate.desc}`}
                accessibilityState={{ selected: isSelected }}
                style={[
                  styles.card,
                  isSelected
                    ? { backgroundColor: theme.primaryContainer, borderColor: 'transparent' }
                    : { backgroundColor: theme.surface, borderColor: theme.outlineVariant },
                ]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[styles.cardLabel, { color: isSelected ? theme.onPrimaryContainer : theme.onSurface }]}>
                    {climate.label}
                  </Text>
                  <Text
                    style={[
                      styles.cardDesc,
                      { color: isSelected ? theme.onPrimaryContainer : theme.onSurfaceVariant },
                    ]}
                  >
                    {climate.desc}
                  </Text>
                </View>
                <View
                  style={[
                    styles.checkCircle,
                    {
                      borderColor: isSelected ? theme.primary : theme.outline,
                      backgroundColor: isSelected ? theme.primary : 'transparent',
                    },
                  ]}
                />
              </Pressable>
            );
          })}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Button label="Continua" disabled={!selected} loading={saving} onPress={handleContinue} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: spacing.md16 },
  progress: { ...typography.labelLarge, marginBottom: spacing.xs8 },
  title: { ...typography.headlineMedium, marginBottom: spacing.xs4 + 2 },
  subtitle: { ...typography.bodyLarge, marginBottom: spacing.lg24 },
  list: { gap: spacing.sm12 - 2 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1.5,
    padding: spacing.md16,
    minHeight: 44,
  },
  cardLabel: { ...typography.titleMedium, marginBottom: 2 },
  cardDesc: { ...typography.bodySmall },
  checkCircle: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5 },
  footer: { padding: spacing.md16 },
});
