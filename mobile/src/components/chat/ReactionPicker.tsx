import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { Sheet } from '@/components/ui/Sheet';
import type { Message } from '@/data/types';
import { colors, radii, spacing } from '@/theme';

export const REACTIONS = ['❤️', '😍', '😂', '😮', '😢', '👍'];

/** What the message says, or what it holds when it is not text. */
function preview(message: Message): string {
  if (message.kind === 'image') return '📷 Photo';
  if (message.kind === 'voice') return '🎤 Message vocal';
  return message.body ?? '';
}

type ReactionPickerProps = {
  visible: boolean;
  /** The message reacted to, recalled above the emojis. */
  message: Message | null;
  /** My current reaction on the message, if any (tapping it removes it). */
  current: string | undefined;
  onPick: (emoji: string) => void;
  onClose: () => void;
};

export function ReactionPicker({ visible, message, current, onPick, onClose }: ReactionPickerProps) {
  return (
    <Sheet visible={visible} title="Réagir" onClose={onClose}>
      {message ? (
        <AppText variant="caption" color={colors.textSecondary} numberOfLines={2} style={styles.preview}>
          {preview(message)}
        </AppText>
      ) : null}
      <View style={styles.row}>
        {REACTIONS.map((emoji) => (
          <Pressable
            key={emoji}
            onPress={() => onPick(emoji)}
            style={[styles.choice, current === emoji && styles.chosen]}
            accessibilityRole="button"
            accessibilityLabel={current === emoji ? `Retirer ${emoji}` : `Réagir ${emoji}`}>
            <AppText style={styles.emoji}>{emoji}</AppText>
          </Pressable>
        ))}
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  preview: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderLeftWidth: 2,
    borderLeftColor: colors.peach,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  choice: {
    width: 50,
    height: 50,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceRaised,
  },
  chosen: {
    backgroundColor: colors.rose,
  },
  emoji: {
    fontSize: 24,
    lineHeight: 30,
  },
});
