import type { Session, User } from '@supabase/supabase-js';
import { createContext, useContext, useEffect, useState, type PropsWithChildren } from 'react';

import { isGoogleConfigured } from '@/lib/env';
import { getGoogleIdToken, signOutFromGoogle } from '@/lib/google-auth';
import { requireSupabase, supabase } from '@/lib/supabase';

export type Me = {
  id: string;
  email: string | null;
  displayName: string;
  avatarUrl: string | null;
};

type SessionStatus = 'loading' | 'signed-out' | 'signed-in';

type SessionValue = {
  status: SessionStatus;
  /** `demo` runs on local sample data when the build has no Supabase configuration. */
  mode: 'live' | 'demo';
  me: Me | null;
  session: Session | null;
  canUseGoogle: boolean;
  signInWithGoogle: () => Promise<void>;
  enterDemo: () => void;
  signOut: () => Promise<void>;
};

const DEMO_ME: Me = { id: 'demo-me', email: null, displayName: 'Thomas', avatarUrl: null };

const SessionContext = createContext<SessionValue | null>(null);

function meFromUser(user: User): Me {
  const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
  const text = (value: unknown) => (typeof value === 'string' && value.trim() ? value.trim() : null);
  return {
    id: user.id,
    email: user.email ?? null,
    displayName: text(meta.full_name) ?? text(meta.name) ?? user.email?.split('@')[0] ?? 'Moi',
    avatarUrl: text(meta.avatar_url) ?? text(meta.picture),
  };
}

export function SessionProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const [restoring, setRestoring] = useState(supabase !== null);
  const [demo, setDemo] = useState(false);

  useEffect(() => {
    if (!supabase) return;
    let active = true;

    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (active) setSession(data.session);
      })
      .finally(() => {
        if (active) setRestoring(false);
      });

    const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  const signInWithGoogle = async () => {
    const client = requireSupabase();
    const idToken = await getGoogleIdToken();
    const { error } = await client.auth.signInWithIdToken({ provider: 'google', token: idToken });
    if (error) throw error;
  };

  const signOut = async () => {
    if (demo) {
      setDemo(false);
      return;
    }
    // "local" removes this device's session before calling the server, so
    // signing out also works offline (the server-side revocation is best effort).
    await supabase?.auth.signOut({ scope: 'local' });
    await signOutFromGoogle();
  };

  let status: SessionStatus = 'signed-out';
  if (restoring) status = 'loading';
  else if (demo || session) status = 'signed-in';

  const value: SessionValue = {
    status,
    mode: demo ? 'demo' : 'live',
    me: demo ? DEMO_ME : session ? meFromUser(session.user) : null,
    session: demo ? null : session,
    canUseGoogle: isGoogleConfigured,
    signInWithGoogle,
    enterDemo: () => setDemo(true),
    signOut,
  };

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionValue {
  const value = useContext(SessionContext);
  if (!value) throw new Error('useSession must be used inside <SessionProvider>');
  return value;
}
