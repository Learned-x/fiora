export interface ThemeColors {
  bg: string;
  surface: string;
  surfaceHigh: string;
  onSurface: string;
  onSurfaceVariant: string;
  outline: string;
  outlineVariant: string;

  primary: string;
  onPrimary: string;
  primaryContainer: string;
  onPrimaryContainer: string;

  secondary: string;
  onSecondary: string;
  secondaryContainer: string;
  onSecondaryContainer: string;

  tertiary: string;
  onTertiary: string;
  tertiaryContainer: string;
  onTertiaryContainer: string;

  error: string;
  onError: string;
  errorContainer: string;
  onErrorContainer: string;

  warning: string;
  onWarning: string;
  warningContainer: string;
  onWarningContainer: string;

  shadow0: string;
  shadow1: string;
  shadow2: string;
  shadow3: string;
  shadow4: string;
  shadow5: string;
}

export const light: ThemeColors = {
  bg: '#f5f5f5',
  surface: '#ffffff',
  surfaceHigh: '#ecedec',
  onSurface: '#0c0c0c',
  onSurfaceVariant: '#5b635c',
  outline: '#798179',
  outlineVariant: '#ebedeb',

  primary: '#007a01',
  onPrimary: '#ffffff',
  primaryContainer: '#d7f7d9',
  onPrimaryContainer: '#001300',

  secondary: '#58664d',
  onSecondary: '#ffffff',
  secondaryContainer: '#eaefe7',
  onSecondaryContainer: '#0a0e07',

  tertiary: '#005bc2',
  onTertiary: '#ffffff',
  tertiaryContainer: '#d9efff',
  onTertiaryContainer: '#000a27',

  error: '#b4110e',
  onError: '#ffffff',
  errorContainer: '#ffe0d9',
  onErrorContainer: '#220000',

  warning: '#9c4300',
  onWarning: '#ffffff',
  warningContainer: '#ffe7cf',
  onWarningContainer: '#1c0500',

  shadow0: 'none',
  shadow1: '0 1px 2px rgba(0,0,0,0.06)',
  shadow2: '0 2px 6px rgba(0,0,0,0.07)',
  shadow3: '0 4px 10px rgba(0,0,0,0.08)',
  shadow4: '0 6px 14px rgba(0,0,0,0.10)',
  shadow5: '0 10px 24px rgba(0,0,0,0.12)',
};

export const dark: ThemeColors = {
  bg: '#000000',
  surface: '#272827',
  surfaceHigh: '#343634',
  onSurface: '#f5f5f5',
  onSurfaceVariant: '#979f98',
  outline: '#5b635c',
  outlineVariant: '#404640',

  primary: '#a7e9af',
  onPrimary: '#003500',
  primaryContainer: '#005700',
  onPrimaryContainer: '#d7f7d9',

  secondary: '#d0d9ca',
  onSecondary: '#232a1d',
  secondaryContainer: '#3d4835',
  onSecondaryContainer: '#eaefe7',

  tertiary: '#add8ff',
  onTertiary: '#00245a',
  tertiaryContainer: '#003f8d',
  onTertiaryContainer: '#d9efff',

  error: '#ffbbae',
  onError: '#520000',
  errorContainer: '#830605',
  onErrorContainer: '#ffe0d9',

  warning: '#ffca99',
  onWarning: '#461800',
  warningContainer: '#702e00',
  onWarningContainer: '#ffe7cf',

  shadow0: 'none',
  shadow1: 'none',
  shadow2: '0 1px 3px rgba(0,0,0,0.5)',
  shadow3: '0 2px 8px rgba(0,0,0,0.55)',
  shadow4: '0 4px 12px rgba(0,0,0,0.6)',
  shadow5: '0 8px 20px rgba(0,0,0,0.65)',
};

/** Rampe tonali complete (13 toni), per casi che richiedono un tono intermedio non coperto dai ruoli semantici. */
export const tonalRamps = {
  primary: { 0: '#000000', 10: '#001300', 20: '#003500', 30: '#005700', 40: '#007a01', 50: '#009c28', 60: '#37ba55', 70: '#73d482', 80: '#a7e9af', 90: '#d7f7d9', 95: '#eafaeb', 98: '#f5fcf6', 99: '#f9fdf9', 100: '#ffffff' },
  secondary: { 0: '#000000', 10: '#0a0e07', 20: '#232a1d', 30: '#3d4835', 40: '#58664d', 50: '#758569', 60: '#94a389', 70: '#b3bfaa', 80: '#d0d9ca', 90: '#eaefe7', 95: '#f4f6f2', 98: '#f9faf9', 99: '#fbfcfb', 100: '#ffffff' },
  tertiary: { 0: '#000000', 10: '#000a27', 20: '#00245a', 30: '#003f8d', 40: '#005bc2', 50: '#247bed', 60: '#529cff', 70: '#7fbcff', 80: '#add8ff', 90: '#d9efff', 95: '#ebf6ff', 98: '#f5fbff', 99: '#f9fcff', 100: '#ffffff' },
  error: { 0: '#000000', 10: '#220000', 20: '#520000', 30: '#830605', 40: '#b4110e', 50: '#df382d', 60: '#fa6656', 70: '#ff9281', 80: '#ffbbae', 90: '#ffe0d9', 95: '#ffefeb', 98: '#fff7f5', 99: '#fffaf9', 100: '#ffffff' },
  warning: { 0: '#000000', 10: '#1c0500', 20: '#461800', 30: '#702e00', 40: '#9c4300', 50: '#c36100', 60: '#de8418', 70: '#f4a860', 80: '#ffca99', 90: '#ffe7cf', 95: '#fff2e6', 98: '#fff9f3', 99: '#fefbf8', 100: '#ffffff' },
  neutral: { 0: '#000000', 10: '#0c0c0c', 20: '#272827', 30: '#424442', 40: '#5e615f', 50: '#7c807d', 60: '#9b9e9b', 70: '#b9bbb9', 80: '#d4d6d5', 90: '#ecedec', 95: '#f5f5f5', 98: '#fafafa', 99: '#fcfcfc', 100: '#ffffff' },
} as const;
