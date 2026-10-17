import React from 'react';
import { Text as NativeText, TextInput as NativeTextInput, StyleSheet } from 'react-native';
import type { TextProps, TextInputProps } from 'react-native';

const families: Record<string, string> = { '400': 'JakartaRegular', normal: 'JakartaRegular', '500': 'JakartaMedium', '600': 'JakartaSemiBold', '700': 'JakartaBold', bold: 'JakartaBold', '800': 'JakartaExtraBold', '900': 'JakartaExtraBold' };

export const Text = React.forwardRef<React.ComponentRef<typeof NativeText>, TextProps>(({ style, ...props }, ref) => {
  const flattened = StyleSheet.flatten(style);
  return <NativeText {...props} ref={ref} style={[style, { fontFamily: families[flattened?.fontWeight ?? '400'] ?? 'JakartaRegular', fontWeight: 'normal' }]} />;
});
Text.displayName = 'Text';

export const TextInput = React.forwardRef<React.ComponentRef<typeof NativeTextInput>, TextInputProps>(({ style, ...props }, ref) => <NativeTextInput {...props} ref={ref} style={[{ fontFamily: 'JakartaRegular' }, style]} />);
TextInput.displayName = 'TextInput';
