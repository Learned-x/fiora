import { useState, type ReactNode } from 'react';
import { LayoutAnimation, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useTheme } from '../theme/useTheme';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';

interface CollapsibleProps {
  title: string;
  children: ReactNode;
  defaultExpanded?: boolean;
}

export function Collapsible({ title, children, defaultExpanded }: CollapsibleProps) {
  const theme = useTheme();
  const [expanded, setExpanded] = useState(!!defaultExpanded);

  function toggle() {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded((e) => !e);
  }

  return (
    <View>
      <Pressable
        onPress={toggle}
        style={styles.header}
        accessibilityRole="button"
        accessibilityLabel={title}
        accessibilityHint={expanded ? 'Comprimi' : 'Espandi'}
        accessibilityState={{ expanded }}
        hitSlop={4}
      >
        <Text style={[styles.title, { color: theme.onSurface }]}>{title}</Text>
        <Svg
          width={12}
          height={12}
          viewBox="0 0 12 12"
          fill="none"
          style={{ transform: [{ rotate: expanded ? '180deg' : '0deg' }] }}
        >
          <Path d="M2 4.5L6 8.5L10 4.5" stroke={theme.onSurfaceVariant} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      </Pressable>
      {expanded && <View>{children}</View>}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm12,
    minHeight: 44,
  },
  title: { ...typography.titleSmall },
});
