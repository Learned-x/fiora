/** Griglia a 4px. Padding card/schermata: 16 o 24. Gap liste: 8-12. */
export const spacing = {
  xs4: 4,
  xs8: 8,
  sm12: 12,
  md16: 16,
  md20: 20,
  lg24: 24,
  xl32: 32,
  xl40: 40,
  xxl48: 48,
  xxxl64: 64,
} as const;

export type SpacingToken = keyof typeof spacing;
