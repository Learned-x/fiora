import { Platform } from 'react-native';

function shadow(color: string, opacity: number, radius: number, elevation: number) {
  return Platform.select({
    ios: {
      shadowColor: color,
      shadowOpacity: opacity,
      shadowRadius: radius,
      shadowOffset: { width: 0, height: Math.round(radius / 2) },
    },
    android: { elevation },
    default: {},
  });
}

export const elevation = {
  sm: (color: string) => shadow(color, 0.06, 6, 2),
  md: (color: string) => shadow(color, 0.1, 14, 5),
  lg: (color: string) => shadow(color, 0.14, 24, 9),
};
