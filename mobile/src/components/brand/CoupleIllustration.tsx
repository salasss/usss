import { useEffect } from 'react';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, Ellipse, LinearGradient, Path, Stop } from 'react-native-svg';

const HEART =
  'M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z';

/** Two soft characters hugging, gently floating. */
export function CoupleIllustration({ width = 300 }: { width?: number }) {
  const float = useSharedValue(0);

  useEffect(() => {
    float.set(withRepeat(withTiming(1, { duration: 2600, easing: Easing.inOut(Easing.sin) }), -1, true));
  }, [float]);

  const floating = useAnimatedStyle(() => ({
    transform: [{ translateY: -8 * float.get() }, { rotate: `${-1.2 + 2.4 * float.get()}deg` }],
  }));

  return (
    <Animated.View style={floating} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Svg width={width} height={(width * 240) / 320} viewBox="0 0 320 240">
        <Defs>
          <LinearGradient id="pink" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor="#F8BFCB" />
            <Stop offset="1" stopColor="#E77D97" />
          </LinearGradient>
          <LinearGradient id="peach" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor="#FCD3B3" />
            <Stop offset="1" stopColor="#F09A7C" />
          </LinearGradient>
        </Defs>

        {/* him, behind */}
        <Circle cx={204} cy={132} r={88} fill="url(#peach)" />
        <Circle cx={200} cy={92} r={40} fill="#FDDDC6" />
        <Path
          d="M160 92 C 160 52, 232 44, 240 86 C 226 70, 196 66, 178 78 C 172 82, 166 87, 160 92 Z"
          fill="#5A2E2B"
        />
        <Path d="M206 100 q 7 6 14 0" stroke="#5A2E2B" strokeWidth={3.2} fill="none" strokeLinecap="round" />
        <Circle cx={224} cy={112} r={6} fill="#EE7C93" opacity={0.45} />

        {/* her, in front */}
        <Circle cx={116} cy={146} r={86} fill="url(#pink)" />
        <Circle cx={122} cy={106} r={38} fill="#FBD3DA" />
        <Path
          d="M84 120 C 70 70, 120 50, 156 82 C 160 86, 162 92, 160 98 C 146 80, 116 76, 98 92 C 92 100, 88 110, 84 120 Z"
          fill="#4A2526"
        />
        <Path d="M134 112 q 7 6 14 0" stroke="#4A2526" strokeWidth={3.2} fill="none" strokeLinecap="round" />
        <Circle cx={148} cy={124} r={6} fill="#EE7C93" opacity={0.5} />

        {/* his arm around her, her hand on his chest */}
        <Path
          d="M232 168 C 214 196, 168 204, 136 192"
          stroke="#F3A385"
          strokeWidth={20}
          fill="none"
          strokeLinecap="round"
        />
        <Ellipse cx={176} cy={156} rx={14} ry={11} fill="#F6AFC0" />

        <Path d={HEART} fill="#EE7C93" transform="translate(152 22) scale(0.9)" />
      </Svg>
    </Animated.View>
  );
}
