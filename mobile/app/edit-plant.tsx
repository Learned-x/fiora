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
import { getPlant, updatePlant } from '../src/services/plants.api';
import type { Plant, SpeciesSummary } from '../src/types/models';

export default function EditPlantScreen() {
  const theme = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [plant, setPlant] = useState<Plant | null>(null);
  const [nome, setNome] = useState('');
  const [posizione, setPosizione] = useState('');
  const [note, setNote] = useState('');
  const [species, setSpecies] = useState<SpeciesSummary | null>(null);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await getPlant(id);
      setPlant(data);
      setNome(data.nome);
      setPosizione(data.posizione ?? '');
      setNote(data.note ?? '');
      setSpecies(data.species);
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
      });
      router.back();
    } catch {
      Alert.alert('Errore', 'Salvataggio non riuscito, riprova.');
      setSaving(false);
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
  form: { padding: 16, paddingTop: 8 },
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
});
