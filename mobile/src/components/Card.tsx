import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme, useIsDark } from '../theme/useTheme';
import { radius } from '../theme/radius';
import { getElevation } from '../theme/elevation';

export type CardVariant = 'elevated' | 'flat' | 'outlined';

interface CardProps {
  variant?: CardVariant;
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
}

/** 3 varianti MD3 (elevata/filled/outlined) sullo stesso shape — radius.lg di default. */
export function Card({ variant = 'elevated', style, children }: CardProps) {
  const theme = useTheme();
  const dark = useIsDark();

  const variantStyle: ViewStyle = (() => {
    switch (variant) {
      case 'elevated':
        return { backgroundColor: theme.surface, ...getElevation(2, dark) };
      case 'flat':
        return { backgroundColor: theme.surfaceHigh };
      case 'outlined':
        return { backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.outlineVariant };
    }
  })();

  return <View style={[styles.base, variantStyle, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.lg,
  },
});
