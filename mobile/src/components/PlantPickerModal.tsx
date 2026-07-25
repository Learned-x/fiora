import { useEffect, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../theme/useTheme';
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
          <Pressable onPress={onClose}>
            <Text style={{ fontSize: 17, color: theme.acc }}>Chiudi</Text>
          </Pressable>
          <Text style={[styles.navTitle, { color: theme.t1 }]}>Collega a pianta</Text>
          <View style={{ width: 50 }} />
        </View>
        <FlatList
          data={plants}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => onSelect(item)}
              style={[styles.plantRow, { backgroundColor: theme.card, borderColor: theme.bord }]}
            >
              <Text style={{ fontSize: 15, color: theme.t1 }}>{item.nome}</Text>
              {item.species?.nomeComune && (
                <Text style={{ fontSize: 12, color: theme.t2, fontStyle: 'italic' }}>{item.species.nomeComune}</Text>
              )}
            </Pressable>
          )}
          ListEmptyComponent={
            <Text style={{ textAlign: 'center', color: theme.t2, paddingTop: 40 }}>
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
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 8,
  },
  navTitle: { fontSize: 17, fontWeight: '600' },
  plantRow: {
    padding: 13,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
  },
});
