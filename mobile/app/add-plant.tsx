import { useState } from 'react';
import {
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
import { router } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import { useTheme } from '../src/theme/useTheme';
import { Button } from '../src/components/Button';
import { TextInput } from '../src/components/TextInput';
import { SpeciesPickerModal } from '../src/components/SpeciesPickerModal';
import { createPlant } from '../src/services/plants.api';
import type { Species } from '../src/types/models';

type AddType = 'pianta' | 'bouquet' | null;

export default function AddPlantScreen() {
  const theme = useTheme();
  const [addType, setAddType] = useState<AddType>(null);
  const [nome, setNome] = useState('');
  const [posizione, setPosizione] = useState('');
  const [species, setSpecies] = useState<Species | null>(null);
  const [giaInAcqua, setGiaInAcqua] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pickerVisible, setPickerVisible] = useState(false);

  async function handleSave() {
    if (!nome.trim()) {
      Alert.alert('Nome mancante', 'Inserisci un nome.');
      return;
    }
    setSaving(true);
    try {
      await createPlant({
        nome: nome.trim(),
        tipo: addType!,
        ...(addType === 'pianta' && species ? { speciesId: species.id } : {}),
        ...(posizione.trim() ? { posizione: posizione.trim() } : {}),
        ...(addType === 'bouquet' ? { dataRicezione: new Date().toISOString(), giaInAcqua } : {}),
      });
      router.back();
    } catch {
      Alert.alert('Errore', 'Salvataggio non riuscito, riprova.');
      setSaving(false);
    }
  }

  const title = addType === null ? 'Aggiungi' : addType === 'pianta' ? 'Nuova pianta' : 'Nuovo bouquet';

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]} edges={['top']}>
      <View style={styles.nav}>
        <Pressable
          onPress={() => (addType === null ? router.back() : setAddType(null))}
          style={styles.backBtn}
        >
          <Svg width={9} height={15} viewBox="0 0 9 15" fill="none">
            <Path d="M8 1L1.5 7.5L8 14" stroke={theme.acc} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
          <Text style={{ fontSize: 17, color: theme.acc }}>Indietro</Text>
        </Pressable>
        <Text style={[styles.navTitle, { color: theme.t1 }]}>{title}</Text>
        <View style={{ width: 80 }} />
      </View>

      {addType === null ? (
        <View style={styles.typeSelect}>
          <Text style={[styles.question, { color: theme.t2 }]}>Cosa vuoi aggiungere?</Text>
          <View style={[styles.card, { backgroundColor: theme.card }]}>
            <Pressable
              onPress={() => setAddType('pianta')}
              style={[styles.typeRow, { borderBottomWidth: 1, borderBottomColor: theme.bord }]}
            >
              <View style={[styles.typeIcon, { backgroundColor: 'rgba(52,199,89,0.1)' }]}>
                <Text style={{ fontSize: 20 }}>🌿</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.typeTitle, { color: theme.t1 }]}>Pianta</Text>
                <Text style={[styles.typeSub, { color: theme.t2 }]}>Cerca dal catalogo</Text>
              </View>
            </Pressable>
            <Pressable onPress={() => setAddType('bouquet')} style={styles.typeRow}>
              <View style={[styles.typeIcon, { backgroundColor: 'rgba(10,132,255,0.08)' }]}>
                <Text style={{ fontSize: 20 }}>💐</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.typeTitle, { color: theme.t1 }]}>Bouquet</Text>
                <Text style={[styles.typeSub, { color: theme.t2 }]}>Fiori recisi e bouquet</Text>
              </View>
            </Pressable>
          </View>
        </View>
      ) : (
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1 }}
        >
          <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
            <Text style={[styles.fieldLabel, { color: theme.t2 }]}>NOME</Text>
            <TextInput
              value={nome}
              onChangeText={setNome}
              placeholder={addType === 'pianta' ? 'La mia Monstera' : 'Bouquet compleanno'}
              style={{ marginBottom: 16 }}
            />

            {addType === 'pianta' && (
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
                        <Text style={{ fontSize: 12, color: theme.t2, fontStyle: 'italic' }}>
                          {species.nomeScientifico}
                        </Text>
                      )}
                    </View>
                  ) : (
                    <Text style={{ fontSize: 16, color: theme.t3 }}>Scegli dal catalogo (opzionale)</Text>
                  )}
                  <Svg width={7} height={12} viewBox="0 0 7 12" fill="none">
                    <Path d="M1 1L6 6L1 11" stroke={theme.t3} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
                  </Svg>
                </Pressable>
              </>
            )}

            <Text style={[styles.fieldLabel, { color: theme.t2 }]}>POSIZIONE</Text>
            <TextInput
              value={posizione}
              onChangeText={setPosizione}
              placeholder="Soggiorno (opzionale)"
              style={{ marginBottom: 16 }}
            />

            {addType === 'bouquet' && (
              <>
                <Pressable
                  onPress={() => setGiaInAcqua((v) => !v)}
                  style={[styles.checkboxRow, { backgroundColor: theme.card, borderColor: theme.bord }]}
                >
                  <View
                    style={[
                      styles.checkbox,
                      {
                        borderColor: giaInAcqua ? theme.acc : theme.bord,
                        backgroundColor: giaInAcqua ? theme.acc : 'transparent',
                      },
                    ]}
                  >
                    {giaInAcqua && (
                      <Svg width={11} height={8} viewBox="0 0 11 8" fill="none">
                        <Path d="M1 4L4 7L10 1" stroke="white" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
                      </Svg>
                    )}
                  </View>
                  <Text style={{ fontSize: 15, color: theme.t1, flex: 1 }}>Il bouquet è già in acqua</Text>
                </Pressable>
                <Text style={[styles.hint, { color: theme.t2 }]}>
                  Data di ricezione: oggi. Ti ricorderemo di cambiare l'acqua e tagliare gli steli.
                  {!giaInAcqua ? ' Ti chiederemo subito di metterlo in acqua.' : ''}
                </Text>
              </>
            )}

            <View style={{ marginTop: 8 }}>
              <Button
                label={addType === 'pianta' ? 'Salva pianta' : 'Salva bouquet'}
                onPress={handleSave}
                loading={saving}
              />
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      )}

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
  typeSelect: { padding: 16 },
  question: { fontSize: 16, marginBottom: 20 },
  card: { borderRadius: 14, overflow: 'hidden' },
  typeRow: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16 },
  typeIcon: { width: 40, height: 40, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  typeTitle: { fontSize: 16, fontWeight: '500', marginBottom: 2 },
  typeSub: { fontSize: 13 },
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
    marginBottom: 16,
  },
  hint: { fontSize: 13, lineHeight: 19, marginBottom: 8, paddingHorizontal: 4 },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 13,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 12,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
