import { StyleProp, StyleSheet, Text, TextStyle } from 'react-native';
import { typography } from '../theme/typography';
import { useTheme } from '../theme/useTheme';

interface SectionLabelProps {
  children: string;
  color?: string;
  style?: StyleProp<TextStyle>;
}

export function SectionLabel({ children, color, style }: SectionLabelProps) {
  const theme = useTheme();

  return (
    <Text style={[styles.base, { color: color ?? theme.t2 }, style]}>
      {children.toUpperCase()}
    </Text>
  );
}

const styles = StyleSheet.create({
  base: {
    fontSize: typography.label.fontSize,
    fontWeight: typography.label.fontWeight,
    letterSpacing: typography.label.letterSpacing,
  },
});
