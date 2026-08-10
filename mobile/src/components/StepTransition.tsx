import { ReactNode, useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleProp, ViewStyle } from 'react-native';

interface StepTransitionProps {
  /** Cambia (es. indice step) per far ripartire l'animazione di ingresso. */
  stepKey: string | number;
  /** 'fwd' entra da destra, 'back' entra da sinistra. */
  direction?: 'fwd' | 'back';
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}

// Cambio pagina stile Apple (design system §Animazioni): slide 18px + fade,
// 380ms, curva "decelerate" di UIKit.
const DURATION = 380;
const EASING = Easing.bezier(0.32, 0.72, 0, 1);
const OFFSET = 18;

export function StepTransition({ stepKey, direction = 'fwd', children, style }: StepTransitionProps) {
  const opacity = useRef(new Animated.Value(1)).current;
  const translateX = useRef(new Animated.Value(0)).current;
  const [prevKey, setPrevKey] = useState(stepKey);

  useEffect(() => {
    if (stepKey === prevKey) return;
    setPrevKey(stepKey);
    opacity.setValue(0);
    translateX.setValue(direction === 'back' ? -OFFSET : OFFSET);
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: DURATION, easing: EASING, useNativeDriver: true }),
      Animated.timing(translateX, { toValue: 0, duration: DURATION, easing: EASING, useNativeDriver: true }),
    ]).start();
  }, [stepKey, prevKey, direction, opacity, translateX]);

  return <Animated.View style={[{ flex: 1, opacity, transform: [{ translateX }] }, style]}>{children}</Animated.View>;
}
