import Ionicons from '@expo/vector-icons/Ionicons';
import { useIsFocused } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, KeyboardAvoidingView, StyleSheet, View } from 'react-native';

import { ChatHeader } from '@/components/chat/ChatHeader';
import { Composer } from '@/components/chat/Composer';
import { ImageViewer } from '@/components/chat/ImageViewer';
import { MessageBubble } from '@/components/chat/MessageBubble';
import { ReactionPicker } from '@/components/chat/ReactionPicker';
import { TypingBubble } from '@/components/chat/TypingBubble';
import { VoicePlayerProvider } from '@/components/chat/VoicePlayer';
import { AppText } from '@/components/ui/AppText';
import type { Message } from '@/data/types';
import { useNow } from '@/hooks/use-now';
import { dayLabel, sameDay } from '@/lib/format';
import { setChatOnScreen } from '@/lib/notifications';
import { useChatActions, useChatStore, useUnreadCount } from '@/state/chat';
import { useCouple } from '@/state/couple';
import { useSource } from '@/state/data';
import { colors, radii, spacing } from '@/theme';

type Item =
  | { key: string; kind: 'message'; message: Message }
  | { key: string; kind: 'day'; label: string };

/** Messages newest first, with a day label above the first message of each day. */
function buildItems(messages: Message[], now: number): Item[] {
  const items: Item[] = [];
  messages.forEach((message, index) => {
    items.push({ key: message.id, kind: 'message', message });
    const older = messages[index + 1];
    if (!older || !sameDay(older.createdAt, message.createdAt)) {
      items.push({ key: `day-${message.createdAt}`, kind: 'day', label: dayLabel(message.createdAt, now) });
    }
  });
  return items;
}

export default function BubbleScreen() {
  const me = useSource().me.id;
  const { partner } = useCouple();
  const messages = useChatStore((state) => state.messages);
  const typing = useChatStore((state) => state.partnerTyping);
  const loading = useChatStore((state) => state.loading);
  const unread = useUnreadCount(me);
  const { react, retry, markRead, loadMore } = useChatActions();
  const focused = useIsFocused();
  const now = useNow();
  const [reactingTo, setReactingTo] = useState<Message | null>(null);
  const [viewing, setViewing] = useState<Message | null>(null);

  useEffect(() => {
    if (focused && unread > 0) markRead();
  }, [focused, unread, markRead]);

  // Message notifications are useless while the conversation is on screen.
  useEffect(() => {
    setChatOnScreen(focused);
    return () => setChatOnScreen(false);
  }, [focused]);

  const items = useMemo(() => buildItems(messages, now), [messages, now]);
  const lastMine = messages.find((m) => m.senderId === me && m.status === 'sent');

  return (
    <View style={styles.root}>
      <ChatHeader />
      <KeyboardAvoidingView behavior="padding" style={styles.flex}>
        <VoicePlayerProvider>
          <View style={styles.flex}>
            <FlatList
              inverted
              data={items}
              keyExtractor={(item) => item.key}
              renderItem={({ item }) =>
                item.kind === 'day' ? (
                  <View style={styles.day}>
                    <AppText variant="tiny" color={colors.textSecondary} style={styles.dayText}>
                      {item.label}
                    </AppText>
                  </View>
                ) : (
                  <MessageBubble
                    message={item.message}
                    mine={item.message.senderId === me}
                    seen={item.message.id === lastMine?.id && Boolean(lastMine?.readAt)}
                    onLongPress={setReactingTo}
                    onRetry={retry}
                    onOpenImage={setViewing}
                  />
                )
              }
              ListHeaderComponent={typing ? <TypingBubble /> : undefined}
              ListFooterComponent={
                loading ? <ActivityIndicator color={colors.peach} style={styles.loader} /> : undefined
              }
              onEndReached={loadMore}
              onEndReachedThreshold={0.4}
              contentContainerStyle={styles.list}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="interactive"
            />
            {!loading && messages.length === 0 ? (
              <View style={styles.empty} pointerEvents="none">
                <Ionicons name="chatbubbles-outline" size={34} color={colors.peach} />
                <AppText variant="heading" align="center">
                  Votre bulle est prête
                </AppText>
                <AppText color={colors.textSecondary} align="center">
                  Écris le premier mot à {partner?.displayName.split(' ')[0] ?? 'ta moitié'} 💌
                </AppText>
              </View>
            ) : null}
          </View>
        </VoicePlayerProvider>
        <Composer />
      </KeyboardAvoidingView>

      <ReactionPicker
        visible={reactingTo !== null}
        current={reactingTo?.reactions[me]}
        onClose={() => setReactingTo(null)}
        onPick={(emoji) => {
          if (reactingTo) react(reactingTo, emoji);
          setReactingTo(null);
        }}
      />
      <ImageViewer message={viewing} onClose={() => setViewing(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  flex: {
    flex: 1,
  },
  list: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  day: {
    alignItems: 'center',
    marginVertical: spacing.md,
  },
  dayText: {
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  loader: {
    marginVertical: spacing.lg,
  },
  empty: {
    position: 'absolute',
    left: spacing.xxl,
    right: spacing.xxl,
    top: '30%',
    alignItems: 'center',
    gap: spacing.sm,
  },
});
