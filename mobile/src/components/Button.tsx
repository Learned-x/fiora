import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';
import { radius } from '../theme/radius';
import { typography } from '../theme/typography';
import { useTheme } from '../theme/useTheme';
import { radius } from '../theme/radius';
import { typography } from '../theme/typography';
import { getElevation } from '../theme/elevation';
import { useIsDark } from '../theme/useTheme';

export type ButtonVariant = 'primary' | 'tonal' | 'outline' | 'text' | 'elevated';

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  loading?: boolean;
  accessibilityLabel?: string;
}

export function Button({ label, onPress, variant = 'primary', disabled, loading, accessibilityLabel }: ButtonProps) {
  const theme = useTheme();
  const dark = useIsDark();
  const isDisabled = disabled || loading;

  const variantStyle = (pressed: boolean) => {
    switch (variant) {
      case 'primary':
        return { backgroundColor: theme.primary, borderWidth: 0 };
      case 'tonal':
        return { backgroundColor: theme.primaryContainer, borderWidth: 0 };
      case 'outline':
        return { backgroundColor: pressed ? theme.primaryContainer : 'transparent', borderWidth: 1.5, borderColor: theme.primary };
      case 'text':
        return { backgroundColor: pressed ? theme.primaryContainer : 'transparent', borderWidth: 0 };
      case 'elevated':
        return { backgroundColor: theme.surface, borderWidth: 0, ...getElevation(pressed ? 1 : 2, dark) };
      default:
        return {};
    }
  };

  const labelColor = (() => {
    switch (variant) {
      case 'primary':
        return theme.onPrimary;
      case 'tonal':
        return theme.onPrimaryContainer;
      case 'outline':
      case 'text':
      case 'elevated':
        return theme.primary;
      default:
        return theme.onPrimary;
    }
  })();

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: isDisabled }}
      hitSlop={4}
      style={({ pressed }) => [
        styles.base,
        variantStyle(pressed),
        isDisabled && { backgroundColor: theme.outlineVariant, borderWidth: 0, opacity: 0.7 },
        pressed && !isDisabled && variant !== 'outline' && variant !== 'text' && { opacity: 0.82 },
      ]}
    >
      {loading ? (
        <ActivityIndicator color={isDisabled ? theme.onSurfaceVariant : labelColor} />
      ) : (
        <Text style={[styles.label, { color: isDisabled ? theme.onSurfaceVariant : labelColor }]}>{label}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.lg,
    minHeight: 44,
    paddingVertical: 15,
    paddingHorizontal: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: typography.labelLarge.fontSize,
    fontWeight: typography.titleMedium.fontWeight,
  },
});
