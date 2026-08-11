import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../theme/useTheme';
import { radius } from '../theme/radius';

export type SensorStatus = 'ok' | 'warn' | 'crit';

interface SensorTileProps {
  value: string;
  label: string;
  status: SensorStatus;
}

/**
 * Stato sensore = colore + etichetta testuale sempre insieme (mai solo colore),
 * per contrasto AA e lettori di schermo (VoiceOver/TalkBack).
 */
export function SensorTile({ value, label, status }: SensorTileProps) {
  const theme = useTheme();
  const { bg, fg } = {
    ok: { bg: theme.primaryContainer, fg: theme.onPrimaryContainer },
    warn: { bg: theme.warningContainer, fg: theme.onWarningContainer },
    crit: { bg: theme.errorContainer, fg: theme.onErrorContainer },
  }[status];

  return (
    <View style={[styles.base, { backgroundColor: bg }]} accessible accessibilityLabel={`${label}: ${value}`}>
      <Text style={[styles.value, { color: fg }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
        {value}
      </Text>
      <Text style={[styles.label, { color: fg }]} numberOfLines={2}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.lg,
    minHeight: 96,
    paddingHorizontal: 10,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  value: {
    fontSize: 20,
    fontWeight: '700',
  },
  label: {
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 15,
  },
});
