import { TextStyle } from 'react-native';

interface TypeStyle extends Pick<TextStyle, 'fontSize' | 'lineHeight' | 'fontWeight'> {}

/**
 * Scala tipografica MD3 (15 livelli). Pesi di Display/Headline/Title portati da 400
 * a 600-700 rispetto allo standard MD3: su iOS la gerarchia si legge dal peso più
 * che dalla sola dimensione.
 */
export const typography = {
  displayLarge: { fontSize: 57, lineHeight: 64, fontWeight: '700' } satisfies TypeStyle,
  displayMedium: { fontSize: 45, lineHeight: 52, fontWeight: '700' } satisfies TypeStyle,
  displaySmall: { fontSize: 36, lineHeight: 44, fontWeight: '700' } satisfies TypeStyle,

  headlineLarge: { fontSize: 32, lineHeight: 40, fontWeight: '700' } satisfies TypeStyle,
  headlineMedium: { fontSize: 28, lineHeight: 36, fontWeight: '700' } satisfies TypeStyle,
  headlineSmall: { fontSize: 24, lineHeight: 32, fontWeight: '600' } satisfies TypeStyle,

  titleLarge: { fontSize: 22, lineHeight: 28, fontWeight: '600' } satisfies TypeStyle,
  titleMedium: { fontSize: 16, lineHeight: 24, fontWeight: '600' } satisfies TypeStyle,
  titleSmall: { fontSize: 14, lineHeight: 20, fontWeight: '600' } satisfies TypeStyle,

  bodyLarge: { fontSize: 16, lineHeight: 24, fontWeight: '400' } satisfies TypeStyle,
  bodyMedium: { fontSize: 14, lineHeight: 20, fontWeight: '400' } satisfies TypeStyle,
  bodySmall: { fontSize: 12, lineHeight: 16, fontWeight: '400' } satisfies TypeStyle,

  labelLarge: { fontSize: 14, lineHeight: 20, fontWeight: '500' } satisfies TypeStyle,
  labelMedium: { fontSize: 12, lineHeight: 16, fontWeight: '500' } satisfies TypeStyle,
  labelSmall: { fontSize: 11, lineHeight: 16, fontWeight: '500' } satisfies TypeStyle,
} as const;

export type TypographyVariant = keyof typeof typography;
