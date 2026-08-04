import { useCallback, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import { useTheme } from '../../src/theme/useTheme';
import type { ThemeColors } from '../../src/theme/colors';
import { spacing } from '../../src/theme/spacing';
import { radius } from '../../src/theme/radius';
import { Card } from '../../src/components/Card';
import { ScreenHeader } from '../../src/components/ScreenHeader';
import { deleteVase, getVase, renameVase } from '../../src/services/vases.api';
import type { SmartVase } from '../../src/services/vases.api';
import { formatDay } from '../../src/lib/plantUi';
import { updatePlant } from '../../src/services/plants.api';
import { PlantPickerModal } from '../../src/components/PlantPickerModal';
import { ActionSheet } from '../../src/components/ActionSheet';
import { TextInput } from '../../src/components/TextInput';
import { Button } from '../../src/components/Button';
import type { Plant } from '../../src/types/models';

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

type Sheet = 'none' | 'notFound' | 'linkError' | 'unlinkError' | 'deleteError' | 'renameError' | 'plantActions' | 'confirmDelete';

export default function VaseDetailScreen() {
  const theme = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [vase, setVase] = useState<SmartVase | null>(null);
  const [busy, setBusy] = useState(false);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [sheet, setSheet] = useState<Sheet>('none');
  const [renameVisible, setRenameVisible] = useState(false);
  const [renameValue, setRenameValue] = useState('');

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

  function openRename() {
    if (!vase) return;
    setRenameValue(vase.nome ?? '');
    setRenameVisible(true);
  }

  async function confirmRename() {
    if (!vase) return;
    const nome = renameValue.trim();
    if (!nome) return;
    setRenameVisible(false);
    setBusy(true);
    try {
      await renameVase(vase.id, nome);
      await load();
    } catch {
      setSheet('renameError');
    } finally {
      setBusy(false);
    }
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
        <ScreenHeader />
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
      <ScreenHeader />
      <ScrollView contentContainerStyle={styles.content}>
        <Pressable onPress={openRename} disabled={busy} style={styles.headerRow}>
          <View style={[styles.dot, { backgroundColor: statoColor(vase.stato, theme) }]} />
          <Text style={[styles.name, { color: theme.t1 }]}>{vase.nome ?? vase.deviceId}</Text>
          <Svg width={15} height={15} viewBox="0 0 20 20" fill="none">
            <Path d="M14.5 2.5a1.5 1.5 0 0 1 2.12 2.12L6.5 14.75 3 15.5l.75-3.5 10.75-9.5Z" stroke={theme.t3} strokeWidth={1.4} strokeLinejoin="round" />
          </Svg>
        </Pressable>
        <Text style={[styles.stato, { color: statoColor(vase.stato, theme) }]}>{statoLabel(vase.stato)}</Text>

        {vase.stato !== 'connesso' && (
          <Card style={[styles.banner, { borderColor: theme.amb, borderWidth: 1.5 }]}>
            <Text style={[styles.bannerText, { color: theme.t2 }]}>
              Vaso disconnesso
              {lettura ? ` — ultima lettura ${formatDay(lettura.time)}` : ''}
            </Text>
          </Card>
        )}

        <Card style={styles.section}>
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
        </Card>

        <Card style={styles.section}>
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
        </Card>

        <Pressable onPress={() => setSheet('confirmDelete')} disabled={busy} style={[styles.deleteBtn, { borderColor: theme.red }]}>
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
                    : sheet === 'renameError'
                      ? 'Rinomina non riuscita, riprova.'
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

      <Modal visible={renameVisible} transparent animationType="fade" onRequestClose={() => setRenameVisible(false)}>
        <Pressable style={styles.renameBackdrop} onPress={() => setRenameVisible(false)}>
          <Pressable style={[styles.renameCard, { backgroundColor: theme.card }]} onPress={() => {}}>
            <Text style={[styles.sectionTitle, { color: theme.t1 }]}>Nome vaso</Text>
            <TextInput
              value={renameValue}
              onChangeText={setRenameValue}
              placeholder="Es. Vaso soggiorno"
              autoFocus
              maxLength={255}
              style={{ marginTop: 12, marginBottom: 16 }}
            />
            <View style={styles.renameActions}>
              <View style={{ flex: 1 }}>
                <Button label="Annulla" variant="outline" onPress={() => setRenameVisible(false)} />
              </View>
              <View style={{ flex: 1 }}>
                <Button label="Salva" onPress={confirmRename} disabled={!renameValue.trim()} />
              </View>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm, marginBottom: spacing.xs },
  dot: { width: 10, height: 10, borderRadius: 5 },
  name: { fontSize: 28, fontWeight: '800', letterSpacing: -0.6 },
  stato: { fontSize: 14, fontWeight: '700', marginBottom: spacing.lg },
  banner: { marginBottom: spacing.lg },
  bannerText: { fontSize: 13 },
  section: { marginBottom: spacing.lg },
  sectionTitle: { fontSize: 15, fontWeight: '700', marginBottom: spacing.md },
  dataRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.sm + 2 },
  plantRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: spacing.sm + 2, minHeight: 44 },
  plantRowRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  dataLabel: { fontSize: 14 },
  dataValue: { fontSize: 14, fontWeight: '600' },
  timestamp: { fontSize: 12, marginTop: spacing.sm },
  emptyData: { fontSize: 13, fontStyle: 'italic' },
  deleteBtn: {
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderWidth: 1.5,
    borderRadius: radius.md,
    minHeight: 50,
    justifyContent: 'center',
  },
  deleteText: { fontSize: 15, fontWeight: '700' },
  renameBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: spacing.xl },
  renameCard: { borderRadius: radius.lg, padding: spacing.xl },
  renameActions: { flexDirection: 'row', gap: spacing.md },
});
