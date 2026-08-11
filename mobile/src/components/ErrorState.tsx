import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../theme/useTheme';
import { radius } from '../theme/radius';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';

interface ErrorStateProps {
  message: string;
  onRetry: () => void;
}

/** Errore sempre con testo esplicito + azione di recupero — mai un "Errore" nudo. */
export function ErrorState({ message, onRetry }: ErrorStateProps) {
  const theme = useTheme();

  return (
    <View
      style={[styles.base, { backgroundColor: theme.errorContainer, borderColor: theme.error }]}
      accessible
      accessibilityRole="alert"
      accessibilityLabel={message}
    >
      <Text style={[styles.text, { color: theme.onErrorContainer }]}>{message}</Text>
      <Pressable
        onPress={onRetry}
        style={({ pressed }) => [styles.btn, { backgroundColor: theme.error }, pressed && { opacity: 0.82 }]}
        accessibilityRole="button"
        accessibilityLabel="Riprova"
        hitSlop={4}
      >
        <Text style={[styles.btnText, { color: theme.onError }]}>Riprova</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.lg,
    borderWidth: 1.5,
    padding: spacing.md16,
    marginBottom: spacing.md20,
  },
  text: { ...typography.bodyMedium, marginBottom: spacing.sm12 },
  btn: {
    alignSelf: 'flex-start',
    minHeight: 44,
    paddingHorizontal: spacing.md16,
    justifyContent: 'center',
    borderRadius: radius.sm + 1,
  },
  btnText: { ...typography.labelLarge, fontWeight: '600' },
});
