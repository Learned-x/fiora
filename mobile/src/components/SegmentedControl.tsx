import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, LayoutChangeEvent, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme, useIsDark } from '../theme/useTheme';
import { radius } from '../theme/radius';
import { typography } from '../theme/typography';
import { getElevation } from '../theme/elevation';

interface SegmentedControlOption {
  key: string;
  label: string;
}

interface SegmentedControlProps {
  options: SegmentedControlOption[];
  selectedKey: string;
  onChange: (key: string) => void;
}

const DECELERATE_EASING = Easing.bezier(0.32, 0.72, 0, 1);

export function SegmentedControl({ options, selectedKey, onChange }: SegmentedControlProps) {
  const theme = useTheme();
  const dark = useIsDark();
  const selectedIndex = Math.max(0, options.findIndex((o) => o.key === selectedKey));
  const [trackWidth, setTrackWidth] = useState(0);
  const translateAnim = useRef(new Animated.Value(selectedIndex)).current;

  useEffect(() => {
    Animated.timing(translateAnim, {
      toValue: selectedIndex,
      duration: 320,
      easing: DECELERATE_EASING,
      useNativeDriver: true,
    }).start();
  }, [selectedIndex, translateAnim]);

  const segmentWidth = trackWidth > 0 ? (trackWidth - 6) / options.length : 0;

  const onTrackLayout = (e: LayoutChangeEvent) => setTrackWidth(e.nativeEvent.layout.width);

  return (
    <View style={[styles.track, { backgroundColor: theme.surfaceHigh }]} onLayout={onTrackLayout}>
      {trackWidth > 0 && (
        <Animated.View
          style={[
            styles.indicator,
            {
              width: segmentWidth,
              backgroundColor: theme.surface,
              ...getElevation(1, dark),
              transform: [
                {
                  translateX: translateAnim.interpolate({
                    inputRange: options.map((_, i) => i),
                    outputRange: options.map((_, i) => i * segmentWidth),
                  }),
                },
              ],
            },
          ]}
        />
      )}
      {options.map((option) => {
        const selected = option.key === selectedKey;
        return (
          <Pressable
            key={option.key}
            onPress={() => onChange(option.key)}
            accessibilityRole="button"
            accessibilityLabel={option.label}
            accessibilityState={{ selected }}
            style={styles.option}
          >
            <Text style={[styles.label, { color: selected ? theme.onSurface : theme.onSurfaceVariant }]}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    borderRadius: radius.md,
    padding: 3,
    position: 'relative',
    minHeight: 44,
  },
  indicator: {
    position: 'absolute',
    top: 3,
    bottom: 3,
    left: 3,
    borderRadius: radius.sm,
  },
  option: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 7,
    zIndex: 1,
  },
  label: {
    fontSize: typography.labelSmall.fontSize,
    fontWeight: typography.labelSmall.fontWeight,
  },
});
