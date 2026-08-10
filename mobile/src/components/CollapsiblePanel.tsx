import { ReactNode, useRef, useState } from 'react';
import { Animated, Easing, LayoutAnimation, Platform, Pressable, StyleSheet, Text, UIManager, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useTheme } from '../theme/useTheme';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface CollapsiblePanelProps {
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
}

// Pannello espandibile con header a tocco + chevron animato — usato per contenuto
// secondario/pesante (grafici sensori) che non deve occupare spazio di default.
export function CollapsiblePanel({ title, children, defaultOpen = false }: CollapsiblePanelProps) {
  const theme = useTheme();
  const [open, setOpen] = useState(defaultOpen);
  const rotation = useRef(new Animated.Value(defaultOpen ? 1 : 0)).current;

  function toggle() {
    LayoutAnimation.configureNext(LayoutAnimation.create(220, LayoutAnimation.Types.easeInEaseOut, LayoutAnimation.Properties.opacity));
    Animated.timing(rotation, {
      toValue: open ? 0 : 1,
      duration: 220,
      easing: Easing.bezier(0.32, 0.72, 0, 1),
      useNativeDriver: true,
    }).start();
    setOpen((v) => !v);
  }

  const rotate = rotation.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '90deg'] });

  return (
    <View>
      <Pressable
        onPress={toggle}
        accessibilityRole="button"
        accessibilityLabel={title}
        accessibilityState={{ expanded: open }}
        style={styles.header}
      >
        <Text style={[styles.title, { color: theme.onSurface }]}>{title}</Text>
        <Animated.View style={{ transform: [{ rotate }] }}>
          <Svg width={9} height={15} viewBox="0 0 9 15" fill="none">
            <Path d="M1 1L7.5 7.5L1 14" stroke={theme.onSurfaceVariant} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </Animated.View>
      </Pressable>
      {open && <View style={styles.content}>{children}</View>}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 44,
    paddingVertical: spacing.sm12,
  },
  title: { fontSize: typography.titleSmall.fontSize, fontWeight: typography.titleSmall.fontWeight },
  content: { paddingTop: spacing.sm12 },
});
