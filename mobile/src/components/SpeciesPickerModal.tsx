import { useEffect, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../theme/useTheme';
import { radius } from '../theme/radius';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';
import { TextInput } from './TextInput';
import { Button } from './Button';
import { ProposeSpeciesModal } from './ProposeSpeciesModal';
import { listSpecies } from '../services/plants.api';
import type { Species } from '../types/models';

interface SpeciesPickerModalProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (species: Species) => void;
}

export function SpeciesPickerModal({ visible, onClose, onSelect }: SpeciesPickerModalProps) {
  const theme = useTheme();
  const [search, setSearch] = useState('');
  const [speciesList, setSpeciesList] = useState<Species[]>([]);
  const [proposeVisible, setProposeVisible] = useState(false);

  useEffect(() => {
    if (!visible) return;
    const timer = setTimeout(() => {
      listSpecies(search || undefined)
        .then(setSpeciesList)
        .catch(() => setSpeciesList([]));
    }, 250);
    return () => clearTimeout(timer);
  }, [visible, search]);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]} edges={['top']}>
        <View style={styles.nav}>
          <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Chiudi" hitSlop={4}>
            <Text style={{ fontSize: typography.bodyLarge.fontSize, color: theme.primary }}>Chiudi</Text>
          </Pressable>
          <Text style={[styles.navTitle, { color: theme.onSurface }]}>Catalogo specie</Text>
          <View style={{ width: 50 }} />
        </View>
        <View style={{ paddingHorizontal: spacing.md16, paddingVertical: spacing.xs8 }}>
          <TextInput value={search} onChangeText={setSearch} placeholder="Cerca per nome…" autoFocus />
        </View>
        <View style={{ paddingHorizontal: spacing.md16, paddingBottom: spacing.sm12 }}>
          <Button label="Aggiungi specie mancante" variant="outline" onPress={() => setProposeVisible(true)} />
        </View>
        <FlatList
          data={speciesList}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: spacing.md16, paddingBottom: spacing.lg24 }}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => onSelect(item)}
              accessibilityRole="button"
              accessibilityLabel={item.nomeComune}
              style={[styles.speciesRow, { backgroundColor: theme.surface, borderColor: theme.outlineVariant }]}
            >
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: typography.bodyMedium.fontSize, color: theme.onSurface, marginBottom: 1 }}>{item.nomeComune}</Text>
                {item.nomeScientifico && (
                  <Text style={{ fontSize: typography.bodySmall.fontSize, color: theme.onSurfaceVariant, fontStyle: 'italic' }}>{item.nomeScientifico}</Text>
                )}
              </View>
              {item.categoria && (
                <View style={[styles.catBadge, { backgroundColor: theme.surfaceHigh }]}>
                  <Text style={{ fontSize: typography.labelSmall.fontSize, color: theme.onSurfaceVariant }}>{item.categoria}</Text>
                </View>
              )}
            </Pressable>
          )}
          ListEmptyComponent={
            <Text style={{ textAlign: 'center', color: theme.onSurfaceVariant, paddingTop: spacing.xl40 }}>Nessuna specie trovata.</Text>
          }
        />
      </SafeAreaView>
      <ProposeSpeciesModal
        visible={proposeVisible}
        onClose={() => setProposeVisible(false)}
        onCreated={(species) => {
          // Due <Modal> RN annidati (questo picker + il form propose) che si
          // chiudono nello stesso tick bloccano l'app: si chiude prima il modal
          // interno e si aspetta che l'animazione di unmount finisca prima di
          // richiudere anche quello esterno tramite onSelect.
          setProposeVisible(false);
          setTimeout(() => onSelect(species), 300);
        }}
        initial={{ nomeComune: search.trim() || undefined }}
      />
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
  speciesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.sm12 + 1,
    paddingHorizontal: spacing.md16,
    borderRadius: radius.md,
    borderWidth: 1,
    marginBottom: spacing.xs8,
    minHeight: 44,
  },
  catBadge: { paddingVertical: 3, paddingHorizontal: spacing.xs8, borderRadius: radius.xs + 2, marginLeft: spacing.sm12 - 2 },
});
