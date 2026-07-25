import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import { useTheme } from '../../src/theme/useTheme';
import type { ThemeColors } from '../../src/theme/colors';
import { deleteVase, getVase } from '../../src/services/vases.api';
import type { SmartVase } from '../../src/services/vases.api';
import { formatDay } from '../../src/lib/plantUi';
import { updatePlant } from '../../src/services/plants.api';
import { PlantPickerModal } from '../../src/components/PlantPickerModal';
import { ActionSheet } from '../../src/components/ActionSheet';
import type { Plant } from '../../src/types/models';

function BackNav({ theme }: { theme: ThemeColors }) {
  return (
    <View style={styles.nav}>
      <Pressable onPress={() => router.back()} style={styles.backBtn}>
        <Svg width={9} height={15} viewBox="0 0 9 15" fill="none">
          <Path d="M8 1L1.5 7.5L8 14" stroke={theme.acc} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
        <Text style={{ fontSize: 17, color: theme.acc }}>Vasi</Text>
      </Pressable>
    </View>
  );
}

function statoColor(stato: SmartVase['stato'], theme: ThemeColors) {
  if (stato === 'connesso') return theme.acc;
  if (stato === 'batteria_scarica') return theme.amb;
  return theme.t3;
}

function statoLabel(stato: SmartVase['stato']) {
  if (stato === 'connesso') return 'Connesso';
  if (stato === 'batteria_scarica') return 'Batteria scarica';
  return 'Disconnesso';
}

type Sheet = 'none' | 'notFound' | 'linkError' | 'unlinkError' | 'deleteError' | 'plantActions' | 'confirmDelete';

export default function VaseDetailScreen() {
  const theme = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [vase, setVase] = useState<SmartVase | null>(null);
  const [busy, setBusy] = useState(false);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [sheet, setSheet] = useState<Sheet>('none');

  const load = useCallback(async () => {
    try {
      setVase(await getVase(id));
    } catch {
      setSheet('notFound');
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  async function handleLinkPlant(plant: Plant) {
    if (!vase) return;
    setPickerVisible(false);
    setBusy(true);
    try {
      await updatePlant(plant.id, { vasoId: vase.id });
      await load();
    } catch {
      setSheet('linkError');
    } finally {
      setBusy(false);
    }
  }

  async function unlinkPlant(plantId: string) {
    setSheet('none');
    setBusy(true);
    try {
      await updatePlant(plantId, { vasoId: null });
      await load();
    } catch {
      setSheet('unlinkError');
    } finally {
      setBusy(false);
    }
  }

  function handlePlantRowPress() {
    if (!vase?.plants?.[0]) {
      setPickerVisible(true);
      return;
    }
    setSheet('plantActions');
  }

  async function confirmDeleteVase() {
    if (!vase) return;
    setSheet('none');
    setBusy(true);
    try {
      await deleteVase(vase.id);
      router.back();
    } catch {
      setSheet('deleteError');
    } finally {
      setBusy(false);
    }
  }

  if (!vase) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]} edges={['top']}>
        <BackNav theme={theme} />
        <ActionSheet
          visible={sheet === 'notFound'}
          message="Vaso non trovato."
          actions={[{ label: 'OK', onPress: () => router.back() }]}
          onRequestClose={() => router.back()}
        />
      </SafeAreaView>
    );
  }

  const pianta = vase.plants?.[0];
  const lettura = vase.ultimaLettura;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]} edges={['top']}>
      <BackNav theme={theme} />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.headerRow}>
          <View style={[styles.dot, { backgroundColor: statoColor(vase.stato, theme) }]} />
          <Text style={[styles.name, { color: theme.t1 }]}>{vase.nome ?? vase.deviceId}</Text>
        </View>
        <Text style={[styles.stato, { color: statoColor(vase.stato, theme) }]}>{statoLabel(vase.stato)}</Text>

        {vase.stato !== 'connesso' && (
          <View style={[styles.banner, { backgroundColor: theme.card }]}>
            <Text style={[styles.bannerText, { color: theme.t2 }]}>
              Vaso disconnesso
              {lettura ? ` — ultima lettura ${formatDay(lettura.time)}` : ''}
            </Text>
          </View>
        )}

        <View style={[styles.section, { backgroundColor: theme.card }]}>
          <Text style={[styles.sectionTitle, { color: theme.t1 }]}>Dati ambientali</Text>
          {lettura ? (
            <>
              <View style={styles.dataRow}>
                <Text style={[styles.dataLabel, { color: theme.t2 }]}>💧 Umidità terreno</Text>
                <Text style={[styles.dataValue, { color: theme.t1 }]}>
                  {lettura.umidita !== null ? `${lettura.umidita}%` : '—'}
                </Text>
              </View>
              <View style={styles.dataRow}>
                <Text style={[styles.dataLabel, { color: theme.t2 }]}>☀️ Luce</Text>
                <Text style={[styles.dataValue, { color: theme.t1 }]}>
                  {lettura.luce !== null ? `${lettura.luce} lux` : '—'}
                </Text>
              </View>
              <View style={styles.dataRow}>
                <Text style={[styles.dataLabel, { color: theme.t2 }]}>🌡️ Temperatura</Text>
                <Text style={[styles.dataValue, { color: theme.t1 }]}>
                  {lettura.temperatura !== null ? `${lettura.temperatura}°C` : '—'}
                </Text>
              </View>
              <Text style={[styles.timestamp, { color: theme.t3 }]}>
                Aggiornato {formatDay(lettura.time)}
              </Text>
            </>
          ) : (
            <Text style={[styles.emptyData, { color: theme.t2 }]}>
              Nessuna lettura ricevuta ancora dal vaso.
            </Text>
          )}
        </View>

        <View style={[styles.section, { backgroundColor: theme.card }]}>
          <View style={[styles.dataRow, { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.bord }]}>
            <Text style={[styles.dataLabel, { color: theme.t2 }]}>🔋 Batteria</Text>
            <Text style={[styles.dataValue, { color: theme.t1 }]}>
              {vase.batteria !== null ? `${vase.batteria}%` : '—'}
            </Text>
          </View>
          <Pressable onPress={handlePlantRowPress} disabled={busy} style={styles.plantRow}>
            <Text style={[styles.dataLabel, { color: theme.t2 }]}>🪴 Pianta collegata</Text>
            <View style={styles.plantRowRight}>
              <Text style={[styles.dataValue, { color: pianta ? theme.t1 : theme.acc }]}>
                {pianta ? pianta.nome : 'Collega…'}
              </Text>
              <Svg width={7} height={12} viewBox="0 0 7 12" fill="none">
                <Path d="M1 1L6 6L1 11" stroke={theme.t3} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
            </View>
          </Pressable>
        </View>

        <Pressable onPress={() => setSheet('confirmDelete')} disabled={busy} style={styles.deleteBtn}>
          <Text style={[styles.deleteText, { color: theme.red }]}>Rimuovi vaso</Text>
        </Pressable>
      </ScrollView>

      <PlantPickerModal
        visible={pickerVisible}
        onClose={() => setPickerVisible(false)}
        onSelect={handleLinkPlant}
      />

      <ActionSheet
        visible={sheet !== 'none'}
        title={sheet === 'plantActions' ? pianta?.nome : sheet === 'confirmDelete' ? 'Rimuovi vaso' : undefined}
        message={
          sheet === 'plantActions'
            ? 'Questo vaso è collegato a questa pianta.'
            : sheet === 'confirmDelete'
              ? 'Il vaso verrà scollegato e i dati di pairing andranno persi. Continuare?'
              : sheet === 'linkError'
                ? 'Collegamento non riuscito, riprova.'
                : sheet === 'unlinkError'
                  ? 'Operazione non riuscita, riprova.'
                  : sheet === 'deleteError'
                    ? 'Rimozione non riuscita, riprova.'
                    : undefined
        }
        actions={
          sheet === 'plantActions'
            ? [
                { label: 'Cambia pianta', onPress: () => { setSheet('none'); setPickerVisible(true); } },
                { label: 'Scollega', variant: 'destructive', onPress: () => pianta && unlinkPlant(pianta.id) },
                { label: 'Annulla', variant: 'cancel', onPress: () => setSheet('none') },
              ]
            : sheet === 'confirmDelete'
              ? [
                  { label: 'Rimuovi', variant: 'destructive', onPress: confirmDeleteVase },
                  { label: 'Annulla', variant: 'cancel', onPress: () => setSheet('none') },
                ]
              : [{ label: 'OK', onPress: () => setSheet('none') }]
        }
        onRequestClose={() => setSheet('none')}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  nav: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingTop: 8 },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, paddingHorizontal: 4 },
  content: { padding: 16, paddingBottom: 40 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 4 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  name: { fontSize: 26, fontWeight: '700', letterSpacing: -0.5 },
  stato: { fontSize: 14, fontWeight: '600', marginBottom: 16 },
  banner: { borderRadius: 12, padding: 14, marginBottom: 16 },
  bannerText: { fontSize: 13 },
  section: { borderRadius: 16, padding: 16, marginBottom: 16 },
  sectionTitle: { fontSize: 15, fontWeight: '600', marginBottom: 12 },
  dataRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10 },
  plantRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 10 },
  plantRowRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dataLabel: { fontSize: 14 },
  dataValue: { fontSize: 14, fontWeight: '600' },
  timestamp: { fontSize: 12, marginTop: 8 },
  emptyData: { fontSize: 13, fontStyle: 'italic' },
  deleteBtn: { alignItems: 'center', paddingVertical: 12 },
  deleteText: { fontSize: 15, fontWeight: '600' },
});
