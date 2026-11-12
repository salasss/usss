import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { EventSheet } from '@/components/events/EventSheet';
import { AppText } from '@/components/ui/AppText';
import { Card } from '@/components/ui/Card';
import { ProgressRing } from '@/components/ui/ProgressRing';
import { useNow } from '@/hooks/use-now';
import { useBubbleStore } from '@/state/bubble';
import { colors, spacing } from '@/theme';

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
/** The ring fills up during the last 30 days before the date. */
const HORIZON = 30 * DAY;

/** Countdown to the next date in the shared calendar. */
export function CountdownCard() {
  const events = useBubbleStore((state) => state.events);
  const now = useNow();
  const [open, setOpen] = useState(false);

  const next = events.find((event) => new Date(event.startsAt).getTime() > now - 3 * HOUR) ?? null;
  const left = next ? new Date(next.startsAt).getTime() - now : 0;

  let value = '';
  let unit = '';
  if (next) {
    if (left <= 0) {
      value = '♥';
      unit = "c'est l'heure";
    } else if (left >= DAY) {
      const days = Math.floor(left / DAY);
      value = String(days);
      unit = days > 1 ? 'jours' : 'jour';
    } else {
      value = String(Math.max(1, Math.ceil(left / HOUR)));
      unit = 'h';
    }
  }

  return (
    <>
      <Pressable
        style={styles.press}
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={next ? `${value} ${unit} avant ${next.title}` : 'Prévoir un rendez-vous'}>
        <Card style={styles.card}>
          <AppText variant="heading">Prochain rendez-vous</AppText>
          <View style={styles.ring}>
            <ProgressRing size={92} progress={next ? 1 - Math.min(left, HORIZON) / HORIZON : 0}>
              {next ? (
                <>
                  <AppText variant="title" style={styles.value}>
                    {value}
                  </AppText>
                  <AppText variant="tiny" color={colors.textSecondary}>
                    {unit}
                  </AppText>
                </>
              ) : (
                <Ionicons name="add" size={30} color={colors.peach} />
              )}
            </ProgressRing>
          </View>
          <AppText variant="caption" color={colors.textSecondary} align="center" numberOfLines={2}>
            {next ? `avant ${next.title}` : 'Prévoir un rendez-vous'}
          </AppText>
        </Card>
      </Pressable>
      <EventSheet visible={open} onClose={() => setOpen(false)} />
    </>
  );
}

const styles = StyleSheet.create({
  press: {
    flex: 1,
  },
  card: {
    flex: 1,
    gap: spacing.sm,
  },
  ring: {
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  value: {
    lineHeight: 30,
  },
});
