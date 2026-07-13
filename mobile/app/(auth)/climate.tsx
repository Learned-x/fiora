import { useState } from 'react';
import { SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Pressable } from 'react-native';
import { useTheme } from '../../src/theme/useTheme';
import { Button } from '../../src/components/Button';
import { useAuthStore } from '../../src/store/auth.store';
import type { Clima } from '../../src/types/models';

const CLIMATES: { id: Clima; label: string; desc: string }[] = [
  { id: 'temperato', label: 'Temperato', desc: 'Nord Italia, Europa centrale' },
  { id: 'mediterraneo', label: 'Mediterraneo', desc: 'Centro-Sud Italia, Spagna' },
  { id: 'tropicale', label: 'Tropicale', desc: 'Caldo e umido tutto l’anno' },
  { id: 'freddo', label: 'Freddo', desc: 'Inverni rigidi, climi continentali' },
  { id: 'appartamento', label: 'Appartamento riscaldato', desc: 'Stagionalità ridotta' },
];

export default function ClimateScreen() {
  const theme = useTheme();
  const setPendingClima = useAuthStore((s) => s.setPendingClima);
  const [selected, setSelected] = useState<Clima | null>(null);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={[styles.progress, { color: theme.t2 }]}>1 di 3</Text>
        <Text style={[styles.title, { color: theme.t1 }]}>Dove vivi?</Text>
        <Text style={[styles.subtitle, { color: theme.t2 }]}>Adattiamo la cura al tuo clima.</Text>

        <View style={styles.list}>
          {CLIMATES.map((climate) => {
            const isSelected = selected === climate.id;
            return (
              <Pressable
                key={climate.id}
                onPress={() => setSelected(climate.id)}
                style={[
                  styles.card,
                  { backgroundColor: theme.card, borderColor: isSelected ? theme.acc : 'transparent' },
                ]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[styles.cardLabel, { color: theme.t1 }]}>{climate.label}</Text>
                  <Text style={[styles.cardDesc, { color: theme.t2 }]}>{climate.desc}</Text>
                </View>
                <View
                  style={[
                    styles.checkCircle,
                    { borderColor: isSelected ? theme.acc : theme.bord, backgroundColor: isSelected ? theme.acc : 'transparent' },
                  ]}
                />
              </Pressable>
            );
          })}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Button
          label="Continua"
          disabled={!selected}
          onPress={() => {
            if (selected) setPendingClima(selected);
            router.push('/(auth)/auth');
          }}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: 16 },
  progress: { fontSize: 13, fontWeight: '500', marginBottom: 8 },
  title: { fontSize: 28, fontWeight: '700', letterSpacing: -0.5, marginBottom: 6 },
  subtitle: { fontSize: 15, marginBottom: 24 },
  list: { gap: 10 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 13,
    borderWidth: 1.5,
    padding: 16,
  },
  cardLabel: { fontSize: 16, fontWeight: '600', marginBottom: 2 },
  cardDesc: { fontSize: 13 },
  checkCircle: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5 },
  footer: { padding: 16 },
});
