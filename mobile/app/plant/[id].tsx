import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import { useTheme } from '../../src/theme/useTheme';
import type { ThemeColors } from '../../src/theme/colors';
import { spacing } from '../../src/theme/spacing';
import { radius } from '../../src/theme/radius';
import { typography } from '../../src/theme/typography';
import { Card } from '../../src/components/Card';
import { SensorTile } from '../../src/components/SensorTile';
import type { SensorStatus as TileStatus } from '../../src/components/SensorTile';
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

function BackNav({ theme, onEdit }: { theme: ThemeColors; onEdit: () => void }) {
  return (
    <View style={styles.nav}>
      <Pressable
        onPress={() => router.back()}
        style={styles.backBtn}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel="Torna a Piante"
      >
        <Svg width={9} height={15} viewBox="0 0 9 15" fill="none">
          <Path d="M8 1L1.5 7.5L8 14" stroke={theme.primary} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
        <Text style={[styles.navText, { color: theme.primary }]}>Piante</Text>
      </Pressable>
      <Pressable onPress={onEdit} hitSlop={8} accessibilityRole="button" accessibilityLabel="Modifica pianta">
        <Text style={[styles.navTextSmall, { color: theme.primary }]}>Modifica</Text>
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
          <ActivityIndicator color={theme.primary} />
        </View>
      </SafeAreaView>
    );
  }

  const pendingTasks = plant.tasks.filter((t) => t.stato === 'pending');
  const isBouquet = plant.tipo === 'bouquet';
  const stageIdx = isBouquet ? BOUQUET_STAGES.findIndex((s) => s.key === plant.statoBouquet) : -1;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]} edges={['top']}>
      <ScrollView contentContainerStyle={{ paddingBottom: spacing.lg24 }}>
        <BackNav theme={theme} onEdit={handleEdit} />

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
              </View>
            </View>

            <View style={styles.sensorTiles}>
              {vase.ultimaLettura.umidita !== null && (
                <View style={styles.sensorTileWrap}>
                  <SensorTile
                    value={`${vase.ultimaLettura.umidita}%`}
                    label={umiditaLabel(vase.ultimaLettura.umidita, plant.species?.sogliaUmidita)}
                    status={toTileStatus(umiditaStatus(vase.ultimaLettura.umidita, plant.species?.sogliaUmidita))}
                  />
                </View>
              )}
              {vase.ultimaLettura.luce !== null && (
                <View style={styles.sensorTileWrap}>
                  <SensorTile
                    value={`${vase.ultimaLettura.luce} lux`}
                    label={luceSensoreLabel(vase.ultimaLettura.luce)}
                    status={toTileStatus(luceSensoreStatus(vase.ultimaLettura.luce))}
                  />
                </View>
              )}
              {vase.ultimaLettura.temperatura !== null && (
                <View style={styles.sensorTileWrap}>
                  <SensorTile
                    value={`${vase.ultimaLettura.temperatura}°`}
                    label={temperaturaLabel(
                      Number(vase.ultimaLettura.temperatura),
                      plant.species?.tempMin ?? null,
                      plant.species?.tempMax ?? null
                    )}
                    status={toTileStatus(
                      temperaturaStatus(
                        Number(vase.ultimaLettura.temperatura),
                        plant.species?.tempMin ?? null,
                        plant.species?.tempMax ?? null
                      )
                    )}
                  />
                </View>
              )}
            </View>

            {readings24h.length >= 2 && (
              <View style={{ marginTop: spacing.sm12 }}>
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
        {plant.species && (
          <View style={styles.section}>
            <Text style={[styles.sectionLabel, { color: theme.onSurfaceVariant }]}>Guida alla cura</Text>
            <Card variant="elevated" style={styles.cardList}>
              <View style={[styles.careRow, { borderBottomColor: theme.outlineVariant }]}>
                <Text style={styles.careEmoji}>☀️</Text>
                <Text style={[styles.careKey, { color: theme.onSurfaceVariant }]}>Luce</Text>
                <Text style={[styles.careVal, { color: theme.onSurface }]}>{luceLabel(plant.species.luce)}</Text>
              </View>
              <View style={[styles.careRow, { borderBottomColor: theme.outlineVariant }]}>
                <Text style={styles.careEmoji}>💧</Text>
                <Text style={[styles.careKey, { color: theme.onSurfaceVariant }]}>Annaffiatura</Text>
                <Text style={[styles.careVal, { color: theme.onSurface }]}>{annaffiaturaLabel(plant.species.annaffiatura)}</Text>
              </View>
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
    paddingHorizontal: spacing.md16,
    paddingTop: spacing.sm12,
    paddingBottom: spacing.xs8,
    minHeight: 44,
  },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 3, minHeight: 44, paddingVertical: spacing.xs8 },
  navText: { ...typography.bodyLarge },
  navTextSmall: { ...typography.bodyMedium },
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
  taskDoneBtn: { paddingVertical: 6, paddingHorizontal: spacing.sm12, borderRadius: radius.sm, minHeight: 32 },
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
