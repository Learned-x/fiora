import type { TextStyle } from 'react-native';

/**
 * Scala tipografica MD3 (15 livelli). Pesi di Display/Headline/Title portati a 600-700
 * (invece del 400 standard MD3): su iOS la gerarchia si legge dal peso, non solo dalla
 * dimensione, per stare accanto ai large title nativi senza sembrare "sottile".
 * Nessun fontFamily esplicito: eredita il font di sistema RN (SF Pro su iOS, Roboto su Android).
 */
function tier(fontSize: number, lineHeight: number, fontWeight: TextStyle['fontWeight']) {
  return { fontSize, lineHeight, fontWeight } as const;
}

export const typography = {
  displayLarge: tier(57, 64, '700'),
  displayMedium: tier(45, 52, '700'),
  displaySmall: tier(36, 44, '700'),
  headlineLarge: tier(32, 40, '700'),
  headlineMedium: tier(28, 36, '700'),
  headlineSmall: tier(24, 32, '600'),
  titleLarge: tier(22, 28, '600'),
  titleMedium: tier(16, 24, '600'),
  titleSmall: tier(14, 20, '600'),
  bodyLarge: tier(16, 24, '400'),
  bodyMedium: tier(14, 20, '400'),
  bodySmall: tier(12, 16, '400'),
  labelLarge: tier(14, 20, '500'),
  labelMedium: tier(12, 16, '500'),
  labelSmall: tier(11, 16, '500'),
} as const;
