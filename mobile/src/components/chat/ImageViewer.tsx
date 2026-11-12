import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { Message } from '@/data/types';
import { useBubble } from '@/state/bubble';
import { colors, spacing } from '@/theme';

/** Full-screen view of a photo from the conversation. */
export function ImageViewer({ message, onClose }: { message: Message | null; onClose: () => void }) {
  const { data } = useBubble();
  const insets = useSafeAreaInsets();
  const [resolved, setResolved] = useState<{ id: string; url: string | null } | null>(null);

  useEffect(() => {
    if (!message) return;
    let active = true;
    const pending = message.mediaPath ? data.mediaUrl(message.mediaPath) : Promise.resolve(message.localUri ?? null);
    pending
      .then((url) => active && setResolved({ id: message.id, url }))
      .catch(() => active && setResolved({ id: message.id, url: null }));
    return () => {
      active = false;
    };
  }, [data, message]);

  const url = message && resolved?.id === message.id ? resolved.url : (message?.localUri ?? null);

  return (
    <Modal visible={message !== null} transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <View style={styles.root}>
        {url ? <Image source={{ uri: url }} style={StyleSheet.absoluteFill} contentFit="contain" /> : null}
        <Pressable
          onPress={onClose}
          style={[styles.close, { top: insets.top + spacing.md }]}
          accessibilityRole="button"
          accessibilityLabel="Fermer">
          <Ionicons name="close" size={24} color={colors.cream} />
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#000',
  },
  close: {
    position: 'absolute',
    right: spacing.lg,
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
});
