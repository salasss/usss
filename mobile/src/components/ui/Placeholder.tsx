import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { Card } from '@/components/ui/Card';
import { colors, radii, spacing } from '@/theme';

type PlaceholderProps = {
  icon: ComponentProps<typeof Ionicons>['name'];
  title: string;
  description: string;
};

/** Friendly empty state shown while a section has no content yet. */
export function Placeholder({ icon, title, description }: PlaceholderProps) {
  return (
    <Card style={styles.card}>
      <View style={styles.icon}>
        <Ionicons name={icon} size={26} color={colors.peach} />
      </View>
      <AppText variant="heading" align="center">
        {title}
      </AppText>
      <AppText variant="body" color={colors.textSecondary} align="center">
        {description}
      </AppText>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xxxl,
  },
  icon: {
    width: 56,
    height: 56,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceRaised,
    marginBottom: spacing.sm,
  },
});
