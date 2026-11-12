import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import {
  launchCameraAsync,
  launchImageLibraryAsync,
  requestCameraPermissionsAsync,
} from 'expo-image-picker';
import { useEffect, useRef, useState, type ComponentProps } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MAX_VOICE_MS, useVoiceRecorder } from '@/components/chat/useVoiceRecorder';
import { AppText } from '@/components/ui/AppText';
import { durationLabel } from '@/lib/format';
import { useChatActions } from '@/state/chat';
import { colors, fonts, radii, spacing } from '@/theme';

const TYPING_EVERY_MS = 3000;
const TYPING_IDLE_MS = 4000;

type IconName = ComponentProps<typeof Ionicons>['name'];

function Action({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} hitSlop={6} style={styles.action} accessibilityRole="button" accessibilityLabel={label}>
      <Ionicons name={icon} size={22} color={colors.peach} />
    </Pressable>
  );
}

/** Text, photos, camera, voice notes and a quick heart, as in the mockups. */
export function Composer() {
  const insets = useSafeAreaInsets();
  const { sendText, sendMedia, setTyping } = useChatActions();
  const voice = useVoiceRecorder();
  const [text, setText] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const typing = useRef<{ lastSent: number; idle?: ReturnType<typeof setTimeout> }>({ lastSent: 0 });

  const stopTyping = () => {
    clearTimeout(typing.current.idle);
    if (typing.current.lastSent > 0) setTyping(false);
    typing.current.lastSent = 0;
  };

  const onChange = (value: string) => {
    setText(value);
    const now = Date.now();
    if (value.trim() && now - typing.current.lastSent > TYPING_EVERY_MS) {
      setTyping(true);
      typing.current.lastSent = now;
    }
    clearTimeout(typing.current.idle);
    typing.current.idle = setTimeout(stopTyping, TYPING_IDLE_MS);
  };

  const submit = () => {
    const body = text.trim();
    if (!body) return;
    sendText(body);
    setText('');
    stopTyping();
  };

  const pick = async (camera: boolean) => {
    setNotice(null);
    if (camera) {
      const permission = await requestCameraPermissionsAsync();
      if (!permission.granted) {
        setNotice("L'appareil photo n'est pas autorisé pour usss.");
        return;
      }
    }
    const options = { mediaTypes: ['images' as const], quality: 0.75 };
    const result = camera ? await launchCameraAsync(options) : await launchImageLibraryAsync(options);
    const asset = result.canceled ? null : result.assets[0];
    if (asset) sendMedia('image', asset.uri, asset.mimeType ?? 'image/jpeg');
  };

  const startVoice = async () => {
    setNotice(null);
    const started = await voice.start().catch(() => false);
    if (started) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
    else setNotice("Le micro n'est pas autorisé pour usss.");
  };

  const finishVoice = async (send: boolean) => {
    const recording = await voice.stop().catch(() => null);
    if (send && recording) sendMedia('voice', recording.uri, 'audio/mp4', recording.durationMs);
  };

  // Long notes are sent automatically when they reach the limit.
  const tooLong = voice.recording && voice.elapsed >= MAX_VOICE_MS;
  useEffect(() => {
    if (tooLong) void finishVoice(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only react to the limit being reached
  }, [tooLong]);

  const canSend = text.trim().length > 0;

  return (
    <View style={[styles.wrap, { paddingBottom: insets.bottom + spacing.sm }]}>
      <View style={styles.box}>
        {voice.recording ? (
          <View style={styles.recordRow}>
            <Pressable
              onPress={() => finishVoice(false)}
              style={styles.action}
              accessibilityRole="button"
              accessibilityLabel="Annuler le vocal">
              <Ionicons name="trash-outline" size={22} color={colors.textSecondary} />
            </Pressable>
            <View style={styles.recDot} />
            <AppText variant="label">{durationLabel(voice.elapsed)}</AppText>
            <View style={styles.levels}>
              {voice.levels.map((level, index) => (
                <View key={index} style={[styles.level, { height: 4 + level * 24 }]} />
              ))}
            </View>
            <Pressable
              onPress={() => finishVoice(true)}
              style={styles.sendVoice}
              accessibilityRole="button"
              accessibilityLabel="Envoyer le vocal">
              <Ionicons name="arrow-up" size={20} color={colors.textOnCream} />
            </Pressable>
          </View>
        ) : (
          <>
            <TextInput
              value={text}
              onChangeText={onChange}
              placeholder="Écris-lui quelque chose…"
              placeholderTextColor={colors.textMuted}
              selectionColor={colors.peach}
              multiline
              maxLength={4000}
              style={styles.input}
            />
            <View style={styles.actions}>
              <Action icon="image-outline" label="Envoyer une photo" onPress={() => pick(false)} />
              <Action icon="camera-outline" label="Prendre une photo" onPress={() => pick(true)} />
              <Action icon="mic-outline" label="Enregistrer un vocal" onPress={startVoice} />
              <Action icon="heart-outline" label="Envoyer un cœur" onPress={() => sendText('❤️')} />
              <View style={styles.spacer} />
              <Pressable
                onPress={submit}
                disabled={!canSend}
                style={[styles.send, !canSend && styles.sendOff]}
                accessibilityRole="button"
                accessibilityLabel="Envoyer">
                <AppText variant="logo" color={colors.textOnCream} style={styles.sendText}>
                  usss
                </AppText>
                <Ionicons name="heart" size={8} color={colors.rose} style={styles.sendHeart} />
              </Pressable>
            </View>
          </>
        )}
      </View>
      {notice ? (
        <AppText variant="caption" color={colors.textMuted} align="center">
          {notice}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    gap: spacing.xs,
    backgroundColor: colors.background,
  },
  box: {
    borderRadius: radii.xl,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderStrong,
    padding: spacing.sm,
    gap: spacing.xs,
  },
  input: {
    minHeight: 44,
    maxHeight: 130,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    color: colors.text,
    fontFamily: fonts.body,
    fontSize: 15,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  action: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  spacer: {
    flex: 1,
  },
  send: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 42,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.pill,
    backgroundColor: colors.cream,
    justifyContent: 'center',
  },
  sendOff: {
    opacity: 0.45,
  },
  sendText: {
    fontSize: 19,
    lineHeight: 34,
  },
  sendHeart: {
    marginLeft: 1,
    marginBottom: 12,
  },
  recordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 52,
  },
  recDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.heart,
  },
  levels: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    height: 30,
  },
  level: {
    flex: 1,
    borderRadius: 2,
    backgroundColor: colors.peach,
  },
  sendVoice: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.cream,
  },
});
