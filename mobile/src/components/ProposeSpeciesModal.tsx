import { useEffect, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../theme/useTheme';
import { spacing } from '../theme/spacing';
import { radius } from '../theme/radius';
import { typography } from '../theme/typography';
import { TextInput } from './TextInput';
import { Button } from './Button';
import { CuraPickerRow } from './CuraPickerRow';
import { proposeSpecies } from '../services/plants.api';
import { ANNAFFIATURA_OPZIONI, LUCE_OPZIONI, UMIDITA_OPZIONI } from '../lib/plantUi';
import type { Species } from '../types/models';

// Stesse categorie di CATEGORY_EMOJI in plantUi.ts.
const CATEGORIA_OPZIONI: { value: 'interno' | 'succulenta' | 'tropicale' | 'aromatica' | 'altro'; label: string }[] = [
  { value: 'interno', label: 'Da interno' },
  { value: 'succulenta', label: 'Succulenta' },
  { value: 'tropicale', label: 'Tropicale' },
  { value: 'aromatica', label: 'Aromatica' },
  { value: 'altro', label: 'Altro' },
];

interface ProposeSpeciesModalProps {
  visible: boolean;
  onClose: () => void;
  onCreated: (species: Species) => void;
  /** Precompila il form — usato dalla ricerca vuota (solo nome) e dalla pianta generica esistente (nome + cura già inserita). */
  initial?: {
    nomeComune?: string;
    luceCura?: 'bassa' | 'media' | 'alta' | null;
    annaffiaturaCura?: 'poca' | 'media' | 'frequente' | null;
    umiditaCura?: 'bassa' | 'media' | 'alta' | null;
  };
}

export function ProposeSpeciesModal({ visible, onClose, onCreated, initial }: ProposeSpeciesModalProps) {
  const theme = useTheme();
  const [nomeComune, setNomeComune] = useState('');
  const [nomeScientifico, setNomeScientifico] = useState('');
  const [categoria, setCategoria] = useState<typeof CATEGORIA_OPZIONI[number]['value'] | null>(null);
  const [categoriaAltro, setCategoriaAltro] = useState('');
  const [luce, setLuce] = useState<'bassa' | 'media' | 'alta' | null>(null);
  const [annaffiatura, setAnnaffiatura] = useState<'poca' | 'media' | 'frequente' | null>(null);
  const [umidita, setUmidita] = useState<'bassa' | 'media' | 'alta' | null>(null);
  const [saving, setSaving] = useState(false);
  const [suggerimento, setSuggerimento] = useState<Species | null>(null);

  useEffect(() => {
    if (!visible) return;
    setNomeComune(initial?.nomeComune ?? '');
    setNomeScientifico('');
    setCategoria(null);
    setCategoriaAltro('');
    setLuce(initial?.luceCura ?? null);
    setAnnaffiatura(initial?.annaffiaturaCura ?? null);
    setUmidita(initial?.umiditaCura ?? null);
    setSuggerimento(null);
  }, [visible, initial]);

  const completo = !!nomeComune.trim() && !!luce && !!annaffiatura && !!umidita;

  // "Altro" + testo libero: il valore digitato sostituisce 'altro', non si
  // affianca — la categoria salvata è quella scritta dall'utente.
  const categoriaEffettiva = categoria === 'altro' && categoriaAltro.trim() ? categoriaAltro.trim() : categoria;

  async function salva(forzaCrea = false) {
    if (!completo || saving) return;
    setSaving(true);
    try {
      const result = await proposeSpecies({
        nomeComune: nomeComune.trim(),
        ...(categoriaEffettiva ? { categoria: categoriaEffettiva } : {}),
        luce: luce!,
        annaffiatura: annaffiatura!,
        umidita: umidita!,
        ...(nomeScientifico.trim() ? { nomeScientifico: nomeScientifico.trim() } : {}),
        forzaCrea,
      });
      setSaving(false);
      if (result.creata) {
        onCreated(result.species);
      } else {
        // Match trovato nel catalogo curato: propone di usare quella invece
        // di creare un duplicato privato (spec §12.3, step 6).
        setSuggerimento(result.suggerimento);
      }
    } catch {
      setSaving(false);
      Alert.alert('Errore', 'Salvataggio non riuscito, riprova.');
    }
  }

  if (suggerimento) {
    return (
      <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
        <Pressable style={styles.backdrop} onPress={onClose}>
          <Pressable style={[styles.card, { backgroundColor: theme.surface }]} onPress={() => {}}>
            <Text style={[styles.title, { color: theme.onSurface }]}>Specie già nel catalogo</Text>
            <Text style={[styles.subtitle, { color: theme.onSurfaceVariant }]}>
              Esiste già "{suggerimento.nomeComune}" nel catalogo — vuoi usare quella invece di crearne una nuova?
            </Text>
            <View style={styles.actions}>
              <View style={{ flex: 1 }}>
                <Button label="Crea comunque" variant="outline" onPress={() => salva(true)} loading={saving} />
              </View>
              <View style={{ flex: 1 }}>
                <Button label="Usa questa" onPress={() => onCreated(suggerimento)} />
              </View>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    );
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]} edges={['top']}>
        <View style={styles.nav}>
          <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Chiudi" hitSlop={4}>
            <Text style={{ fontSize: typography.bodyLarge.fontSize, color: theme.primary }}>Chiudi</Text>
          </Pressable>
          <Text style={[styles.navTitle, { color: theme.onSurface }]}>Proponi specie</Text>
          <View style={{ width: 50 }} />
        </View>
        <ScrollView contentContainerStyle={{ padding: spacing.md16, paddingBottom: spacing.xl40 }} keyboardShouldPersistTaps="handled">
          <Text style={[styles.hint, { color: theme.onSurfaceVariant }]}>
            Resta visibile solo a te, utilizzabile subito per questa e le tue prossime piante.
          </Text>

          <Text style={[styles.fieldLabel, { color: theme.onSurfaceVariant }]}>NOME COMUNE</Text>
          <TextInput value={nomeComune} onChangeText={setNomeComune} placeholder="Es. Monstera del vicino" style={{ marginBottom: spacing.md16 }} />

          <Text style={[styles.fieldLabel, { color: theme.onSurfaceVariant }]}>NOME SCIENTIFICO (opzionale)</Text>
          <TextInput value={nomeScientifico} onChangeText={setNomeScientifico} placeholder="Es. Monstera deliciosa" style={{ marginBottom: spacing.md16 }} />

          <CuraPickerRow label="CATEGORIA (opzionale)" options={CATEGORIA_OPZIONI} value={categoria} onChange={setCategoria} />
          {categoria === 'altro' && (
            <TextInput
              value={categoriaAltro}
              onChangeText={setCategoriaAltro}
              placeholder="Specifica categoria (opzionale)"
              style={{ marginTop: -spacing.xs8, marginBottom: spacing.md16 }}
            />
          )}
          <CuraPickerRow label="LUCE" options={LUCE_OPZIONI} value={luce} onChange={setLuce} requiredHint="Campo obbligatorio" />
          <CuraPickerRow label="ANNAFFIATURA" options={ANNAFFIATURA_OPZIONI} value={annaffiatura} onChange={setAnnaffiatura} requiredHint="Campo obbligatorio" />
          <CuraPickerRow label="UMIDITÀ" options={UMIDITA_OPZIONI} value={umidita} onChange={setUmidita} requiredHint="Campo obbligatorio" />

          <Button label="Salva specie" onPress={() => salva(false)} disabled={!completo || saving} loading={saving} />
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  nav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md16,
    paddingTop: spacing.sm12 + 2,
    paddingBottom: spacing.xs8,
    minHeight: 44,
  },
  navTitle: { fontSize: typography.bodyLarge.fontSize, fontWeight: '600' },
  hint: { ...typography.bodySmall, marginBottom: spacing.md16 },
  fieldLabel: { ...typography.labelMedium, letterSpacing: 0.5, marginBottom: spacing.xs8 - 2, paddingHorizontal: spacing.xs4 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: spacing.lg24 },
  card: { borderRadius: radius.lg, padding: spacing.md20 },
  title: { ...typography.titleSmall },
  subtitle: { ...typography.bodySmall, marginTop: spacing.xs4, marginBottom: spacing.md16 },
  actions: { flexDirection: 'row', gap: spacing.sm12 - 2 },
});
