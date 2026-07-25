import { useCallback, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import { useTheme } from '../../src/theme/useTheme';
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
        <Text style={[styles.title, { color: theme.t1 }]}>Vasi Smart</Text>
        <Pressable onPress={() => router.push('/vase/pair')} style={[styles.addBtn, { backgroundColor: theme.acc }]}>
          <Svg width={14} height={14} viewBox="0 0 14 14" fill="none">
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
              <Text style={{ fontSize: 44, marginBottom: 16 }}>🪴</Text>
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
            <Pressable
              onPress={() => router.push(`/vase/${item.id}`)}
              style={[styles.card, { backgroundColor: theme.card }]}
            >
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
    paddingHorizontal: 16,
    paddingTop: 16,
    marginBottom: 16,
  },
  title: { fontSize: 30, fontWeight: '700', letterSpacing: -0.6 },
  addBtn: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  list: { paddingHorizontal: 16, paddingBottom: 24, flexGrow: 1 },
  card: { borderRadius: 16, padding: 16, marginBottom: 12 },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  cardName: { fontSize: 16, fontWeight: '600', flexShrink: 1 },
  battery: { fontSize: 13 },
  cardStato: { fontSize: 12, fontWeight: '600', marginBottom: 4 },
  cardPlant: { fontSize: 13 },
  empty: { alignItems: 'center', paddingTop: 80 },
  emptyTitle: { fontSize: 18, fontWeight: '600', marginBottom: 6 },
  emptySub: { fontSize: 14, textAlign: 'center', paddingHorizontal: 40, lineHeight: 20 },
  emptyButton: { marginTop: 24, alignSelf: 'stretch', width: '100%', paddingHorizontal: 24 },
});
