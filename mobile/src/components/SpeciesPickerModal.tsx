import { useEffect, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../theme/useTheme';
import { TextInput } from './TextInput';
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
          <Pressable onPress={onClose}>
            <Text style={{ fontSize: 17, color: theme.acc }}>Chiudi</Text>
          </Pressable>
          <Text style={[styles.navTitle, { color: theme.t1 }]}>Catalogo specie</Text>
          <View style={{ width: 50 }} />
        </View>
        <View style={{ paddingHorizontal: 16, paddingVertical: 8 }}>
          <TextInput value={search} onChangeText={setSearch} placeholder="Cerca per nome…" autoFocus />
        </View>
        <FlatList
          data={speciesList}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => onSelect(item)}
              style={[styles.speciesRow, { backgroundColor: theme.card, borderColor: theme.bord }]}
            >
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 15, color: theme.t1, marginBottom: 1 }}>{item.nomeComune}</Text>
                {item.nomeScientifico && (
                  <Text style={{ fontSize: 12, color: theme.t2, fontStyle: 'italic' }}>{item.nomeScientifico}</Text>
                )}
              </View>
              {item.categoria && (
                <View style={[styles.catBadge, { backgroundColor: theme.card2 }]}>
                  <Text style={{ fontSize: 11, color: theme.t2 }}>{item.categoria}</Text>
                </View>
              )}
            </Pressable>
          )}
          ListEmptyComponent={
            <Text style={{ textAlign: 'center', color: theme.t2, paddingTop: 40 }}>Nessuna specie trovata.</Text>
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
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 8,
  },
  navTitle: { fontSize: 17, fontWeight: '600' },
  speciesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 13,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
  },
  catBadge: { paddingVertical: 3, paddingHorizontal: 8, borderRadius: 6, marginLeft: 10 },
});
