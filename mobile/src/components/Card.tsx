import { ReactNode } from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { useTheme, useIsDark } from '../theme/useTheme';
import { radius } from '../theme/radius';
import { getElevation } from '../theme/elevation';

export type CardVariant = 'elevated' | 'flat' | 'outline';

interface CardProps {
  children: ReactNode;
  variant?: CardVariant;
  style?: StyleProp<ViewStyle>;
}

export function Card({ children, variant = 'elevated', style }: CardProps) {
  const theme = useTheme();
  const dark = useIsDark();

  const variantStyle: ViewStyle = (() => {
    switch (variant) {
      case 'flat':
        return { backgroundColor: theme.surfaceHigh };
      case 'outline':
        return { backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.outlineVariant };
      case 'elevated':
      default:
        return { backgroundColor: theme.surface, ...getElevation(2, dark) };
    }
  })();

  return <View style={[styles.base, variantStyle, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.lg,
  },
});
