import { useCallback, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import { useTheme } from '../../src/theme/useTheme';
import { spacing } from '../../src/theme/spacing';
import { radius } from '../../src/theme/radius';
import { elevation } from '../../src/theme/elevation';
import { Card } from '../../src/components/Card';
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

  const load = useCallback(async (currentFilter: Filter) => {
    try {
      const stato = currentFilter === 'archiviate' ? 'archiviato' : 'attivo';
      setPlants(await listPlants(stato));
      setLoaded(true);
    } catch {
      // errore rete: pull-to-refresh per riprovare
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
        <View>
          <Text style={[styles.eyebrow, { color: theme.acc }]}>COLLEZIONE</Text>
          <Text style={[styles.title, { color: theme.t1 }]}>Piante</Text>
        </View>
        <Pressable
          onPress={() => router.push('/add-plant')}
          style={[styles.addBtn, { backgroundColor: theme.acc }, elevation.md(theme.acc)]}
        >
          <Svg width={18} height={18} viewBox="0 0 14 14" fill="none">
            <Path d="M7 1.5v11M1.5 7h11" stroke="white" strokeWidth={2} strokeLinecap="round" />
          </Svg>
        </Pressable>
      </View>

      <View style={styles.chips}>
        {FILTERS.map((f) => {
          const active = filter === f.key;
          return (
            <Pressable
              key={f.key}
              onPress={() => setFilter(f.key)}
              style={[
                styles.chip,
                active ? { backgroundColor: theme.acc } : { backgroundColor: theme.card2 },
              ]}
            >
              <Text style={[styles.chipText, { color: active ? 'white' : theme.t2, fontWeight: active ? '700' : '500' }]}>
                {f.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        numColumns={2}
        columnWrapperStyle={styles.row}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.t2} />}
        ListEmptyComponent={
          loaded ? (
            <View style={styles.empty}>
              <View style={[styles.emptyIcon, { backgroundColor: theme.card2 }]}>
                <Text style={{ fontSize: 32 }}>🪴</Text>
              </View>
              <Text style={[styles.emptyTitle, { color: theme.t1 }]}>Nessuna pianta</Text>
              <Text style={[styles.emptySub, { color: theme.t2 }]}>Aggiungi la tua prima pianta con il pulsante +.</Text>
            </View>
          ) : null
        }
        renderItem={({ item }) => (
          <Pressable onPress={() => router.push(`/plant/${item.id}`)} style={styles.cardWrap}>
            <Card style={styles.card}>
              <View style={styles.cardTop}>
                <Text style={{ fontSize: 30, lineHeight: 34 }}>{plantEmoji(item)}</Text>
                {item.tipo === 'bouquet' && (
                  <View style={[styles.bouquetBadge, { backgroundColor: 'rgba(10,132,255,0.1)' }]}>
                    <Text style={[styles.bouquetBadgeText, { color: theme.blu }]}>bouquet</Text>
                  </View>
                )}
              </View>
              <Text style={[styles.cardName, { color: theme.t1 }]} numberOfLines={1}>
                {item.nome}
              </Text>
              <Text style={[styles.cardSpecies, { color: theme.t2 }]} numberOfLines={1}>
                {item.species?.nomeComune ?? (item.tipo === 'bouquet' ? 'Fiori recisi' : 'Specie non impostata')}
              </Text>
              {(item._count?.tasks ?? 0) > 0 && (
                <View style={styles.taskHint}>
                  <View style={[styles.taskDot, { backgroundColor: theme.amb }]} />
                  <Text style={[styles.taskHintText, { color: theme.t2 }]}>
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
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    marginBottom: spacing.xl,
  },
  eyebrow: { fontSize: 12, fontWeight: '700', letterSpacing: 1, marginBottom: 4 },
  title: { fontSize: 34, fontWeight: '800', letterSpacing: -0.8 },
  addBtn: { width: 48, height: 48, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
  chips: { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.lg, marginBottom: spacing.lg },
  chip: { paddingVertical: spacing.sm, paddingHorizontal: spacing.md + 2, borderRadius: radius.full },
  chipText: { fontSize: 13 },
  list: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl, flexGrow: 1 },
  row: { gap: spacing.md, marginBottom: spacing.md },
  cardWrap: { flex: 1 },
  card: { padding: spacing.lg },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: spacing.md },
  bouquetBadge: { paddingVertical: 3, paddingHorizontal: 7, borderRadius: radius.sm },
  bouquetBadgeText: { fontSize: 10, fontWeight: '600' },
  cardName: { fontSize: 16, fontWeight: '700', marginBottom: 2 },
  cardSpecies: { fontSize: 12, fontStyle: 'italic' },
  taskHint: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: spacing.sm },
  taskDot: { width: 5, height: 5, borderRadius: 3 },
  taskHintText: { fontSize: 11 },
  empty: { alignItems: 'center', paddingTop: spacing.xxxl + spacing.xl },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  emptyTitle: { fontSize: 18, fontWeight: '700', marginBottom: 4 },
  emptySub: { fontSize: 14, textAlign: 'center', paddingHorizontal: 40 },
});
