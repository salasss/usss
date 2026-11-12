import { DarkTheme, Stack, ThemeProvider, type Theme } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { CoupleProvider, useCouple } from '@/state/couple';
import { DataProvider } from '@/state/data';
import { SessionProvider, useSession } from '@/state/session';
import { colors } from '@/theme';

// Keep the splash screen until the session and the couple are known.
SplashScreen.preventAutoHideAsync().catch(() => undefined);
SplashScreen.setOptions({ duration: 300, fade: true });

const navigationTheme: Theme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: colors.peach,
    background: colors.background,
    card: colors.background,
    text: colors.text,
    border: colors.border,
    notification: colors.rose,
  },
};

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={styles.root}>
      <SessionProvider>
        <DataProvider>
          <CoupleProvider>
            <ThemeProvider value={navigationTheme}>
              <StatusBar style="light" />
              <RootNavigator />
            </ThemeProvider>
          </CoupleProvider>
        </DataProvider>
      </SessionProvider>
    </GestureHandlerRootView>
  );
}

function RootNavigator() {
  const { status } = useSession();
  const couple = useCouple();
  const signedIn = status === 'signed-in';
  const paired = couple.status === 'paired';
  const coupleKnown = couple.status !== 'idle' && couple.status !== 'loading';
  const ready = status !== 'loading' && (!signedIn || coupleKnown);

  useEffect(() => {
    if (ready) SplashScreen.hide();
  }, [ready]);

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'fade',
        contentStyle: { backgroundColor: colors.background },
      }}>
      <Stack.Protected guard={signedIn && paired}>
        <Stack.Screen name="(tabs)" />
      </Stack.Protected>
      <Stack.Protected guard={signedIn && !paired}>
        <Stack.Screen name="pairing" />
      </Stack.Protected>
      <Stack.Protected guard={!signedIn}>
        <Stack.Screen name="sign-in" />
      </Stack.Protected>
    </Stack>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
});
