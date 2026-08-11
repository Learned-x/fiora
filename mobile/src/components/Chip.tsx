import { Pressable, StyleSheet, Text } from 'react-native';
import { useTheme } from '../theme/useTheme';
import { radius } from '../theme/radius';
import { typography } from '../theme/typography';

interface ChipProps {
  label: string;
  selected?: boolean;
  onPress: () => void;
  accessibilityLabel?: string;
}

export function Chip({ label, selected, onPress, accessibilityLabel }: ChipProps) {
  const theme = useTheme();

  return (
    <Pressable
      onPress={onPress}
      hitSlop={4}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ selected: !!selected }}
      style={({ pressed }) => [
        styles.base,
        selected
          ? { backgroundColor: theme.secondaryContainer, borderColor: 'transparent' }
          : { backgroundColor: 'transparent', borderColor: theme.outline },
        pressed && { opacity: 0.82 },
      ]}
    >
      <Text style={[styles.label, { color: selected ? theme.onSecondaryContainer : theme.onSurfaceVariant }]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.full,
    borderWidth: 1,
    flexShrink: 0,
  },
  label: {
    fontSize: typography.labelLarge.fontSize,
    fontWeight: typography.labelLarge.fontWeight,
  },
});
