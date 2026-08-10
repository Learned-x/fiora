import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import { useTheme } from '../src/theme/useTheme';
import { typography } from '../src/theme/typography';
import { spacing } from '../src/theme/spacing';
import { Card } from '../src/components/Card';
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
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Indietro"
          hitSlop={8}
          style={styles.backBtn}
        >
          <Svg width={9} height={15} viewBox="0 0 9 15" fill="none">
            <Path d="M8 1L1.5 7.5L8 14" stroke={theme.primary} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
          <Text style={{ fontSize: 17, color: theme.primary }}>Indietro</Text>
        </Pressable>
      </View>

      <Text style={[styles.title, { color: theme.onSurface }]}>Storico cure</Text>
      {nome ? <Text style={[styles.subtitle, { color: theme.onSurfaceVariant }]}>{nome}</Text> : null}

      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={theme.primary} />
        </View>
      ) : items.length === 0 ? (
        <View style={styles.empty}>
          <Text style={{ fontSize: 36, marginBottom: spacing.sm12 - 2 }}>🌱</Text>
          <Text style={[styles.emptyTitle, { color: theme.onSurface }]}>Nessuna cura registrata</Text>
          <Text style={[styles.emptySub, { color: theme.onSurfaceVariant }]}>
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
          ListFooterComponent={
            loadingMore ? <ActivityIndicator color={theme.primary} style={{ marginVertical: spacing.md16 }} /> : null
          }
          renderItem={({ item, index }) => (
            <Card
              variant="flat"
              style={[
                styles.row,
                index === 0 && styles.rowFirst,
                index === items.length - 1 && styles.rowLast,
                index < items.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.outlineVariant, borderRadius: 0 },
              ]}
            >
              <Text style={[styles.rowTipo, { color: theme.onSurface }]}>
                {TASK_LABELS[item.tipo as keyof typeof TASK_LABELS] ?? item.tipo}
              </Text>
              <Text style={[styles.rowDate, { color: theme.onSurfaceVariant }]}>{formatDateTime(item.createdAt)}</Text>
              {item.nota ? <Text style={[styles.rowNota, { color: theme.onSurfaceVariant }]}>{item.nota}</Text> : null}
            </Card>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  nav: { paddingHorizontal: spacing.md16, paddingTop: spacing.sm12 + 2, paddingBottom: spacing.xs8 },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs4 - 1, alignSelf: 'flex-start', minHeight: 44 },
  title: { ...typography.headlineSmall, paddingHorizontal: spacing.md16 },
  subtitle: { ...typography.bodyMedium, paddingHorizontal: spacing.md16, marginTop: 2, marginBottom: spacing.sm12 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 60 },
  emptyTitle: { ...typography.titleMedium, marginBottom: spacing.xs4 },
  emptySub: { ...typography.bodyMedium },
  list: { paddingHorizontal: spacing.md16, paddingTop: spacing.xs8, paddingBottom: spacing.lg24 },
  row: { padding: spacing.sm12 + 2, paddingHorizontal: spacing.md16 },
  rowFirst: { borderTopLeftRadius: 14, borderTopRightRadius: 14 },
  rowLast: { borderBottomLeftRadius: 14, borderBottomRightRadius: 14 },
  rowTipo: { ...typography.bodyLarge, fontWeight: '500', marginBottom: 2 },
  rowDate: { ...typography.bodySmall },
  rowNota: { ...typography.bodySmall, marginTop: 3, fontStyle: 'italic' },
});
