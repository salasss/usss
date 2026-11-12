import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Keyboard, Pressable, StyleSheet, TextInput, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring } from 'react-native-reanimated';

import { MemoryPhoto } from '@/components/memories/MemoryPhoto';
import { AppText } from '@/components/ui/AppText';
import { Card } from '@/components/ui/Card';
import { useBubble, useBubbleStore } from '@/state/bubble';
import { useCouple } from '@/state/couple';
import { colors, fonts, radii, spacing } from '@/theme';

/** The latest memory, a heart to react, and a little note for the partner. */
export function DailyMomentCard() {
  const router = useRouter();
  const memories = useBubbleStore((state) => state.memories);
  const { toggleFavorite, sendNote } = useBubble();
  const { partner } = useCouple();
  const [note, setNote] = useState('');
  const [sent, setSent] = useState(false);
  const pop = useSharedValue(1);
  const heartStyle = useAnimatedStyle(() => ({ transform: [{ scale: pop.get() }] }));

  const moment = memories[0] ?? null;
  const partnerName = partner?.displayName.split(' ')[0] ?? 'ta moitié';

  const react = () => {
    if (!moment) return;
    pop.set(withSequence(withSpring(1.45, { damping: 6, stiffness: 400 }), withSpring(1)));
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
    void toggleFavorite(moment);
  };

  const send = () => {
    const text = note.trim();
    if (!text) return;
    sendNote(text);
    setNote('');
    setSent(true);
    Keyboard.dismiss();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
    setTimeout(() => setSent(false), 2500);
  };

  return (
    <Card tone="cream" style={styles.card}>
      <View style={styles.header}>
        <AppText variant="heading" color={colors.textOnCream}>
          L&apos;instant du jour
        </AppText>
        {moment?.title ? (
          <AppText variant="caption" color={colors.textOnCream} numberOfLines={1} style={styles.title}>
            {moment.title}
          </AppText>
        ) : null}
      </View>

      {moment ? (
        <View style={styles.photoWrap}>
          <MemoryPhoto path={moment.photoPath} category={moment.category} style={styles.photo} />
          <Pressable style={styles.react} onPress={react} accessibilityRole="button">
            <AppText variant="label" color={colors.textOnCream}>
              {moment.isFavorite ? 'Coup de cœur' : 'Réagir'}
            </AppText>
            <Animated.View style={heartStyle}>
              <Ionicons name={moment.isFavorite ? 'heart' : 'heart-outline'} size={16} color={colors.heart} />
            </Animated.View>
          </Pressable>
        </View>
      ) : (
        <Pressable style={styles.empty} onPress={() => router.navigate('/souvenirs')} accessibilityRole="button">
          <Ionicons name="images-outline" size={28} color={colors.textOnCream} />
          <AppText variant="bodyStrong" color={colors.textOnCream}>
            Ajoutez votre premier souvenir
          </AppText>
        </Pressable>
      )}

      <View style={styles.noteRow}>
        <TextInput
          value={note}
          onChangeText={setNote}
          onSubmitEditing={send}
          placeholder={`Laisser un petit mot à ${partnerName}…`}
          placeholderTextColor={colors.textMuted}
          returnKeyType="send"
          maxLength={500}
          style={styles.noteInput}
        />
        <Pressable onPress={send} hitSlop={8} accessibilityRole="button" accessibilityLabel="Envoyer le mot">
          <Ionicons name="paper-plane" size={20} color={note.trim() ? colors.peach : colors.textMuted} />
        </Pressable>
      </View>
      {sent ? (
        <AppText variant="caption" color={colors.textOnCream}>
          Envoyé dans votre bulle 💌
        </AppText>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.md,
    padding: spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingHorizontal: spacing.xs,
  },
  title: {
    flexShrink: 1,
    opacity: 0.7,
  },
  photoWrap: {
    borderRadius: radii.lg,
    overflow: 'hidden',
  },
  photo: {
    height: 180,
    borderRadius: radii.lg,
  },
  react: {
    position: 'absolute',
    left: spacing.md,
    bottom: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    height: 34,
    borderRadius: radii.pill,
    backgroundColor: colors.cream,
  },
  empty: {
    height: 140,
    borderRadius: radii.lg,
    backgroundColor: colors.creamDeep,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  noteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingLeft: spacing.lg,
    paddingRight: spacing.lg,
    height: 48,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
  },
  noteInput: {
    flex: 1,
    color: colors.text,
    fontFamily: fonts.body,
    fontSize: 14,
  },
});
