import Ionicons from '@expo/vector-icons/Ionicons';
import { DateTimePickerAndroid, type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Image } from 'expo-image';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet } from 'react-native';

import { CATEGORY_LOOK } from '@/components/memories/MemoryPhoto';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { Sheet } from '@/components/ui/Sheet';
import { TextField } from '@/components/ui/TextField';
import type { MemoryCategory } from '@/data/types';
import { useBubble } from '@/state/bubble';
import { colors, radii, spacing } from '@/theme';

export type PickedPhoto = { uri: string; mimeType: string };

/** Local calendar day as YYYY-MM-DD (no UTC shift). */
function isoDay(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

type MemorySheetProps = {
  photo: PickedPhoto | null;
  onClose: () => void;
};

/** Saves a picked photo as a memory: title, category and day. */
export function MemorySheet({ photo, onClose }: MemorySheetProps) {
  const { addMemory } = useBubble();
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<MemoryCategory>('simple');
  const [day, setDay] = useState(() => new Date());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setTitle('');
    setCategory('simple');
    setDay(new Date());
    setError(null);
  };

  const close = () => {
    reset();
    onClose();
  };

  const pickDay = () =>
    DateTimePickerAndroid.open({
      value: day,
      mode: 'date',
      maximumDate: new Date(),
      onChange: (event: DateTimePickerEvent, picked?: Date) => {
        if (event.type === 'set' && picked) setDay(picked);
      },
    });

  const save = async () => {
    if (!photo) return;
    setBusy(true);
    setError(null);
    try {
      await addMemory({
        localUri: photo.uri,
        mimeType: photo.mimeType,
        title: title.trim(),
        category,
        takenOn: isoDay(day),
      });
      close();
    } catch {
      setError("Impossible d'enregistrer ce souvenir pour l'instant.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet visible={photo !== null} title="Nouveau souvenir" onClose={close}>
      {photo ? <Image source={{ uri: photo.uri }} style={styles.preview} contentFit="cover" /> : null}
      <TextField value={title} onChangeText={setTitle} placeholder="Un petit titre…" maxLength={80} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        {(Object.keys(CATEGORY_LOOK) as MemoryCategory[]).map((key) => (
          <Pressable
            key={key}
            onPress={() => setCategory(key)}
            style={[styles.chip, key === category && styles.chipOn]}
            accessibilityRole="radio"
            accessibilityState={{ selected: key === category }}>
            <Ionicons
              name={CATEGORY_LOOK[key].icon}
              size={14}
              color={key === category ? colors.textOnAccent : colors.textSecondary}
            />
            <AppText variant="label" color={key === category ? colors.textOnAccent : colors.textSecondary}>
              {CATEGORY_LOOK[key].label}
            </AppText>
          </Pressable>
        ))}
      </ScrollView>
      <Pressable style={styles.day} onPress={pickDay} accessibilityRole="button">
        <Ionicons name="calendar-outline" size={18} color={colors.peach} />
        <AppText variant="bodyStrong" style={styles.dayText}>
          {day.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </AppText>
      </Pressable>
      {error ? (
        <AppText variant="caption" color={colors.danger}>
          {error}
        </AppText>
      ) : null}
      <Button label="Garder ce souvenir" variant="warm" loading={busy} onPress={save} />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  preview: {
    height: 170,
    borderRadius: radii.xl,
  },
  chips: {
    gap: spacing.sm,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 36,
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceRaised,
  },
  chipOn: {
    backgroundColor: colors.peach,
  },
  day: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    height: 48,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceRaised,
  },
  dayText: {
    textTransform: 'capitalize',
  },
});
