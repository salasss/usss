import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState, type ComponentProps } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import type { MemoryCategory } from '@/data/types';
import { useBubble } from '@/state/bubble';
import { colors, gradients } from '@/theme';

type IconName = ComponentProps<typeof Ionicons>['name'];

export const CATEGORY_LOOK: Record<
  MemoryCategory,
  { label: string; icon: IconName; colors: readonly [string, string, ...string[]] }
> = {
  trip: { label: 'Voyages', icon: 'airplane', colors: gradients.sunset },
  night: { label: 'Soirées', icon: 'wine', colors: gradients.lilac },
  date: { label: 'Rendez-vous', icon: 'heart', colors: gradients.warm },
  simple: { label: 'Moments simples', icon: 'sunny', colors: gradients.butter },
};

/** Illustrated tile for memories without a displayable photo. */
export function MemoryArt({ category, style }: { category: MemoryCategory; style?: StyleProp<ViewStyle> }) {
  const look = CATEGORY_LOOK[category];
  return (
    <LinearGradient colors={look.colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.art, style]}>
      <View style={styles.artBadge}>
        <Ionicons name={look.icon} size={30} color={colors.cream} />
      </View>
    </LinearGradient>
  );
}

type MemoryPhotoProps = {
  path: string;
  category: MemoryCategory;
  style?: StyleProp<ViewStyle>;
};

/** Photo of a memory, fetched through a short-lived signed URL. */
export function MemoryPhoto({ path, category, style }: MemoryPhotoProps) {
  const { data } = useBubble();
  const [resolved, setResolved] = useState<{ path: string; url: string | null } | null>(null);

  useEffect(() => {
    let active = true;
    data
      .mediaUrl(path)
      .then((url) => active && setResolved({ path, url }))
      .catch(() => active && setResolved({ path, url: null }));
    return () => {
      active = false;
    };
  }, [data, path]);

  const url = resolved?.path === path ? resolved.url : null;
  if (!url) return <MemoryArt category={category} style={style} />;

  return (
    <View style={[styles.photo, style]}>
      <Image source={{ uri: url }} style={StyleSheet.absoluteFill} contentFit="cover" transition={250} />
    </View>
  );
}

const styles = StyleSheet.create({
  art: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  artBadge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(22, 18, 19, 0.18)',
  },
  photo: {
    overflow: 'hidden',
    backgroundColor: colors.surfaceRaised,
  },
});
