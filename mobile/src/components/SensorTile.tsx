import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../theme/useTheme';
import { radius } from '../theme/radius';
import { typography } from '../theme/typography';

export type SensorStatus = 'ok' | 'warn' | 'crit';

interface SensorTileProps {
  value: string;
  label: string;
  status: SensorStatus;
}

/** Tile sensore singola (umidità/luce/temperatura). Colore + etichetta testuale
 * sempre insieme — mai solo colore, per lettori di schermo e daltonismo. */
export function SensorTile({ value, label, status }: SensorTileProps) {
  const theme = useTheme();

  const { bg, fg } = (() => {
    switch (status) {
      case 'warn':
        return { bg: theme.warningContainer, fg: theme.onWarningContainer };
      case 'crit':
        return { bg: theme.errorContainer, fg: theme.onErrorContainer };
      case 'ok':
      default:
        return { bg: theme.primaryContainer, fg: theme.onPrimaryContainer };
    }
  })();

  return (
    <View
      style={[styles.base, { backgroundColor: bg }]}
      accessible
      accessibilityRole="text"
      accessibilityLabel={`${label}: ${value}`}
    >
      <Text style={[styles.value, { color: fg }]}>{value}</Text>
      <Text style={[styles.label, { color: fg }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.lg,
    paddingVertical: 10,
    paddingHorizontal: 8,
    alignItems: 'center',
    minHeight: 44,
    justifyContent: 'center',
  },
  value: {
    fontSize: typography.titleMedium.fontSize,
    fontWeight: typography.headlineSmall.fontWeight,
  },
  label: {
    fontSize: 10,
    marginTop: 2,
    textAlign: 'center',
  },
});
