import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { AppText } from '@/components/ui/AppText';
import { Avatar } from '@/components/ui/Avatar';
import { useNow } from '@/hooks/use-now';
import { useBubbleStore } from '@/state/bubble';
import { useCouple } from '@/state/couple';
import { useSession } from '@/state/session';
import { colors, spacing } from '@/theme';

const firstName = (name: string) => name.trim().split(/\s+/)[0] ?? name;

function Dots() {
  return (
    <View style={styles.dots}>
      {Array.from({ length: 5 }, (_, index) => (
        <View key={index} style={styles.dot} />
      ))}
    </View>
  );
}

function BeatingHeart() {
  const beat = useSharedValue(0);

  useEffect(() => {
    beat.set(
      withRepeat(
        withSequence(
          withTiming(1, { duration: 220, easing: Easing.out(Easing.quad) }),
          withTiming(0, { duration: 260 }),
          withTiming(0.6, { duration: 200 }),
          withTiming(0, { duration: 900 }),
        ),
        -1,
      ),
    );
  }, [beat]);

  const style = useAnimatedStyle(() => ({ transform: [{ scale: 1 + 0.18 * beat.get() }] }));

  return (
    <Animated.View style={style}>
      <Ionicons name="heart" size={26} color={colors.rose} />
    </Animated.View>
  );
}

/** Both avatars linked by a dotted line and a beating heart. */
export function CoupleHeader() {
  const { me } = useSession();
  const { partner, couple } = useCouple();
  const partnerOnline = useBubbleStore((state) => state.partnerOnline);
  const now = useNow(3_600_000);

  if (!me || !partner) return null;

  const together = couple?.togetherSince
    ? Math.floor((now - new Date(couple.togetherSince).getTime()) / 86_400_000)
    : null;
  const status = partnerOnline
    ? `${firstName(partner.displayName)} est en ligne`
    : together !== null && together > 0
      ? `Ensemble depuis ${together} jours`
      : 'Rien que vous deux';

  return (
    <View style={styles.root}>
      <View style={styles.row}>
        <Avatar name={me.displayName} uri={me.avatarUrl} size={64} ring={colors.peach} />
        <Dots />
        <BeatingHeart />
        <Dots />
        <Avatar
          name={partner.displayName}
          uri={partner.avatarUrl}
          size={64}
          ring={colors.lilac}
          online={partnerOnline}
        />
      </View>
      <View style={styles.names}>
        <AppText variant="subtitle" align="center">
          {firstName(me.displayName)} & {firstName(partner.displayName)}
        </AppText>
        <AppText variant="caption" color={partnerOnline ? colors.online : colors.textMuted} align="center">
          {status}
        </AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: spacing.md,
    alignItems: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  dots: {
    flexDirection: 'row',
    gap: 4,
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.rose,
    opacity: 0.7,
  },
  names: {
    gap: 2,
  },
});
