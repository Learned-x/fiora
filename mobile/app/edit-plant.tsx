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
import { Button } from '../src/components/Button';
import { TextInput } from '../src/components/TextInput';
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
      <View style={styles.nav}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Svg width={9} height={15} viewBox="0 0 9 15" fill="none">
            <Path d="M8 1L1.5 7.5L8 14" stroke={theme.acc} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
          <Text style={{ fontSize: 17, color: theme.acc }}>Annulla</Text>
        </Pressable>
        <Text style={[styles.navTitle, { color: theme.t1 }]}>Modifica</Text>
        <View style={{ width: 80 }} />
      </View>

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
          <Text style={[styles.fieldLabel, { color: theme.t2, marginTop: 28 }]}>ALTRE AZIONI</Text>
          <View style={[styles.actionsCard, { backgroundColor: theme.card }]}>
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
          </View>
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
  nav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 8,
  },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 3, width: 80 },
  navTitle: { fontSize: 17, fontWeight: '600' },
  form: { padding: 16, paddingTop: 8, paddingBottom: 32 },
  fieldLabel: { fontSize: 11, fontWeight: '600', letterSpacing: 0.5, marginBottom: 6, paddingHorizontal: 4 },
  speciesPicker: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 13,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 8,
  },
  stagesRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  stageChip: {
    flex: 1,
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1,
    paddingVertical: 10,
  },
  hint: { fontSize: 12, lineHeight: 17, marginBottom: 16, paddingHorizontal: 4 },
  actionsCard: { borderRadius: 14, overflow: 'hidden', marginBottom: 8 },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  actionText: { fontSize: 16 },
  dangerZone: { borderRadius: 14, borderWidth: 1, marginTop: 16, overflow: 'hidden' },
  deleteConfirmBox: { padding: 16 },
  deleteTitle: { fontSize: 16, fontWeight: '700', marginBottom: 6 },
  deleteText: { fontSize: 13, lineHeight: 19, marginBottom: 14 },
  deleteButtons: { flexDirection: 'row', gap: 10 },
  deleteBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 11,
    paddingVertical: 12,
  },
});
