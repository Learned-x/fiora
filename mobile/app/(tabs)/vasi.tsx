import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../src/theme/useTheme';

export default function VasiScreen() {
  const theme = useTheme();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]} edges={['top']}>
      <View style={styles.content}>
        <Text style={[styles.title, { color: theme.t1 }]}>Vasi Smart</Text>
        <View style={styles.placeholder}>
          <Text style={{ fontSize: 44, marginBottom: 16 }}>🪴</Text>
          <Text style={[styles.placeholderTitle, { color: theme.t1 }]}>In arrivo</Text>
          <Text style={[styles.placeholderSub, { color: theme.t2 }]}>
            Collega il tuo vaso smart per monitorare umidità, luce e temperatura in tempo reale.
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1, padding: 16 },
  title: { fontSize: 30, fontWeight: '700', letterSpacing: -0.6 },
  placeholder: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 80 },
  placeholderTitle: { fontSize: 18, fontWeight: '600', marginBottom: 6 },
  placeholderSub: { fontSize: 14, textAlign: 'center', paddingHorizontal: 40, lineHeight: 20 },
});
