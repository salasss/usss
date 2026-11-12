import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { Card } from '@/components/ui/Card';
import { TextField } from '@/components/ui/TextField';
import type { Goal } from '@/data/types';
import { useBubble, useBubbleStore } from '@/state/bubble';
import { colors, radii, spacing } from '@/theme';

/** "Nos projets": a shared checklist. */
export function GoalsCard() {
  const goals = useBubbleStore((state) => state.goals);
  const { addGoal, toggleGoal, deleteGoal } = useBubble();
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);

  const done = goals.filter((goal) => goal.doneAt).length;

  const submit = async () => {
    const title = draft.trim();
    if (!title) {
      setAdding(false);
      return;
    }
    setDraft('');
    setError(null);
    try {
      await addGoal(title);
    } catch {
      setError("Ce projet n'a pas pu être ajouté.");
    }
  };

  const toggle = (goal: Goal) => {
    Haptics.selectionAsync().catch(() => undefined);
    void toggleGoal(goal);
  };

  const confirmDelete = (goal: Goal) =>
    Alert.alert('Supprimer ce projet ?', goal.title, [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Supprimer', style: 'destructive', onPress: () => void deleteGoal(goal) },
    ]);

  return (
    <Card style={styles.card}>
      <View style={styles.header}>
        <View>
          <AppText variant="subtitle">Nos projets</AppText>
          {goals.length > 0 ? (
            <AppText variant="tiny" color={colors.textMuted}>
              {done} sur {goals.length} réalisés
            </AppText>
          ) : null}
        </View>
        <Pressable
          onPress={() => setAdding((value) => !value)}
          style={styles.addButton}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Ajouter un projet">
          <Ionicons name={adding ? 'close' : 'add'} size={20} color={colors.cream} />
        </Pressable>
      </View>

      {goals.map((goal) => (
        <Pressable
          key={goal.id}
          onPress={() => toggle(goal)}
          onLongPress={() => confirmDelete(goal)}
          style={styles.row}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: goal.doneAt !== null }}>
          <View style={[styles.box, goal.doneAt && styles.boxOn]}>
            {goal.doneAt ? <Ionicons name="checkmark" size={14} color={colors.textOnAccent} /> : null}
          </View>
          <AppText
            style={[styles.title, goal.doneAt && styles.titleDone]}
            color={goal.doneAt ? colors.textMuted : colors.text}>
            {goal.title}
          </AppText>
        </Pressable>
      ))}

      {adding ? (
        <TextField
          value={draft}
          onChangeText={setDraft}
          onSubmitEditing={submit}
          placeholder="Un voyage, un resto, un projet…"
          returnKeyType="done"
          maxLength={120}
          autoFocus
        />
      ) : null}

      {goals.length === 0 && !adding ? (
        <AppText variant="caption" color={colors.textMuted}>
          Vos envies à deux : un voyage, un resto, un projet fou…
        </AppText>
      ) : null}
      {error ? (
        <AppText variant="caption" color={colors.danger}>
          {error}
        </AppText>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  addButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceRaised,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 36,
  },
  box: {
    width: 24,
    height: 24,
    borderRadius: radii.sm - 4,
    borderWidth: 2,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxOn: {
    backgroundColor: colors.pink,
    borderColor: colors.pink,
  },
  title: {
    flex: 1,
  },
  titleDone: {
    textDecorationLine: 'line-through',
  },
});
