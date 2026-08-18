import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useTheme } from '../../src/theme/useTheme';
import { spacing } from '../../src/theme/spacing';
import { radius } from '../../src/theme/radius';
import { typography } from '../../src/theme/typography';
import { Card } from '../../src/components/Card';
import { Chip } from '../../src/components/Chip';
import { Collapsible } from '../../src/components/Collapsible';
import { ScreenHeader } from '../../src/components/ScreenHeader';
import { SensorTile } from '../../src/components/SensorTile';
import type { SensorStatus as TileStatus } from '../../src/components/SensorTile';
import { SensorChart } from '../../src/components/SensorChart';
import { Toast } from '../../src/components/Toast';
import type { ToastTrigger } from '../../src/components/Toast';
import { SoglieVaseModal } from '../../src/components/SoglieVaseModal';
import { ProposeSpeciesModal } from '../../src/components/ProposeSpeciesModal';
import { completeTask, createTask, getPlant, updatePlant } from '../../src/services/plants.api';
import { getVase, getVaseReadings24h, refreshVase } from '../../src/services/vases.api';
import type { SensorReading, SmartVase } from '../../src/services/vases.api';
import type { Plant, Species, StatoBouquet, Task, TaskTipo } from '../../src/types/models';
import {
  annaffiaturaLabel,
  curaEffettiva,
  formatDay,
  luceLabel,
  luceSensoreLabel,
  luceSensoreStatus,
  plantEmoji,
  temperaturaLabel,
  temperaturaStatus,
  TASK_LABELS,
  umiditaCategoriaLabel,
  umiditaLabel,
  umiditaStatus,
} from '../../src/lib/plantUi';

type PlantDetail = Plant & { tasks: Task[] };

// Il modello dati usa solo ok/warning; le SensorTile del design system distinguono
// warn/crit — non abbiamo un terzo livello lato dati, quindi "warning" mappa su "warn".
function toTileStatus(status: 'ok' | 'warning'): TileStatus {
  return status === 'ok' ? 'ok' : 'warn';
}

const BOUQUET_STAGES: { key: StatoBouquet; label: string }[] = [
  { key: 'fresco', label: 'Fresco' },
  { key: 'in_cura', label: 'In cura' },
  { key: 'appassendo', label: 'Appassendo' },
  { key: 'concluso', label: 'Concluso' },
];

export default function PlantDetailScreen() {
  const theme = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [plant, setPlant] = useState<PlantDetail | null>(null);
  const [busy, setBusy] = useState(false);
  const [vase, setVase] = useState<SmartVase | null>(null);
  const [readings24h, setReadings24h] = useState<SensorReading[]>([]);
  const [sensorWindow, setSensorWindow] = useState<'24h' | '7d' | '30d'>('24h');
  const [toast, setToast] = useState<ToastTrigger | null>(null);
  const [refreshingVase, setRefreshingVase] = useState(false);
  const [soglieModalVisible, setSoglieModalVisible] = useState(false);
  const [proposeModalVisible, setProposeModalVisible] = useState(false);
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await getPlant(id);
      setPlant(data);
      if (data.vasoId) {
        const [vaseData, readings] = await Promise.all([
          getVase(data.vasoId),
          getVaseReadings24h(data.vasoId),
        ]);
        setVase(vaseData);
        setReadings24h(readings);
      } else {
        setVase(null);
        setReadings24h([]);
      }
    } catch {
      Alert.alert('Errore', 'Pianta non trovata.', [{ text: 'OK', onPress: () => router.back() }]);
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      load();
      return () => {
        if (pollTimer.current) clearInterval(pollTimer.current);
      };
    }, [load])
  );

  // Chiede al vaso una lettura immediata e ripolla per un po' aspettando un
  // dato più recente: la risposta non arriva in questa chiamata HTTP ma via
  // MQTT come una lettura normale (vedi vase.service.ts refreshVase).
  async function handleVaseRefresh() {
    if (!vase) return;
    if (pollTimer.current) clearInterval(pollTimer.current);
    setRefreshingVase(true);
    try {
      await refreshVase(vase.id);
    } catch {
      setRefreshingVase(false);
      Alert.alert('Errore', 'Richiesta di aggiornamento non riuscita, riprova.');
      return;
    }

    const startedAt = vase.ultimaLettura?.time;
    const vaseId = vase.id;
    const deadline = Date.now() + 30000;
    pollTimer.current = setInterval(async () => {
      if (Date.now() >= deadline) {
        if (pollTimer.current) clearInterval(pollTimer.current);
        setRefreshingVase(false);
        return;
      }
      const fresh = await getVase(vaseId).catch(() => null);
      if (fresh?.ultimaLettura?.time && fresh.ultimaLettura.time !== startedAt) {
        if (pollTimer.current) clearInterval(pollTimer.current);
        setRefreshingVase(false);
        setVase(fresh);
        getVaseReadings24h(vaseId).then(setReadings24h).catch(() => {});
      }
    }, 3000);
  }

  async function quickAction(tipo: TaskTipo) {
    if (!plant || busy) return;
    setBusy(true);
    try {
      // Se esiste già un task pending dello stesso tipo lo completiamo,
      // altrimenti registriamo l'azione creando un task e completandolo subito.
      const existing = plant.tasks.find((t) => t.tipo === tipo && t.stato === 'pending');
      if (existing) {
        await completeTask(existing.id);
      } else {
        const created = await createTask(plant.id, tipo, new Date().toISOString());
        await completeTask(created.id);
      }
      await load();
      setToast({
        text: tipo === 'annaffiatura' ? 'Annaffiatura registrata ✓' : 'Concimazione registrata ✓',
        id: Date.now(),
      });
    } catch {
      Alert.alert('Errore', 'Operazione non riuscita, riprova.');
    } finally {
      setBusy(false);
    }
  }

  function handleEdit() {
    if (!plant) return;
    router.push({ pathname: '/edit-plant', params: { id: plant.id } });
  }

  if (!plant) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}>
        <View style={styles.loading}>
          <ActivityIndicator color={theme.primary} />
        </View>
      </SafeAreaView>
    );
  }

  const pendingTasks = plant.tasks.filter((t) => t.stato === 'pending');
  const isBouquet = plant.tipo === 'bouquet';
  const stageIdx = isBouquet ? BOUQUET_STAGES.findIndex((s) => s.key === plant.statoBouquet) : -1;
  const umiditaSoglia = { min: plant.sogliaUmiditaMin, max: plant.sogliaUmiditaMax };
  const luceSoglia = { min: plant.sogliaLuceMin, max: plant.sogliaLuceMax };
  const tempSoglia = {
    min: plant.sogliaTempMin !== null ? Number(plant.sogliaTempMin) : null,
    max: plant.sogliaTempMax !== null ? Number(plant.sogliaTempMax) : null,
  };
  const luceEffettiva = curaEffettiva(plant.luceCura, plant.species?.luce);
  const annaffiaturaEffettiva = curaEffettiva(plant.annaffiaturaCura, plant.species?.annaffiatura);
  const umiditaEffettiva = curaEffettiva(plant.umiditaCura, plant.species?.umidita);
  // D15: badge "Personalizzata" — senza specie la cura manuale è sempre presente
  // (obbligatoria), con specie va mostrato solo se almeno un campo è overridato.
  const haOverrideCura = !plant.species || plant.luceCura != null || plant.annaffiaturaCura != null || plant.umiditaCura != null;
  const umiditaHistory = readings24h.filter((r) => r.umidita !== null).map((r) => r.umidita as number);
  const luceHistory = readings24h.filter((r) => r.luce !== null).map((r) => r.luce as number);
  const temperaturaHistory = readings24h
    .filter((r) => r.temperatura !== null)
    .map((r) => Number(r.temperatura));

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]} edges={['top']}>
      <ScreenHeader back={{ label: 'Piante' }} right={{ label: 'Modifica', onPress: handleEdit }} />
      <ScrollView
        contentContainerStyle={{ paddingBottom: spacing.lg24 }}
        refreshControl={
          vase ? (
            <RefreshControl
              refreshing={refreshingVase}
              onRefresh={handleVaseRefresh}
              enabled={vase.stato === 'connesso'}
            />
          ) : undefined
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.emoji}>{plantEmoji(plant)}</Text>
          <Text style={[styles.name, { color: theme.onSurface }]}>{plant.nome}</Text>
          {plant.species && (
            <>
              <Text style={[styles.common, { color: theme.onSurfaceVariant }]}>{plant.species.nomeComune}</Text>
              {plant.species.nomeScientifico && (
                <Text style={[styles.sci, { color: theme.onSurfaceVariant }]}>{plant.species.nomeScientifico}</Text>
              )}
            </>
          )}
          {isBouquet && plant.dataRicezione && (
            <Text style={[styles.common, { color: theme.onSurfaceVariant }]}>
              Ricevuto il {new Date(plant.dataRicezione).toLocaleDateString('it-IT')}
            </Text>
          )}
          <View style={styles.metaRow}>
            {plant.posizione ? <Text style={[styles.meta, { color: theme.onSurfaceVariant }]}>📍 {plant.posizione}</Text> : null}
            {plant.stato === 'archiviato' && <Text style={[styles.meta, { color: theme.warning }]}>Archiviata</Text>}
          </View>
        </View>

        {/* Vaso Smart */}
        {vase && vase.ultimaLettura && (
          <View style={styles.section}>
            <View style={styles.sensorHeader}>
              <Text style={[styles.sectionLabel, { marginBottom: 0, color: theme.onSurfaceVariant }]}>Vaso smart</Text>
              <View style={styles.sensorHeaderRight}>
                <View
                  style={[
                    styles.statusDot,
                    { backgroundColor: vase.stato === 'connesso' ? theme.primary : theme.onSurfaceVariant },
                  ]}
                />
                <Text
                  style={[
                    styles.sensorStatusText,
                    { color: vase.stato === 'connesso' ? theme.primary : theme.onSurfaceVariant },
                  ]}
                >
                  {vase.stato === 'connesso' ? 'Connesso' : 'Disconnesso'}
                </Text>
                {vase.stato === 'connesso' && (
                  <Pressable
                    onPress={handleVaseRefresh}
                    disabled={refreshingVase}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel="Aggiorna dati vaso"
                  >
                    {refreshingVase ? (
                      <ActivityIndicator size="small" color={theme.primary} />
                    ) : (
                      <Text style={[styles.sensorStatusText, { color: theme.primary, marginLeft: spacing.xs4 }]}>
                        Aggiorna
                      </Text>
                    )}
                  </Pressable>
                )}
              </View>
            </View>

            <View style={styles.sensorTiles}>
              {vase.ultimaLettura.umidita !== null && (
                <View style={styles.sensorTileWrap}>
                  <SensorTile
                    title="Umidità"
                    value={`${vase.ultimaLettura.umidita}%`}
                    label={umiditaLabel(vase.ultimaLettura.umidita, umiditaSoglia, plant.species?.sogliaUmidita)}
                    status={toTileStatus(umiditaStatus(vase.ultimaLettura.umidita, umiditaSoglia, plant.species?.sogliaUmidita))}
                  />
                </View>
              )}
              {vase.ultimaLettura.luce !== null && (
                <View style={styles.sensorTileWrap}>
                  <SensorTile
                    title="Luce"
                    value={`${vase.ultimaLettura.luce} lux`}
                    label={luceSensoreLabel(vase.ultimaLettura.luce, luceSoglia)}
                    status={toTileStatus(luceSensoreStatus(vase.ultimaLettura.luce, luceSoglia))}
                  />
                </View>
              )}
              {vase.ultimaLettura.temperatura !== null && (
                <View style={styles.sensorTileWrap}>
                  <SensorTile
                    title="Temperatura"
                    value={`${vase.ultimaLettura.temperatura}°`}
                    label={temperaturaLabel(
                      Number(vase.ultimaLettura.temperatura),
                      tempSoglia,
                      plant.species?.tempMin ?? null,
                      plant.species?.tempMax ?? null
                    )}
                    status={toTileStatus(
                      temperaturaStatus(
                        Number(vase.ultimaLettura.temperatura),
                        tempSoglia,
                        plant.species?.tempMin ?? null,
                        plant.species?.tempMax ?? null
                      )
                    )}
                  />
                </View>
              )}
            </View>

            <Pressable
              onPress={() => setSoglieModalVisible(true)}
              hitSlop={8}
              style={({ pressed }) => [styles.soglieBtn, { marginTop: spacing.sm12, opacity: pressed ? 0.6 : 1 }]}
              accessibilityRole="button"
              accessibilityLabel="Personalizza soglie sensori"
            >
              <Text style={[styles.sensorStatusText, { color: theme.primary }]}>Personalizza soglie</Text>
            </Pressable>

            <View style={{ marginTop: spacing.sm12 }}>
              <Collapsible title="Andamento sensori">
                <View style={styles.segTrack}>
                  {(['24h', '7d', '30d'] as const).map((w) => (
                    <Chip
                      key={w}
                      label={w === '24h' ? '24H' : w === '7d' ? '7 GG' : '30 GG'}
                      selected={sensorWindow === w}
                      onPress={() => setSensorWindow(w)}
                      accessibilityLabel={`Intervallo ${w === '24h' ? '24 ore' : w === '7d' ? '7 giorni' : '30 giorni'}`}
                    />
                  ))}
                </View>
                {sensorWindow === '24h' ? (
                  <View style={styles.chartsList}>
                    {umiditaHistory.length >= 2 && (
                      <SensorChart
                        label="Umidità terreno"
                        value={`${umiditaHistory[umiditaHistory.length - 1]}%`}
                        color={theme.warning}
                        values={umiditaHistory}
                        fromLabel="24h fa"
                        toLabel="ora"
                      />
                    )}
                    {luceHistory.length >= 2 && (
                      <SensorChart
                        label="Luce"
                        value={`${luceHistory[luceHistory.length - 1]} lux`}
                        color={theme.primary}
                        values={luceHistory}
                        fromLabel="24h fa"
                        toLabel="ora"
                      />
                    )}
                    {temperaturaHistory.length >= 2 && (
                      <SensorChart
                        label="Temperatura"
                        value={`${temperaturaHistory[temperaturaHistory.length - 1]}°`}
                        color={theme.error}
                        values={temperaturaHistory}
                        fromLabel="24h fa"
                        toLabel="ora"
                      />
                    )}
                  </View>
                ) : (
                  <Text style={[styles.noteText, { color: theme.onSurfaceVariant, paddingTop: spacing.sm12 }]}>
                    Storico oltre le 24h non ancora disponibile.
                  </Text>
                )}
              </Collapsible>
            </View>
          </View>
        )}

        {/* Ciclo di vita bouquet */}
        {isBouquet && (
          <View style={styles.section}>
            <Text style={[styles.sectionLabel, { color: theme.onSurfaceVariant }]}>Ciclo di vita</Text>
            <Card variant="flat" style={styles.cardPadded}>
              <View style={styles.stagesRow}>
                {BOUQUET_STAGES.map((stage, i) => {
                  const active = i <= stageIdx;
                  return (
                    <View key={stage.key} style={styles.stage}>
                      <View
                        style={[
                          styles.stageDot,
                          { backgroundColor: active ? theme.primary : theme.outlineVariant },
                        ]}
                      />
                      <Text style={[styles.stageLabel, { color: active ? theme.onSurface : theme.onSurfaceVariant }]}>
                        {stage.label}
                      </Text>
                    </View>
                  );
                })}
              </View>
              <View style={[styles.progressTrack, { backgroundColor: theme.outlineVariant }]}>
                <View
                  style={[
                    styles.progressFill,
                    { backgroundColor: theme.primary, width: `${((stageIdx + 1) / BOUQUET_STAGES.length) * 100}%` },
                  ]}
                />
              </View>
            </Card>
          </View>
        )}

        {/* Guida alla cura */}
        {!isBouquet && (luceEffettiva || annaffiaturaEffettiva || umiditaEffettiva) && (
          <View style={styles.section}>
            <View style={styles.sensorHeader}>
              <Text style={[styles.sectionLabel, { marginBottom: 0, color: theme.onSurfaceVariant }]}>Guida alla cura</Text>
              {haOverrideCura && (
                <Text style={[styles.sensorStatusText, { color: theme.onSurfaceVariant }]}>Personalizzata</Text>
              )}
            </View>
            <Card variant="elevated" style={[styles.cardList, { marginTop: spacing.sm12 - 2 }]}>
              <View style={[styles.careRow, { borderBottomColor: theme.outlineVariant }]}>
                <Text style={styles.careEmoji}>☀️</Text>
                <Text style={[styles.careKey, { color: theme.onSurfaceVariant }]}>Luce</Text>
                <Text style={[styles.careVal, { color: theme.onSurface }]}>{luceLabel(luceEffettiva ?? undefined)}</Text>
              </View>
              <View style={[styles.careRow, { borderBottomColor: theme.outlineVariant }]}>
                <Text style={styles.careEmoji}>💧</Text>
                <Text style={[styles.careKey, { color: theme.onSurfaceVariant }]}>Annaffiatura</Text>
                <Text style={[styles.careVal, { color: theme.onSurface }]}>{annaffiaturaLabel(annaffiaturaEffettiva ?? undefined)}</Text>
              </View>
              <View style={[styles.careRow, { borderBottomColor: theme.outlineVariant }]}>
                <Text style={styles.careEmoji}>💦</Text>
                <Text style={[styles.careKey, { color: theme.onSurfaceVariant }]}>Umidità</Text>
                <Text style={[styles.careVal, { color: theme.onSurface }]}>{umiditaCategoriaLabel(umiditaEffettiva)}</Text>
              </View>
              {plant.species && (
                <View style={[styles.careRow, { borderBottomWidth: 0 }]}>
                  <Text style={styles.careEmoji}>⚠️</Text>
                  <Text style={[styles.careKey, { color: theme.onSurfaceVariant }]}>Tossicità</Text>
                  <View
                    style={[
                      styles.toxBadge,
                      { backgroundColor: plant.species.tossicita ? theme.errorContainer : theme.primaryContainer },
                    ]}
                  >
                    <Text
                      style={[
                        styles.toxBadgeText,
                        { color: plant.species.tossicita ? theme.onErrorContainer : theme.onPrimaryContainer },
                      ]}
                    >
                      {plant.species.tossicita ? 'Tossica per animali' : 'Non tossica'}
                    </Text>
                  </View>
                </View>
              )}
              {!plant.species && (
                <Pressable
                  onPress={() => setProposeModalVisible(true)}
                  accessibilityRole="button"
                  accessibilityLabel="Proponi come specie"
                  style={[styles.careRow, { borderTopWidth: 1, borderTopColor: theme.outlineVariant, borderBottomWidth: 0 }]}
                >
                  <Text style={styles.careEmoji}>➕</Text>
                  <Text style={[styles.careKey, { color: theme.primary, flex: 1 }]}>Proponi come specie</Text>
                </Pressable>
              )}
            </Card>
          </View>
        )}

        {/* Task attivi */}
        {pendingTasks.length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.sectionLabel, { color: theme.onSurfaceVariant }]}>Task attivi</Text>
            <Card variant="elevated" style={styles.cardList}>
              {pendingTasks.map((task, i) => (
                <View
                  key={task.id}
                  style={[
                    styles.taskRow,
                    i < pendingTasks.length - 1 && { borderBottomWidth: 1, borderBottomColor: theme.outlineVariant },
                  ]}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.taskLabel, { color: theme.onSurface }]}>{TASK_LABELS[task.tipo]}</Text>
                    <Text style={[styles.taskDue, { color: theme.onSurfaceVariant }]}>Scadenza {formatDay(task.scadenza)}</Text>
                  </View>
                  <Pressable
                    onPress={async () => {
                      await completeTask(task.id);
                      await load();
                    }}
                    style={[styles.taskDoneBtn, { backgroundColor: theme.primary }]}
                    hitSlop={4}
                    accessibilityRole="button"
                    accessibilityLabel={`Completa ${TASK_LABELS[task.tipo]}`}
                  >
                    <Text style={[styles.taskDoneBtnText, { color: theme.onPrimary }]}>Completa</Text>
                  </Pressable>
                </View>
              ))}
            </Card>
          </View>
        )}

        {/* Note */}
        {plant.note ? (
          <View style={styles.section}>
            <Card variant="flat" style={styles.cardPadded}>
              <Text style={[styles.noteText, { color: theme.onSurfaceVariant }]}>{plant.note}</Text>
            </Card>
          </View>
        ) : null}

        {/* Azioni rapide */}
        <View style={styles.actionsGrid}>
          <Pressable
            onPress={() => quickAction('annaffiatura')}
            style={[styles.actionCard, { backgroundColor: theme.primary }]}
            accessibilityRole="button"
            accessibilityLabel="Annaffia"
          >
            <Text style={[styles.actionLabel, { color: theme.onPrimary }]}>💧 Annaffia</Text>
          </Pressable>
          <Pressable
            onPress={() => quickAction('concimazione')}
            style={[styles.actionCard, { backgroundColor: theme.surfaceHigh }]}
            accessibilityRole="button"
            accessibilityLabel="Concima"
          >
            <Text style={[styles.actionLabelNeutral, { color: theme.onSurface }]}>🌿 Concima</Text>
          </Pressable>
          <Pressable
            onPress={() => router.push({ pathname: '/plant-history', params: { id: plant.id, nome: plant.nome } })}
            style={[styles.actionCard, { backgroundColor: theme.surfaceHigh }]}
            accessibilityRole="button"
            accessibilityLabel="Storico cure"
          >
            <Text style={[styles.actionLabelNeutral, { color: theme.onSurface }]}>Storico cure</Text>
          </Pressable>
          {plant.vasoId && (
            <Pressable
              onPress={() => router.push(`/vase/${plant.vasoId}`)}
              style={[styles.actionCard, { backgroundColor: theme.surfaceHigh }]}
              accessibilityRole="button"
              accessibilityLabel="Vaso Smart"
            >
              <Text style={[styles.actionLabelNeutral, { color: theme.onSurface }]}>🪴 Vaso Smart</Text>
            </Pressable>
          )}
        </View>
      </ScrollView>
      <Toast trigger={toast} />
      {vase && (
        <SoglieVaseModal
          visible={soglieModalVisible}
          plant={plant}
          onClose={() => setSoglieModalVisible(false)}
          onSaved={(updated) => {
            setPlant((prev) => (prev ? { ...prev, ...updated } : prev));
            setToast({ text: 'Soglie aggiornate ✓', id: Date.now() });
          }}
          onError={() => Alert.alert('Errore', 'Salvataggio soglie non riuscito, riprova.')}
        />
      )}
      <ProposeSpeciesModal
        visible={proposeModalVisible}
        onClose={() => setProposeModalVisible(false)}
        onCreated={async (species: Species) => {
          setProposeModalVisible(false);
          try {
            const updated = await updatePlant(plant.id, { speciesId: species.id });
            setPlant((prev) => (prev ? { ...prev, ...updated } : prev));
            setToast({ text: 'Specie collegata ✓', id: Date.now() });
          } catch {
            Alert.alert('Errore', 'Specie creata ma collegamento alla pianta non riuscito, riprova da "Cambia specie".');
          }
        }}
        initial={{
          nomeComune: plant.nome,
          luceCura: plant.luceCura,
          annaffiaturaCura: plant.annaffiaturaCura,
          umiditaCura: plant.umiditaCura,
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { paddingHorizontal: spacing.md16, paddingTop: spacing.sm12, paddingBottom: spacing.lg24, alignItems: 'center' },
  emoji: { fontSize: 60, lineHeight: 66, marginBottom: spacing.sm12 },
  name: { ...typography.headlineSmall, letterSpacing: -0.4, marginBottom: 3, textAlign: 'center' },
  common: { ...typography.bodyMedium, marginBottom: 2 },
  sci: { ...typography.bodySmall, fontStyle: 'italic' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm12 - 2, marginTop: spacing.sm12 },
  meta: { ...typography.bodySmall },
  section: { paddingHorizontal: spacing.md16, marginBottom: spacing.lg24 },
  sensorHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm12 - 2 },
  sensorHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statusDot: { width: 7, height: 7, borderRadius: 3.5 },
  sensorStatusText: { ...typography.labelMedium },
  sensorTiles: { flexDirection: 'row', gap: spacing.sm12 - 2 },
  sensorTileWrap: { flex: 1 },
  soglieBtn: { alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center', paddingVertical: spacing.xs8 },
  segTrack: { flexDirection: 'row', gap: spacing.xs8, paddingBottom: spacing.sm12 },
  chartsList: { gap: spacing.sm12 },
  sectionLabel: {
    ...typography.labelMedium,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.sm12 - 2,
  },
  cardList: { overflow: 'hidden' },
  cardPadded: { padding: spacing.md16 },
  stagesRow: { flexDirection: 'row', marginBottom: spacing.sm12 },
  stage: { flex: 1, alignItems: 'center' },
  stageDot: { width: 10, height: 10, borderRadius: 5, marginBottom: 6 },
  stageLabel: { ...typography.labelSmall },
  progressTrack: { height: 4, borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: 4, borderRadius: 2 },
  careRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm12 + 1,
    paddingHorizontal: spacing.md16,
    borderBottomWidth: 1,
    minHeight: 44,
  },
  careEmoji: { fontSize: 15, width: 28 },
  careKey: { ...typography.bodyMedium, width: 90 },
  careVal: { ...typography.bodyMedium, flex: 1 },
  toxBadge: { paddingVertical: 3, paddingHorizontal: spacing.sm12 - 3, borderRadius: radius.sm - 1 },
  toxBadgeText: { ...typography.labelMedium },
  taskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm12 + 2,
    paddingHorizontal: spacing.md16,
    minHeight: 44,
  },
  taskLabel: { ...typography.bodyMedium },
  taskDue: { ...typography.bodySmall, marginTop: 1 },
  taskDoneBtn: { paddingHorizontal: spacing.sm12, borderRadius: radius.sm, minHeight: 44, justifyContent: 'center' },
  taskDoneBtnText: { ...typography.labelMedium },
  noteText: { ...typography.bodyMedium },
  actionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm12 - 2, paddingHorizontal: spacing.md16 },
  actionCard: {
    flexBasis: '48%',
    flexGrow: 1,
    borderRadius: radius.lg,
    padding: spacing.sm12 + 2,
    alignItems: 'center',
    minHeight: 44,
    justifyContent: 'center',
  },
  actionLabel: { ...typography.labelLarge },
  actionLabelNeutral: { ...typography.labelLarge },
});
