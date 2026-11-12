import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { colors } from '@/theme';

function Heart({ delay, color }: { delay: number; color: string }) {
  const beat = useSharedValue(0);

  useEffect(() => {
    beat.set(
      withDelay(
        delay,
        withRepeat(
          withSequence(
            withTiming(1, { duration: 380, easing: Easing.out(Easing.quad) }),
            withTiming(0, { duration: 620, easing: Easing.inOut(Easing.quad) }),
          ),
          -1,
        ),
      ),
    );
  }, [beat, delay]);

  const style = useAnimatedStyle(() => ({
    opacity: 0.45 + 0.55 * beat.get(),
    transform: [{ scale: 0.85 + 0.3 * beat.get() }],
  }));

  return (
    <Animated.View style={style}>
      <Ionicons name="heart" size={22} color={color} />
    </Animated.View>
  );
}

/** Two hearts beating in turn while the partner has not joined yet. */
export function WaitingHearts() {
  return (
    <View style={styles.row} accessibilityElementsHidden>
      <Heart delay={0} color={colors.peach} />
      <Heart delay={300} color={colors.rose} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
  },
});
