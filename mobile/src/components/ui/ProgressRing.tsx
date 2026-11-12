import { useId, type PropsWithChildren } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';

import { colors, gradients } from '@/theme';

type ProgressRingProps = PropsWithChildren<{
  size?: number;
  stroke?: number;
  /** 0 to 1. */
  progress: number;
}>;

/** Circular gauge with the peach → rose → lilac gradient of the mockups. */
export function ProgressRing({ size = 96, stroke = 9, progress, children }: ProgressRingProps) {
  const gradientId = `ring${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.min(1, Math.max(0, progress));
  const center = size / 2;

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
            {gradients.sunset.map((color, index) => (
              <Stop key={color} offset={index / (gradients.sunset.length - 1)} stopColor={color} />
            ))}
          </LinearGradient>
        </Defs>
        <Circle cx={center} cy={center} r={radius} stroke={colors.surfaceSunken} strokeWidth={stroke} fill="none" />
        <Circle
          cx={center}
          cy={center}
          r={radius}
          stroke={`url(#${gradientId})`}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={circumference * (1 - clamped)}
          transform={`rotate(-90 ${center} ${center})`}
        />
      </Svg>
      <View style={styles.content}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
