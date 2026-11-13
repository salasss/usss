import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { AppState } from 'react-native';

import { getPushToken, isMessageNotification, rememberDevice } from '@/lib/notifications';
import { useSource } from '@/state/data';

/**
 * Notifications of the bubble, mounted with the tabs (the couple is complete):
 * registers this phone with the backend in live mode, and opens the chat
 * when a message notification is tapped, including the one that launched
 * the app.
 */
export function PushSync() {
  const source = useSource();
  const router = useRouter();

  useEffect(() => {
    if (source.mode !== 'live') return;
    let active = true;
    // Registered, or notifications refused: nothing left to do.
    let settled = false;
    let running = false;

    const register = async (token: string) => {
      await source.registerDevice(token);
      rememberDevice(token, (registered) => source.unregisterDevice(registered));
    };

    const setUp = async () => {
      if (running || settled) return;
      running = true;
      try {
        const token = await getPushToken();
        if (!active) return;
        if (token) await register(token);
        settled = true;
      } catch (error) {
        // No Firebase file in this build, server asleep, no network...
        if (__DEV__) console.warn('push registration failed', error);
      } finally {
        running = false;
      }
    };
    void setUp();

    // A failed registration is tried again when the app comes back to the front.
    const appState = AppState.addEventListener('change', (state) => {
      if (state === 'active') void setUp();
    });
    // FCM may replace the token: the backend must know the new one.
    const tokenChange = Notifications.addPushTokenListener(({ data }) => {
      if (active && typeof data === 'string') register(data).catch(() => undefined);
    });

    return () => {
      active = false;
      appState.remove();
      tokenChange.remove();
    };
  }, [source]);

  useEffect(() => {
    const open = (response: Notifications.NotificationResponse | null) => {
      if (response?.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) return;
      if (!isMessageNotification(response.notification.request.content.data)) return;
      // Handled once: coming back to the tabs later must not reopen the chat.
      Notifications.clearLastNotificationResponse();
      router.navigate('/bulle');
    };

    // The notification that launched the app, then those tapped while it runs.
    open(Notifications.getLastNotificationResponse());
    const subscription = Notifications.addNotificationResponseReceivedListener(open);
    return () => subscription.remove();
  }, [router]);

  return null;
}
