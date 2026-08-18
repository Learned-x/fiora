import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../theme/useTheme';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';
import { Chip } from './Chip';

interface CuraPickerRowProps<K extends string> {
  label: string;
  options: { value: K; label: string }[];
  value: K | null;
  onChange: (value: K) => void;
  /** Mostrato sotto la riga quando il campo è obbligatorio e ancora vuoto. */
  requiredHint?: string;
}

export function CuraPickerRow<K extends string>({ label, options, value, onChange, requiredHint }: CuraPickerRowProps<K>) {
  const theme = useTheme();

  return (
    <View style={{ marginBottom: spacing.md16 }}>
      <Text style={[styles.fieldLabel, { color: theme.onSurfaceVariant }]}>{label}</Text>
      <View style={styles.row}>
        {options.map((opt) => (
          <Chip
            key={opt.value}
            label={opt.label}
            selected={value === opt.value}
            onPress={() => onChange(opt.value)}
            accessibilityLabel={`${label}: ${opt.label}`}
          />
        ))}
      </View>
      {requiredHint && !value && (
        <Text style={[styles.hint, { color: theme.error }]}>{requiredHint}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  fieldLabel: { ...typography.labelMedium, letterSpacing: 0.5, marginBottom: spacing.xs8 - 2, paddingHorizontal: spacing.xs4 },
  row: { flexDirection: 'row', gap: spacing.xs8, flexWrap: 'wrap' },
  hint: { ...typography.bodySmall, marginTop: spacing.xs8 - 2, paddingHorizontal: spacing.xs4 },
});
