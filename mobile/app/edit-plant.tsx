import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import { useTheme } from '../src/theme/useTheme';
import { spacing } from '../src/theme/spacing';
import { radius } from '../src/theme/radius';
import { Button } from '../src/components/Button';
import { TextInput } from '../src/components/TextInput';
import { Card } from '../src/components/Card';
import { ScreenHeader } from '../src/components/ScreenHeader';
import { SpeciesPickerModal } from '../src/components/SpeciesPickerModal';
import { deletePlant, getPlant, updatePlant } from '../src/services/plants.api';
import type { Plant, SpeciesSummary, StatoBouquet } from '../src/types/models';

const BOUQUET_STAGES: { key: StatoBouquet; label: string }[] = [
  { key: 'fresco', label: 'Fresco' },
  { key: 'in_cura', label: 'In cura' },
  { key: 'appassendo', label: 'Appassendo' },
  { key: 'concluso', label: 'Concluso' },
];

export default function EditPlantScreen() {
  const theme = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [plant, setPlant] = useState<Plant | null>(null);
  const [nome, setNome] = useState('');
  const [posizione, setPosizione] = useState('');
  const [note, setNote] = useState('');
  const [species, setSpecies] = useState<SpeciesSummary | null>(null);
  const [statoBouquet, setStatoBouquet] = useState<StatoBouquet | null>(null);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [deleteMode, setDeleteMode] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await getPlant(id);
      setPlant(data);
      setNome(data.nome);
      setPosizione(data.posizione ?? '');
      setNote(data.note ?? '');
      setSpecies(data.species);
      setStatoBouquet(data.statoBouquet);
    } catch {
      Alert.alert('Errore', 'Pianta non trovata.', [{ text: 'OK', onPress: () => router.back() }]);
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  async function handleSave() {
    if (!plant) return;
    if (!nome.trim()) {
      Alert.alert('Nome mancante', 'Inserisci un nome.');
      return;
    }
    setSaving(true);
    try {
      await updatePlant(plant.id, {
        nome: nome.trim(),
        posizione: posizione.trim() || null,
        note: note.trim() || null,
        ...(plant.tipo === 'pianta' ? { speciesId: species?.id ?? null } : {}),
        // Invia statoBouquet solo se cambiato: un set esplicito disattiva
        // il ricalcolo automatico lato backend (statoBouquetManuale).
        ...(plant.tipo === 'bouquet' && statoBouquet && statoBouquet !== plant.statoBouquet
          ? { statoBouquet }
          : {}),
      });
      router.back();
    } catch {
      Alert.alert('Errore', 'Salvataggio non riuscito, riprova.');
      setSaving(false);
    }
  }

  async function handleToggleArchive() {
    if (!plant || archiving) return;
    setArchiving(true);
    try {
      await updatePlant(plant.id, { stato: plant.stato === 'attivo' ? 'archiviato' : 'attivo' });
      await load();
    } catch {
      Alert.alert('Errore', 'Operazione non riuscita, riprova.');
    } finally {
      setArchiving(false);
    }
  }

  async function handleDelete() {
    if (!plant || deleting) return;
    setDeleting(true);
    try {
      await deletePlant(plant.id);
      router.replace('/(tabs)/plants');
    } catch {
      Alert.alert('Errore', 'Eliminazione non riuscita, riprova.');
      setDeleting(false);
    }
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

  const deleteEnabled = deleteConfirm.trim().toUpperCase() === 'ELIMINA';

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]} edges={['top']}>
      <ScreenHeader
        title="Modifica"
        rightAction={
          <Pressable onPress={() => router.back()} hitSlop={8}>
            <Text style={{ fontSize: 15, fontWeight: '600', color: theme.t2 }}>Annulla</Text>
          </Pressable>
        }
      />

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
          <Text style={[styles.fieldLabel, { color: theme.t2 }]}>NOME</Text>
          <TextInput value={nome} onChangeText={setNome} style={{ marginBottom: 16 }} />

          {plant.tipo === 'pianta' && (
            <>
              <Text style={[styles.fieldLabel, { color: theme.t2 }]}>SPECIE</Text>
              <Pressable
                onPress={() => setPickerVisible(true)}
                style={[styles.speciesPicker, { backgroundColor: theme.card, borderColor: theme.bord }]}
              >
                {species ? (
                  <View>
                    <Text style={{ fontSize: 16, color: theme.t1 }}>{species.nomeComune}</Text>
                    {species.nomeScientifico && (
                      <Text style={{ fontSize: 12, color: theme.t2, fontStyle: 'italic' }}>{species.nomeScientifico}</Text>
                    )}
                  </View>
                ) : (
                  <Text style={{ fontSize: 16, color: theme.t3 }}>Scegli dal catalogo (opzionale)</Text>
                )}
                <Svg width={7} height={12} viewBox="0 0 7 12" fill="none">
                  <Path d="M1 1L6 6L1 11" stroke={theme.t3} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
                </Svg>
              </Pressable>
              {species && (
                <Pressable onPress={() => setSpecies(null)} style={{ marginBottom: 16, paddingHorizontal: 4 }}>
                  <Text style={{ fontSize: 13, color: theme.red }}>Rimuovi specie</Text>
                </Pressable>
              )}
            </>
          )}

          {plant.tipo === 'bouquet' && (
            <>
              <Text style={[styles.fieldLabel, { color: theme.t2 }]}>STATO BOUQUET</Text>
              <View style={styles.stagesRow}>
                {BOUQUET_STAGES.map((stage) => {
                  const isSelected = statoBouquet === stage.key;
                  return (
                    <Pressable
                      key={stage.key}
                      onPress={() => setStatoBouquet(stage.key)}
                      style={[
                        styles.stageChip,
                        {
                          backgroundColor: isSelected ? theme.acc : theme.card,
                          borderColor: isSelected ? theme.acc : theme.bord,
                        },
                      ]}
                    >
                      <Text style={{ fontSize: 13, fontWeight: '500', color: isSelected ? 'white' : theme.t1 }}>
                        {stage.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              <Text style={[styles.hint, { color: theme.t3 }]}>
                Impostando lo stato manualmente, l'aggiornamento automatico si disattiva.
              </Text>
            </>
          )}

          <Text style={[styles.fieldLabel, { color: theme.t2 }]}>POSIZIONE</Text>
          <TextInput
            value={posizione}
            onChangeText={setPosizione}
            placeholder="Soggiorno (opzionale)"
            style={{ marginBottom: 16 }}
          />

          <Text style={[styles.fieldLabel, { color: theme.t2 }]}>NOTE</Text>
          <TextInput
            value={note}
            onChangeText={setNote}
            placeholder="Note (opzionale)"
            multiline
            numberOfLines={3}
            style={{ marginBottom: 24, minHeight: 80, textAlignVertical: 'top' }}
          />

          <Button label="Salva modifiche" onPress={handleSave} loading={saving} />

          {/* Altre azioni */}
          <Text style={[styles.fieldLabel, { color: theme.t2, marginTop: spacing.xl + spacing.xs }]}>ALTRE AZIONI</Text>
          <Card padded={false} style={styles.actionsCard}>
            <Pressable
              onPress={() => router.push({ pathname: '/plant-history', params: { id: plant.id, nome: plant.nome } })}
              style={[styles.actionRow, { borderBottomWidth: 1, borderBottomColor: theme.bord }]}
            >
              <Text style={[styles.actionText, { color: theme.t1 }]}>Storico cure</Text>
              <Svg width={7} height={12} viewBox="0 0 7 12" fill="none">
                <Path d="M1 1L6 6L1 11" stroke={theme.t3} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
            </Pressable>
            <Pressable onPress={handleToggleArchive} style={styles.actionRow}>
              <Text style={[styles.actionText, { color: theme.amb }]}>
                {plant.stato === 'attivo' ? 'Archivia pianta' : 'Ripristina pianta'}
              </Text>
              {archiving && <ActivityIndicator size="small" color={theme.amb} />}
            </Pressable>
          </Card>
          {plant.stato === 'attivo' && (
            <Text style={[styles.hint, { color: theme.t3 }]}>
              Archiviando, i task in sospeso verranno annullati e i promemoria sospesi.
            </Text>
          )}

          {/* Zona eliminazione */}
          <View style={[styles.dangerZone, { borderColor: theme.red }]}>
            {!deleteMode ? (
              <Pressable onPress={() => setDeleteMode(true)} style={styles.actionRow}>
                <Text style={[styles.actionText, { color: theme.red }]}>Elimina pianta</Text>
              </Pressable>
            ) : (
              <View style={styles.deleteConfirmBox}>
                <Text style={[styles.deleteTitle, { color: theme.red }]}>Eliminare "{plant.nome}"?</Text>
                <Text style={[styles.deleteText, { color: theme.t2 }]}>
                  L'operazione non è reversibile e i task in sospeso verranno annullati. Digita ELIMINA per
                  confermare.
                </Text>
                <TextInput
                  value={deleteConfirm}
                  onChangeText={setDeleteConfirm}
                  placeholder="ELIMINA"
                  autoCapitalize="characters"
                  autoCorrect={false}
                  style={{ marginBottom: 12 }}
                />
                <View style={styles.deleteButtons}>
                  <Pressable
                    onPress={() => {
                      setDeleteMode(false);
                      setDeleteConfirm('');
                    }}
                    style={[styles.deleteBtn, { backgroundColor: theme.card2 }]}
                  >
                    <Text style={{ fontSize: 14, fontWeight: '500', color: theme.t1 }}>Annulla</Text>
                  </Pressable>
                  <Pressable
                    onPress={handleDelete}
                    disabled={!deleteEnabled || deleting}
                    style={[styles.deleteBtn, { backgroundColor: theme.red, opacity: deleteEnabled ? 1 : 0.4 }]}
                  >
                    {deleting ? (
                      <ActivityIndicator size="small" color="white" />
                    ) : (
                      <Text style={{ fontSize: 14, fontWeight: '600', color: 'white' }}>Elimina definitivamente</Text>
                    )}
                  </Pressable>
                </View>
              </View>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <SpeciesPickerModal
        visible={pickerVisible}
        onClose={() => setPickerVisible(false)}
        onSelect={(s) => {
          setSpecies(s);
          setPickerVisible(false);
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  form: { padding: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.xxl },
  fieldLabel: { fontSize: 11, fontWeight: '600', letterSpacing: 0.5, marginBottom: spacing.sm, paddingHorizontal: 4 },
  speciesPicker: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: radius.md,
    borderWidth: 1,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md + 2,
    minHeight: 50,
    marginBottom: spacing.sm,
  },
  stagesRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
  stageChip: {
    flex: 1,
    alignItems: 'center',
    borderRadius: radius.sm,
    borderWidth: 1,
    paddingVertical: spacing.sm + 2,
    minHeight: 40,
    justifyContent: 'center',
  },
  hint: { fontSize: 12, lineHeight: 17, marginBottom: spacing.lg, paddingHorizontal: 4 },
  actionsCard: { marginBottom: spacing.sm },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    minHeight: 52,
  },
  actionText: { fontSize: 16 },
  dangerZone: { borderRadius: radius.lg, borderWidth: 1, marginTop: spacing.lg, overflow: 'hidden' },
  deleteConfirmBox: { padding: spacing.lg },
  deleteTitle: { fontSize: 16, fontWeight: '700', marginBottom: spacing.sm },
  deleteText: { fontSize: 13, lineHeight: 19, marginBottom: spacing.md + 2 },
  deleteButtons: { flexDirection: 'row', gap: spacing.md },
  deleteBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
    paddingVertical: spacing.md,
    minHeight: 46,
  },
});
