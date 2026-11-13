import type { ErrorBoundaryProps } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Logo } from '@/components/brand/Logo';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { signOutFromGoogle } from '@/lib/google-auth';
import { forgetDevice } from '@/lib/notifications';
import { supabase } from '@/lib/supabase';
import { colors, spacing } from '@/theme';

/**
 * Last-resort screen when rendering fails. Signing out is offered too, so a
 * broken saved session can never lock the app in a crash loop.
 */
export function CrashScreen({ retry }: ErrorBoundaryProps) {
  const [busy, setBusy] = useState(false);

  const signOutAndRetry = async () => {
    setBusy(true);
    await forgetDevice();
    await supabase?.auth.signOut({ scope: 'local' }).catch(() => undefined);
    await signOutFromGoogle();
    setBusy(false);
    await retry();
  };

  return (
    <View style={styles.root}>
      <Logo size={40} />
      <AppText variant="title" align="center">
        Oups…
      </AppText>
      <AppText color={colors.textSecondary} align="center">
        Quelque chose s&apos;est mal passé. Vos données sont en sécurité.
      </AppText>
      <View style={styles.actions}>
        <Button label="Réessayer" variant="warm" onPress={() => void retry()} />
        <Button label="Se déconnecter" variant="ghost" loading={busy} onPress={signOutAndRetry} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    padding: spacing.xxl,
  },
  actions: {
    alignSelf: 'stretch',
    gap: spacing.md,
    marginTop: spacing.lg,
  },
});
