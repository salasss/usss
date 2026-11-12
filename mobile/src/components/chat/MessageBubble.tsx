import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, View } from 'react-native';

import { VoiceNote } from '@/components/chat/VoiceNote';
import { MemoryPhoto } from '@/components/memories/MemoryPhoto';
import { AppText } from '@/components/ui/AppText';
import { DEMO_MEDIA_PREFIX } from '@/data/demo';
import type { MemoryCategory, Message } from '@/data/types';
import { timeLabel } from '@/lib/format';
import { colors, gradients, radii, spacing } from '@/theme';

type MessageBubbleProps = {
  message: Message;
  mine: boolean;
  /** "Vu" under my latest message once read. */
  seen: boolean;
  onLongPress: (message: Message) => void;
  onRetry: (message: Message) => void;
  onOpenImage: (message: Message) => void;
};

const CATEGORIES: MemoryCategory[] = ['trip', 'night', 'date', 'simple'];

function ImageContent({ message, mine }: { message: Message; mine: boolean }) {
  const corner = mine ? styles.mineCorner : styles.theirsCorner;
  if (!message.mediaPath && message.localUri) {
    return <Image source={{ uri: message.localUri }} style={[styles.image, corner]} contentFit="cover" />;
  }
  const hint = message.mediaPath?.startsWith(DEMO_MEDIA_PREFIX)
    ? message.mediaPath.slice(DEMO_MEDIA_PREFIX.length)
    : 'night';
  const category = (CATEGORIES as string[]).includes(hint) ? (hint as MemoryCategory) : 'night';
  return <MemoryPhoto path={message.mediaPath ?? ''} category={category} style={[styles.image, corner]} />;
}

/** One message, with the asymmetric rounded shapes of the mockups. */
export function MessageBubble({ message, mine, seen, onLongPress, onRetry, onOpenImage }: MessageBubbleProps) {
  const reactions = Object.values(message.reactions);
  const failed = message.status === 'failed';

  const onPress = () => {
    if (failed) onRetry(message);
    else if (message.kind === 'image') onOpenImage(message);
  };

  return (
    <View style={[styles.row, mine ? styles.rowMine : styles.rowTheirs]}>
      <Pressable
        onPress={onPress}
        onLongPress={() => onLongPress(message)}
        delayLongPress={260}
        style={message.status === 'pending' ? styles.pending : undefined}
        accessibilityHint="Appui long pour réagir">
        {message.kind === 'text' ? (
          <LinearGradient
            colors={mine ? gradients.lilac : gradients.warm}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.text, mine ? styles.mineCorner : styles.theirsCorner]}>
            <AppText color={colors.textOnAccent}>{message.body}</AppText>
          </LinearGradient>
        ) : message.kind === 'voice' ? (
          <VoiceNote message={message} mine={mine} />
        ) : (
          <ImageContent message={message} mine={mine} />
        )}
      </Pressable>

      {reactions.length > 0 ? (
        <View style={[styles.reactions, mine ? styles.reactionsMine : styles.reactionsTheirs]}>
          {reactions.map((emoji, index) => (
            <AppText key={`${emoji}${index}`} style={styles.emoji}>
              {emoji}
            </AppText>
          ))}
        </View>
      ) : null}

      <View style={[styles.meta, mine && styles.metaMine]}>
        {failed ? (
          <>
            <Ionicons name="alert-circle" size={12} color={colors.danger} />
            <AppText variant="tiny" color={colors.danger}>
              Non envoyé · toucher pour réessayer
            </AppText>
          </>
        ) : (
          <AppText variant="tiny" color={colors.textMuted}>
            {message.status === 'pending' ? 'Envoi…' : timeLabel(message.createdAt)}
            {seen ? ' · Vu' : ''}
          </AppText>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    maxWidth: '82%',
    marginVertical: 3,
  },
  rowMine: {
    alignSelf: 'flex-end',
    alignItems: 'flex-end',
  },
  rowTheirs: {
    alignSelf: 'flex-start',
    alignItems: 'flex-start',
  },
  pending: {
    opacity: 0.6,
  },
  text: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radii.lg,
  },
  mineCorner: {
    borderBottomRightRadius: 6,
  },
  theirsCorner: {
    borderBottomLeftRadius: 6,
  },
  image: {
    width: 230,
    height: 172,
    borderRadius: radii.lg,
    overflow: 'hidden',
  },
  reactions: {
    flexDirection: 'row',
    marginTop: -10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 2,
    borderColor: colors.background,
  },
  reactionsMine: {
    marginRight: spacing.md,
  },
  reactionsTheirs: {
    marginLeft: spacing.md,
  },
  emoji: {
    fontSize: 14,
    lineHeight: 18,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 3,
    paddingHorizontal: spacing.xs,
  },
  metaMine: {
    justifyContent: 'flex-end',
  },
});
