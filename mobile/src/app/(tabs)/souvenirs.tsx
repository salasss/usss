import Ionicons from '@expo/vector-icons/Ionicons';
import { launchImageLibraryAsync } from 'expo-image-picker';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { AgendaStrip } from '@/components/events/AgendaStrip';
import { GoalsCard } from '@/components/memories/GoalsCard';
import { CATEGORY_LOOK } from '@/components/memories/MemoryPhoto';
import { MemorySheet, type PickedPhoto } from '@/components/memories/MemorySheet';
import { AddMemoryTile, MemoryTile } from '@/components/memories/MemoryTile';
import { AppText } from '@/components/ui/AppText';
import { Screen } from '@/components/ui/Screen';
import { TextField } from '@/components/ui/TextField';
import type { Memory, MemoryCategory } from '@/data/types';
import { pickedImageType } from '@/lib/media';
import { useBubble, useBubbleStore } from '@/state/bubble';
import { colors, radii, spacing } from '@/theme';

type Filter = 'all' | 'favorites' | MemoryCategory;

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'Tous' },
  { key: 'favorites', label: 'Coups de cœur' },
  ...(Object.keys(CATEGORY_LOOK) as MemoryCategory[]).map((key) => ({ key, label: CATEGORY_LOOK[key].label })),
];

/** Varying heights give the mosaic its rhythm. */
const HEIGHTS = [190, 150, 170, 210, 140, 180];

function HeaderButton({ icon, label, active, onPress }: { icon: 'search' | 'close'; label: string; active?: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      style={[styles.headerButton, active && styles.headerButtonOn]}
      accessibilityRole="button"
      accessibilityLabel={label}>
      <Ionicons name={icon} size={20} color={colors.cream} />
    </Pressable>
  );
}

export default function MemoriesScreen() {
  const memories = useBubbleStore((state) => state.memories);
  const { deleteMemory } = useBubble();
  const [filter, setFilter] = useState<Filter>('all');
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState('');
  const [photo, setPhoto] = useState<PickedPhoto | null>(null);

  const needle = query.trim().toLocaleLowerCase('fr');
  const visible = memories.filter(
    (memory) =>
      (filter === 'all' || (filter === 'favorites' ? memory.isFavorite : memory.category === filter)) &&
      (!needle || memory.title.toLocaleLowerCase('fr').includes(needle)),
  );

  // Two columns; the "add" tile opens the left one.
  const left: { memory: Memory; height: number }[] = [];
  const right: { memory: Memory; height: number }[] = [];
  visible.forEach((memory, index) => {
    (index % 2 === 0 ? right : left).push({ memory, height: HEIGHTS[index % HEIGHTS.length] });
  });

  const pickPhoto = async () => {
    const result = await launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
    const asset = result.canceled ? null : result.assets[0];
    if (asset) setPhoto({ uri: asset.uri, mimeType: pickedImageType(asset.uri) });
  };

  const confirmDelete = (memory: Memory) =>
    Alert.alert('Supprimer ce souvenir ?', 'La photo sera retirée pour vous deux.', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Supprimer', style: 'destructive', onPress: () => void deleteMemory(memory) },
    ]);

  return (
    <Screen>
      <View style={styles.header}>
        <AppText variant="hero" style={styles.title}>
          Nos souvenirs
        </AppText>
        <HeaderButton
          icon={searching ? 'close' : 'search'}
          label={searching ? 'Fermer la recherche' : 'Rechercher'}
          active={searching}
          onPress={() => {
            setSearching((value) => !value);
            setQuery('');
          }}
        />
      </View>

      {searching ? (
        <TextField value={query} onChangeText={setQuery} placeholder="Rechercher un souvenir…" autoFocus />
      ) : null}

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.bleed}
        contentContainerStyle={styles.filters}>
        {FILTERS.map((item) => (
          <Pressable
            key={item.key}
            onPress={() => setFilter(item.key)}
            style={[styles.filter, filter === item.key && styles.filterOn]}
            accessibilityRole="tab"
            accessibilityState={{ selected: filter === item.key }}>
            <AppText variant="label" color={filter === item.key ? colors.textOnCream : colors.textSecondary}>
              {item.label}
            </AppText>
          </Pressable>
        ))}
      </ScrollView>

      <Animated.View entering={FadeInDown.duration(450)} style={styles.mosaic}>
        <View style={styles.column}>
          <AddMemoryTile onPress={pickPhoto} />
          {left.map(({ memory, height }) => (
            <MemoryTile key={memory.id} memory={memory} height={height} onLongPress={confirmDelete} />
          ))}
        </View>
        <View style={styles.column}>
          {right.map(({ memory, height }) => (
            <MemoryTile key={memory.id} memory={memory} height={height} onLongPress={confirmDelete} />
          ))}
        </View>
      </Animated.View>

      {visible.length === 0 && memories.length > 0 ? (
        <AppText color={colors.textMuted} align="center">
          Aucun souvenir ici pour l&apos;instant.
        </AppText>
      ) : null}

      <Animated.View entering={FadeInDown.delay(120).duration(450)}>
        <GoalsCard />
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(200).duration(450)} style={styles.agenda}>
        <AppText variant="subtitle">Agenda partagé</AppText>
        <AgendaStrip />
      </Animated.View>

      <MemorySheet photo={photo} onClose={() => setPhoto(null)} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingTop: spacing.sm,
  },
  title: {
    flex: 1,
  },
  headerButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  headerButtonOn: {
    backgroundColor: colors.surfaceRaised,
  },
  // Horizontal lists scroll to the screen edges, not to the page margin.
  bleed: {
    marginHorizontal: -spacing.xl,
  },
  filters: {
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
  },
  filter: {
    height: 36,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.pill,
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  filterOn: {
    backgroundColor: colors.cream,
  },
  mosaic: {
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'flex-start',
  },
  column: {
    flex: 1,
    gap: spacing.md,
  },
  agenda: {
    gap: spacing.md,
  },
});
