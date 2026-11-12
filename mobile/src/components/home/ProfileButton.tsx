import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Sheet } from '@/components/ui/Sheet';
import { useSession } from '@/state/session';
import { colors, spacing } from '@/theme';

/** My avatar; opens a small sheet with the account actions. */
export function ProfileButton() {
  const { me, mode, signOut } = useSession();
  const [open, setOpen] = useState(false);

  if (!me) return null;

  return (
    <>
      <Pressable onPress={() => setOpen(true)} hitSlop={8} accessibilityRole="button" accessibilityLabel="Mon compte">
        <Avatar name={me.displayName} uri={me.avatarUrl} size={40} ring={colors.borderStrong} />
      </Pressable>
      <Sheet visible={open} onClose={() => setOpen(false)}>
        <View style={styles.identity}>
          <Avatar name={me.displayName} uri={me.avatarUrl} size={56} />
          <View style={styles.texts}>
            <AppText variant="heading">{me.displayName}</AppText>
            <AppText variant="caption" color={colors.textSecondary}>
              {mode === 'demo' ? 'Mode démo : données d’exemple' : me.email}
            </AppText>
          </View>
        </View>
        <Button
          label={mode === 'demo' ? 'Quitter la démo' : 'Se déconnecter'}
          variant="ghost"
          icon={<Ionicons name="log-out-outline" size={18} color={colors.cream} />}
          onPress={() => {
            setOpen(false);
            void signOut();
          }}
        />
      </Sheet>
    </>
  );
}

const styles = StyleSheet.create({
  identity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
  },
  texts: {
    flex: 1,
    gap: 2,
  },
});
