import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { Logo } from '@/components/brand/Logo';
import { CoupleHeader } from '@/components/home/CoupleHeader';
import { CountdownCard } from '@/components/home/CountdownCard';
import { DailyMomentCard } from '@/components/home/DailyMomentCard';
import { MoodCard } from '@/components/home/MoodCard';
import { ProfileButton } from '@/components/home/ProfileButton';
import { Screen } from '@/components/ui/Screen';
import { spacing } from '@/theme';

export default function OurSpaceScreen() {
  return (
    <Screen>
      <View style={styles.top}>
        <Logo size={30} />
        <ProfileButton />
      </View>
      <Animated.View entering={FadeInDown.duration(500)}>
        <CoupleHeader />
      </Animated.View>
      <Animated.View entering={FadeInDown.delay(90).duration(500)}>
        <DailyMomentCard />
      </Animated.View>
      <Animated.View entering={FadeInDown.delay(180).duration(500)} style={styles.row}>
        <MoodCard />
        <CountdownCard />
      </Animated.View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  row: {
    flexDirection: 'row',
    gap: spacing.md,
  },
});
