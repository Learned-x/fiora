import { router } from 'expo-router';
import { Pressable, StyleSheet, Text } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useTheme } from '../theme/useTheme';

interface BackButtonProps {
  onPress?: () => void;
  label?: string;
}

function goBack() {
  if (router.canGoBack()) {
    router.back();
  } else {
    router.replace('/');
  }
}

export function BackButton({ onPress, label = 'Indietro' }: BackButtonProps) {
  const theme = useTheme();

  return (
    <Pressable
      onPress={onPress ?? goBack}
      style={styles.btn}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
    >
      <Svg width={9} height={15} viewBox="0 0 9 15" fill="none">
        <Path
          d="M8 1L1.5 7.5L8 14"
          stroke={theme.acc}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
      <Text style={[styles.label, { color: theme.acc }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    minHeight: 44,
    paddingVertical: 8,
    paddingRight: 12,
  },
  label: {
    fontSize: 17,
    fontWeight: '400',
  },
});
