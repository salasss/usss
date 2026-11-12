import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, View } from 'react-native';

import { CATEGORY_LOOK, MemoryPhoto } from '@/components/memories/MemoryPhoto';
import { AppText } from '@/components/ui/AppText';
import type { Memory } from '@/data/types';
import { useBubble } from '@/state/bubble';
import { colors, radii, spacing } from '@/theme';

const formatDay = (isoDay: string) =>
  new Date(`${isoDay}T12:00:00`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });

type MemoryTileProps = {
  memory: Memory;
  height: number;
  onLongPress: (memory: Memory) => void;
};

/** One memory of the mosaic: ultra-rounded photo, title, date and heart. */
export function MemoryTile({ memory, height, onLongPress }: MemoryTileProps) {
  const { toggleFavorite } = useBubble();

  return (
    <Pressable
      onLongPress={() => onLongPress(memory)}
      delayLongPress={320}
      style={styles.tile}
      accessibilityHint="Appui long pour supprimer">
      <MemoryPhoto path={memory.photoPath} category={memory.category} style={[styles.photo, { height }]} />
      <View style={styles.caption}>
        <View style={styles.texts}>
          <AppText variant="label" numberOfLines={1}>
            {memory.title || CATEGORY_LOOK[memory.category].label}
          </AppText>
          <AppText variant="tiny" color={colors.textMuted}>
            {formatDay(memory.takenOn)}
          </AppText>
        </View>
        <Pressable
          onPress={() => toggleFavorite(memory)}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={memory.isFavorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}>
          <Ionicons name={memory.isFavorite ? 'heart' : 'heart-outline'} size={18} color={colors.heart} />
        </Pressable>
      </View>
    </Pressable>
  );
}

/** First tile of the mosaic: add a memory. */
export function AddMemoryTile({ onPress }: { onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.add} accessibilityRole="button">
      <View style={styles.addIcon}>
        <Ionicons name="add" size={26} color={colors.textOnAccent} />
      </View>
      <AppText variant="label" align="center">
        Ajouter un souvenir
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tile: {
    padding: 6,
    borderRadius: radii.xl + 6,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  photo: {
    borderRadius: radii.xl,
  },
  caption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
  },
  texts: {
    flex: 1,
  },
  add: {
    height: 150,
    borderRadius: radii.xl + 6,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    padding: spacing.md,
  },
  addIcon: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: colors.peach,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
