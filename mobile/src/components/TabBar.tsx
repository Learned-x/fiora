import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useTheme } from '../theme/useTheme';
import type { ThemeColors } from '../theme/colors';

interface TabIconProps {
  color: string;
}

function OggiIcon({ color }: TabIconProps) {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={9} stroke={color} strokeWidth={1.8} />
      <Path d="M8 12.5L10.8 15L16 9.5" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function PianteIcon({ color }: TabIconProps) {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 21V11M12 11C12 7 9.5 4.5 5 4C5.5 8.5 8 11 12 11ZM12 13C12 9.7 14.2 7.5 19 7C18.5 11 16 13 12 13Z"
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function VasiIcon({ color }: TabIconProps) {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      <Path d="M4 8H20L18.5 12H5.5L4 8Z" stroke={color} strokeWidth={1.8} strokeLinejoin="round" />
      <Path d="M6.5 12L8 20H16L17.5 12" stroke={color} strokeWidth={1.8} strokeLinejoin="round" />
      <Path d="M12 8V4" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
    </Svg>
  );
}

function ImpostazioniIcon({ color }: TabIconProps) {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={3} stroke={color} strokeWidth={1.8} />
      <Path
        d="M12 3.5V6M12 18V20.5M20.5 12H18M6 12H3.5M18 6L16.2 7.8M7.8 16.2L6 18M18 18L16.2 16.2M7.8 7.8L6 6"
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
      />
    </Svg>
  );
}

const TAB_META: Record<string, { label: string; Icon: (props: TabIconProps) => React.JSX.Element }> = {
  index: { label: 'Oggi', Icon: OggiIcon },
  plants: { label: 'Piante', Icon: PianteIcon },
  vasi: { label: 'Vasi', Icon: VasiIcon },
  settings: { label: 'Impostazioni', Icon: ImpostazioniIcon },
};

function AddButton({ theme }: { theme: ThemeColors }) {
  return (
    <Pressable onPress={() => router.push('/add-plant')} style={styles.tab}>
      <View style={[styles.addCircle, { backgroundColor: theme.acc }]}>
        <Svg width={22} height={22} viewBox="0 0 22 22" fill="none">
          <Path d="M11 4v14M4 11h14" stroke="white" strokeWidth={2.2} strokeLinecap="round" />
        </Svg>
      </View>
      <Text style={[styles.label, { color: theme.t2 }]}>Aggiungi</Text>
    </Pressable>
  );
}

export function TabBar({ state, navigation }: BottomTabBarProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const renderTab = (routeName: string) => {
    const route = state.routes.find((r) => r.name === routeName);
    if (!route) return null;
    const meta = TAB_META[routeName];
    const isFocused = state.routes[state.index].name === routeName;
    const color = isFocused ? theme.acc : theme.t3;

    return (
      <Pressable key={routeName} onPress={() => navigation.navigate(routeName)} style={styles.tab}>
        <meta.Icon color={color} />
        <Text style={[styles.label, { color: isFocused ? theme.acc : theme.t2, fontWeight: isFocused ? '600' : '400' }]}>
          {meta.label}
        </Text>
      </Pressable>
    );
  };

  return (
    <View
      style={[
        styles.bar,
        { backgroundColor: theme.card, borderTopColor: theme.bord, paddingBottom: Math.max(insets.bottom, 4) },
      ]}
    >
      {renderTab('index')}
      {renderTab('plants')}
      <AddButton theme={theme} />
      {renderTab('vasi')}
      {renderTab('settings')}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    borderTopWidth: 1,
    paddingTop: 8,
  },
  tab: {
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 12,
    paddingVertical: 2,
    minWidth: 60,
  },
  label: {
    fontSize: 10,
  },
  addCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -20,
    shadowColor: '#34C759',
    shadowOpacity: 0.35,
    shadowRadius: 7,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },
});
