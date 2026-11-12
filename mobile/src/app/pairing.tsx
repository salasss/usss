import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Pressable, ScrollView, Share, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Logo } from '@/components/brand/Logo';
import {
  CODE_LENGTH,
  CodeDisplay,
  CodeInput,
  formatCode,
  hasLookAlikes,
} from '@/components/couple/InviteCode';
import { WaitingHearts } from '@/components/couple/WaitingHearts';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { useCouple } from '@/state/couple';
import { useSession } from '@/state/session';
import { colors, spacing } from '@/theme';

type Busy = 'create' | 'join' | 'renew' | null;

function formatExpiry(iso: string): string {
  return new Date(iso).toLocaleString('fr-FR', {
    weekday: 'long',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function PairingScreen() {
  const insets = useSafeAreaInsets();
  const { me, signOut } = useSession();
  const { status, couple, error: loadError, refresh, create, join, renewInvite } = useCouple();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState<Busy>(null);
  const [error, setError] = useState<string | null>(null);

  const firstName = me?.displayName.split(' ')[0] ?? '';
  const invite = couple?.invite ?? null;
  const codeReady = code.length === CODE_LENGTH && !hasLookAlikes(code);

  const act = async (kind: Busy, action: () => Promise<void>) => {
    setBusy(kind);
    setError(null);
    try {
      await action();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(null);
    }
  };

  const share = () => {
    if (!invite) return;
    Share.share({
      message: `Rejoins-moi sur usss 💞\nMon code : ${formatCode(invite.code)}`,
    }).catch(() => undefined);
  };

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + spacing.xxl, paddingBottom: insets.bottom + spacing.xxl },
      ]}
      keyboardShouldPersistTaps="handled">
      <Animated.View entering={FadeInDown.duration(500)} style={styles.header}>
        <Logo size={40} />
        <AppText variant="hero">Créons votre bulle</AppText>
        <AppText color={colors.textSecondary}>
          {firstName ? `Bonjour ${firstName} ! ` : ''}usss ne s&apos;ouvre qu&apos;à deux : invite ta
          moitié, ou rejoins sa bulle avec son code.
        </AppText>
      </Animated.View>

      {status === 'error' ? (
        <Card style={styles.card}>
          <AppText variant="heading">Impossible de joindre usss</AppText>
          <AppText color={colors.textSecondary}>{loadError}</AppText>
          <Button label="Réessayer" variant="surface" compact onPress={refresh} />
        </Card>
      ) : null}

      {status === 'waiting' && invite ? (
        <Animated.View entering={FadeInDown.delay(100).duration(500)}>
          <Card tone="cream" style={styles.card}>
            <AppText variant="label" color={colors.textOnCream}>
              Ton code d&apos;invitation
            </AppText>
            <CodeDisplay code={invite.code} />
            <AppText variant="caption" color={colors.textOnCream} align="center">
              {invite.expired
                ? 'Ce code a expiré.'
                : `Valable jusqu'à ${formatExpiry(invite.expiresAt)}`}
            </AppText>
            {invite.expired ? (
              <Button
                label="Nouveau code"
                variant="warm"
                loading={busy === 'renew'}
                onPress={() => act('renew', renewInvite)}
              />
            ) : (
              <Button
                label="Partager le code"
                variant="warm"
                icon={<Ionicons name="share-social" size={18} color={colors.textOnAccent} />}
                onPress={share}
              />
            )}
            <View style={styles.waiting}>
              <WaitingHearts />
              <AppText variant="caption" color={colors.textOnCream}>
                En attente de ta moitié…
              </AppText>
            </View>
          </Card>
        </Animated.View>
      ) : null}

      {status === 'single' ? (
        <Animated.View entering={FadeInDown.delay(100).duration(500)}>
          <Card style={styles.card}>
            <AppText variant="heading">Inviter ma moitié</AppText>
            <AppText color={colors.textSecondary}>
              Crée votre bulle, puis partage le code qui s&apos;affiche.
            </AppText>
            <Button
              label="Créer notre bulle"
              variant="warm"
              loading={busy === 'create'}
              onPress={() => act('create', create)}
            />
          </Card>
        </Animated.View>
      ) : null}

      {status === 'single' || status === 'waiting' ? (
        <Animated.View entering={FadeInDown.delay(200).duration(500)}>
          <Card style={styles.card}>
            <AppText variant="heading">
              {status === 'waiting' ? 'Tu as plutôt reçu un code ?' : "J'ai reçu un code"}
            </AppText>
            <CodeInput
              value={code}
              onChange={setCode}
              onSubmit={() => codeReady && act('join', () => join(code))}
            />
            {hasLookAlikes(code) ? (
              <AppText variant="caption" color={colors.textMuted}>
                Les codes n&apos;utilisent ni 0, ni O, ni 1, ni I.
              </AppText>
            ) : null}
            <Button
              label="Rejoindre sa bulle"
              variant="cream"
              loading={busy === 'join'}
              disabled={!codeReady}
              onPress={() => act('join', () => join(code))}
            />
          </Card>
        </Animated.View>
      ) : null}

      {error ? (
        <AppText color={colors.danger} align="center" accessibilityLiveRegion="polite">
          {error}
        </AppText>
      ) : null}

      <Pressable onPress={signOut} accessibilityRole="button" hitSlop={8} style={styles.signOut}>
        <AppText variant="caption" color={colors.textMuted} align="center">
          Changer de compte
        </AppText>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingHorizontal: spacing.xl,
    gap: spacing.lg,
  },
  header: {
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  card: {
    gap: spacing.md,
  },
  waiting: {
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  signOut: {
    marginTop: spacing.md,
  },
});
