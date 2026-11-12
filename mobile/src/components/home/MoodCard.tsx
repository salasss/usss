import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { Card } from '@/components/ui/Card';
import { GradientSlider } from '@/components/ui/GradientSlider';
import { useBubble, useBubbleStore } from '@/state/bubble';
import { useCouple } from '@/state/couple';
import { useSession } from '@/state/session';
import { colors, gradients, radii, spacing } from '@/theme';

function MiniBar({ value, color }: { value: number; color: string }) {
  return (
    <View style={styles.miniTrack}>
      <View style={[styles.miniFill, { width: `${value}%`, backgroundColor: color }]} />
    </View>
  );
}

/** My mood as two sliders, my partner's as two small bars. */
export function MoodCard() {
  const { me } = useSession();
  const { partner } = useCouple();
  const moods = useBubbleStore((state) => state.moods);
  const { setMood } = useBubble();

  const mine = (me && moods[me.id]) || { energy: 50, mood: 50 };
  const theirs = partner ? moods[partner.userId] : undefined;

  return (
    <Card style={styles.card}>
      <AppText variant="heading">Notre humeur</AppText>
      <GradientSlider
        label="Énergie"
        value={mine.energy}
        gradient={gradients.butter}
        onCommit={(energy) => setMood(energy, mine.mood)}
      />
      <GradientSlider
        label="Humeur"
        value={mine.mood}
        gradient={gradients.lilac}
        onCommit={(mood) => setMood(mine.energy, mood)}
      />
      {partner ? (
        <View style={styles.partner}>
          <AppText variant="tiny" color={colors.textMuted}>
            {partner.displayName.split(' ')[0]}
          </AppText>
          {theirs ? (
            <View style={styles.bars}>
              <MiniBar value={theirs.energy} color={colors.butter} />
              <MiniBar value={theirs.mood} color={colors.lilac} />
            </View>
          ) : (
            <AppText variant="tiny" color={colors.textMuted}>
              pas encore partagé
            </AppText>
          )}
        </View>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    gap: spacing.sm,
  },
  partner: {
    marginTop: spacing.xs,
    gap: spacing.xs,
  },
  bars: {
    gap: 5,
  },
  miniTrack: {
    height: 5,
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceSunken,
    overflow: 'hidden',
  },
  miniFill: {
    height: 5,
    borderRadius: radii.pill,
  },
});
