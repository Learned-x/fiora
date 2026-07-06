import { useColorScheme } from 'react-native';
import { light, dark, ThemeColors } from './colors';

export function useTheme(): ThemeColors {
  const scheme = useColorScheme();
  return scheme === 'dark' ? dark : light;
}
