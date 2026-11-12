import { StyleSheet, TextInput, type TextInputProps } from 'react-native';

import { colors, fonts, radii, spacing } from '@/theme';

/** Rounded dark input used in forms and sheets. */
export function TextField({ style, ...props }: TextInputProps) {
  return (
    <TextInput
      placeholderTextColor={colors.textMuted}
      selectionColor={colors.peach}
      {...props}
      style={[styles.input, style]}
    />
  );
}

const styles = StyleSheet.create({
  input: {
    minHeight: 52,
    borderRadius: radii.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.surfaceSunken,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderStrong,
    color: colors.text,
    fontFamily: fonts.body,
    fontWeight: '500',
    fontSize: 15,
  },
});
