import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import Svg, { Circle, Path } from 'react-native-svg';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useTheme, useIsDark } from '../theme/useTheme';
import type { ThemeColors } from '../theme/colors';
import { getElevation } from '../theme/elevation';

interface TabIconProps {
  color: string;
}

function OggiIcon({ color }: TabIconProps) {
  return (
    <Svg width={25} height={25} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={9} stroke={color} strokeWidth={1.8} />
      <Path d="M8 12.5L10.8 15L16 9.5" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function PianteIcon({ color }: TabIconProps) {
  return (
    <Svg width={25} height={25} viewBox="0 0 24 24" fill="none">
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
    <Svg width={25} height={25} viewBox="0 0 24 24" fill="none">
      <Path d="M4 8H20L18.5 12H5.5L4 8Z" stroke={color} strokeWidth={1.8} strokeLinejoin="round" />
      <Path d="M6.5 12L8 20H16L17.5 12" stroke={color} strokeWidth={1.8} strokeLinejoin="round" />
      <Path d="M12 8V4" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
    </Svg>
  );
}

function ImpostazioniIcon({ color }: TabIconProps) {
  return (
    <Svg width={25} height={25} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={8} r={3.8} stroke={color} strokeWidth={1.8} />
      <Path
        d="M4.5 20C5.4 16.2 8.3 14 12 14C15.7 14 18.6 16.2 19.5 20"
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
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
    <Pressable
      onPress={() => router.push('/add-plant')}
      style={styles.tab}
      accessibilityRole="button"
      accessibilityLabel="Aggiungi"
      hitSlop={4}
    >
      <View style={[styles.addCircle, { backgroundColor: theme.primary, shadowColor: theme.primary }]}>
        <Svg width={22} height={22} viewBox="0 0 22 22" fill="none">
          <Path d="M11 4v14M4 11h14" stroke={theme.onPrimary} strokeWidth={2.2} strokeLinecap="round" />
        </Svg>
      </View>
    </Pressable>
  );
}

export function TabBar({ state, navigation }: BottomTabBarProps) {
  const theme = useTheme();
  const dark = useIsDark();
  const insets = useSafeAreaInsets();

  const renderTab = (routeName: string) => {
    const route = state.routes.find((r) => r.name === routeName);
    if (!route) return null;
    const meta = TAB_META[routeName];
    const isFocused = state.routes[state.index].name === routeName;
    const iconColor = isFocused ? theme.onPrimary : theme.onSurfaceVariant;

    return (
      <Pressable
        key={routeName}
        onPress={() => navigation.navigate(routeName)}
        style={styles.tab}
        accessibilityRole="button"
        accessibilityLabel={meta.label}
        accessibilityState={{ selected: isFocused }}
        hitSlop={4}
      >
        <View style={[styles.iconWrap, isFocused && { backgroundColor: theme.primary }]}>
          <meta.Icon color={iconColor} />
        </View>
      </Pressable>
    );
  };

  return (
    <View style={[styles.wrap, { backgroundColor: theme.bg, paddingBottom: Math.max(insets.bottom, 16) }]}>
      <View style={[styles.bar, { backgroundColor: theme.surface }, getElevation(2, dark)]}>
        {renderTab('index')}
        {renderTab('plants')}
        <AddButton theme={theme} />
        {renderTab('vasi')}
        {renderTab('settings')}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: 14,
    paddingTop: 4,
  },
  bar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 8,
  },
  tab: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
    minWidth: 44,
    minHeight: 44,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOpacity: 0.35,
    shadowRadius: 7,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },
});
