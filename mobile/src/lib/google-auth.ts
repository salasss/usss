import {
  GoogleSignin,
  isErrorWithCode,
  isSuccessResponse,
  statusCodes,
} from '@react-native-google-signin/google-signin';

import { env } from '@/lib/env';

export class SignInCancelledError extends Error {
  constructor() {
    super('Google sign-in cancelled');
  }
}

let configured = false;

function ensureConfigured() {
  if (configured) return;
  GoogleSignin.configure({
    // The ID token audience must be the Web client ID registered in Supabase.
    webClientId: env.googleWebClientId ?? undefined,
    scopes: ['profile', 'email'],
  });
  configured = true;
}

/** Opens the native Google account picker and returns the Google ID token. */
export async function getGoogleIdToken(): Promise<string> {
  ensureConfigured();
  await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });

  const response = await GoogleSignin.signIn();
  if (!isSuccessResponse(response)) {
    throw new SignInCancelledError();
  }

  const { idToken } = response.data;
  if (!idToken) {
    throw new Error('Google returned no ID token: check EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID.');
  }
  return idToken;
}

export async function signOutFromGoogle() {
  try {
    ensureConfigured();
    await GoogleSignin.signOut();
  } catch {
    // Already signed out on the Google side: nothing to do.
  }
}

/** French, user-facing message for a sign-in failure, or `null` when the user simply cancelled. */
export function describeSignInError(error: unknown): string | null {
  if (error instanceof SignInCancelledError) return null;

  if (isErrorWithCode(error)) {
    switch (error.code) {
      case statusCodes.SIGN_IN_CANCELLED:
        return null;
      case statusCodes.IN_PROGRESS:
        return 'Une connexion est déjà en cours…';
      case statusCodes.PLAY_SERVICES_NOT_AVAILABLE:
        return 'Les services Google Play sont indisponibles sur ce téléphone.';
      case '10':
      case 'DEVELOPER_ERROR':
        return "Google refuse cette version de l'app : vérifie l'empreinte SHA-1 et le client OAuth Android.";
    }
  }

  return 'Connexion impossible pour le moment. Réessaie dans un instant.';
}
