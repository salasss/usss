import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CoupleIllustration } from '@/components/brand/CoupleIllustration';
import { GoogleLogo } from '@/components/brand/GoogleLogo';
import { Logo } from '@/components/brand/Logo';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { describeSignInError } from '@/lib/google-auth';
import { useSession } from '@/state/session';
import { colors, spacing } from '@/theme';

export default function SignInScreen() {
  const insets = useSafeAreaInsets();
  const { canUseGoogle, signInWithGoogle, enterDemo } = useSession();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onGoogle = async () => {
    setBusy(true);
    setError(null);
    try {
      await signInWithGoogle();
    } catch (cause) {
      setError(describeSignInError(cause));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View
      style={[
        styles.root,
        { paddingTop: insets.top + spacing.xxxl * 1.5, paddingBottom: insets.bottom + spacing.xxl },
      ]}>
      <Animated.View entering={FadeInDown.duration(700)} style={styles.brand}>
        <Logo size={64} />
        <AppText variant="bodyStrong" color={colors.textSecondary}>
          Pour nous deux, uniquement
        </AppText>
      </Animated.View>

      <Animated.View entering={FadeIn.delay(250).duration(900)} style={styles.art}>
        <CoupleIllustration width={300} />
      </Animated.View>

      <Animated.View entering={FadeInUp.delay(400).duration(700)} style={styles.actions}>
        <Button
          label="Se connecter avec Google"
          icon={<GoogleLogo size={20} />}
          loading={busy}
          disabled={!canUseGoogle}
          onPress={onGoogle}
        />

        {!canUseGoogle ? (
          <>
            <AppText variant="caption" color={colors.textMuted} align="center">
              Connexion Google pas encore configurée dans cette version.
            </AppText>
            <Button label="Découvrir en mode démo" variant="ghost" onPress={enterDemo} />
          </>
        ) : null}

        {error ? (
          <AppText variant="caption" color={colors.danger} align="center" accessibilityLiveRegion="polite">
            {error}
          </AppText>
        ) : null}

        <AppText variant="tiny" color={colors.textMuted} align="center" style={styles.legal}>
          Vos échanges restent entre vous deux.
        </AppText>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.xxl,
    justifyContent: 'space-between',
  },
  brand: {
    alignItems: 'center',
    gap: spacing.sm,
  },
  art: {
    alignItems: 'center',
  },
  actions: {
    gap: spacing.md,
  },
  legal: {
    marginTop: spacing.sm,
  },
});
