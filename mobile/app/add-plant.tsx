import { useRef, useState } from 'react';
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
import { typography } from '../src/theme/typography';
import { Button } from '../src/components/Button';
import { TextInput } from '../src/components/TextInput';
import { ScreenHeader } from '../src/components/ScreenHeader';
import { StepTransition } from '../src/components/StepTransition';
import { Card } from '../src/components/Card';
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

  const prevAddTypeRef = useRef(addType);
  const directionRef = useRef<'fwd' | 'back'>('fwd');
  if (prevAddTypeRef.current !== addType) {
    directionRef.current = addType === null ? 'back' : 'fwd';
    prevAddTypeRef.current = addType;
  }

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
      <ScreenHeader
        back={{ label: 'Indietro', onPress: () => (addType === null ? router.back() : setAddType(null)) }}
        title={title}
      />

      <StepTransition stepKey={addType} direction={directionRef.current}>
      {addType === null ? (
        <View style={styles.typeSelect}>
          <Text style={[styles.question, { color: theme.onSurfaceVariant }]}>Cosa vuoi aggiungere?</Text>
          <Card variant="elevated" style={styles.typeCard}>
            <Pressable
              onPress={() => setAddType('pianta')}
              style={[styles.typeRow, { borderBottomWidth: 1, borderBottomColor: theme.outlineVariant }]}
              accessibilityRole="button"
              accessibilityLabel="Pianta — cerca dal catalogo"
            >
              <View style={[styles.typeIcon, { backgroundColor: theme.primaryContainer }]}>
                <Text style={{ fontSize: 20 }}>🌿</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.typeTitle, { color: theme.onSurface }]}>Pianta</Text>
                <Text style={[styles.typeSub, { color: theme.onSurfaceVariant }]}>Cerca dal catalogo</Text>
              </View>
            </Pressable>
            <Pressable
              onPress={() => setAddType('bouquet')}
              style={styles.typeRow}
              accessibilityRole="button"
              accessibilityLabel="Bouquet — fiori recisi e bouquet"
            >
              <View style={[styles.typeIcon, { backgroundColor: theme.tertiaryContainer }]}>
                <Text style={{ fontSize: 20 }}>💐</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.typeTitle, { color: theme.onSurface }]}>Bouquet</Text>
                <Text style={[styles.typeSub, { color: theme.onSurfaceVariant }]}>Fiori recisi e bouquet</Text>
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
            <Text style={[styles.fieldLabel, { color: theme.onSurfaceVariant }]}>NOME</Text>
            <TextInput
              value={nome}
              onChangeText={setNome}
              placeholder={addType === 'pianta' ? 'La mia Monstera' : 'Bouquet compleanno'}
              style={{ marginBottom: spacing.md16 }}
            />

            {addType === 'pianta' && (
              <>
                <Text style={[styles.fieldLabel, { color: theme.onSurfaceVariant }]}>SPECIE</Text>
                <Pressable
                  onPress={() => setPickerVisible(true)}
                  style={[styles.speciesPicker, { backgroundColor: theme.surface, borderColor: theme.outline }]}
                  accessibilityRole="button"
                  accessibilityLabel={species ? `Specie selezionata: ${species.nomeComune}` : 'Scegli specie dal catalogo'}
                >
                  {species ? (
                    <View>
                      <Text style={[styles.speciesName, { color: theme.onSurface }]}>{species.nomeComune}</Text>
                      {species.nomeScientifico && (
                        <Text style={[styles.speciesSci, { color: theme.onSurfaceVariant }]}>
                          {species.nomeScientifico}
                        </Text>
                      )}
                    </View>
                  ) : (
                    <Text style={[styles.speciesPlaceholder, { color: theme.onSurfaceVariant }]}>
                      Scegli dal catalogo (opzionale)
                    </Text>
                  )}
                  <Svg width={7} height={12} viewBox="0 0 7 12" fill="none">
                    <Path d="M1 1L6 6L1 11" stroke={theme.onSurfaceVariant} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
                  </Svg>
                </Pressable>
              </>
            )}

            <Text style={[styles.fieldLabel, { color: theme.onSurfaceVariant }]}>POSIZIONE</Text>
            <TextInput
              value={posizione}
              onChangeText={setPosizione}
              placeholder="Soggiorno (opzionale)"
              style={{ marginBottom: spacing.md16 }}
            />

            {addType === 'bouquet' && (
              <>
                <Pressable
                  onPress={() => setGiaInAcqua((v) => !v)}
                  style={[styles.checkboxRow, { backgroundColor: theme.surface, borderColor: theme.outline }]}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: giaInAcqua }}
                  accessibilityLabel="Il bouquet è già in acqua"
                >
                  <View
                    style={[
                      styles.checkbox,
                      {
                        borderColor: giaInAcqua ? theme.primary : theme.outline,
                        backgroundColor: giaInAcqua ? theme.primary : 'transparent',
                      },
                    ]}
                  >
                    {giaInAcqua && (
                      <Svg width={11} height={8} viewBox="0 0 11 8" fill="none">
                        <Path d="M1 4L4 7L10 1" stroke={theme.onPrimary} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
                      </Svg>
                    )}
                  </View>
                  <Text style={[styles.checkboxLabel, { color: theme.onSurface }]}>Il bouquet è già in acqua</Text>
                </Pressable>
                <Text style={[styles.hint, { color: theme.onSurfaceVariant }]}>
                  Data di ricezione: oggi. Ti ricorderemo di cambiare l'acqua e tagliare gli steli.
                  {!giaInAcqua ? ' Ti chiederemo subito di metterlo in acqua.' : ''}
                </Text>
              </>
            )}

            <View style={{ marginTop: spacing.xs8 }}>
              <Button
                label={addType === 'pianta' ? 'Salva pianta' : 'Salva bouquet'}
                onPress={handleSave}
                loading={saving}
              />
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      )}
      </StepTransition>

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
  typeSelect: { padding: spacing.md16 },
  question: { ...typography.bodyLarge, marginBottom: spacing.lg24 - 4 },
  typeCard: { overflow: 'hidden' },
  typeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm12 + 2, padding: spacing.md16, minHeight: 44 },
  typeIcon: { width: 40, height: 40, borderRadius: radius.md - 1, alignItems: 'center', justifyContent: 'center' },
  typeTitle: { ...typography.bodyLarge, fontWeight: '600', marginBottom: 2 },
  typeSub: { ...typography.bodySmall },
  form: { padding: spacing.md16, paddingTop: spacing.xs8 },
  fieldLabel: { ...typography.labelMedium, letterSpacing: 0.5, marginBottom: 6, paddingHorizontal: spacing.xs4 },
  speciesPicker: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: radius.lg,
    borderWidth: 1,
    paddingHorizontal: spacing.md16,
    paddingVertical: spacing.sm12 + 1,
    marginBottom: spacing.md16,
    minHeight: 44,
  },
  speciesName: { ...typography.bodyLarge },
  speciesSci: { ...typography.bodySmall, fontStyle: 'italic' },
  speciesPlaceholder: { ...typography.bodyLarge },
  hint: { ...typography.bodySmall, lineHeight: 19, marginBottom: spacing.xs8, paddingHorizontal: spacing.xs4 },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm12,
    borderRadius: radius.lg,
    borderWidth: 1,
    paddingHorizontal: spacing.md16,
    paddingVertical: spacing.sm12 + 1,
    marginBottom: spacing.sm12,
    minHeight: 44,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxLabel: { ...typography.bodyMedium, flex: 1 },
});
