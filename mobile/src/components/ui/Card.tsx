import type { PropsWithChildren } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors, radii, spacing } from '@/theme';

type CardProps = PropsWithChildren<{
  tone?: 'surface' | 'raised' | 'cream';
  style?: StyleProp<ViewStyle>;
}>;

/** Rounded "bento" block used across the app. */
export function Card({ tone = 'surface', style, children }: CardProps) {
  return <View style={[styles.base, toneStyles[tone], style]}>{children}</View>;
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radii.lg,
    padding: spacing.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    overflow: 'hidden',
  },
});

const toneStyles = StyleSheet.create({
  surface: { backgroundColor: colors.surface },
  raised: { backgroundColor: colors.surfaceRaised },
  cream: { backgroundColor: colors.cream, borderColor: 'transparent' },
});
