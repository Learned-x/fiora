import { useCallback, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import { useTheme } from '../../src/theme/useTheme';
import { typography } from '../../src/theme/typography';
import { spacing } from '../../src/theme/spacing';
import { radius } from '../../src/theme/radius';
import type { ThemeColors } from '../../src/theme/colors';
import { Card } from '../../src/components/Card';
import { Button } from '../../src/components/Button';
import { TextInput } from '../../src/components/TextInput';
import { SensorTile } from '../../src/components/SensorTile';
import type { SensorStatus as TileStatus } from '../../src/components/SensorTile';
import { Sparkline } from '../../src/components/Sparkline';
import { deleteVase, getVase, getVaseReadings24h, renameVase } from '../../src/services/vases.api';
import type { SmartVase } from '../../src/services/vases.api';
import { formatDay, luceSensoreLabel, luceSensoreStatus, temperaturaLabel, temperaturaStatus, umiditaLabel, umiditaStatus } from '../../src/lib/plantUi';
import { updatePlant } from '../../src/services/plants.api';
import { PlantPickerModal } from '../../src/components/PlantPickerModal';
import { ActionSheet } from '../../src/components/ActionSheet';
import type { Plant } from '../../src/types/models';

function toTileStatus(status: 'ok' | 'warning'): TileStatus {
  return status === 'ok' ? 'ok' : 'warn';
}

function BackNav({ theme }: { theme: ThemeColors }) {
  return (
    <View style={styles.nav}>
      <Pressable
        onPress={() => router.back()}
        accessibilityRole="button"
        accessibilityLabel="Torna a Vasi"
        hitSlop={8}
        style={styles.backBtn}
      >
        <Svg width={9} height={15} viewBox="0 0 9 15" fill="none">
          <Path d="M8 1L1.5 7.5L8 14" stroke={theme.primary} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
        <Text style={{ fontSize: 17, color: theme.primary }}>Vasi</Text>
      </Pressable>
    </View>
  );
}

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

type Sheet = 'none' | 'notFound' | 'linkError' | 'unlinkError' | 'deleteError' | 'renameError' | 'plantActions' | 'confirmDelete';

export default function VaseDetailScreen() {
  const theme = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [vase, setVase] = useState<SmartVase | null>(null);
  const [humidityHistory, setHumidityHistory] = useState<number[]>([]);
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
    try {
      const readings = await getVaseReadings24h(id);
      setHumidityHistory(
        readings
          .filter((r) => r.umidita !== null)
          .map((r) => r.umidita as number)
      );
    } catch {
      // storico opzionale: la schermata resta utilizzabile senza sparkline
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
  const temperaturaNum = lettura?.temperatura !== null && lettura?.temperatura !== undefined ? Number(lettura.temperatura) : null;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]} edges={['top']}>
      <BackNav theme={theme} />
      <ScrollView contentContainerStyle={styles.content}>
        <Pressable
          onPress={openRename}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel={`Rinomina vaso, nome attuale ${vase.nome ?? vase.deviceId}`}
          style={styles.headerRow}
        >
          <View style={[styles.dot, { backgroundColor: statoColor(vase.stato, theme) }]} />
          <Text style={[styles.name, { color: theme.onSurface }]}>{vase.nome ?? vase.deviceId}</Text>
          <Svg width={15} height={15} viewBox="0 0 20 20" fill="none">
            <Path d="M14.5 2.5a1.5 1.5 0 0 1 2.12 2.12L6.5 14.75 3 15.5l.75-3.5 10.75-9.5Z" stroke={theme.onSurfaceVariant} strokeWidth={1.4} strokeLinejoin="round" />
          </Svg>
        </Pressable>
        <Text style={[styles.stato, { color: statoColor(vase.stato, theme) }]}>{statoLabel(vase.stato)}</Text>

        {vase.stato !== 'connesso' && (
          <Card variant="flat" style={styles.banner}>
            <Text style={[styles.bannerText, { color: theme.onSurfaceVariant }]}>
              Vaso disconnesso
              {lettura ? ` — ultima lettura ${formatDay(lettura.time)}` : ''}
            </Text>
          </Card>
        )}

        {lettura ? (
          <>
            <View style={styles.tilesRow}>
              <View style={styles.tile}>
                <SensorTile
                  value={lettura.umidita !== null ? `${lettura.umidita}%` : '—'}
                  label={lettura.umidita !== null ? umiditaLabel(lettura.umidita, undefined) : 'Umidità'}
                  status={lettura.umidita !== null ? toTileStatus(umiditaStatus(lettura.umidita, undefined)) : 'ok'}
                />
              </View>
              <View style={styles.tile}>
                <SensorTile
                  value={lettura.luce !== null ? `${lettura.luce} lux` : '—'}
                  label={lettura.luce !== null ? luceSensoreLabel(lettura.luce) : 'Luce'}
                  status={lettura.luce !== null ? toTileStatus(luceSensoreStatus(lettura.luce)) : 'ok'}
                />
              </View>
              <View style={styles.tile}>
                <SensorTile
                  value={temperaturaNum !== null ? `${temperaturaNum}°C` : '—'}
                  label={temperaturaNum !== null ? temperaturaLabel(temperaturaNum, null, null) : 'Temperatura'}
                  status={temperaturaNum !== null ? toTileStatus(temperaturaStatus(temperaturaNum, null, null)) : 'ok'}
                />
              </View>
            </View>
            <Text style={[styles.timestamp, { color: theme.onSurfaceVariant }]}>
              Aggiornato {formatDay(lettura.time)}
            </Text>

            {humidityHistory.length >= 2 && (
              <View style={{ marginTop: spacing.md16 }}>
                <Sparkline label="Umidità" values={humidityHistory} unit="%" />
              </View>
            )}
          </>
        ) : (
          <Card variant="flat" style={styles.section}>
            <Text style={[styles.emptyData, { color: theme.onSurfaceVariant }]}>
              Nessuna lettura ricevuta ancora dal vaso.
            </Text>
          </Card>
        )}

        <Text style={[styles.sectionLabel, { color: theme.onSurfaceVariant }]}>Gestione</Text>
        <Card variant="flat" style={styles.section}>
          <View style={[styles.dataRow, { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.outlineVariant }]}>
            <Text style={[styles.dataLabel, { color: theme.onSurfaceVariant }]}>Batteria</Text>
            <Text style={[styles.dataValue, { color: theme.onSurface }]}>
              {vase.batteria !== null ? `${vase.batteria}%` : '—'}
            </Text>
          </View>
          <Pressable
            onPress={handlePlantRowPress}
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel={pianta ? `Pianta collegata: ${pianta.nome}` : 'Collega una pianta'}
            style={styles.plantRow}
          >
            <Text style={[styles.dataLabel, { color: theme.onSurfaceVariant }]}>Pianta collegata</Text>
            <View style={styles.plantRowRight}>
              <Text style={[styles.dataValue, { color: pianta ? theme.onSurface : theme.primary }]}>
                {pianta ? pianta.nome : 'Collega…'}
              </Text>
              <Svg width={7} height={12} viewBox="0 0 7 12" fill="none">
                <Path d="M1 1L6 6L1 11" stroke={theme.onSurfaceVariant} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
            </View>
          </Pressable>
        </Card>

        <Pressable
          onPress={() => setSheet('confirmDelete')}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel="Rimuovi vaso"
          style={styles.deleteBtn}
        >
          <Text style={[styles.deleteText, { color: theme.error }]}>Rimuovi vaso</Text>
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
          <Pressable style={[styles.renameCard, { backgroundColor: theme.surface }]} onPress={() => {}}>
            <Text style={[styles.sectionTitle, { color: theme.onSurface }]}>Nome vaso</Text>
            <TextInput
              value={renameValue}
              onChangeText={setRenameValue}
              placeholder="Es. Vaso soggiorno"
              autoFocus
              maxLength={255}
              style={{ marginTop: spacing.sm12, marginBottom: spacing.md16 }}
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
  nav: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.sm12, paddingTop: spacing.xs8 },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs4 + 2, minHeight: 44, paddingVertical: spacing.xs8, paddingHorizontal: spacing.xs4 },
  content: { padding: spacing.md16, paddingBottom: spacing.xl40 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm12 - 2, marginBottom: spacing.xs4, minHeight: 44 },
  dot: { width: 10, height: 10, borderRadius: radius.full },
  name: { ...typography.headlineSmall },
  stato: { ...typography.labelLarge, fontWeight: '600', marginBottom: spacing.md16 },
  banner: { padding: spacing.sm12 + 2, marginBottom: spacing.md16 },
  bannerText: { ...typography.bodySmall },
  tilesRow: { flexDirection: 'row', gap: spacing.xs8 },
  tile: { flex: 1 },
  sectionLabel: {
    ...typography.labelMedium,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: spacing.lg24,
    marginBottom: spacing.xs8,
    paddingHorizontal: spacing.xs4,
  },
  section: { padding: spacing.md16, marginBottom: spacing.md16 },
  sectionTitle: { ...typography.titleSmall },
  dataRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.xs8 + 2, minHeight: 44 },
  plantRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: spacing.xs8 + 2, minHeight: 44 },
  plantRowRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs4 + 2 },
  dataLabel: { ...typography.bodyMedium },
  dataValue: { ...typography.bodyMedium, fontWeight: '600' },
  timestamp: { ...typography.labelMedium, marginTop: spacing.xs8 },
  emptyData: { ...typography.bodySmall, fontStyle: 'italic' },
  deleteBtn: { alignItems: 'center', paddingVertical: spacing.sm12, minHeight: 44, justifyContent: 'center' },
  deleteText: { ...typography.bodyLarge, fontWeight: '600' },
  renameBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: spacing.lg24 },
  renameCard: { borderRadius: radius.lg, padding: spacing.md20 },
  renameActions: { flexDirection: 'row', gap: spacing.sm12 - 2 },
});
