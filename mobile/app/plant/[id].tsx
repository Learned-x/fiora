import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import { useTheme } from '../../src/theme/useTheme';
import type { ThemeColors } from '../../src/theme/colors';
import { completeTask, createTask, getPlant } from '../../src/services/plants.api';
import { getVase, getVaseReadings24h } from '../../src/services/vases.api';
import type { SensorReading, SmartVase } from '../../src/services/vases.api';
import { Sparkline } from '../../src/components/Sparkline';
import type { Plant, StatoBouquet, Task, TaskTipo } from '../../src/types/models';
import {
  annaffiaturaLabel,
  formatDay,
  luceLabel,
  luceSensoreLabel,
  luceSensoreStatus,
  plantEmoji,
  temperaturaLabel,
  temperaturaStatus,
  TASK_LABELS,
  umiditaLabel,
  umiditaStatus,
} from '../../src/lib/plantUi';

type PlantDetail = Plant & { tasks: Task[] };

const BOUQUET_STAGES: { key: StatoBouquet; label: string }[] = [
  { key: 'fresco', label: 'Fresco' },
  { key: 'in_cura', label: 'In cura' },
  { key: 'appassendo', label: 'Appassendo' },
  { key: 'concluso', label: 'Concluso' },
];

function BackNav({ theme, onEdit }: { theme: ThemeColors; onEdit: () => void }) {
  return (
    <View style={styles.nav}>
      <Pressable onPress={() => router.back()} style={styles.backBtn}>
        <Svg width={9} height={15} viewBox="0 0 9 15" fill="none">
          <Path d="M8 1L1.5 7.5L8 14" stroke={theme.acc} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
        <Text style={{ fontSize: 17, color: theme.acc }}>Piante</Text>
      </Pressable>
      <Pressable onPress={onEdit}>
        <Text style={{ fontSize: 15, color: theme.acc }}>Modifica</Text>
      </Pressable>
    </View>
  );
}

export default function PlantDetailScreen() {
  const theme = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [plant, setPlant] = useState<PlantDetail | null>(null);
  const [busy, setBusy] = useState(false);
  const [vase, setVase] = useState<SmartVase | null>(null);
  const [readings24h, setReadings24h] = useState<SensorReading[]>([]);

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
    }, [load])
  );

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
          <ActivityIndicator color={theme.acc} />
        </View>
      </SafeAreaView>
    );
  }

  const pendingTasks = plant.tasks.filter((t) => t.stato === 'pending');
  const isBouquet = plant.tipo === 'bouquet';
  const stageIdx = isBouquet ? BOUQUET_STAGES.findIndex((s) => s.key === plant.statoBouquet) : -1;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]} edges={['top']}>
      <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
        <BackNav theme={theme} onEdit={handleEdit} />

        {/* Header */}
        <View style={styles.header}>
          <Text style={{ fontSize: 60, lineHeight: 66, marginBottom: 12 }}>{plantEmoji(plant)}</Text>
          <Text style={[styles.name, { color: theme.t1 }]}>{plant.nome}</Text>
          {plant.species && (
            <>
              <Text style={[styles.common, { color: theme.t2 }]}>{plant.species.nomeComune}</Text>
              {plant.species.nomeScientifico && (
                <Text style={[styles.sci, { color: theme.t3 }]}>{plant.species.nomeScientifico}</Text>
              )}
            </>
          )}
          {isBouquet && plant.dataRicezione && (
            <Text style={[styles.common, { color: theme.t2 }]}>
              Ricevuto il {new Date(plant.dataRicezione).toLocaleDateString('it-IT')}
            </Text>
          )}
          <View style={styles.metaRow}>
            {plant.posizione ? <Text style={[styles.meta, { color: theme.t2 }]}>📍 {plant.posizione}</Text> : null}
            {plant.stato === 'archiviato' && <Text style={[styles.meta, { color: theme.amb }]}>Archiviata</Text>}
          </View>
        </View>

        {/* Vaso Smart */}
        {vase && vase.ultimaLettura && (
          <View style={styles.section}>
            <View style={styles.sensorHeader}>
              <Text style={[styles.sectionLabel, { marginBottom: 0, color: theme.t2 }]}>Vaso smart</Text>
              <View style={styles.sensorHeaderRight}>
                <View
                  style={[
                    styles.statusDot,
                    { backgroundColor: vase.stato === 'connesso' ? theme.acc : theme.t3 },
                  ]}
                />
                <Text style={[styles.sensorStatusText, { color: vase.stato === 'connesso' ? theme.acc : theme.t3 }]}>
                  {vase.stato === 'connesso' ? 'Connesso' : 'Disconnesso'}
                </Text>
              </View>
            </View>

            <View style={styles.sensorTiles}>
              {vase.ultimaLettura.umidita !== null && (
                <View style={[styles.sensorTile, { backgroundColor: theme.card }]}>
                  <Text
                    style={[
                      styles.sensorValue,
                      { color: umiditaStatus(vase.ultimaLettura.umidita, plant.species?.sogliaUmidita) === 'ok' ? theme.acc : theme.amb },
                    ]}
                  >
                    {vase.ultimaLettura.umidita}%
                  </Text>
                  <Text style={[styles.sensorUnit, { color: theme.t2 }]}>umidità</Text>
                  <Text
                    style={[
                      styles.sensorTag,
                      { color: umiditaStatus(vase.ultimaLettura.umidita, plant.species?.sogliaUmidita) === 'ok' ? theme.acc : theme.amb },
                    ]}
                  >
                    {umiditaLabel(vase.ultimaLettura.umidita, plant.species?.sogliaUmidita)}
                  </Text>
                </View>
              )}
              {vase.ultimaLettura.luce !== null && (
                <View style={[styles.sensorTile, { backgroundColor: theme.card }]}>
                  <Text
                    style={[
                      styles.sensorValue,
                      { color: luceSensoreStatus(vase.ultimaLettura.luce) === 'ok' ? theme.acc : theme.amb },
                    ]}
                  >
                    {vase.ultimaLettura.luce}
                  </Text>
                  <Text style={[styles.sensorUnit, { color: theme.t2 }]}>lux</Text>
                  <Text
                    style={[
                      styles.sensorTag,
                      { color: luceSensoreStatus(vase.ultimaLettura.luce) === 'ok' ? theme.acc : theme.amb },
                    ]}
                  >
                    {luceSensoreLabel(vase.ultimaLettura.luce)}
                  </Text>
                </View>
              )}
              {vase.ultimaLettura.temperatura !== null && (
                <View style={[styles.sensorTile, { backgroundColor: theme.card }]}>
                  <Text
                    style={[
                      styles.sensorValue,
                      {
                        color:
                          temperaturaStatus(Number(vase.ultimaLettura.temperatura), plant.species?.tempMin ?? null, plant.species?.tempMax ?? null) === 'ok'
                            ? theme.acc
                            : theme.amb,
                      },
                    ]}
                  >
                    {vase.ultimaLettura.temperatura}°
                  </Text>
                  <Text style={[styles.sensorUnit, { color: theme.t2 }]}>temp.</Text>
                  <Text
                    style={[
                      styles.sensorTag,
                      {
                        color:
                          temperaturaStatus(Number(vase.ultimaLettura.temperatura), plant.species?.tempMin ?? null, plant.species?.tempMax ?? null) === 'ok'
                            ? theme.acc
                            : theme.amb,
                      },
                    ]}
                  >
                    {temperaturaLabel(Number(vase.ultimaLettura.temperatura), plant.species?.tempMin ?? null, plant.species?.tempMax ?? null)}
                  </Text>
                </View>
              )}
            </View>

            {readings24h.length >= 2 && (
              <View style={{ marginTop: 12 }}>
                <Sparkline
                  label="Umidità"
                  unit="%"
                  values={readings24h.filter((r) => r.umidita !== null).map((r) => r.umidita as number)}
                />
              </View>
            )}
          </View>
        )}

        {/* Ciclo di vita bouquet */}
        {isBouquet && (
          <View style={styles.section}>
            <Text style={[styles.sectionLabel, { color: theme.t2 }]}>Ciclo di vita</Text>
            <View style={[styles.cardPadded, { backgroundColor: theme.card }]}>
              <View style={styles.stagesRow}>
                {BOUQUET_STAGES.map((stage, i) => {
                  const active = i <= stageIdx;
                  return (
                    <View key={stage.key} style={styles.stage}>
                      <View
                        style={[
                          styles.stageDot,
                          { backgroundColor: active ? theme.acc : theme.bord },
                        ]}
                      />
                      <Text style={[styles.stageLabel, { color: active ? theme.t1 : theme.t3 }]}>{stage.label}</Text>
                    </View>
                  );
                })}
              </View>
              <View style={[styles.progressTrack, { backgroundColor: theme.bord }]}>
                <View
                  style={[
                    styles.progressFill,
                    { backgroundColor: theme.acc, width: `${((stageIdx + 1) / BOUQUET_STAGES.length) * 100}%` },
                  ]}
                />
              </View>
            </View>
          </View>
        )}

        {/* Guida alla cura */}
        {plant.species && (
          <View style={styles.section}>
            <Text style={[styles.sectionLabel, { color: theme.t2 }]}>Guida alla cura</Text>
            <View style={[styles.card, { backgroundColor: theme.card }]}>
              <View style={[styles.careRow, { borderBottomColor: theme.bord }]}>
                <Text style={styles.careEmoji}>☀️</Text>
                <Text style={[styles.careKey, { color: theme.t2 }]}>Luce</Text>
                <Text style={[styles.careVal, { color: theme.t1 }]}>{luceLabel(plant.species.luce)}</Text>
              </View>
              <View style={[styles.careRow, { borderBottomColor: theme.bord }]}>
                <Text style={styles.careEmoji}>💧</Text>
                <Text style={[styles.careKey, { color: theme.t2 }]}>Annaffiatura</Text>
                <Text style={[styles.careVal, { color: theme.t1 }]}>{annaffiaturaLabel(plant.species.annaffiatura)}</Text>
              </View>
              <View style={[styles.careRow, { borderBottomWidth: 0 }]}>
                <Text style={styles.careEmoji}>⚠️</Text>
                <Text style={[styles.careKey, { color: theme.t2 }]}>Tossicità</Text>
                <View
                  style={[
                    styles.toxBadge,
                    {
                      backgroundColor: plant.species.tossicita ? 'rgba(255,59,48,0.1)' : 'rgba(52,199,89,0.12)',
                    },
                  ]}
                >
                  <Text style={{ fontSize: 12, fontWeight: '600', color: plant.species.tossicita ? theme.red : theme.acc }}>
                    {plant.species.tossicita ? 'Tossica per animali' : 'Non tossica'}
                  </Text>
                </View>
              </View>
            </View>
          </View>
        )}

        {/* Task attivi */}
        {pendingTasks.length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.sectionLabel, { color: theme.t2 }]}>Task attivi</Text>
            <View style={[styles.card, { backgroundColor: theme.card }]}>
              {pendingTasks.map((task, i) => (
                <View
                  key={task.id}
                  style={[styles.taskRow, i < pendingTasks.length - 1 && { borderBottomWidth: 1, borderBottomColor: theme.bord }]}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 15, color: theme.t1 }}>{TASK_LABELS[task.tipo]}</Text>
                    <Text style={{ fontSize: 13, color: theme.t2, marginTop: 1 }}>Scadenza {formatDay(task.scadenza)}</Text>
                  </View>
                  <Pressable
                    onPress={async () => {
                      await completeTask(task.id);
                      await load();
                    }}
                    style={[styles.taskDoneBtn, { backgroundColor: theme.acc }]}
                  >
                    <Text style={{ fontSize: 12, fontWeight: '600', color: 'white' }}>Completa</Text>
                  </Pressable>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Note */}
        {plant.note ? (
          <View style={styles.section}>
            <View style={[styles.cardPadded, { backgroundColor: theme.card }]}>
              <Text style={{ fontSize: 13, color: theme.t2, lineHeight: 21 }}>{plant.note}</Text>
            </View>
          </View>
        ) : null}

        {/* Azioni rapide */}
        <View style={styles.actionsGrid}>
          <Pressable onPress={() => quickAction('annaffiatura')} style={[styles.actionCard, { backgroundColor: theme.acc }]}>
            <Text style={{ fontSize: 14, fontWeight: '600', color: 'white' }}>💧 Annaffia</Text>
          </Pressable>
          <Pressable onPress={() => quickAction('concimazione')} style={[styles.actionCard, { backgroundColor: theme.card }]}>
            <Text style={{ fontSize: 14, fontWeight: '500', color: theme.t1 }}>🌿 Concima</Text>
          </Pressable>
          <Pressable
            onPress={() => router.push({ pathname: '/plant-history', params: { id: plant.id, nome: plant.nome } })}
            style={[styles.actionCard, { backgroundColor: theme.card }]}
          >
            <Text style={{ fontSize: 14, fontWeight: '500', color: theme.t1 }}>Storico cure</Text>
          </Pressable>
          {plant.vasoId && (
            <Pressable onPress={() => router.push(`/vase/${plant.vasoId}`)} style={[styles.actionCard, { backgroundColor: theme.card }]}>
              <Text style={{ fontSize: 14, fontWeight: '500', color: theme.t1 }}>🪴 Vaso Smart</Text>
            </Pressable>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  nav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 8,
  },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  header: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 20, alignItems: 'center' },
  name: { fontSize: 24, fontWeight: '700', letterSpacing: -0.4, marginBottom: 3 },
  common: { fontSize: 14, marginBottom: 2 },
  sci: { fontSize: 13, fontStyle: 'italic' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10 },
  meta: { fontSize: 13 },
  section: { paddingHorizontal: 16, marginBottom: 20 },
  sensorHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  sensorHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statusDot: { width: 7, height: 7, borderRadius: 3.5 },
  sensorStatusText: { fontSize: 12, fontWeight: '600' },
  sensorTiles: { flexDirection: 'row', gap: 10 },
  sensorTile: { flex: 1, borderRadius: 14, padding: 12, alignItems: 'center' },
  sensorValue: { fontSize: 20, fontWeight: '700' },
  sensorUnit: { fontSize: 11, marginTop: 2 },
  sensorTag: { fontSize: 12, fontWeight: '600', marginTop: 6 },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  card: { borderRadius: 14, overflow: 'hidden' },
  cardPadded: { borderRadius: 14, padding: 16 },
  stagesRow: { flexDirection: 'row', marginBottom: 12 },
  stage: { flex: 1, alignItems: 'center' },
  stageDot: { width: 10, height: 10, borderRadius: 5, marginBottom: 6 },
  stageLabel: { fontSize: 11 },
  progressTrack: { height: 4, borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: 4, borderRadius: 2 },
  careRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 13,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  careEmoji: { fontSize: 15, width: 28 },
  careKey: { fontSize: 14, width: 90 },
  careVal: { fontSize: 14, flex: 1 },
  toxBadge: { paddingVertical: 3, paddingHorizontal: 9, borderRadius: 7 },
  taskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  taskDoneBtn: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 8 },
  actionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingHorizontal: 16 },
  actionCard: { flexBasis: '48%', flexGrow: 1, borderRadius: 13, padding: 14, alignItems: 'center' },
});
