import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { useEffect, useState, type ComponentProps } from 'react';
import { Pressable, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { AppText } from '@/components/ui/AppText';
import { colors, radii, shadows, spacing, TAB_BAR_GAP, TAB_BAR_HEIGHT } from '@/theme';

type IconName = ComponentProps<typeof Ionicons>['name'];

const ICONS: Record<string, { active: IconName; idle: IconName }> = {
  index: { active: 'home', idle: 'home-outline' },
  bulle: { active: 'chatbubble-ellipses', idle: 'chatbubble-ellipses-outline' },
  souvenirs: { active: 'images', idle: 'images-outline' },
};

/** The chat is immersive, like in the mockups: no tab bar there. */
const HIDDEN_ON = new Set(['bulle']);

const PADDING = 6;
const SPRING = { damping: 18, stiffness: 190, mass: 0.9 };

export function TabBar({ state, descriptors, emitter, navigateToTab, insets }: BottomTabBarProps) {
  const [width, setWidth] = useState(0);
  const position = useSharedValue(state.index);
  const itemWidth = width > 0 ? (width - PADDING * 2) / state.routes.length : 0;

  useEffect(() => {
    position.set(withSpring(state.index, SPRING));
  }, [position, state.index]);

  const indicatorStyle = useAnimatedStyle(() => ({
    width: itemWidth,
    transform: [{ translateX: position.get() * itemWidth }],
  }));

  if (HIDDEN_ON.has(state.routes[state.index]?.name ?? '')) {
    return null;
  }

  const onLayout = (event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width);

  return (
    <View
      pointerEvents="box-none"
      style={[styles.wrapper, { bottom: insets.bottom + TAB_BAR_GAP }]}>
      <View style={styles.bar} onLayout={onLayout} role="tablist">
        {itemWidth > 0 ? <Animated.View style={[styles.indicator, indicatorStyle]} /> : null}

        {state.routes.map((route, index) => {
          const focused = index === state.index;
          const { options } = descriptors[route.key];
          const label = options.title ?? route.name;
          const icons = ICONS[route.name] ?? { active: 'ellipse', idle: 'ellipse-outline' };

          const onPress = () => {
            const event = emitter.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
            if (!focused && !event.defaultPrevented) {
              Haptics.selectionAsync().catch(() => undefined);
              navigateToTab(route.key);
            }
          };

          return (
            <Pressable
              key={route.key}
              role="tab"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={label}
              onPress={onPress}
              onLongPress={() => emitter.emit({ type: 'tabLongPress', target: route.key })}
              style={styles.item}>
              <Ionicons
                name={focused ? icons.active : icons.idle}
                size={21}
                color={focused ? colors.cream : colors.textMuted}
              />
              <AppText variant="tiny" color={focused ? colors.cream : colors.textMuted}>
                {label}
              </AppText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    left: spacing.xl,
    right: spacing.xl,
  },
  bar: {
    height: TAB_BAR_HEIGHT,
    flexDirection: 'row',
    padding: PADDING,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderStrong,
    ...shadows.soft,
  },
  indicator: {
    position: 'absolute',
    top: PADDING,
    bottom: PADDING,
    left: PADDING,
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceRaised,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  item: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    borderRadius: radii.pill,
  },
});
