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
import { typography } from '../src/theme/typography';
import { spacing } from '../src/theme/spacing';
import { radius } from '../src/theme/radius';
import { Button } from '../src/components/Button';
import { ScreenHeader } from '../src/components/ScreenHeader';
import { TextInput } from '../src/components/TextInput';
import { Card } from '../src/components/Card';
import { SpeciesPickerModal } from '../src/components/SpeciesPickerModal';
import { CuraPickerRow } from '../src/components/CuraPickerRow';
import { deletePlant, getPlant, updatePlant } from '../src/services/plants.api';
import type { Plant, SpeciesSummary, StatoBouquet } from '../src/types/models';
import { ANNAFFIATURA_OPZIONI, curaEffettiva, LUCE_OPZIONI, normalizzaUmiditaCategoria, UMIDITA_OPZIONI } from '../src/lib/plantUi';

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
  // Valore effettivo mostrato/editato: override della pianta se presente,
  // altrimenti quello della specie. Sempre visibile e modificabile, non dietro
  // un toggle — l'utente vede subito cosa userà l'app, non un dato nascosto.
  const [luceCura, setLuceCura] = useState<'bassa' | 'media' | 'alta' | null>(null);
  const [annaffiaturaCura, setAnnaffiaturaCura] = useState<'poca' | 'media' | 'frequente' | null>(null);
  const [umiditaCura, setUmiditaCura] = useState<'bassa' | 'media' | 'alta' | null>(null);
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
      setLuceCura(curaEffettiva(data.luceCura, data.species?.luce));
      setAnnaffiaturaCura(curaEffettiva(data.annaffiaturaCura, data.species?.annaffiatura));
      setUmiditaCura(curaEffettiva(data.umiditaCura, normalizzaUmiditaCategoria(data.species?.umidita)));
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

  const curaManualeRichiesta = plant?.tipo === 'pianta';
  const curaManualeCompleta = !!luceCura && !!annaffiaturaCura && !!umiditaCura;

  // Invia override solo se diverso dal default specie — se l'utente lascia il
  // valore di default (o lo riporta manualmente lì), niente override sporco
  // salvato per sempre su quella pianta.
  function campoCura<K extends string>(valore: K | null, daSpecie: K | null | undefined): K | null {
    return valore === (daSpecie ?? null) ? null : valore;
  }

  async function handleSave() {
    if (!plant) return;
    if (!nome.trim()) {
      Alert.alert('Nome mancante', 'Inserisci un nome.');
      return;
    }
    if (curaManualeRichiesta && !curaManualeCompleta) {
      Alert.alert('Dati di cura mancanti', 'Indica luce, annaffiatura e umidità.');
      return;
    }
    setSaving(true);
    try {
      await updatePlant(plant.id, {
        nome: nome.trim(),
        posizione: posizione.trim() || null,
        note: note.trim() || null,
        ...(plant.tipo === 'pianta' ? { speciesId: species?.id ?? null } : {}),
        ...(plant.tipo === 'pianta'
          ? {
              luceCura: campoCura(luceCura!, species?.luce),
              annaffiaturaCura: campoCura(annaffiaturaCura!, species?.annaffiatura),
              umiditaCura: campoCura(umiditaCura!, normalizzaUmiditaCategoria(species?.umidita)),
            }
          : {}),
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
          <ActivityIndicator color={theme.primary} />
        </View>
      </SafeAreaView>
    );
  }

  const deleteEnabled = deleteConfirm.trim().toUpperCase() === 'ELIMINA';

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]} edges={['top']}>
      <ScreenHeader left={{ label: 'Annulla', onPress: () => router.back() }} title="Modifica" />

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
          <Text style={[styles.fieldLabel, { color: theme.onSurfaceVariant }]}>NOME</Text>
          <TextInput value={nome} onChangeText={setNome} style={{ marginBottom: spacing.md16 }} />

          {plant.tipo === 'pianta' && (
            <>
              <Text style={[styles.fieldLabel, { color: theme.onSurfaceVariant }]}>SPECIE</Text>
              <Pressable
                onPress={() => setPickerVisible(true)}
                accessibilityRole="button"
                accessibilityLabel={species ? `Specie: ${species.nomeComune}` : 'Scegli specie dal catalogo'}
                style={[styles.speciesPicker, { backgroundColor: theme.surface, borderColor: theme.outline }]}
              >
                {species ? (
                  <View>
                    <Text style={{ fontSize: typography.bodyLarge.fontSize, color: theme.onSurface }}>{species.nomeComune}</Text>
                    {species.nomeScientifico && (
                      <Text style={{ fontSize: typography.bodySmall.fontSize, color: theme.onSurfaceVariant, fontStyle: 'italic' }}>
                        {species.nomeScientifico}
                      </Text>
                    )}
                  </View>
                ) : (
                  <Text style={{ fontSize: typography.bodyLarge.fontSize, color: theme.onSurfaceVariant }}>
                    Scegli dal catalogo (opzionale)
                  </Text>
                )}
                <Svg width={7} height={12} viewBox="0 0 7 12" fill="none">
                  <Path d="M1 1L6 6L1 11" stroke={theme.onSurfaceVariant} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
                </Svg>
              </Pressable>
              {species && (
                <Pressable
                  onPress={() => {
                    setSpecies(null);
                    setLuceCura(null);
                    setAnnaffiaturaCura(null);
                    setUmiditaCura(null);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel="Rimuovi specie"
                  hitSlop={4}
                  style={{ marginBottom: spacing.md16, paddingHorizontal: spacing.xs4, minHeight: 44, justifyContent: 'center' }}
                >
                  <Text style={{ fontSize: typography.bodySmall.fontSize, color: theme.error }}>Rimuovi specie</Text>
                </Pressable>
              )}

              <Text style={[styles.hint, { color: theme.onSurfaceVariant }]}>
                {species
                  ? 'Valori della specie, modificabili solo per questa pianta.'
                  : 'Senza una specie dal catalogo, indica tu di cosa ha bisogno questa pianta — servono anche a generare i promemoria di annaffiatura.'}
              </Text>

              {curaManualeRichiesta && (
                <>
                  <CuraPickerRow
                    label="LUCE"
                    options={LUCE_OPZIONI}
                    value={luceCura}
                    onChange={setLuceCura}
                    requiredHint="Campo obbligatorio"
                  />
                  <CuraPickerRow
                    label="ANNAFFIATURA"
                    options={ANNAFFIATURA_OPZIONI}
                    value={annaffiaturaCura}
                    onChange={setAnnaffiaturaCura}
                    requiredHint="Campo obbligatorio"
                  />
                  <CuraPickerRow
                    label="UMIDITÀ"
                    options={UMIDITA_OPZIONI}
                    value={umiditaCura}
                    onChange={setUmiditaCura}
                    requiredHint="Campo obbligatorio"
                  />
                </>
              )}
            </>
          )}

          {plant.tipo === 'bouquet' && (
            <>
              <Text style={[styles.fieldLabel, { color: theme.onSurfaceVariant }]}>STATO BOUQUET</Text>
              <View style={styles.stagesRow}>
                {BOUQUET_STAGES.map((stage) => {
                  const isSelected = statoBouquet === stage.key;
                  return (
                    <Pressable
                      key={stage.key}
                      onPress={() => setStatoBouquet(stage.key)}
                      accessibilityRole="button"
                      accessibilityLabel={`Stato bouquet: ${stage.label}`}
                      accessibilityState={{ selected: isSelected }}
                      style={[
                        styles.stageChip,
                        {
                          backgroundColor: isSelected ? theme.primary : theme.surface,
                          borderColor: isSelected ? theme.primary : theme.outline,
                        },
                      ]}
                    >
                      <Text style={{ fontSize: typography.labelLarge.fontSize, fontWeight: '500', color: isSelected ? theme.onPrimary : theme.onSurface }}>
                        {stage.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              <Text style={[styles.hint, { color: theme.onSurfaceVariant }]}>
                Impostando lo stato manualmente, l'aggiornamento automatico si disattiva.
              </Text>
            </>
          )}

          <Text style={[styles.fieldLabel, { color: theme.onSurfaceVariant }]}>POSIZIONE</Text>
          <TextInput
            value={posizione}
            onChangeText={setPosizione}
            placeholder="Soggiorno (opzionale)"
            style={{ marginBottom: spacing.md16 }}
          />

          <Text style={[styles.fieldLabel, { color: theme.onSurfaceVariant }]}>NOTE</Text>
          <TextInput
            value={note}
            onChangeText={setNote}
            placeholder="Note (opzionale)"
            multiline
            numberOfLines={3}
            style={{ marginBottom: spacing.lg24, minHeight: 80, textAlignVertical: 'top' }}
          />

          <Button
            label="Salva modifiche"
            onPress={handleSave}
            loading={saving}
            disabled={curaManualeRichiesta && !curaManualeCompleta}
          />

          {/* Altre azioni */}
          <Text style={[styles.fieldLabel, { color: theme.onSurfaceVariant, marginTop: spacing.lg24 + spacing.xs4 }]}>
            ALTRE AZIONI
          </Text>
          <Card variant="flat" style={styles.actionsCard}>
            <Pressable
              onPress={() => router.push({ pathname: '/plant-history', params: { id: plant.id, nome: plant.nome } })}
              accessibilityRole="button"
              accessibilityLabel="Storico cure"
              style={[styles.actionRow, { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.outlineVariant }]}
            >
              <Text style={[styles.actionText, { color: theme.onSurface }]}>Storico cure</Text>
              <Svg width={7} height={12} viewBox="0 0 7 12" fill="none">
                <Path d="M1 1L6 6L1 11" stroke={theme.onSurfaceVariant} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
            </Pressable>
            <Pressable
              onPress={handleToggleArchive}
              accessibilityRole="button"
              accessibilityLabel={plant.stato === 'attivo' ? 'Archivia pianta' : 'Ripristina pianta'}
              style={styles.actionRow}
            >
              <Text style={[styles.actionText, { color: theme.warning }]}>
                {plant.stato === 'attivo' ? 'Archivia pianta' : 'Ripristina pianta'}
              </Text>
              {archiving && <ActivityIndicator size="small" color={theme.warning} />}
            </Pressable>
          </Card>
          {plant.stato === 'attivo' && (
            <Text style={[styles.hint, { color: theme.onSurfaceVariant }]}>
              Archiviando, i task in sospeso verranno annullati e i promemoria sospesi.
            </Text>
          )}

          {/* Zona eliminazione */}
          <View style={[styles.dangerZone, { borderColor: theme.error }]}>
            {!deleteMode ? (
              <Pressable
                onPress={() => setDeleteMode(true)}
                accessibilityRole="button"
                accessibilityLabel="Elimina pianta"
                style={styles.actionRow}
              >
                <Text style={[styles.actionText, { color: theme.error }]}>Elimina pianta</Text>
              </Pressable>
            ) : (
              <View style={styles.deleteConfirmBox}>
                <Text style={[styles.deleteTitle, { color: theme.error }]}>Eliminare "{plant.nome}"?</Text>
                <Text style={[styles.deleteMessage, { color: theme.onSurfaceVariant }]}>
                  L'operazione non è reversibile e i task in sospeso verranno annullati. Digita ELIMINA per
                  confermare.
                </Text>
                <TextInput
                  value={deleteConfirm}
                  onChangeText={setDeleteConfirm}
                  placeholder="ELIMINA"
                  autoCapitalize="characters"
                  autoCorrect={false}
                  style={{ marginBottom: spacing.sm12 }}
                />
                <View style={styles.deleteButtons}>
                  <View style={{ flex: 1 }}>
                    <Button
                      label="Annulla"
                      variant="outline"
                      onPress={() => {
                        setDeleteMode(false);
                        setDeleteConfirm('');
                      }}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Pressable
                      onPress={handleDelete}
                      disabled={!deleteEnabled || deleting}
                      accessibilityRole="button"
                      accessibilityLabel="Elimina definitivamente"
                      accessibilityState={{ disabled: !deleteEnabled || deleting }}
                      style={[styles.deleteConfirmBtn, { backgroundColor: theme.error, opacity: deleteEnabled ? 1 : 0.4 }]}
                    >
                      {deleting ? (
                        <ActivityIndicator size="small" color={theme.onError} />
                      ) : (
                        <Text style={{ fontSize: typography.labelLarge.fontSize, fontWeight: '600', color: theme.onError }}>
                          Elimina definitivamente
                        </Text>
                      )}
                    </Pressable>
                  </View>
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
          setLuceCura(s.luce);
          setAnnaffiaturaCura(s.annaffiatura);
          setUmiditaCura(normalizzaUmiditaCategoria(s.umidita));
          setPickerVisible(false);
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  form: { padding: spacing.md16, paddingTop: spacing.xs8, paddingBottom: spacing.xl32 },
  fieldLabel: { ...typography.labelMedium, letterSpacing: 0.5, marginBottom: spacing.xs8 - 2, paddingHorizontal: spacing.xs4 },
  speciesPicker: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: radius.lg,
    borderWidth: 1,
    paddingHorizontal: spacing.md16,
    paddingVertical: spacing.sm12 + 2,
    marginBottom: spacing.xs8,
    minHeight: 44,
  },
  stagesRow: { flexDirection: 'row', gap: spacing.xs8, marginBottom: spacing.xs8 },
  stageChip: {
    flex: 1,
    alignItems: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    paddingVertical: spacing.xs8 + 2,
    minHeight: 44,
    justifyContent: 'center',
  },
  hint: { ...typography.bodySmall, marginBottom: spacing.md16, paddingHorizontal: spacing.xs4 },
  actionsCard: { overflow: 'hidden', marginBottom: spacing.xs8 },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm12 + 2,
    paddingHorizontal: spacing.md16,
    minHeight: 44,
  },
  actionText: { ...typography.bodyLarge },
  dangerZone: { borderRadius: radius.md, borderWidth: 1, marginTop: spacing.md16, overflow: 'hidden' },
  deleteConfirmBox: { padding: spacing.md16 },
  deleteTitle: { ...typography.titleMedium, fontWeight: '700', marginBottom: spacing.xs8 - 2 },
  deleteMessage: { ...typography.bodySmall, marginBottom: spacing.sm12 + 2 },
  deleteButtons: { flexDirection: 'row', gap: spacing.sm12 - 2 },
  deleteConfirmBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    paddingVertical: spacing.sm12,
    minHeight: 44,
  },
});
