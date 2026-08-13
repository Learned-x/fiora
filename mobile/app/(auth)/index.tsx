import { useRef, useState } from 'react';
import {
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useTheme } from '../../src/theme/useTheme';
import { Button } from '../../src/components/Button';
import { spacing } from '../../src/theme/spacing';
import { typography } from '../../src/theme/typography';

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
        <Pressable
          onPress={() => router.push('/(auth)/auth')}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Salta introduzione"
        >
          <Text style={[styles.skipText, { color: theme.onSurfaceVariant }]}>Salta</Text>
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
            <View style={[styles.emojiCircle, { backgroundColor: theme.primaryContainer }]}>
              <Text style={styles.emoji}>{slide.emoji}</Text>
            </View>
            <Text style={[styles.title, { color: theme.onSurface }]}>{slide.title}</Text>
            <Text style={[styles.desc, { color: theme.onSurfaceVariant }]}>{slide.desc}</Text>
          </View>
        ))}
      </ScrollView>

      <View style={styles.dots}>
        {SLIDES.map((slide, i) => (
          <View
            key={slide.title}
            style={[
              styles.dot,
              { backgroundColor: i === page ? theme.primary : theme.outlineVariant },
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
  skipRow: { flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: spacing.md16, paddingTop: spacing.xs8 },
  skipText: { ...typography.bodyLarge, fontWeight: '500' },
  slide: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xl32, gap: spacing.md16 },
  emojiCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs8,
  },
  emoji: { fontSize: 42 },
  title: { ...typography.headlineMedium, textAlign: 'center' },
  desc: { ...typography.bodyLarge, textAlign: 'center' },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginBottom: spacing.md16 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  footer: { padding: spacing.md16 },
});
