import type { PropsWithChildren, ReactNode } from 'react';
import { ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, spacing, TAB_BAR_GAP, TAB_BAR_HEIGHT } from '@/theme';

type ScreenProps = PropsWithChildren<{
  /** Scrollable content (default) or a fixed layout. */
  scroll?: boolean;
  /** Reserve room for the floating tab bar. */
  withTabBar?: boolean;
  /** Rendered above the scroll view, outside of it. */
  header?: ReactNode;
  contentStyle?: StyleProp<ViewStyle>;
}>;

export function Screen({
  scroll = true,
  withTabBar = true,
  header,
  contentStyle,
  children,
}: ScreenProps) {
  const insets = useSafeAreaInsets();
  const bottom = insets.bottom + spacing.xl + (withTabBar ? TAB_BAR_HEIGHT + TAB_BAR_GAP : 0);

  if (!scroll) {
    return (
      <View style={[styles.root, { paddingTop: insets.top }]}>
        {header}
        <View style={[styles.fixed, { paddingBottom: bottom }, contentStyle]}>{children}</View>
      </View>
    );
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {header}
      <ScrollView
        style={styles.root}
        contentContainerStyle={[styles.content, { paddingBottom: bottom }, contentStyle]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled">
        {children}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    gap: spacing.lg,
  },
  fixed: {
    flex: 1,
    paddingHorizontal: spacing.xl,
  },
});
