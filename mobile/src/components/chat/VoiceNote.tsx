import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, View } from 'react-native';

import { useVoicePlayer } from '@/components/chat/VoicePlayer';
import { AppText } from '@/components/ui/AppText';
import { DEMO_MEDIA_PREFIX } from '@/data/demo';
import type { Message } from '@/data/types';
import { durationLabel, waveform } from '@/lib/format';
import { useBubble } from '@/state/bubble';
import { colors, gradients, radii, spacing } from '@/theme';

/** Gradient pill with play button, waveform and duration. */
export function VoiceNote({ message, mine }: { message: Message; mine: boolean }) {
  const { data } = useBubble();
  const voice = useVoicePlayer();
  const active = voice.activeId === message.id;
  const playable = Boolean(message.localUri || (message.mediaPath && !message.mediaPath.startsWith(DEMO_MEDIA_PREFIX)));
  const bars = waveform(message.id);

  const play = async () => {
    const url = message.localUri ?? (message.mediaPath ? await data.mediaUrl(message.mediaPath) : null);
    if (url) voice.toggle(message.id, url);
  };

  return (
    <LinearGradient
      colors={gradients.sunset}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.pill, mine ? styles.mine : styles.theirs]}>
      <Pressable
        onPress={play}
        disabled={!playable}
        style={[styles.play, !playable && styles.disabled]}
        accessibilityRole="button"
        accessibilityLabel={active && voice.playing ? 'Pause' : 'Écouter le vocal'}>
        <Ionicons name={active && voice.playing ? 'pause' : 'play'} size={18} color={colors.textOnCream} />
      </Pressable>
      <View style={styles.bars}>
        {bars.map((height, index) => (
          <View
            key={index}
            style={[
              styles.bar,
              {
                height: 6 + height * 22,
                opacity: active && index / bars.length <= voice.progress ? 1 : 0.55,
              },
            ]}
          />
        ))}
      </View>
      <AppText variant="tiny" color={colors.textOnAccent}>
        {durationLabel(message.durationMs ?? 0)}
      </AppText>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingLeft: spacing.sm,
    paddingRight: spacing.md,
    borderRadius: radii.lg,
    width: 236,
  },
  mine: {
    borderBottomRightRadius: 6,
  },
  theirs: {
    borderBottomLeftRadius: 6,
  },
  play: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.cream,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: {
    opacity: 0.6,
  },
  bars: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  bar: {
    flex: 1,
    borderRadius: 2,
    backgroundColor: colors.cream,
  },
});
