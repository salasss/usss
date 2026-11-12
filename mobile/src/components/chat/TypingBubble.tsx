import { LinearGradient } from 'expo-linear-gradient';
import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { colors, gradients, radii, spacing } from '@/theme';

function Dot({ delay }: { delay: number }) {
  const lift = useSharedValue(0);

  useEffect(() => {
    lift.set(
      withDelay(
        delay,
        withRepeat(withSequence(withTiming(1, { duration: 280 }), withTiming(0, { duration: 280 }), withTiming(0, { duration: 300 })), -1),
      ),
    );
  }, [lift, delay]);

  const style = useAnimatedStyle(() => ({
    opacity: 0.5 + 0.5 * lift.get(),
    transform: [{ translateY: -3 * lift.get() }],
  }));

  return <Animated.View style={[styles.dot, style]} />;
}

/** "…" bubble while the partner is typing. */
export function TypingBubble() {
  return (
    <LinearGradient
      colors={gradients.warm}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.bubble}
      accessibilityLabel="En train d'écrire">
      <Dot delay={0} />
      <Dot delay={140} />
      <Dot delay={280} />
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  bubble: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    gap: 5,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md + 2,
    borderRadius: radii.lg,
    borderBottomLeftRadius: 6,
    marginVertical: spacing.sm,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.textOnAccent,
  },
});
