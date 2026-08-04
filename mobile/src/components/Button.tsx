import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';
import { radius } from '../theme/radius';
import { typography } from '../theme/typography';
import { useTheme } from '../theme/useTheme';

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'outline';
  disabled?: boolean;
  loading?: boolean;
}

export function Button({ label, onPress, variant = 'primary', disabled, loading }: ButtonProps) {
  const theme = useTheme();
  const isOutline = variant === 'outline';
  const isDisabled = disabled || loading;

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={[
        styles.base,
        isOutline
          ? { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: theme.acc }
          : { backgroundColor: theme.acc },
        isDisabled && { opacity: 0.5 },
      ]}
    >
      {loading ? (
        <ActivityIndicator color={isOutline ? theme.acc : '#FFFFFF'} />
      ) : (
        <Text style={[styles.label, { color: isOutline ? theme.acc : '#FFFFFF' }]}>{label}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.md,
    paddingVertical: 15,
    minHeight: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: typography.bodyMedium.fontSize,
    fontWeight: typography.bodyMedium.fontWeight,
  },
});
