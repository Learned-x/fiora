import { useEffect, useRef, type ReactNode } from 'react';
import { Animated, Easing, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

interface StepTransitionProps {
  /** Cambia ad ogni step: quando cambia riparte la transizione. */
  stepKey: string | number | null;
  /** avanti = entra da destra, indietro = entra da sinistra (come da design system). */
  direction: 'fwd' | 'back';
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}

/** Transizione fra step di un flow (380ms, cubic-bezier(0.32,0.72,0,1), ±18px + fade). */
export function StepTransition({ stepKey, direction, children, style }: StepTransitionProps) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    anim.setValue(0);
    Animated.timing(anim, {
      toValue: 1,
      duration: 380,
      easing: Easing.bezier(0.32, 0.72, 0, 1),
      useNativeDriver: true,
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }).start();
  }, [stepKey]);

  const translateX = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [direction === 'fwd' ? 18 : -18, 0],
  });

  return (
    <Animated.View style={[styles.base, { opacity: anim, transform: [{ translateX }] }, style]}>
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  base: { flex: 1 },
});
