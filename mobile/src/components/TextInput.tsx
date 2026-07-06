import { useState } from 'react';
import { StyleSheet, TextInput as RNTextInput, TextInputProps as RNTextInputProps } from 'react-native';
import { useTheme } from '../theme/useTheme';

type TextInputProps = RNTextInputProps;

export function TextInput(props: TextInputProps) {
  const theme = useTheme();
  const [focused, setFocused] = useState(false);

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
      placeholderTextColor={theme.t3}
      style={[
        styles.base,
        {
          backgroundColor: theme.card,
          color: theme.t1,
          borderColor: focused ? theme.acc : theme.bord,
        },
        props.style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: 13,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
  },
});
