import { useCallback, useState } from 'react';
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import { useTheme } from '../../src/theme/useTheme';
import type { ThemeColors } from '../../src/theme/colors';
import { spacing } from '../../src/theme/spacing';
import { typography } from '../../src/theme/typography';
import { radius } from '../../src/theme/radius';
import { Card } from '../../src/components/Card';
import { SectionLabel } from '../../src/components/SectionLabel';
import { elevation } from '../../src/theme/elevation';
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
  dotColor: string;
  theme: ThemeColors;
  onAction: (task: Task, azione: 'completa' | 'rimanda' | 'salta') => void;
}

function TaskGroup({ tasks, dotColor, theme, onAction }: TaskCardProps) {
  return (
    <View style={styles.taskGroup}>
      {tasks.map((task) => (
        <Card key={task.id} padded={false} style={styles.taskCard}>
          <Pressable
            onPress={() => onAction(task, 'completa')}
            hitSlop={8}
            style={[
              styles.completeCircle,
              { borderColor: task.inRitardo ? theme.amb : dotColor },
            ]}
          />
          <View style={styles.taskBody}>
            <Text style={[styles.taskLabel, { color: theme.t1 }]}>
              {TASK_LABELS[task.tipo]} {task.plant.nome}
            </Text>
            <Text style={[styles.taskDetail, { color: task.inRitardo ? theme.amb : theme.t2 }]}>
              {task.inRitardo ? 'In ritardo · ' : ''}Scadenza {formatDay(task.scadenza)}
              {task.nota ? ` · ${task.nota}` : ''}
            </Text>
            <View style={styles.taskActions}>
              <Pressable onPress={() => onAction(task, 'rimanda')} hitSlop={8}>
                <Text style={[styles.actionLink, { color: theme.t2 }]}>Rimanda</Text>
              </Pressable>
              <Pressable onPress={() => onAction(task, 'salta')} hitSlop={8}>
                <Text style={[styles.actionLink, { color: theme.t3 }]}>Salta</Text>
              </Pressable>
            </View>
          </View>
        </Card>
      ))}
    </View>
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
    } catch {
      // errore rete: mantieni i dati correnti, il pull-to-refresh permette di riprovare
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
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.t2} />}
      >
        <Text style={[styles.eyebrow, { color: theme.acc }]}>{formatTodayLong().toUpperCase()}</Text>
        <Text style={[styles.title, { color: theme.t1 }]}>Oggi</Text>

        {graceperiod && (
          <Card style={[styles.graceBanner, { borderColor: theme.red, borderWidth: 1.5 }]}>
            <Text style={[styles.graceTitle, { color: theme.red }]}>Account in eliminazione</Text>
            <Text style={[styles.graceText, { color: theme.t2 }]}>
              Il tuo account verrà eliminato tra {graceperiod.giorniRimanenti} giorni.
            </Text>
            <Pressable onPress={handleCancelDeletion} style={[styles.graceBtn, { backgroundColor: theme.red }]}>
              <Text style={styles.graceBtnText}>Annulla eliminazione</Text>
            </Pressable>
          </Card>
        )}

        {sensorTasks.length > 0 && (
          <>
            <SectionLabel color={theme.red} style={styles.sectionLabel}>Da sensore</SectionLabel>
            <TaskGroup tasks={sensorTasks} dotColor={theme.red} theme={theme} onAction={handleAction} />
          </>
        )}

        {calTasks.length > 0 && (
          <>
            <SectionLabel style={styles.sectionLabel}>In calendario</SectionLabel>
            <TaskGroup tasks={calTasks} dotColor={theme.acc} theme={theme} onAction={handleAction} />
          </>
        )}

        {doneToday.length > 0 && (
          <>
            <SectionLabel color={theme.t3} style={styles.sectionLabel}>Completati</SectionLabel>
            <Card padded={false} elevated={false} style={[styles.doneCard, { opacity: 0.55 }]}>
              {doneToday.map((task, i) => (
                <View
                  key={task.id}
                  style={[styles.doneRow, i < doneToday.length - 1 && { borderBottomWidth: 1, borderBottomColor: theme.bord }]}
                >
                  <View style={[styles.doneCheck, { backgroundColor: theme.acc }]}>
                    <Svg width={11} height={8} viewBox="0 0 11 8" fill="none">
                      <Path d="M1 4L4 7L10 1" stroke="white" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
                    </Svg>
                  </View>
                  <Text style={[styles.doneLabel, { color: theme.t2 }]}>
                    {TASK_LABELS[task.tipo]} {task.plant.nome}
                  </Text>
                </View>
              ))}
            </Card>
          </>
        )}

        {allDone && (
          <View style={styles.allDone}>
            <View style={[styles.allDoneCircle, { backgroundColor: theme.acc }, elevation.md(theme.acc)]}>
              <Svg width={28} height={20} viewBox="0 0 28 20" fill="none">
                <Path d="M2 10L10 18L26 2" stroke="white" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
            </View>
            <Text style={[styles.allDoneTitle, { color: theme.t1 }]}>Tutto a posto</Text>
            <Text style={[styles.allDoneSub, { color: theme.t2 }]}>Nessun task in sospeso oggi.</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  eyebrow: { fontSize: 12, fontWeight: '700', letterSpacing: 1, marginBottom: 4 },
  title: { fontSize: 34, fontWeight: '800', letterSpacing: -0.8, marginBottom: spacing.xl },
  sectionLabel: { marginBottom: spacing.md, paddingHorizontal: spacing.xs, marginTop: spacing.sm },

  taskGroup: { gap: spacing.md, marginBottom: spacing.sm },
  taskCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    padding: spacing.lg,
  },
  completeCircle: {
    width: 26,
    height: 26,
    borderRadius: radius.full,
    borderWidth: 2,
    marginTop: 2,
  },
  taskBody: { flex: 1 },
  taskLabel: { ...typography.bodyMedium, marginBottom: 3 },
  taskDetail: { fontSize: typography.bodySmall.fontSize, marginBottom: spacing.sm },
  taskActions: { flexDirection: 'row', gap: spacing.lg },
  actionLink: { fontSize: 13, fontWeight: '600' },

  doneCard: { borderRadius: radius.lg, marginBottom: spacing.xl },
  doneRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.lg },
  doneCheck: { width: 24, height: 24, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
  doneLabel: { fontSize: typography.h3.fontSize - 3, textDecorationLine: 'line-through' },

  graceBanner: { marginBottom: spacing.xl },
  graceTitle: { fontSize: typography.bodyMedium.fontSize - 1, fontWeight: '700', marginBottom: spacing.xs },
  graceText: { fontSize: typography.bodySmall.fontSize, marginBottom: spacing.md },
  graceBtn: {
    alignSelf: 'flex-start',
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.md + 2,
    borderRadius: radius.sm,
    minHeight: 40,
    justifyContent: 'center',
  },
  graceBtnText: { fontSize: typography.bodySmall.fontSize, fontWeight: '600', color: 'white' },

  allDone: { alignItems: 'center', paddingVertical: spacing.xxxl },
  allDoneCircle: {
    width: 64,
    height: 64,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  allDoneTitle: { fontSize: 20, fontWeight: '700', marginBottom: spacing.xs },
  allDoneSub: { fontSize: typography.bodySmall.fontSize },
});
