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
import { spacing } from '../src/theme/spacing';
import { radius } from '../src/theme/radius';
import { Button } from '../src/components/Button';
import { TextInput } from '../src/components/TextInput';
import { Card } from '../src/components/Card';
import { ScreenHeader } from '../src/components/ScreenHeader';
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
      <ScreenHeader title={title} onBack={() => (addType === null ? router.back() : setAddType(null))} />

      {addType === null ? (
        <View style={styles.typeSelect}>
          <Text style={[styles.question, { color: theme.t2 }]}>Cosa vuoi aggiungere?</Text>
          <Card padded={false}>
            <Pressable
              onPress={() => setAddType('pianta')}
              style={[styles.typeRow, { borderBottomWidth: 1, borderBottomColor: theme.bord }]}
            >
              <View style={[styles.typeIcon, { backgroundColor: 'rgba(21,128,61,0.12)' }]}>
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
          </Card>
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
  typeSelect: { padding: spacing.lg },
  question: { fontSize: 16, marginBottom: spacing.xl },
  typeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md + 2, padding: spacing.lg },
  typeIcon: { width: 44, height: 44, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  typeTitle: { fontSize: 16, fontWeight: '700', marginBottom: 2 },
  typeSub: { fontSize: 13 },
  form: { padding: spacing.lg, paddingTop: spacing.sm },
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
    marginBottom: spacing.lg,
  },
  hint: { fontSize: 13, lineHeight: 19, marginBottom: spacing.sm, paddingHorizontal: 4 },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md + 2,
    minHeight: 50,
    marginBottom: spacing.md,
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
