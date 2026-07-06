import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useTheme } from '../theme/useTheme';

function GoogleIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 20 20">
      <Path
        fill="#4285F4"
        d="M19.6 10.23c0-.68-.06-1.36-.17-2H10v3.79h5.4a4.6 4.6 0 0 1-2 3.02v2.5h3.24c1.9-1.75 2.96-4.34 2.96-7.31Z"
      />
      <Path
        fill="#34A853"
        d="M10 20c2.7 0 4.96-.89 6.62-2.42l-3.24-2.5c-.9.6-2.05.96-3.38.96-2.6 0-4.8-1.76-5.59-4.12H1.06v2.59A10 10 0 0 0 10 20Z"
      />
      <Path
        fill="#FBBC05"
        d="M4.41 11.92a6 6 0 0 1 0-3.84V5.49H1.06a10 10 0 0 0 0 9.02l3.35-2.59Z"
      />
      <Path
        fill="#EA4335"
        d="M10 3.96c1.47 0 2.79.5 3.83 1.5l2.87-2.87C14.95.99 12.7 0 10 0 6.09 0 2.7 2.24 1.06 5.49l3.35 2.59C5.2 5.72 7.4 3.96 10 3.96Z"
      />
    </Svg>
  );
}

function AppleIcon({ color }: { color: string }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 20 20">
      <Path
        fill={color}
        d="M14.94 10.6c-.02-2 1.63-2.96 1.7-3-1-1.46-2.56-1.66-3.11-1.68-1.32-.13-2.58.78-3.25.78-.67 0-1.71-.76-2.81-.74-1.45.02-2.78.84-3.52 2.13-1.51 2.6-.38 6.46 1.08 8.57.71 1.03 1.56 2.19 2.68 2.15 1.08-.04 1.49-.7 2.79-.7 1.3 0 1.67.7 2.81.68 1.16-.02 1.9-1.05 2.6-2.09.82-1.2 1.16-2.36 1.17-2.42-.03-.01-2.24-.86-2.14-3.68Zm-2-6.77c.59-.71.99-1.7.88-2.68-.85.03-1.88.57-2.49 1.27-.55.63-1.03 1.63-.9 2.6.94.07 1.9-.48 2.51-1.19Z"
      />
    </Svg>
  );
}

interface SocialButtonProps {
  provider: 'google' | 'apple';
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
}

export function SocialButton({ provider, label, onPress, loading, disabled }: SocialButtonProps) {
  const theme = useTheme();

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={[
        styles.base,
        { backgroundColor: theme.card, shadowColor: '#000' },
        (disabled || loading) && { opacity: 0.5 },
      ]}
    >
      {loading ? (
        <ActivityIndicator color={theme.t1} />
      ) : (
        <>
          {provider === 'google' ? <GoogleIcon /> : <AppleIcon color={theme.t1} />}
          <Text style={[styles.label, { color: theme.t1 }]}>{label}</Text>
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    borderRadius: 13,
    paddingVertical: 14,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  label: {
    fontSize: 16,
    fontWeight: '500',
  },
});
