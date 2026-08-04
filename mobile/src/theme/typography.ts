interface TypeStyle {
  fontSize: number;
  fontWeight: '400' | '500' | '600' | '700';
  letterSpacing?: number;
}

export const typography: Record<string, TypeStyle> = {
  h1: { fontSize: 30, fontWeight: '700', letterSpacing: -0.5 },
  h2: { fontSize: 22, fontWeight: '700', letterSpacing: -0.4 },
  h3: { fontSize: 18, fontWeight: '600' },
  body: { fontSize: 16, fontWeight: '400' },
  bodyMedium: { fontSize: 16, fontWeight: '600' },
  bodySmall: { fontSize: 14, fontWeight: '400' },
  caption: { fontSize: 12, fontWeight: '500' },
  label: { fontSize: 12, fontWeight: '600', letterSpacing: 0.5 },
};
