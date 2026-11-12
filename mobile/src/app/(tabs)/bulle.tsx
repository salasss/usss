import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { Placeholder } from '@/components/ui/Placeholder';
import { Screen } from '@/components/ui/Screen';
import { colors, radii, spacing } from '@/theme';

export default function BubbleScreen() {
  const router = useRouter();

  const header = (
    <View style={styles.header}>
      <Pressable
        onPress={() => router.navigate('/')}
        accessibilityRole="button"
        accessibilityLabel="Retour à notre espace"
        hitSlop={12}
        style={styles.back}>
        <Ionicons name="chevron-back" size={22} color={colors.cream} />
      </Pressable>
      <AppText variant="subtitle">Notre bulle</AppText>
    </View>
  );

  return (
    <Screen scroll={false} withTabBar={false} header={header} contentStyle={styles.content}>
      <Placeholder
        icon="chatbubbles-outline"
        title="Votre bulle"
        description="Messages, vocaux et photos, rien que pour vous deux."
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  back: {
    width: 40,
    height: 40,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  content: {
    justifyContent: 'center',
  },
});
