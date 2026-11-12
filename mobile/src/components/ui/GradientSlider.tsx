import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useMemo, useState } from 'react';
import { PanResponder, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { colors, radii, spacing } from '@/theme';

type GradientSliderProps = {
  label: string;
  /** 0 to 100. */
  value: number;
  gradient: readonly [string, string, ...string[]];
  /** Called once the finger is lifted. */
  onCommit: (value: number) => void;
};

const TRACK = 10;
const THUMB = 22;

const clamp = (value: number) => Math.min(100, Math.max(0, value));

export function GradientSlider({ label, value, gradient, onCommit }: GradientSliderProps) {
  const [width, setWidth] = useState(0);
  const [dragged, setDragged] = useState<number | null>(null);
  const shown = dragged ?? value;

  const responder = useMemo(() => {
    // The track's children ignore touches, so locationX stays relative to the
    // track for the whole gesture (and is clamped when the finger leaves it).
    const toValue = (x: number) => (width > 0 ? clamp(Math.round((x / width) * 100)) : 0);
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      // Keep the gesture when the finger drifts vertically inside a ScrollView.
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (event) => setDragged(toValue(event.nativeEvent.locationX)),
      onPanResponderMove: (event) => setDragged(toValue(event.nativeEvent.locationX)),
      onPanResponderRelease: (event) => {
        const next = toValue(event.nativeEvent.locationX);
        setDragged(null);
        Haptics.selectionAsync().catch(() => undefined);
        onCommit(next);
      },
      onPanResponderTerminate: () => setDragged(null),
    });
  }, [width, onCommit]);

  const fill = (shown / 100) * width;

  return (
    <View style={styles.root}>
      <View style={styles.labels}>
        <AppText variant="caption" color={colors.textSecondary}>
          {label}
        </AppText>
        <AppText variant="tiny" color={colors.textMuted}>
          {shown}
        </AppText>
      </View>
      <View
        style={styles.hitArea}
        onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
        accessibilityRole="adjustable"
        accessibilityLabel={label}
        accessibilityValue={{ min: 0, max: 100, now: shown }}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={(event) =>
          onCommit(clamp(value + (event.nativeEvent.actionName === 'increment' ? 10 : -10)))
        }
        {...responder.panHandlers}>
        <View style={styles.track} pointerEvents="none">
          <LinearGradient
            colors={gradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={[styles.fill, { width: Math.max(TRACK, fill) }]}
          />
        </View>
        <View
          pointerEvents="none"
          style={[styles.thumb, { transform: [{ translateX: Math.min(Math.max(fill - THUMB / 2, 0), Math.max(width - THUMB, 0)) }] }]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: spacing.xs,
  },
  labels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  hitArea: {
    height: THUMB + 8,
    justifyContent: 'center',
  },
  track: {
    height: TRACK,
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceSunken,
    overflow: 'hidden',
  },
  fill: {
    height: TRACK,
    borderRadius: radii.pill,
  },
  thumb: {
    position: 'absolute',
    left: 0,
    width: THUMB,
    height: THUMB,
    borderRadius: THUMB / 2,
    backgroundColor: colors.cream,
    borderWidth: 3,
    borderColor: colors.surface,
    elevation: 4,
  },
});
