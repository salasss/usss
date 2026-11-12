import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { colors, gradients } from '@/theme';

type AvatarProps = {
  name: string;
  uri?: string | null;
  size?: number;
  /** Shows a presence dot when defined. */
  online?: boolean;
  ring?: string;
};

/** "Léa Martin" → "LM", "Léa" → "L". */
function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  const letters = parts.length > 1 ? parts[0][0] + parts[parts.length - 1][0] : parts[0][0];
  return letters.toUpperCase();
}

export function Avatar({ name, uri, size = 56, online, ring = colors.peach }: AvatarProps) {
  const inner = size - 6;
  const dot = Math.max(10, Math.round(size * 0.24));

  return (
    <View style={{ width: size, height: size }} accessibilityLabel={name}>
      <View style={[styles.ring, { width: size, height: size, borderRadius: size / 2, borderColor: ring }]}>
        {uri ? (
          <Image
            source={{ uri }}
            style={{ width: inner, height: inner, borderRadius: inner / 2 }}
            contentFit="cover"
            transition={200}
          />
        ) : (
          <LinearGradient
            colors={gradients.warm}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.fallback, { width: inner, height: inner, borderRadius: inner / 2 }]}>
            <AppText variant="heading" color={colors.textOnAccent} style={{ fontSize: inner * 0.36 }}>
              {initials(name)}
            </AppText>
          </LinearGradient>
        )}
      </View>
      {online !== undefined ? (
        <View
          style={[
            styles.dot,
            {
              width: dot,
              height: dot,
              borderRadius: dot / 2,
              backgroundColor: online ? colors.online : colors.textMuted,
            },
          ]}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  ring: {
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    borderWidth: 2,
    borderColor: colors.background,
  },
});
