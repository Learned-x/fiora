import { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text } from 'react-native';
import { useTheme } from '../theme/useTheme';
import { radius } from '../theme/radius';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';

export interface ToastTrigger {
  text: string;
  /** Valore che cambia ad ogni chiamata (es. Date.now()) — fa ripartire l'animazione anche a parità di testo. */
  id: number;
}

interface ToastProps {
  trigger: ToastTrigger | null;
}

/** Conferma visiva transitoria dopo un'azione rapida (es. "Annaffiatura registrata"). */
export function Toast({ trigger }: ToastProps) {
  const theme = useTheme();
  const opacity = useRef(new Animated.Value(0)).current;
  const [shownText, setShownText] = useState<string | null>(null);

  useEffect(() => {
    if (!trigger) return;
    setShownText(trigger.text);
    opacity.setValue(0);
    Animated.sequence([
      Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.delay(1400),
      Animated.timing(opacity, { toValue: 0, duration: 300, useNativeDriver: true }),
    ]).start(() => setShownText(null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trigger?.id]);

  if (!shownText) return null;

  return (
    <Animated.View
      style={[styles.base, { backgroundColor: theme.primaryContainer, opacity }]}
      accessible
      accessibilityLiveRegion="polite"
      pointerEvents="none"
    >
      <Text style={[styles.text, { color: theme.onPrimaryContainer }]}>{shownText}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  base: {
    position: 'absolute',
    left: spacing.md16,
    right: spacing.md16,
    bottom: spacing.xl32,
    borderRadius: radius.lg,
    paddingVertical: spacing.sm12,
    paddingHorizontal: spacing.md16,
    alignItems: 'center',
  },
  text: { ...typography.labelLarge, fontWeight: '600' },
});
