import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { colors } from '@/theme';

/** "usss" wordmark with the heart as its full stop. */
export function Logo({ size = 34 }: { size?: number }) {
  return (
    <View style={styles.row} accessibilityRole="header" accessibilityLabel="usss">
      <AppText variant="logo" color={colors.cream} style={{ fontSize: size, lineHeight: size * 1.2 }}>
        usss
      </AppText>
      <Ionicons
        name="heart"
        size={Math.round(size * 0.34)}
        color={colors.rose}
        style={{ marginLeft: size * 0.04, marginBottom: size * 0.2 }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
});
