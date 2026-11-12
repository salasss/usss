import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/ui/AppText';
import { Avatar } from '@/components/ui/Avatar';
import { useBubbleStore } from '@/state/bubble';
import { useChatStore } from '@/state/chat';
import { useCouple } from '@/state/couple';
import { colors, radii, spacing } from '@/theme';

export function ChatHeader() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { partner } = useCouple();
  const online = useBubbleStore((state) => state.partnerOnline);
  const connection = useBubbleStore((state) => state.connection);
  const typing = useChatStore((state) => state.partnerTyping);

  const status =
    connection !== 'open' ? 'Connexion…' : typing ? 'écrit…' : online ? 'En ligne' : 'Hors ligne';

  return (
    <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
      <Pressable
        onPress={() => router.navigate('/')}
        hitSlop={10}
        style={styles.back}
        accessibilityRole="button"
        accessibilityLabel="Retour à notre espace">
        <Ionicons name="chevron-back" size={22} color={colors.cream} />
      </Pressable>
      {partner ? (
        <>
          <Avatar name={partner.displayName} uri={partner.avatarUrl} size={44} ring={colors.lilac} online={online} />
          <View style={styles.titles}>
            <AppText variant="heading" numberOfLines={1}>
              {partner.displayName}
            </AppText>
            <AppText
              variant="caption"
              color={typing ? colors.peach : online && connection === 'open' ? colors.online : colors.textMuted}>
              {status}
            </AppText>
          </View>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    backgroundColor: colors.background,
  },
  back: {
    width: 40,
    height: 40,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  titles: {
    flex: 1,
  },
});
