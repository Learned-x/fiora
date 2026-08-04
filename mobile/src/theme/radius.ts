export const radius = {
  sm: 8,
  md: 13,
  lg: 16,
  xl: 24,
  full: 999,
} as const;

export type RadiusKey = keyof typeof radius;
