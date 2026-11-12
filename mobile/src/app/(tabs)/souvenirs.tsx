import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { Placeholder } from '@/components/ui/Placeholder';
import { Screen } from '@/components/ui/Screen';
import { colors, spacing } from '@/theme';

export default function MemoriesScreen() {
  return (
    <Screen>
      <View style={styles.titles}>
        <AppText variant="hero">Nos souvenirs</AppText>
        <AppText color={colors.textSecondary}>Vos plus beaux moments, rangés avec soin.</AppText>
      </View>
      <Placeholder
        icon="images-outline"
        title="Votre album"
        description="Photos, projets à deux et agenda partagé."
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  titles: {
    gap: spacing.xs,
    paddingTop: spacing.sm,
  },
});
