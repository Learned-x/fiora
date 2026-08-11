import type { ViewStyle } from 'react-native';

/**
 * 6 livelli MD3. In chiaro: ombre morbide (coerenti con lo stile iOS già in uso).
 * In scuro: l'ombra è quasi assente (i primi due livelli sono nulli, come da spec) —
 * l'elevazione in scuro si legge dal tono della superficie (vedi theme/colors.ts),
 * non dall'ombra.
 */
const LIGHT_SHADOWS: ViewStyle[] = [
  {},
  { shadowColor: '#000000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 1 },
  { shadowColor: '#000000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 3 },
  { shadowColor: '#000000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 5 },
  { shadowColor: '#000000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.1, shadowRadius: 7 },
  { shadowColor: '#000000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.12, shadowRadius: 12 },
];

const DARK_SHADOWS: ViewStyle[] = [
  {},
  {},
  { shadowColor: '#000000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.5, shadowRadius: 1.5 },
  { shadowColor: '#000000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.55, shadowRadius: 4 },
  { shadowColor: '#000000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.6, shadowRadius: 6 },
  { shadowColor: '#000000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.65, shadowRadius: 10 },
];

const ANDROID_ELEVATION = [0, 1, 3, 6, 8, 12];

export function getElevation(level: 0 | 1 | 2 | 3 | 4 | 5, dark: boolean): ViewStyle {
  const shadow = (dark ? DARK_SHADOWS : LIGHT_SHADOWS)[level];
  return { ...shadow, elevation: ANDROID_ELEVATION[level] };
}
