import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../theme/useTheme';
import { radius } from '../theme/radius';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';

export interface ActionSheetAction {
  label: string;
  onPress: () => void;
  variant?: 'default' | 'destructive' | 'cancel';
}

interface ActionSheetProps {
  visible: boolean;
  title?: string;
  message?: string;
  actions: ActionSheetAction[];
  onRequestClose: () => void;
}

export function ActionSheet({ visible, title, message, actions, onRequestClose }: ActionSheetProps) {
  const theme = useTheme();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onRequestClose}>
      <Pressable style={styles.backdrop} onPress={onRequestClose} accessibilityRole="button" accessibilityLabel="Chiudi">
        <Pressable onPress={() => {}}>
          <SafeAreaView edges={['bottom']} style={styles.sheetWrap}>
            <View style={[styles.card, { backgroundColor: theme.surface }]}>
              {(title || message) && (
                <View style={[styles.header, { borderBottomColor: theme.outlineVariant }]}>
                  {title && <Text style={[styles.title, { color: theme.onSurfaceVariant }]}>{title}</Text>}
                  {message && <Text style={[styles.message, { color: theme.onSurfaceVariant }]}>{message}</Text>}
                </View>
              )}
              {actions.map((action, i) => (
                <Pressable
                  key={i}
                  onPress={action.onPress}
                  accessibilityRole="button"
                  accessibilityLabel={action.label}
                  style={[styles.actionRow, i < actions.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.outlineVariant }]}
                >
                  <Text
                    style={[
                      styles.actionLabel,
                      { color: action.variant === 'destructive' ? theme.error : theme.primary },
                      action.variant === 'cancel' && { fontWeight: '600' },
                    ]}
                  >
                    {action.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </SafeAreaView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheetWrap: { paddingHorizontal: spacing.xs8, paddingBottom: spacing.xs8 },
  card: { borderRadius: radius.lg, overflow: 'hidden' },
  header: { paddingVertical: spacing.sm12, paddingHorizontal: spacing.md16, borderBottomWidth: StyleSheet.hairlineWidth, alignItems: 'center' },
  title: { fontSize: typography.labelLarge.fontSize, fontWeight: '600', marginBottom: 2, textAlign: 'center' },
  message: { fontSize: typography.labelLarge.fontSize, textAlign: 'center' },
  actionRow: { paddingVertical: spacing.md16, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  actionLabel: { fontSize: typography.bodyLarge.fontSize },
});
