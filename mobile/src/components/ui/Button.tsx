import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { AppText } from '@/components/ui/AppText';
import { colors, gradients, radii, spacing } from '@/theme';

type Variant = 'cream' | 'warm' | 'surface' | 'ghost';

type ButtonProps = {
  label: string;
  onPress?: () => void;
  variant?: Variant;
  icon?: ReactNode;
  loading?: boolean;
  disabled?: boolean;
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
};

const LABEL_COLOR: Record<Variant, string> = {
  cream: colors.textOnCream,
  warm: colors.textOnAccent,
  surface: colors.text,
  ghost: colors.cream,
};

export function Button({
  label,
  onPress,
  variant = 'cream',
  icon,
  loading = false,
  disabled = false,
  compact = false,
  style,
}: ButtonProps) {
  const scale = useSharedValue(1);
  const pressStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));
  const inactive = disabled || loading;

  const content = (
    <View style={[styles.content, compact && styles.compact]}>
      {loading ? <ActivityIndicator color={LABEL_COLOR[variant]} /> : icon}
      <AppText variant="bodyStrong" color={LABEL_COLOR[variant]}>
        {label}
      </AppText>
    </View>
  );

  return (
    <Pressable
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: inactive, busy: loading }}
      onPressIn={() => scale.set(withSpring(0.97, { damping: 20, stiffness: 300 }))}
      onPressOut={() => scale.set(withSpring(1, { damping: 14, stiffness: 220 }))}
      style={style}>
      <Animated.View style={[styles.base, variantStyles[variant], inactive && styles.inactive, pressStyle]}>
        {variant === 'warm' ? (
          <LinearGradient
            colors={gradients.warm}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
        ) : null}
        {content}
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radii.pill,
    overflow: 'hidden',
  },
  content: {
    minHeight: 56,
    paddingHorizontal: spacing.xxl,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  compact: {
    minHeight: 44,
    paddingHorizontal: spacing.lg,
  },
  inactive: {
    opacity: 0.55,
  },
});

const variantStyles = StyleSheet.create({
  cream: { backgroundColor: colors.cream },
  warm: { backgroundColor: colors.peach },
  surface: { backgroundColor: colors.surfaceRaised },
  ghost: {
    backgroundColor: 'transparent',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderStrong,
  },
});
