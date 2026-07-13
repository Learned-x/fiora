import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import { useTheme } from '../src/theme/useTheme';
import { listPlantActions } from '../src/services/plants.api';
import type { ActionLogEntry } from '../src/types/models';
import { TASK_LABELS } from '../src/lib/plantUi';

const PAGE_SIZE = 20;

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return `${d.toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' })} · ${d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}`;
}

export default function PlantHistoryScreen() {
  const theme = useTheme();
  const { id, nome } = useLocalSearchParams<{ id: string; nome?: string }>();
  const [items, setItems] = useState<ActionLogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const loadPage = useCallback(
    async (offset: number) => {
      const result = await listPlantActions(id, { limit: PAGE_SIZE, offset });
      setTotal(result.total);
      setItems((prev) => (offset === 0 ? result.items : [...prev, ...result.items]));
    },
    [id]
  );

  useEffect(() => {
    loadPage(0)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [loadPage]);

  async function loadMore() {
    if (loadingMore || items.length >= total) return;
    setLoadingMore(true);
    try {
      await loadPage(items.length);
    } catch {
      // errore rete: l'utente può riprovare scrollando di nuovo
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]} edges={['top']}>
      <View style={styles.nav}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Svg width={9} height={15} viewBox="0 0 9 15" fill="none">
            <Path d="M8 1L1.5 7.5L8 14" stroke={theme.acc} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
          <Text style={{ fontSize: 17, color: theme.acc }}>Indietro</Text>
        </Pressable>
      </View>

      <Text style={[styles.title, { color: theme.t1 }]}>Storico cure</Text>
      {nome ? <Text style={[styles.subtitle, { color: theme.t2 }]}>{nome}</Text> : null}

      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={theme.acc} />
        </View>
      ) : items.length === 0 ? (
        <View style={styles.empty}>
          <Text style={{ fontSize: 36, marginBottom: 10 }}>🌱</Text>
          <Text style={[styles.emptyTitle, { color: theme.t1 }]}>Nessuna cura registrata</Text>
          <Text style={[styles.emptySub, { color: theme.t2 }]}>
            Le azioni completate compariranno qui.
          </Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          onEndReached={loadMore}
          onEndReachedThreshold={0.4}
          ListFooterComponent={loadingMore ? <ActivityIndicator color={theme.acc} style={{ marginVertical: 16 }} /> : null}
          renderItem={({ item, index }) => (
            <View
              style={[
                styles.row,
                { backgroundColor: theme.card },
                index === 0 && styles.rowFirst,
                index === items.length - 1 && styles.rowLast,
                index < items.length - 1 && { borderBottomWidth: 1, borderBottomColor: theme.bord },
              ]}
            >
              <Text style={[styles.rowTipo, { color: theme.t1 }]}>
                {TASK_LABELS[item.tipo as keyof typeof TASK_LABELS] ?? item.tipo}
              </Text>
              <Text style={[styles.rowDate, { color: theme.t2 }]}>{formatDateTime(item.createdAt)}</Text>
              {item.nota ? <Text style={[styles.rowNota, { color: theme.t3 }]}>{item.nota}</Text> : null}
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  nav: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 8 },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 3, alignSelf: 'flex-start' },
  title: { fontSize: 26, fontWeight: '700', letterSpacing: -0.5, paddingHorizontal: 16 },
  subtitle: { fontSize: 14, paddingHorizontal: 16, marginTop: 2, marginBottom: 12 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 60 },
  emptyTitle: { fontSize: 17, fontWeight: '600', marginBottom: 4 },
  emptySub: { fontSize: 14 },
  list: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 24 },
  row: { padding: 14, paddingHorizontal: 16 },
  rowFirst: { borderTopLeftRadius: 14, borderTopRightRadius: 14 },
  rowLast: { borderBottomLeftRadius: 14, borderBottomRightRadius: 14 },
  rowTipo: { fontSize: 15, fontWeight: '500', marginBottom: 2 },
  rowDate: { fontSize: 13 },
  rowNota: { fontSize: 13, marginTop: 3, fontStyle: 'italic' },
});
