import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { Sheet } from '@/components/ui/Sheet';
import { colors, radii } from '@/theme';

export const REACTIONS = ['❤️', '😍', '😂', '😮', '😢', '👍'];

type ReactionPickerProps = {
  visible: boolean;
  /** My current reaction on the message, if any (tapping it removes it). */
  current: string | undefined;
  onPick: (emoji: string) => void;
  onClose: () => void;
};

export function ReactionPicker({ visible, current, onPick, onClose }: ReactionPickerProps) {
  return (
    <Sheet visible={visible} title="Réagir" onClose={onClose}>
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
