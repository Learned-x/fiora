import { ReactNode } from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { elevation } from '../theme/elevation';
import { radius } from '../theme/radius';
import { spacing } from '../theme/spacing';
import { useTheme } from '../theme/useTheme';

interface CardProps {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  padded?: boolean;
  elevated?: boolean;
}

export function Card({ children, style, padded = true, elevated = true }: CardProps) {
  const theme = useTheme();

  return (
    <View style={[styles.shadowWrap, elevated && elevation.sm(theme.t1), style]}>
      <View style={[styles.base, { backgroundColor: theme.card }, padded && styles.padded]}>
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shadowWrap: {
    borderRadius: radius.lg,
  },
  base: {
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  padded: {
    padding: spacing.lg,
  },
});
