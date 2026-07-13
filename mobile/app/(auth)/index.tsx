import { useRef, useState } from 'react';
import {
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '../../src/theme/useTheme';
import { Button } from '../../src/components/Button';

const SLIDES = [
  {
    emoji: '🪴',
    title: 'Benvenuto in Fiora',
    desc: 'Tutte le tue piante e i tuoi bouquet in un unico posto, con una guida di cura per ogni specie.',
  },
  {
    emoji: '💧',
    title: 'Promemoria intelligenti',
    desc: 'Annaffiatura, concimazione e cura dei bouquet: Fiora calcola le scadenze in base al tuo clima.',
  },
  {
    emoji: '📡',
    title: 'Pronto per il vaso smart',
    desc: 'Presto potrai collegare il vaso con sensori e ricevere avvisi quando la tua pianta ha sete.',
  },
];

export default function IntroScreen() {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const scrollRef = useRef<ScrollView>(null);
  const [page, setPage] = useState(0);

  const isLast = page === SLIDES.length - 1;

  function handleScroll(e: NativeSyntheticEvent<NativeScrollEvent>) {
    setPage(Math.round(e.nativeEvent.contentOffset.x / width));
  }

  function handleNext() {
    if (isLast) {
      router.push('/(auth)/auth');
    } else {
      scrollRef.current?.scrollTo({ x: (page + 1) * width, animated: true });
    }
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}>
      <View style={styles.skipRow}>
        <Pressable onPress={() => router.push('/(auth)/auth')} hitSlop={12}>
          <Text style={[styles.skipText, { color: theme.t2 }]}>Salta</Text>
        </Pressable>
      </View>

      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleScroll}
      >
        {SLIDES.map((slide) => (
          <View key={slide.title} style={[styles.slide, { width }]}>
            <Text style={styles.emoji}>{slide.emoji}</Text>
            <Text style={[styles.title, { color: theme.t1 }]}>{slide.title}</Text>
            <Text style={[styles.desc, { color: theme.t2 }]}>{slide.desc}</Text>
          </View>
        ))}
      </ScrollView>

      <View style={styles.dots}>
        {SLIDES.map((slide, i) => (
          <View
            key={slide.title}
            style={[
              styles.dot,
              { backgroundColor: i === page ? theme.acc : theme.bord },
            ]}
          />
        ))}
      </View>

      <View style={styles.footer}>
        <Button label={isLast ? 'Inizia' : 'Avanti'} onPress={handleNext} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  skipRow: { flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: 16, paddingTop: 8 },
  skipText: { fontSize: 15, fontWeight: '500' },
  slide: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  emoji: { fontSize: 64, marginBottom: 24 },
  title: { fontSize: 28, fontWeight: '700', letterSpacing: -0.5, marginBottom: 12, textAlign: 'center' },
  desc: { fontSize: 15, lineHeight: 22, textAlign: 'center' },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 16 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  footer: { padding: 16 },
});
