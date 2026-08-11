import { useCallback, useState } from 'react';
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import { useTheme } from '../../src/theme/useTheme';
import type { ThemeColors } from '../../src/theme/colors';
import { typography } from '../../src/theme/typography';
import { spacing } from '../../src/theme/spacing';
import { radius } from '../../src/theme/radius';
import { Card } from '../../src/components/Card';
import { Skeleton } from '../../src/components/Skeleton';
import { ErrorState } from '../../src/components/ErrorState';
import { completeTask, listTasks, postponeTask, skipTask } from '../../src/services/plants.api';
import { cancelAccountDeletion } from '../../src/services/user.api';
import { useAuthStore } from '../../src/store/auth.store';
import type { Task } from '../../src/types/models';
import { formatDay, formatTodayLong, TASK_LABELS } from '../../src/lib/plantUi';

function endOfToday(): string {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d.toISOString();
}

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

interface TaskCardProps {
  tasks: Task[];
  theme: ThemeColors;
  onAction: (task: Task, azione: 'completa' | 'rimanda' | 'salta') => void;
}

/** Riga allerta sensore: pallino + singola riga di testo, sola lettura (come da design system). */
function AlertGroup({ tasks, theme }: { tasks: Task[]; theme: ThemeColors }) {
  return (
    <Card variant="elevated" style={styles.card}>
      {tasks.map((task, i) => (
        <View
          key={task.id}
          style={[styles.alertRow, i < tasks.length - 1 && { borderBottomWidth: 1, borderBottomColor: theme.outlineVariant }]}
        >
          <View style={[styles.dot, { backgroundColor: theme.error }]} />
          <Text style={[styles.alertText, { color: theme.onSurface }]} numberOfLines={1}>
            {task.plant.nome} — {task.nota ?? TASK_LABELS[task.tipo]}
          </Text>
        </View>
      ))}
    </Card>
  );
}

/** Riga task calendario/rimandati: titolo+sottotitolo a sinistra, 3 azioni rapide a icona a destra. */
function TaskGroup({ tasks, theme, onAction }: TaskCardProps) {
  return (
    <Card variant="elevated" style={styles.card}>
      {tasks.map((task, i) => (
        <View
          key={task.id}
          style={[styles.taskRow, i < tasks.length - 1 && { borderBottomWidth: 1, borderBottomColor: theme.outlineVariant }]}
        >
          <View style={{ flex: 1 }}>
            <Text style={[styles.taskLabel, { color: theme.onSurface }]} numberOfLines={1}>
              {task.plant.nome}
            </Text>
            <Text style={[styles.taskDetail, { color: task.inRitardo ? theme.warning : theme.onSurfaceVariant }]} numberOfLines={1}>
              {TASK_LABELS[task.tipo]}
              {task.inRitardo ? ` · in ritardo di ${formatDay(task.scadenza)}` : ` · ${formatDay(task.scadenza)}`}
            </Text>
          </View>
          <View style={styles.quickActions}>
            <Pressable
              onPress={() => onAction(task, 'completa')}
              style={({ pressed }) => [styles.quickAction, { backgroundColor: theme.surfaceHigh }, pressed && { opacity: 0.7 }]}
              accessibilityRole="button"
              accessibilityLabel={`Completa ${TASK_LABELS[task.tipo]} ${task.plant.nome}`}
              accessibilityHint="Segna il task come fatto"
              hitSlop={7}
            >
              <Text style={[styles.quickActionIcon, { color: theme.primary }]}>✓</Text>
            </Pressable>
            <Pressable
              onPress={() => onAction(task, 'rimanda')}
              style={({ pressed }) => [styles.quickAction, { backgroundColor: theme.surfaceHigh }, pressed && { opacity: 0.7 }]}
              accessibilityRole="button"
              accessibilityLabel={`Rimanda ${TASK_LABELS[task.tipo]} ${task.plant.nome}`}
              accessibilityHint="Scegli quando ripresentare il task"
              hitSlop={7}
            >
              <Text style={[styles.quickActionIcon, { color: theme.onSurfaceVariant }]}>⏱</Text>
            </Pressable>
            <Pressable
              onPress={() => onAction(task, 'salta')}
              style={({ pressed }) => [styles.quickAction, { backgroundColor: theme.surfaceHigh }, pressed && { opacity: 0.7 }]}
              accessibilityRole="button"
              accessibilityLabel={`Salta ${TASK_LABELS[task.tipo]} ${task.plant.nome}`}
              accessibilityHint="Rimuove il task da oggi senza completarlo"
              hitSlop={7}
            >
              <Text style={[styles.quickActionIcon, { color: theme.onSurfaceVariant }]}>✕</Text>
            </Pressable>
          </View>
        </View>
      ))}
    </Card>
  );
}

export default function OggiScreen() {
  const theme = useTheme();
  const graceperiod = useAuthStore((s) => s.graceperiod);
  const clearGracePeriod = useAuthStore((s) => s.clearGracePeriod);
  const [pending, setPending] = useState<Task[]>([]);
  const [doneToday, setDoneToday] = useState<Task[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState(false);

  async function handleCancelDeletion() {
    try {
      await cancelAccountDeletion();
      clearGracePeriod();
      Alert.alert('Fatto', 'L\'eliminazione del tuo account è stata annullata.');
    } catch {
      Alert.alert('Errore', 'Operazione non riuscita, riprova.');
    }
  }

  const load = useCallback(async () => {
    try {
      const [pendingTasks, completedTasks] = await Promise.all([
        listTasks({ stato: 'pending', to: endOfToday() }),
        listTasks({ stato: 'completato' }),
      ]);
      setPending(pendingTasks);
      setDoneToday(
        completedTasks.filter((t) => t.completatoA && new Date(t.completatoA) >= startOfToday())
      );
      setLoaded(true);
      setLoadError(false);
    } catch {
      // Errore rete: mantieni i dati correnti (se già caricati una volta) ma segnala
      // sempre l'errore — prima restava silenzioso, schermo vuoto senza spiegazione.
      setLoadError(true);
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

  async function handleAction(task: Task, azione: 'completa' | 'rimanda' | 'salta') {
    try {
      if (azione === 'completa') {
        await completeTask(task.id);
      } else if (azione === 'salta') {
        await skipTask(task.id);
      } else {
        const postpone = async (scadenza: Date) => {
          await postponeTask(task.id, scadenza.toISOString());
          await load();
        };
        const tra2Ore = () => {
          const d = new Date();
          d.setHours(d.getHours() + 2);
          return d;
        };
        const traGiorni = (days: number) => {
          const d = new Date();
          d.setDate(d.getDate() + days);
          d.setHours(9, 0, 0, 0);
          return d;
        };
        Alert.alert('Rimanda', `${TASK_LABELS[task.tipo]} ${task.plant.nome}`, [
          { text: 'Tra 2 ore', onPress: () => postpone(tra2Ore()) },
          { text: 'Domani', onPress: () => postpone(traGiorni(1)) },
          { text: 'Tra 2 giorni', onPress: () => postpone(traGiorni(2)) },
          { text: 'Annulla', style: 'cancel' },
        ]);
        return;
      }
      await load();
    } catch {
      Alert.alert('Errore', 'Operazione non riuscita, riprova.');
    }
  }

  const sensorTasks = pending.filter((t) => t.sorgente === 'sensore');
  const calTasks = pending.filter((t) => t.sorgente !== 'sensore');
  const allDone = loaded && pending.length === 0;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.onSurfaceVariant} />}
      >
        <Text style={[styles.date, { color: theme.onSurfaceVariant }]}>{formatTodayLong()}</Text>
        <Text style={[styles.title, { color: theme.onSurface }]}>Oggi</Text>

        {!loaded && !loadError && (
          <View accessible accessibilityLabel="Caricamento task in corso">
            <Skeleton height={72} style={styles.card} />
            <Skeleton height={72} style={styles.card} />
          </View>
        )}

        {loadError && <ErrorState message="Impossibile caricare i task di oggi. Controlla la connessione." onRetry={load} />}

        {graceperiod && (
          <View style={[styles.graceBanner, { backgroundColor: theme.errorContainer, borderColor: theme.error }]}>
            <Text style={[styles.graceTitle, { color: theme.onErrorContainer }]}>Account in eliminazione</Text>
            <Text style={[styles.graceText, { color: theme.onErrorContainer }]}>
              Il tuo account verrà eliminato tra {graceperiod.giorniRimanenti} giorni.
            </Text>
            <Pressable
              onPress={handleCancelDeletion}
              style={[styles.graceBtn, { backgroundColor: theme.error }]}
              accessibilityRole="button"
              accessibilityLabel="Annulla eliminazione account"
              hitSlop={4}
            >
              <Text style={[styles.graceBtnText, { color: theme.onError }]}>Annulla eliminazione</Text>
            </Pressable>
          </View>
        )}

        {sensorTasks.length > 0 && (
          <>
            <Text style={[styles.sectionLabel, { color: theme.error }]}>Allerta sensore</Text>
            <AlertGroup tasks={sensorTasks} theme={theme} />
          </>
        )}

        {calTasks.length > 0 && (
          <>
            <Text style={[styles.sectionLabel, { color: theme.onSurfaceVariant }]}>In scadenza oggi</Text>
            <TaskGroup tasks={calTasks} theme={theme} onAction={handleAction} />
          </>
        )}

        {doneToday.length > 0 && (
          <>
            <Text style={[styles.sectionLabel, { color: theme.onSurfaceVariant }]}>Completati</Text>
            <Card variant="elevated" style={[styles.card, { opacity: 0.6 }]}>
              {doneToday.map((task, i) => (
                <View
                  key={task.id}
                  style={[styles.doneRow, i < doneToday.length - 1 && { borderBottomWidth: 1, borderBottomColor: theme.outlineVariant }]}
                >
                  <View style={[styles.doneCheck, { backgroundColor: theme.primary }]}>
                    <Svg width={13} height={10} viewBox="0 0 11 8" fill="none">
                      <Path d="M1 4L4 7L10 1" stroke={theme.onPrimary} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
                    </Svg>
                  </View>
                  <Text style={[styles.doneLabel, { color: theme.onSurfaceVariant }]}>
                    {TASK_LABELS[task.tipo]} {task.plant.nome}
                  </Text>
                </View>
              ))}
            </Card>
          </>
        )}

        {allDone && (
          <View style={styles.allDone}>
            <View style={[styles.allDoneCircle, { backgroundColor: theme.primary }]}>
              <Svg width={28} height={20} viewBox="0 0 28 20" fill="none">
                <Path d="M2 10L10 18L26 2" stroke={theme.onPrimary} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
            </View>
            <Text style={[styles.allDoneTitle, { color: theme.onSurface }]}>Tutto a posto</Text>
            <Text style={[styles.allDoneSub, { color: theme.onSurfaceVariant }]}>Nessun task in sospeso oggi.</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: spacing.md16, paddingBottom: spacing.lg24 },
  date: { ...typography.labelMedium, marginBottom: spacing.xs4 / 2 },
  title: { ...typography.headlineLarge, letterSpacing: -0.6, marginBottom: spacing.md16 },
  sectionLabel: {
    ...typography.labelMedium,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.xs8,
    paddingHorizontal: spacing.xs4,
  },
  card: { overflow: 'hidden', marginBottom: spacing.md20 },
  alertRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs8 + 2, padding: spacing.sm12 + 2, paddingHorizontal: spacing.md16 },
  alertText: { ...typography.bodyMedium, flex: 1 },
  dot: { width: 7, height: 7, borderRadius: radius.xs, flexShrink: 0 },
  taskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm12,
    padding: spacing.sm12 + 2,
    paddingHorizontal: spacing.md16,
  },
  taskLabel: { ...typography.bodyLarge, fontWeight: '600', marginBottom: 2 },
  taskDetail: { ...typography.bodySmall },
  quickActions: { flexDirection: 'row', gap: spacing.xs8 },
  quickAction: { width: 38, height: 38, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
  quickActionIcon: { fontSize: 17, fontWeight: '600' },
  doneRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs8 + 2, padding: spacing.sm12 + 2, paddingHorizontal: spacing.md16 },
  doneCheck: { width: 24, height: 24, borderRadius: radius.sm + 2, alignItems: 'center', justifyContent: 'center' },
  doneLabel: { ...typography.bodyMedium, textDecorationLine: 'line-through' },
  graceBanner: { borderRadius: radius.lg, borderWidth: 1.5, padding: spacing.md16, marginBottom: spacing.md20 },
  graceTitle: { ...typography.titleSmall, marginBottom: spacing.xs4 },
  graceText: { ...typography.bodySmall, marginBottom: spacing.sm12 },
  graceBtn: { alignSelf: 'flex-start', paddingHorizontal: spacing.sm12 + 2, borderRadius: radius.sm + 1, minHeight: 44, justifyContent: 'center' },
  graceBtnText: { ...typography.labelMedium, fontWeight: '600' },
  allDone: { alignItems: 'center', paddingVertical: spacing.xxl48 },
  allDoneCircle: { width: 56, height: 56, borderRadius: radius.xl, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md16 },
  allDoneTitle: { ...typography.titleMedium, marginBottom: spacing.xs4 },
  allDoneSub: { ...typography.bodyMedium },
});
