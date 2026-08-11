import { useCallback, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import { useTheme } from '../../src/theme/useTheme';
import { typography } from '../../src/theme/typography';
import { spacing } from '../../src/theme/spacing';
import { radius } from '../../src/theme/radius';
import { Card } from '../../src/components/Card';
import { Chip } from '../../src/components/Chip';
import { Skeleton } from '../../src/components/Skeleton';
import { ErrorState } from '../../src/components/ErrorState';
import { listPlants } from '../../src/services/plants.api';
import type { Plant } from '../../src/types/models';
import { plantEmoji } from '../../src/lib/plantUi';

type Filter = 'tutti' | 'piante' | 'bouquet' | 'archiviate';

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'tutti', label: 'Tutte' },
  { key: 'piante', label: 'Piante' },
  { key: 'bouquet', label: 'Bouquet' },
  { key: 'archiviate', label: 'Archiviate' },
];

export default function PlantsScreen() {
  const theme = useTheme();
  const [plants, setPlants] = useState<Plant[]>([]);
  const [filter, setFilter] = useState<Filter>('tutti');
  const [refreshing, setRefreshing] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState(false);

  const load = useCallback(async (currentFilter: Filter) => {
    try {
      const stato = currentFilter === 'archiviate' ? 'archiviato' : 'attivo';
      setPlants(await listPlants(stato));
      setLoaded(true);
      setLoadError(false);
    } catch {
      setLoadError(true);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load(filter);
    }, [load, filter])
  );

  async function onRefresh() {
    setRefreshing(true);
    await load(filter);
    setRefreshing(false);
  }

  const filtered = plants.filter((p) => {
    if (filter === 'piante') return p.tipo === 'pianta';
    if (filter === 'bouquet') return p.tipo === 'bouquet';
    return true;
  });

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]} edges={['top']}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.onSurface }]}>Piante</Text>
        <Pressable
          onPress={() => router.push('/add-plant')}
          style={({ pressed }) => [styles.addBtn, { backgroundColor: theme.primary }, pressed && { opacity: 0.82 }]}
          accessibilityRole="button"
          accessibilityLabel="Aggiungi pianta"
          hitSlop={4}
        >
          <Svg width={14} height={14} viewBox="0 0 14 14" fill="none">
            <Path d="M7 1.5v11M1.5 7h11" stroke={theme.onPrimary} strokeWidth={2} strokeLinecap="round" />
          </Svg>
        </Pressable>
      </View>

      <View style={styles.chips}>
        {FILTERS.map((f) => (
          <Chip
            key={f.key}
            label={f.label}
            selected={filter === f.key}
            onPress={() => setFilter(f.key)}
            accessibilityLabel={`Filtra: ${f.label}`}
          />
        ))}
      </View>

      {!loaded && !loadError && (
        <View style={styles.list}>
          <View style={styles.row}>
            <Skeleton height={140} style={{ flex: 1 }} />
            <Skeleton height={140} style={{ flex: 1 }} />
          </View>
        </View>
      )}
      {loadError && (
        <View style={styles.list}>
          <ErrorState message="Impossibile caricare le piante. Controlla la connessione." onRetry={() => load(filter)} />
        </View>
      )}

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        numColumns={2}
        columnWrapperStyle={styles.row}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.onSurfaceVariant} />}
        ListEmptyComponent={
          loaded ? (
            <View style={styles.empty}>
              <Text style={{ fontSize: 40, marginBottom: spacing.sm12 }}>🪴</Text>
              <Text style={[styles.emptyTitle, { color: theme.onSurface }]}>Nessuna pianta</Text>
              <Text style={[styles.emptySub, { color: theme.onSurfaceVariant }]}>Aggiungi la tua prima pianta con il pulsante +.</Text>
            </View>
          ) : null
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() => router.push(`/plant/${item.id}`)}
            accessibilityRole="button"
            accessibilityLabel={`Apri ${item.nome}`}
            style={styles.cardWrap}
          >
            <Card variant="elevated" style={styles.card}>
              <View style={[styles.emojiTile, { backgroundColor: theme.surfaceHigh }]}>
                <Text style={styles.emoji}>{plantEmoji(item)}</Text>
                {item.tipo === 'bouquet' && (
                  <View style={[styles.bouquetBadge, { backgroundColor: theme.tertiaryContainer }]}>
                    <Text style={[styles.bouquetBadgeText, { color: theme.onTertiaryContainer }]}>bouquet</Text>
                  </View>
                )}
              </View>
              <Text style={[styles.cardName, { color: theme.onSurface }]} numberOfLines={1}>
                {item.nome}
              </Text>
              <Text style={[styles.cardSpecies, { color: theme.onSurfaceVariant }]} numberOfLines={1}>
                {item.species?.nomeComune ?? (item.tipo === 'bouquet' ? 'Fiori recisi' : 'Specie non impostata')}
              </Text>
              {(item._count?.tasks ?? 0) > 0 && (
                <View style={styles.taskHint}>
                  <View style={[styles.taskDot, { backgroundColor: theme.warning }]} />
                  <Text style={[styles.taskHintText, { color: theme.onSurfaceVariant }]}>
                    {item._count!.tasks} task
                  </Text>
                </View>
              )}
            </Card>
          </Pressable>
        )}
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
  title: { ...typography.headlineLarge, letterSpacing: -0.6 },
  addBtn: { width: 44, height: 44, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
  chips: { flexDirection: 'row', gap: spacing.xs8 - 1, paddingHorizontal: spacing.md16, marginBottom: spacing.md16, flexWrap: 'wrap' },
  list: { paddingHorizontal: spacing.md16, paddingBottom: spacing.lg24, flexGrow: 1 },
  row: { gap: spacing.sm12, marginBottom: spacing.sm12 },
  cardWrap: { flex: 1 },
  card: { padding: spacing.sm12 },
  emojiTile: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 56,
    borderRadius: radius.md,
    marginBottom: spacing.xs8,
  },
  emoji: { fontSize: 26 },
  bouquetBadge: {
    position: 'absolute',
    top: spacing.xs4,
    right: spacing.xs4,
    paddingVertical: 3,
    paddingHorizontal: spacing.xs8 - 1,
    borderRadius: radius.xs + 2,
  },
  bouquetBadgeText: { ...typography.labelSmall },
  cardName: { ...typography.titleSmall, marginBottom: 2 },
  cardSpecies: { ...typography.bodySmall, fontStyle: 'italic' },
  taskHint: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs4, marginTop: spacing.xs8 },
  taskDot: { width: 5, height: 5, borderRadius: 3 },
  taskHintText: { ...typography.labelSmall },
  empty: { alignItems: 'center', paddingTop: spacing.xxxl64 + spacing.md16 },
  emptyTitle: { ...typography.titleMedium, marginBottom: spacing.xs4 },
  emptySub: { ...typography.bodyMedium, textAlign: 'center', paddingHorizontal: spacing.xl40 },
});
