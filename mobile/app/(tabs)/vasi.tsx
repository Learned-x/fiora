import { useCallback, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import { useTheme } from '../../src/theme/useTheme';
import { typography } from '../../src/theme/typography';
import { spacing } from '../../src/theme/spacing';
import { radius } from '../../src/theme/radius';
import { Button } from '../../src/components/Button';
import { Card } from '../../src/components/Card';
import { listVases } from '../../src/services/vases.api';
import type { SmartVase } from '../../src/services/vases.api';
import type { ThemeColors } from '../../src/theme/colors';

function statoColor(stato: SmartVase['stato'], theme: ThemeColors) {
  if (stato === 'connesso') return theme.primary;
  if (stato === 'batteria_scarica') return theme.warning;
  return theme.onSurfaceVariant;
}

function statoLabel(stato: SmartVase['stato']) {
  if (stato === 'connesso') return 'Connesso';
  if (stato === 'batteria_scarica') return 'Batteria scarica';
  return 'Disconnesso';
}

function batteryColor(pct: number, theme: ThemeColors) {
  if (pct <= 15) return theme.error;
  if (pct <= 35) return theme.warning;
  return theme.primary;
}

export default function VasiScreen() {
  const theme = useTheme();
  const [vasi, setVasi] = useState<SmartVase[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    try {
      setVasi(await listVases());
      setLoaded(true);
    } catch {
      // errore rete: pull-to-refresh per riprovare
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]} edges={['top']}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.onSurface }]}>Vasi Smart</Text>
        <Pressable
          onPress={() => router.push('/vase/pair')}
          accessibilityRole="button"
          accessibilityLabel="Collega un nuovo vaso"
          hitSlop={8}
          style={({ pressed }) => [styles.addBtn, { backgroundColor: theme.primary }, pressed && { opacity: 0.82 }]}
        >
          <Svg width={16} height={16} viewBox="0 0 14 14" fill="none">
            <Path d="M7 1.5v11M1.5 7h11" stroke={theme.onPrimary} strokeWidth={2} strokeLinecap="round" />
          </Svg>
        </Pressable>
      </View>

      <FlatList
        data={vasi}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.onSurfaceVariant} />}
        ListEmptyComponent={
          loaded ? (
            <View style={styles.empty}>
              <Text style={{ fontSize: 44, marginBottom: spacing.md16 }}>🪴</Text>
              <Text style={[styles.emptyTitle, { color: theme.onSurface }]}>Nessun vaso collegato</Text>
              <Text style={[styles.emptySub, { color: theme.onSurfaceVariant }]}>
                Collega il tuo vaso smart per monitorare umidità, luce e temperatura in tempo reale.
              </Text>
              <View style={styles.emptyButton}>
                <Button label="Collega vaso" onPress={() => router.push('/vase/pair')} />
              </View>
            </View>
          ) : null
        }
        renderItem={({ item }) => {
          const pianta = item.plants?.[0];
          const battColor = item.batteria !== null ? batteryColor(item.batteria, theme) : theme.onSurfaceVariant;
          return (
            <Pressable
              onPress={() => router.push(`/vase/${item.id}`)}
              accessibilityRole="button"
              accessibilityLabel={`Vaso ${item.nome ?? item.deviceId}, ${statoLabel(item.stato)}${pianta ? `, collegato a ${pianta.nome}` : ''}`}
              style={({ pressed }) => [styles.cardWrap, pressed && { opacity: 0.85 }]}
            >
              <Card variant="elevated" style={styles.card}>
                <View style={styles.cardTop}>
                  <View style={styles.cardTitleRow}>
                    <View style={[styles.dot, { backgroundColor: statoColor(item.stato, theme) }]} />
                    <Text style={[styles.cardName, { color: theme.onSurface }]} numberOfLines={1}>
                      {item.nome ?? item.deviceId}
                    </Text>
                  </View>
                  {item.batteria !== null && (
                    <View style={styles.batteryWrap}>
                      <View style={[styles.batteryTrack, { backgroundColor: theme.outlineVariant }]}>
                        <View
                          style={[
                            styles.batteryFill,
                            { width: `${Math.max(4, Math.min(100, item.batteria))}%`, backgroundColor: battColor },
                          ]}
                        />
                      </View>
                      <Text style={[styles.battery, { color: theme.onSurfaceVariant }]}>{item.batteria}%</Text>
                    </View>
                  )}
                </View>
                <Text style={[styles.cardStato, { color: statoColor(item.stato, theme) }]}>
                  {statoLabel(item.stato)}
                </Text>
                <Text style={[styles.cardPlant, { color: theme.onSurfaceVariant }]} numberOfLines={1}>
                  {pianta ? `Collegato a ${pianta.nome}` : 'Nessuna pianta collegata'}
                </Text>
              </Card>
            </Pressable>
          );
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md16,
    paddingTop: spacing.md16,
    marginBottom: spacing.md16,
  },
  title: { ...typography.headlineMedium },
  addBtn: {
    width: 44,
    height: 44,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: { paddingHorizontal: spacing.md16, paddingBottom: spacing.lg24, flexGrow: 1 },
  cardWrap: { marginBottom: spacing.sm12 },
  card: { padding: spacing.md16 },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.xs8 },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs8, flex: 1 },
  dot: { width: 10, height: 10, borderRadius: radius.full },
  cardName: { ...typography.titleMedium, flexShrink: 1 },
  batteryWrap: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs8 },
  batteryTrack: { width: 36, height: 6, borderRadius: radius.full, overflow: 'hidden' },
  batteryFill: { height: '100%', borderRadius: radius.full },
  battery: { ...typography.labelMedium },
  cardStato: { ...typography.labelLarge, fontWeight: '600', marginBottom: spacing.xs4 },
  cardPlant: { ...typography.bodyMedium },
  empty: { alignItems: 'center', paddingTop: spacing.xxxl64 + spacing.lg24 },
  emptyTitle: { ...typography.titleLarge, marginBottom: spacing.xs4 },
  emptySub: { ...typography.bodyMedium, textAlign: 'center', paddingHorizontal: spacing.xl40 },
  emptyButton: { marginTop: spacing.lg24, alignSelf: 'stretch', width: '100%', paddingHorizontal: spacing.lg24 },
});
