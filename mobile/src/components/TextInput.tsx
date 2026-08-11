import { useId, useState } from 'react';
import { StyleSheet, Text, View, TextInput as RNTextInput, TextInputProps as RNTextInputProps } from 'react-native';
import { useTheme } from '../theme/useTheme';
import { radius } from '../theme/radius';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';

interface TextInputProps extends RNTextInputProps {
  error?: boolean;
  /** Etichetta fissa sopra il campo — il placeholder da solo sparisce appena si scrive. */
  label?: string;
  /** Messaggio d'errore mostrato sotto il campo (richiede anche error=true). */
  errorMessage?: string;
}

export function TextInput({ error, label, errorMessage, ...props }: TextInputProps) {
  const theme = useTheme();
  const [focused, setFocused] = useState(false);
  const reactId = useId();
  const inputId = props.id ?? reactId;

  const borderColor = error ? theme.error : focused ? theme.primary : theme.outline;
  const borderWidth = error || focused ? 1.5 : 1;

  const input = (
    <RNTextInput
      {...props}
      nativeID={inputId}
      onFocus={(e) => {
        setFocused(true);
        props.onFocus?.(e);
      }}
      onBlur={(e) => {
        setFocused(false);
        props.onBlur?.(e);
      }}
      placeholderTextColor={theme.onSurfaceVariant}
      accessibilityLabel={props.accessibilityLabel ?? label}
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

  if (!label) return input;

  return (
    <View>
      <Text nativeID={`${inputId}-label`} style={[styles.label, { color: theme.onSurfaceVariant }]}>
        {label}
      </Text>
      {input}
      {error && errorMessage && (
        <Text style={[styles.errorText, { color: theme.error }]}>{errorMessage}</Text>
      )}
    </View>
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
  label: {
    ...typography.labelMedium,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.xs8 - 2,
    paddingHorizontal: spacing.xs4,
  },
  errorText: {
    ...typography.bodySmall,
    marginTop: spacing.xs4,
  },
});
