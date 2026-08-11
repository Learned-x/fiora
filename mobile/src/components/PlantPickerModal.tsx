import { useEffect, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../theme/useTheme';
import { radius } from '../theme/radius';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';
import { listPlants } from '../services/plants.api';
import type { Plant } from '../types/models';

interface PlantPickerModalProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (plant: Plant) => void;
}

export function PlantPickerModal({ visible, onClose, onSelect }: PlantPickerModalProps) {
  const theme = useTheme();
  const [plants, setPlants] = useState<Plant[]>([]);

  useEffect(() => {
    if (!visible) return;
    listPlants('attivo')
      .then((all) => setPlants(all.filter((p) => !p.vasoId)))
      .catch(() => setPlants([]));
  }, [visible]);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]} edges={['top']}>
        <View style={styles.nav}>
          <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Chiudi" hitSlop={4}>
            <Text style={{ fontSize: typography.bodyLarge.fontSize, color: theme.primary }}>Chiudi</Text>
          </Pressable>
          <Text style={[styles.navTitle, { color: theme.onSurface }]}>Collega a pianta</Text>
          <View style={{ width: 50 }} />
        </View>
        <FlatList
          data={plants}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: spacing.md16, paddingBottom: spacing.lg24 }}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => onSelect(item)}
              accessibilityRole="button"
              accessibilityLabel={item.nome}
              style={[styles.plantRow, { backgroundColor: theme.surface, borderColor: theme.outlineVariant }]}
            >
              <Text style={{ fontSize: typography.bodyMedium.fontSize, color: theme.onSurface }}>{item.nome}</Text>
              {item.species?.nomeComune && (
                <Text style={{ fontSize: typography.bodySmall.fontSize, color: theme.onSurfaceVariant, fontStyle: 'italic' }}>{item.species.nomeComune}</Text>
              )}
            </Pressable>
          )}
          ListEmptyComponent={
            <Text style={{ textAlign: 'center', color: theme.onSurfaceVariant, paddingTop: spacing.xl40 }}>
              Nessuna pianta disponibile (tutte già collegate a un vaso).
            </Text>
          }
        />
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  nav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md16,
    paddingTop: spacing.sm12 + 2,
    paddingBottom: spacing.xs8,
    minHeight: 44,
  },
  navTitle: { fontSize: typography.bodyLarge.fontSize, fontWeight: '600' },
  plantRow: {
    padding: spacing.sm12 + 1,
    paddingHorizontal: spacing.md16,
    borderRadius: radius.md,
    borderWidth: 1,
    marginBottom: spacing.xs8,
    minHeight: 44,
    justifyContent: 'center',
  },
});
