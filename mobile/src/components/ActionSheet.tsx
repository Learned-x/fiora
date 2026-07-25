import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../theme/useTheme';

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
      <Pressable style={styles.backdrop} onPress={onRequestClose}>
        <Pressable onPress={() => {}}>
          <SafeAreaView edges={['bottom']} style={styles.sheetWrap}>
            <View style={[styles.card, { backgroundColor: theme.card }]}>
              {(title || message) && (
                <View style={[styles.header, { borderBottomColor: theme.bord }]}>
                  {title && <Text style={[styles.title, { color: theme.t2 }]}>{title}</Text>}
                  {message && <Text style={[styles.message, { color: theme.t2 }]}>{message}</Text>}
                </View>
              )}
              {actions.map((action, i) => (
                <Pressable
                  key={i}
                  onPress={action.onPress}
                  style={[styles.actionRow, i < actions.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.bord }]}
                >
                  <Text
                    style={[
                      styles.actionLabel,
                      { color: action.variant === 'destructive' ? theme.red : theme.acc },
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
  sheetWrap: { paddingHorizontal: 8, paddingBottom: 8 },
  card: { borderRadius: 14, overflow: 'hidden' },
  header: { paddingVertical: 12, paddingHorizontal: 16, borderBottomWidth: StyleSheet.hairlineWidth, alignItems: 'center' },
  title: { fontSize: 13, fontWeight: '600', marginBottom: 2, textAlign: 'center' },
  message: { fontSize: 13, textAlign: 'center' },
  actionRow: { paddingVertical: 15, alignItems: 'center' },
  actionLabel: { fontSize: 17 },
});
