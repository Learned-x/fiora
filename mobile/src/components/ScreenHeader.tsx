import { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../theme/useTheme';
import { BackButton } from './BackButton';

interface ScreenHeaderProps {
  title?: string;
  onBack?: () => void;
  backLabel?: string;
  rightAction?: ReactNode;
}

export function ScreenHeader({ title, onBack, backLabel, rightAction }: ScreenHeaderProps) {
  const theme = useTheme();

  return (
    <View style={styles.row}>
      <View style={styles.side}>
        <BackButton onPress={onBack} label={backLabel} />
      </View>
      {title ? (
        <Text style={[styles.title, { color: theme.t1 }]} numberOfLines={1}>
          {title}
        </Text>
      ) : (
        <View style={styles.spacer} />
      )}
      <View style={[styles.side, styles.sideRight]}>{rightAction}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    minHeight: 44,
  },
  side: {
    minWidth: 80,
    justifyContent: 'center',
  },
  sideRight: {
    alignItems: 'flex-end',
  },
  spacer: {
    flex: 1,
  },
  title: {
    flex: 1,
    textAlign: 'center',
    fontSize: 17,
    fontWeight: '600',
  },
});
