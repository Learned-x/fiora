import { StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';
import { useTheme } from '../theme/useTheme';
import { radius } from '../theme/radius';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';

interface SensorChartProps {
  label: string;
  value: string;
  color: string;
  values: number[];
  fromLabel: string;
  toLabel: string;
}

const WIDTH = 148;
const HEIGHT = 40;

/** Grafico andamento sensore: area sfumata + linea, come da design system. */
export function SensorChart({ label, value, color, values, fromLabel, toLabel }: SensorChartProps) {
  const theme = useTheme();

  if (values.length < 2) return null;

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const gradId = `sensor-chart-${label.replace(/\s+/g, '-')}`;

  const points = values.map((v, i) => {
    const x = (i / (values.length - 1)) * WIDTH;
    const y = HEIGHT - ((v - min) / range) * HEIGHT;
    return [x, y] as const;
  });

  const linePath = points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x},${y}`).join(' ');
  const areaPath = `${linePath} L${WIDTH},${HEIGHT} L0,${HEIGHT} Z`;

  return (
    <View style={[styles.card, { backgroundColor: theme.surfaceHigh }]}>
      <View style={styles.header}>
        <Text style={[styles.label, { color: theme.onSurfaceVariant }]}>{label}</Text>
        <Text style={[styles.value, { color: theme.onSurface }]}>{value}</Text>
      </View>
      <Svg width="100%" height={HEIGHT} viewBox={`0 0 ${WIDTH} ${HEIGHT}`} preserveAspectRatio="none">
        <Defs>
          <LinearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor={color} stopOpacity={0.35} />
            <Stop offset="100%" stopColor={color} stopOpacity={0} />
          </LinearGradient>
        </Defs>
        <Path d={areaPath} fill={`url(#${gradId})`} stroke="none" />
        <Path d={linePath} stroke={color} strokeWidth={2.2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
      <View style={styles.axisRow}>
        <Text style={[styles.axisLabel, { color: theme.onSurfaceVariant }]}>{fromLabel}</Text>
        <Text style={[styles.axisLabel, { color: theme.onSurfaceVariant }]}>{toLabel}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.lg, padding: spacing.sm12 + 2 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: spacing.xs8 - 2 },
  label: { ...typography.bodySmall },
  value: { ...typography.titleSmall },
  axisRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.xs4 + 1 },
  axisLabel: { fontSize: 10 },
});
