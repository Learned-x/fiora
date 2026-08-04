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
import { Button } from '../../src/components/Button';
import { listVases } from '../../src/services/vases.api';
import type { SmartVase } from '../../src/services/vases.api';

function statoColor(stato: SmartVase['stato'], theme: ReturnType<typeof useTheme>) {
  if (stato === 'connesso') return theme.acc;
  if (stato === 'batteria_scarica') return theme.amb;
  return theme.t3;
}

function statoLabel(stato: SmartVase['stato']) {
  if (stato === 'connesso') return 'Connesso';
  if (stato === 'batteria_scarica') return 'Batteria scarica';
  return 'Disconnesso';
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
        <View>
          <Text style={[styles.eyebrow, { color: theme.acc }]}>DISPOSITIVI</Text>
          <Text style={[styles.title, { color: theme.t1 }]}>Vasi Smart</Text>
        </View>
        <Pressable
          onPress={() => router.push('/vase/pair')}
          style={[styles.addBtn, { backgroundColor: theme.acc }, elevation.md(theme.acc)]}
        >
          <Svg width={18} height={18} viewBox="0 0 14 14" fill="none">
            <Path d="M7 1.5v11M1.5 7h11" stroke="white" strokeWidth={2} strokeLinecap="round" />
          </Svg>
        </Pressable>
      </View>

      <FlatList
        data={vasi}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.t2} />}
        ListEmptyComponent={
          loaded ? (
            <View style={styles.empty}>
              <View style={[styles.emptyIcon, { backgroundColor: theme.card2 }]}>
                <Text style={{ fontSize: 36 }}>🪴</Text>
              </View>
              <Text style={[styles.emptyTitle, { color: theme.t1 }]}>Nessun vaso collegato</Text>
              <Text style={[styles.emptySub, { color: theme.t2 }]}>
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
          return (
            <Pressable onPress={() => router.push(`/vase/${item.id}`)} style={styles.cardWrap}>
              <Card style={styles.card}>
                <View style={styles.cardTop}>
                  <View style={styles.cardTitleRow}>
                    <View style={[styles.dot, { backgroundColor: statoColor(item.stato, theme) }]} />
                    <Text style={[styles.cardName, { color: theme.t1 }]} numberOfLines={1}>
                      {item.nome ?? item.deviceId}
                    </Text>
                  </View>
                  {item.batteria !== null && (
                    <Text style={[styles.battery, { color: theme.t2 }]}>🔋 {item.batteria}%</Text>
                  )}
                </View>
                <Text style={[styles.cardStato, { color: statoColor(item.stato, theme) }]}>
                  {statoLabel(item.stato)}
                </Text>
                <Text style={[styles.cardPlant, { color: theme.t2 }]} numberOfLines={1}>
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
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    marginBottom: spacing.xl,
  },
  eyebrow: { fontSize: 12, fontWeight: '700', letterSpacing: 1, marginBottom: 4 },
  title: { fontSize: 34, fontWeight: '800', letterSpacing: -0.8 },
  addBtn: { width: 48, height: 48, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
  list: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl, flexGrow: 1 },
  cardWrap: { marginBottom: spacing.md },
  card: { padding: spacing.lg },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.xs },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flex: 1 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  cardName: { fontSize: 17, fontWeight: '700', flexShrink: 1 },
  battery: { fontSize: 13 },
  cardStato: { fontSize: 12, fontWeight: '700', marginBottom: 4, letterSpacing: 0.3 },
  cardPlant: { fontSize: 13 },
  empty: { alignItems: 'center', paddingTop: spacing.xxxl + spacing.xl },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  emptyTitle: { fontSize: 18, fontWeight: '700', marginBottom: 6 },
  emptySub: { fontSize: 14, textAlign: 'center', paddingHorizontal: 40, lineHeight: 20 },
  emptyButton: { marginTop: spacing.xl, alignSelf: 'stretch', width: '100%', paddingHorizontal: spacing.xl },
});
