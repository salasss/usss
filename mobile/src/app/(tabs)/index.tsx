import { StyleSheet, View } from 'react-native';

import { Logo } from '@/components/brand/Logo';
import { AppText } from '@/components/ui/AppText';
import { Placeholder } from '@/components/ui/Placeholder';
import { Screen } from '@/components/ui/Screen';
import { colors, spacing } from '@/theme';

export default function OurSpaceScreen() {
  return (
    <Screen>
      <View style={styles.header}>
        <Logo />
      </View>
      <View style={styles.titles}>
        <AppText variant="title">Notre espace</AppText>
        <AppText color={colors.textSecondary}>Un coin rien qu&apos;à vous deux.</AppText>
      </View>
      <Placeholder
        icon="sparkles-outline"
        title="Bientôt ici"
        description="L'instant du jour, vos humeurs et le prochain rendez-vous."
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  titles: {
    gap: spacing.xs,
  },
});
