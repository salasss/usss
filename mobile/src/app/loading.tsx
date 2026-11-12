import { ActivityIndicator, StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { Logo } from '@/components/brand/Logo';
import { colors, spacing } from '@/theme';

/** Shown right after signing in, while the couple is being loaded. */
export default function LoadingScreen() {
  return (
    <View style={styles.root}>
      <Animated.View entering={FadeIn.duration(400)} style={styles.content}>
        <Logo size={48} />
        <ActivityIndicator color={colors.peach} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    alignItems: 'center',
    gap: spacing.xl,
  },
});
