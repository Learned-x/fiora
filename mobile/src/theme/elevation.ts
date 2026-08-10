import { Platform, ViewStyle } from 'react-native';
import { tonalRamps } from './colors';

interface ElevationSpec {
  shadowOpacity: number;
  shadowRadius: number;
  shadowOffsetY: number;
  androidElevation: number;
}

/** 6 livelli MD3. In chiaro: ombre morbide crescenti. In scuro: ombra quasi assente,
 * l'elevazione si legge dal tono di superficie (vedi darkSurfaceForLevel). */
const LIGHT_SPECS: ElevationSpec[] = [
  { shadowOpacity: 0, shadowRadius: 0, shadowOffsetY: 0, androidElevation: 0 },
  { shadowOpacity: 0.06, shadowRadius: 2, shadowOffsetY: 1, androidElevation: 1 },
  { shadowOpacity: 0.07, shadowRadius: 6, shadowOffsetY: 2, androidElevation: 3 },
  { shadowOpacity: 0.08, shadowRadius: 10, shadowOffsetY: 4, androidElevation: 6 },
  { shadowOpacity: 0.1, shadowRadius: 14, shadowOffsetY: 6, androidElevation: 8 },
  { shadowOpacity: 0.12, shadowRadius: 24, shadowOffsetY: 10, androidElevation: 12 },
];

const DARK_SPECS: ElevationSpec[] = [
  { shadowOpacity: 0, shadowRadius: 0, shadowOffsetY: 0, androidElevation: 0 },
  { shadowOpacity: 0, shadowRadius: 0, shadowOffsetY: 0, androidElevation: 0 },
  { shadowOpacity: 0.5, shadowRadius: 3, shadowOffsetY: 1, androidElevation: 3 },
  { shadowOpacity: 0.55, shadowRadius: 8, shadowOffsetY: 2, androidElevation: 6 },
  { shadowOpacity: 0.6, shadowRadius: 12, shadowOffsetY: 4, androidElevation: 8 },
  { shadowOpacity: 0.65, shadowRadius: 20, shadowOffsetY: 8, androidElevation: 12 },
];

/** Tono neutral di superficie per livello, usato in dark mode al posto dell'ombra. */
const DARK_SURFACE_TONES = [
  tonalRamps.neutral[10],
  tonalRamps.neutral[20],
  tonalRamps.neutral[30],
  tonalRamps.neutral[40],
  tonalRamps.neutral[50],
  tonalRamps.neutral[60],
];

export type ElevationLevel = 0 | 1 | 2 | 3 | 4 | 5;

export function getElevation(level: ElevationLevel, dark: boolean): ViewStyle {
  const spec = (dark ? DARK_SPECS : LIGHT_SPECS)[level];
  return Platform.select<ViewStyle>({
    ios: {
      shadowColor: '#000000',
      shadowOpacity: spec.shadowOpacity,
      shadowRadius: spec.shadowRadius,
      shadowOffset: { width: 0, height: spec.shadowOffsetY },
    },
    android: { elevation: spec.androidElevation },
    default: {},
  })!;
}

/** Colore di superficie da usare in dark mode per un dato livello (elevazione = tono più chiaro). */
export function darkSurfaceForLevel(level: ElevationLevel): string {
  return DARK_SURFACE_TONES[level];
}
