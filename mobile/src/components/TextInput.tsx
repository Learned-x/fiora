import { useState } from 'react';
import { StyleSheet, TextInput as RNTextInput, TextInputProps as RNTextInputProps } from 'react-native';
import { useTheme } from '../theme/useTheme';
import { radius } from '../theme/radius';
import { typography } from '../theme/typography';

interface TextInputProps extends RNTextInputProps {
  error?: boolean;
}

export function TextInput({ error, ...props }: TextInputProps) {
  const theme = useTheme();
  const [focused, setFocused] = useState(false);

  const borderColor = error ? theme.error : focused ? theme.primary : theme.outline;
  const borderWidth = error || focused ? 1.5 : 1;

  return (
    <RNTextInput
      {...props}
      onFocus={(e) => {
        setFocused(true);
        props.onFocus?.(e);
      }}
      onBlur={(e) => {
        setFocused(false);
        props.onBlur?.(e);
      }}
      placeholderTextColor={theme.onSurfaceVariant}
      accessibilityState={{ disabled: !!props.editable === false }}
      style={[
        styles.base,
        {
          backgroundColor: props.editable === false ? theme.surfaceHigh : theme.surface,
          color: theme.onSurface,
          borderColor,
          borderWidth,
          opacity: props.editable === false ? 0.7 : 1,
        },
        props.style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.lg,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: typography.bodyLarge.fontSize,
    minHeight: 44,
  },
});
