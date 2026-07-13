import { useCallback, useState } from 'react';
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import { useTheme } from '../../src/theme/useTheme';
import type { ThemeColors } from '../../src/theme/colors';
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
    <View style={[styles.card, { backgroundColor: theme.card }]}>
      {tasks.map((task, i) => (
        <View key={task.id} style={[styles.taskRow, i < tasks.length - 1 && { borderBottomWidth: 1, borderBottomColor: theme.bord }]}>
          <View style={styles.taskHeader}>
            <View style={[styles.dot, { backgroundColor: task.inRitardo ? theme.amb : dotColor }]} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.taskLabel, { color: theme.t1 }]}>
                {TASK_LABELS[task.tipo]} {task.plant.nome}
              </Text>
              <Text style={[styles.taskDetail, { color: task.inRitardo ? theme.amb : theme.t2 }]}>
                {task.inRitardo ? 'In ritardo · ' : ''}Scadenza {formatDay(task.scadenza)}
                {task.nota ? ` · ${task.nota}` : ''}
              </Text>
            </View>
          </View>
          <View style={styles.taskActions}>
            <Pressable onPress={() => onAction(task, 'completa')} style={[styles.actionBtn, { backgroundColor: theme.acc }]}>
              <Text style={styles.actionBtnPrimaryText}>Completa</Text>
            </Pressable>
            <Pressable onPress={() => onAction(task, 'rimanda')} style={[styles.actionBtn, { backgroundColor: theme.card2 }]}>
              <Text style={[styles.actionBtnText, { color: theme.t1 }]}>Rimanda</Text>
            </Pressable>
            <Pressable onPress={() => onAction(task, 'salta')} style={[styles.actionBtn, { backgroundColor: theme.card2 }]}>
              <Text style={[styles.actionBtnText, { color: theme.t2 }]}>Salta</Text>
            </Pressable>
          </View>
        </View>
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
        <Text style={[styles.date, { color: theme.t2 }]}>{formatTodayLong()}</Text>
        <Text style={[styles.title, { color: theme.t1 }]}>Oggi</Text>

        {graceperiod && (
          <View style={[styles.graceBanner, { backgroundColor: theme.card, borderColor: theme.red }]}>
            <Text style={[styles.graceTitle, { color: theme.red }]}>Account in eliminazione</Text>
            <Text style={[styles.graceText, { color: theme.t2 }]}>
              Il tuo account verrà eliminato tra {graceperiod.giorniRimanenti} giorni.
            </Text>
            <Pressable onPress={handleCancelDeletion} style={[styles.graceBtn, { backgroundColor: theme.red }]}>
              <Text style={styles.graceBtnText}>Annulla eliminazione</Text>
            </Pressable>
          </View>
        )}

        {sensorTasks.length > 0 && (
          <>
            <Text style={[styles.sectionLabel, { color: theme.red }]}>Da sensore</Text>
            <TaskGroup tasks={sensorTasks} dotColor={theme.red} theme={theme} onAction={handleAction} />
          </>
        )}

        {calTasks.length > 0 && (
          <>
            <Text style={[styles.sectionLabel, { color: theme.t2 }]}>In calendario</Text>
            <TaskGroup tasks={calTasks} dotColor={theme.acc} theme={theme} onAction={handleAction} />
          </>
        )}

        {doneToday.length > 0 && (
          <>
            <Text style={[styles.sectionLabel, { color: theme.t3 }]}>Completati</Text>
            <View style={[styles.card, { backgroundColor: theme.card, opacity: 0.5 }]}>
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
            </View>
          </>
        )}

        {allDone && (
          <View style={styles.allDone}>
            <View style={[styles.allDoneCircle, { backgroundColor: theme.acc }]}>
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
  content: { padding: 16, paddingBottom: 24 },
  date: { fontSize: 13, fontWeight: '500', marginBottom: 2 },
  title: { fontSize: 30, fontWeight: '700', letterSpacing: -0.6, marginBottom: 16 },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  card: { borderRadius: 14, overflow: 'hidden', marginBottom: 20 },
  taskRow: { padding: 14, paddingHorizontal: 16 },
  taskHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 12 },
  dot: { width: 8, height: 8, borderRadius: 4, marginTop: 5 },
  taskLabel: { fontSize: 16, fontWeight: '500', marginBottom: 2 },
  taskDetail: { fontSize: 13 },
  taskActions: { flexDirection: 'row', gap: 8, paddingLeft: 18 },
  actionBtn: { paddingVertical: 7, paddingHorizontal: 14, borderRadius: 9 },
  actionBtnPrimaryText: { fontSize: 13, fontWeight: '600', color: 'white' },
  actionBtnText: { fontSize: 13, fontWeight: '500' },
  doneRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, paddingHorizontal: 16 },
  doneCheck: { width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  doneLabel: { fontSize: 15, textDecorationLine: 'line-through' },
  graceBanner: { borderRadius: 14, borderWidth: 1.5, padding: 16, marginBottom: 20 },
  graceTitle: { fontSize: 15, fontWeight: '700', marginBottom: 4 },
  graceText: { fontSize: 13, marginBottom: 12 },
  graceBtn: { alignSelf: 'flex-start', paddingVertical: 8, paddingHorizontal: 14, borderRadius: 9 },
  graceBtnText: { fontSize: 13, fontWeight: '600', color: 'white' },
  allDone: { alignItems: 'center', paddingVertical: 48 },
  allDoneCircle: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  allDoneTitle: { fontSize: 18, fontWeight: '600', marginBottom: 4 },
  allDoneSub: { fontSize: 14 },
});
