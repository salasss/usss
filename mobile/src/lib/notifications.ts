import * as Notifications from 'expo-notifications';
import { AndroidImportance } from 'expo-notifications';
import { AppState, Platform } from 'react-native';

/** Android channel of chat messages: the backend sends `channel_id: "messages"`. */
export const MESSAGES_CHANNEL = 'messages';

/** Waiting longer than this for the backend at sign-out is not worth it. */
const FORGET_TIMEOUT_MS = 3000;

/** Chat notifications carry `{ type: "message", couple_id }` as data. */
export function isMessageNotification(data: unknown): boolean {
  return typeof data === 'object' && data !== null && (data as Record<string, unknown>).type === 'message';
}

let chatOnScreen = false;

/** Told by the chat screen: while it is visible, a message notification is redundant. */
export function setChatOnScreen(visible: boolean) {
  chatOnScreen = visible;
}

/**
 * What a notification received while the app is open does: it shows, unless
 * it is a message and the chat is on screen (the message is already there).
 * In the background, Android shows notifications without asking the app.
 */
export function setUpNotifications() {
  Notifications.setNotificationHandler({
    handleNotification: async (notification) => {
      const redundant =
        chatOnScreen &&
        AppState.currentState === 'active' &&
        isMessageNotification(notification.request.content.data);
      return {
        shouldShowBanner: !redundant,
        shouldShowList: !redundant,
        shouldPlaySound: !redundant,
        shouldSetBadge: false,
      };
    },
  });
}

/**
 * Prepares this phone for chat notifications and returns its FCM token, or
 * null when notifications are refused. Throws when Firebase is not set up
 * in this build (no google-services.json) or Google Play services fail.
 */
export async function getPushToken(): Promise<string | null> {
  if (Platform.OS !== 'android') return null;

  // Android 13+ only asks for the permission once a channel exists.
  await Notifications.setNotificationChannelAsync(MESSAGES_CHANNEL, {
    name: 'Messages',
    description: 'Les messages de ta moitié dans votre bulle',
    importance: AndroidImportance.HIGH,
  });

  const current = await Notifications.getPermissionsAsync();
  const granted =
    current.granted || (current.canAskAgain && (await Notifications.requestPermissionsAsync()).granted);
  if (!granted) return null;

  const { data } = await Notifications.getDevicePushTokenAsync();
  return typeof data === 'string' && data ? data : null;
}

type Registration = { token: string; unregister: (token: string) => Promise<void> };

let registration: Registration | null = null;

/** Remembers the token given to the backend, to remove it at sign-out. */
export function rememberDevice(token: string, unregister: (token: string) => Promise<void>) {
  registration = { token, unregister };
}

/**
 * Stops this phone's notifications for the account signing out. Best effort
 * and bounded in time: a sleeping or unreachable server never holds up the
 * sign-out.
 */
export async function forgetDevice(): Promise<void> {
  const current = registration;
  registration = null;
  // What was received for this account should not stay in the shade.
  Notifications.dismissAllNotificationsAsync().catch(() => undefined);
  if (!current) return;

  let timer: ReturnType<typeof setTimeout> | undefined;
  await Promise.race([
    current.unregister(current.token).catch(() => undefined),
    new Promise<void>((resolve) => {
      timer = setTimeout(resolve, FORGET_TIMEOUT_MS);
    }),
  ]);
  clearTimeout(timer);
}
