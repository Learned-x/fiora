import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../theme/useTheme';
import { spacing } from '../theme/spacing';
import { radius } from '../theme/radius';
import { typography } from '../theme/typography';
import { Button } from './Button';
import { TextInput } from './TextInput';
import { updatePlant } from '../services/plants.api';
import type { Plant } from '../types/models';

interface SoglieVaseModalProps {
  visible: boolean;
  plant: Plant;
  onClose: () => void;
  onSaved: (plant: Plant) => void;
  onError: () => void;
}

// null = campo vuoto in UI = "usa il default della specie" lato dati.
type CampoSoglia = number | null;

function toInput(v: number | string | null | undefined): string {
  if (v == null) return '';
  // Il backend restituisce la temperatura come stringa decimale (Decimal → JSON);
  // in UI si vuole sempre la virgola, coerente con la tastiera italiana.
  return String(v).replace('.', ',');
}

function fromInputInt(s: string): CampoSoglia {
  const trimmed = s.trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? Math.round(n) : null;
}

// Temperatura ammette un decimale (stessa precisione delle letture, 1 cifra) e
// accetta sia virgola che punto: la tastiera italiana produce virgola, ma non
// c'è motivo di rifiutare chi digita il punto.
function fromInputFloat(s: string): CampoSoglia {
  const trimmed = s.trim().replace(',', '.');
  if (!trimmed) return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? Math.round(n * 10) / 10 : null;
}

export function SoglieVaseModal({ visible, plant, onClose, onSaved, onError }: SoglieVaseModalProps) {
  const theme = useTheme();
  const [umiditaMin, setUmiditaMin] = useState('');
  const [umiditaMax, setUmiditaMax] = useState('');
  const [luceMin, setLuceMin] = useState('');
  const [luceMax, setLuceMax] = useState('');
  const [tempMin, setTempMin] = useState('');
  const [tempMax, setTempMax] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setUmiditaMin(toInput(plant.sogliaUmiditaMin));
    setUmiditaMax(toInput(plant.sogliaUmiditaMax));
    setLuceMin(toInput(plant.sogliaLuceMin));
    setLuceMax(toInput(plant.sogliaLuceMax));
    setTempMin(toInput(plant.sogliaTempMin));
    setTempMax(toInput(plant.sogliaTempMax));
  }, [visible, plant]);

  // Min > max sul singolo campo coppia: il backend la respinge comunque, ma
  // segnalarlo subito evita un giro di rete per un errore ovvio.
  const intPairs: [string, string][] = [
    [umiditaMin, umiditaMax],
    [luceMin, luceMax],
  ];
  const hasInvalidPair =
    intPairs.some(([min, max]) => {
      const a = fromInputInt(min);
      const b = fromInputInt(max);
      return a !== null && b !== null && a > b;
    }) ||
    (() => {
      const a = fromInputFloat(tempMin);
      const b = fromInputFloat(tempMax);
      return a !== null && b !== null && a > b;
    })();

  async function confirm() {
    if (hasInvalidPair || saving) return;
    setSaving(true);
    try {
      const updated = await updatePlant(plant.id, {
        sogliaUmiditaMin: fromInputInt(umiditaMin),
        sogliaUmiditaMax: fromInputInt(umiditaMax),
        sogliaLuceMin: fromInputInt(luceMin),
        sogliaLuceMax: fromInputInt(luceMax),
        sogliaTempMin: fromInputFloat(tempMin),
        sogliaTempMax: fromInputFloat(tempMax),
      });
      setSaving(false);
      onClose();
      onSaved(updated);
    } catch {
      setSaving(false);
      onClose();
      onError();
    }
  }

  function resetToDefault() {
    setUmiditaMin('');
    setUmiditaMax('');
    setLuceMin('');
    setLuceMax('');
    setTempMin('');
    setTempMax('');
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <Pressable style={styles.backdrop} onPress={onClose}>
          <Pressable style={[styles.card, { backgroundColor: theme.surface }]} onPress={() => {}}>
            <Text style={[styles.title, { color: theme.onSurface }]}>Personalizza soglie</Text>
            <Text style={[styles.subtitle, { color: theme.onSurfaceVariant }]}>
              Campo vuoto = usa il valore predefinito della specie.
            </Text>
            <ScrollView style={{ maxHeight: 360 }} keyboardShouldPersistTaps="handled">
              <View style={styles.row}>
                <View style={styles.field}>
                  <TextInput label="Umidità min %" value={umiditaMin} onChangeText={setUmiditaMin} keyboardType="number-pad" maxLength={3} />
                </View>
                <View style={styles.field}>
                  <TextInput label="Umidità max %" value={umiditaMax} onChangeText={setUmiditaMax} keyboardType="number-pad" maxLength={3} />
                </View>
              </View>
              <View style={styles.row}>
                <View style={styles.field}>
                  <TextInput label="Luce min lux" value={luceMin} onChangeText={setLuceMin} keyboardType="number-pad" maxLength={6} />
                </View>
                <View style={styles.field}>
                  <TextInput label="Luce max lux" value={luceMax} onChangeText={setLuceMax} keyboardType="number-pad" maxLength={6} />
                </View>
              </View>
              <View style={styles.row}>
                <View style={styles.field}>
                  <TextInput label="Temp. min °C" value={tempMin} onChangeText={setTempMin} keyboardType="decimal-pad" maxLength={5} />
                </View>
                <View style={styles.field}>
                  <TextInput label="Temp. max °C" value={tempMax} onChangeText={setTempMax} keyboardType="decimal-pad" maxLength={5} />
                </View>
              </View>
              {hasInvalidPair && (
                <Text style={[styles.errorText, { color: theme.error }]}>Il minimo non può superare il massimo.</Text>
              )}
            </ScrollView>
            <Pressable onPress={resetToDefault} hitSlop={8} style={{ marginTop: spacing.sm12, marginBottom: spacing.md16 }}>
              <Text style={[styles.resetLabel, { color: theme.primary }]}>Ripristina predefiniti specie</Text>
            </Pressable>
            <View style={styles.actions}>
              <View style={{ flex: 1 }}>
                <Button label="Annulla" variant="outline" onPress={onClose} />
              </View>
              <View style={{ flex: 1 }}>
                <Button label="Salva" onPress={confirm} disabled={hasInvalidPair || saving} loading={saving} />
              </View>
            </View>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: spacing.lg24 },
  card: { borderRadius: radius.lg, padding: spacing.md20 },
  title: { ...typography.titleSmall },
  subtitle: { ...typography.bodySmall, marginTop: spacing.xs4, marginBottom: spacing.md16 },
  row: { flexDirection: 'row', gap: spacing.sm12 - 2, marginBottom: spacing.sm12 },
  field: { flex: 1 },
  errorText: { ...typography.bodySmall, marginTop: spacing.xs8 },
  resetLabel: { ...typography.labelMedium, textAlign: 'center' },
  actions: { flexDirection: 'row', gap: spacing.sm12 - 2 },
});
