import Ionicons from '@expo/vector-icons/Ionicons';
import { DateTimePickerAndroid, type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { Sheet } from '@/components/ui/Sheet';
import { TextField } from '@/components/ui/TextField';
import type { EventColor } from '@/data/types';
import { capitalize } from '@/lib/format';
import { useBubble } from '@/state/bubble';
import { colors, radii, spacing } from '@/theme';

export const EVENT_COLORS: Record<EventColor, string> = {
  peach: colors.peach,
  rose: colors.rose,
  lilac: colors.lilac,
  butter: colors.butter,
  mint: colors.mint,
};

function tomorrowEvening(): Date {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  date.setHours(20, 0, 0, 0);
  return date;
}

const formatDay = (date: Date) =>
  capitalize(date.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }));
const formatTime = (date: Date) => date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

type EventSheetProps = {
  visible: boolean;
  onClose: () => void;
};

/** Plans a date together: title, day, time and a color. */
export function EventSheet({ visible, onClose }: EventSheetProps) {
  const { addEvent } = useBubble();
  const [title, setTitle] = useState('');
  const [when, setWhen] = useState(tomorrowEvening);
  const [color, setColor] = useState<EventColor>('peach');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pick = (mode: 'date' | 'time') =>
    DateTimePickerAndroid.open({
      value: when,
      mode,
      is24Hour: true,
      minimumDate: mode === 'date' ? new Date() : undefined,
      onChange: (event: DateTimePickerEvent, picked?: Date) => {
        if (event.type !== 'set' || !picked) return;
        setWhen((current) => {
          const next = new Date(current);
          if (mode === 'date') next.setFullYear(picked.getFullYear(), picked.getMonth(), picked.getDate());
          else next.setHours(picked.getHours(), picked.getMinutes(), 0, 0);
          return next;
        });
      },
    });

  const close = () => {
    setError(null);
    onClose();
  };

  const save = async () => {
    const name = title.trim();
    if (!name) {
      setError('Donne un petit nom à ce rendez-vous.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await addEvent({ title: name, startsAt: when.toISOString(), color });
      setTitle('');
      setWhen(tomorrowEvening());
      onClose();
    } catch {
      setError("Impossible d'enregistrer ce rendez-vous pour l'instant.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet visible={visible} title="Prochain rendez-vous" onClose={close}>
      <TextField
        value={title}
        onChangeText={setTitle}
        placeholder="Week-end à la mer, dîner, ciné…"
        maxLength={120}
        returnKeyType="done"
      />

      <View style={styles.row}>
        <Pressable style={styles.when} onPress={() => pick('date')} accessibilityRole="button">
          <Ionicons name="calendar-outline" size={18} color={colors.peach} />
          <AppText variant="bodyStrong">{formatDay(when)}</AppText>
        </Pressable>
        <Pressable style={styles.when} onPress={() => pick('time')} accessibilityRole="button">
          <Ionicons name="time-outline" size={18} color={colors.peach} />
          <AppText variant="bodyStrong">{formatTime(when)}</AppText>
        </Pressable>
      </View>

      <View style={styles.colors}>
        {(Object.keys(EVENT_COLORS) as EventColor[]).map((key) => (
          <Pressable
            key={key}
            onPress={() => setColor(key)}
            accessibilityRole="radio"
            accessibilityState={{ selected: key === color }}
            accessibilityLabel={key}
            style={[styles.swatch, { backgroundColor: EVENT_COLORS[key] }, key === color && styles.swatchOn]}
          />
        ))}
      </View>

      {error ? (
        <AppText variant="caption" color={colors.danger}>
          {error}
        </AppText>
      ) : null}
      <Button label="Enregistrer" variant="warm" loading={busy} onPress={save} />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  when: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    height: 50,
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceRaised,
  },
  colors: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  swatch: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 3,
    borderColor: 'transparent',
  },
  swatchOn: {
    borderColor: colors.cream,
  },
});
