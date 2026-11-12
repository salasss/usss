import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { EventSheet } from '@/components/events/EventSheet';
import { AppText } from '@/components/ui/AppText';
import type { CalendarEvent, EventColor } from '@/data/types';
import { useBubble, useBubbleStore } from '@/state/bubble';
import { colors, gradients, radii, spacing } from '@/theme';

const CARD_GRADIENTS: Record<EventColor, readonly [string, string, ...string[]]> = {
  peach: gradients.warm,
  rose: ['#F6B3C4', '#EE7C93'],
  lilac: gradients.lilac,
  butter: gradients.butter,
  mint: gradients.mint,
};

/** "Agenda partagé": upcoming dates as colorful cards. */
export function AgendaStrip() {
  const events = useBubbleStore((state) => state.events);
  const { deleteEvent } = useBubble();
  const [open, setOpen] = useState(false);

  const confirmDelete = (event: CalendarEvent) =>
    Alert.alert('Supprimer ce rendez-vous ?', event.title, [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Supprimer', style: 'destructive', onPress: () => void deleteEvent(event) },
    ]);

  return (
    <>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.strip}>
        {events.map((event) => {
          const date = new Date(event.startsAt);
          return (
            <Pressable
              key={event.id}
              onLongPress={() => confirmDelete(event)}
              delayLongPress={320}
              accessibilityHint="Appui long pour supprimer">
              <LinearGradient
                colors={CARD_GRADIENTS[event.color]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.card}>
                <AppText variant="title" color={colors.textOnAccent}>
                  {date.getDate()}
                </AppText>
                <AppText variant="label" color={colors.textOnAccent} style={styles.month}>
                  {date.toLocaleDateString('fr-FR', { weekday: 'short', month: 'short' })}
                </AppText>
                <View style={styles.spacer} />
                <AppText variant="bodyStrong" color={colors.textOnAccent} numberOfLines={2}>
                  {event.title}
                </AppText>
                <AppText variant="tiny" color={colors.textOnAccent}>
                  {date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                </AppText>
              </LinearGradient>
            </Pressable>
          );
        })}
        <Pressable onPress={() => setOpen(true)} style={styles.add} accessibilityRole="button" accessibilityLabel="Ajouter une date">
          <Ionicons name="add" size={26} color={colors.peach} />
          <AppText variant="label" align="center" color={colors.textSecondary}>
            Ajouter une date
          </AppText>
        </Pressable>
      </ScrollView>
      <EventSheet visible={open} onClose={() => setOpen(false)} />
    </>
  );
}

const styles = StyleSheet.create({
  strip: {
    gap: spacing.md,
    paddingRight: spacing.xl,
  },
  card: {
    width: 138,
    height: 168,
    borderRadius: radii.xl,
    padding: spacing.lg,
  },
  month: {
    textTransform: 'capitalize',
    opacity: 0.8,
  },
  spacer: {
    flex: 1,
  },
  add: {
    width: 120,
    height: 168,
    borderRadius: radii.xl,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    padding: spacing.md,
  },
});
