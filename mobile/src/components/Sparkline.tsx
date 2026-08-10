import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Polyline } from 'react-native-svg';
import { useTheme } from '../theme/useTheme';
import { radius } from '../theme/radius';
import { typography } from '../theme/typography';

interface SparklineProps {
  label: string;
  values: number[];
  unit?: string;
}

const WIDTH = 300;
const HEIGHT = 60;

export function Sparkline({ label, values, unit = '' }: SparklineProps) {
  const theme = useTheme();

  if (values.length < 2) {
    return null;
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const points = values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * WIDTH;
      const y = HEIGHT - ((v - min) / range) * HEIGHT;
      return `${x},${y}`;
    })
    .join(' ');

  const lastX = WIDTH;
  const lastY = HEIGHT - ((values[values.length - 1] - min) / range) * HEIGHT;

  return (
    <View style={[styles.card, { backgroundColor: theme.surfaceHigh }]}>
      <View style={styles.header}>
        <Text style={[styles.label, { color: theme.onSurfaceVariant }]}>{label} · 24h</Text>
        <Text style={[styles.value, { color: theme.primary }]}>
          {values[values.length - 1]}
          {unit}
        </Text>
      </View>
      <Svg width="100%" height={HEIGHT} viewBox={`0 0 ${WIDTH} ${HEIGHT}`} preserveAspectRatio="none">
        <Polyline points={points} fill="none" stroke={theme.primary} strokeWidth={2.2} strokeLinejoin="round" strokeLinecap="round" />
        <Circle cx={lastX - 2} cy={lastY} r={3} fill={theme.primary} />
      </Svg>
      <View style={styles.axisRow}>
        <Text style={[styles.axisLabel, { color: theme.onSurfaceVariant }]}>ieri</Text>
        <Text style={[styles.axisLabel, { color: theme.onSurfaceVariant }]}>ora</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.lg, padding: 16 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  label: { fontSize: typography.bodyMedium.fontSize },
  value: { fontSize: typography.titleMedium.fontSize, fontWeight: typography.titleMedium.fontWeight },
  axisRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  axisLabel: { fontSize: 10 },
});
