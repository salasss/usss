import { createContext, useContext, useMemo, type PropsWithChildren } from 'react';

import { createDemoSource } from '@/data/demo';
import { createLiveSource } from '@/data/live';
import type { DataSource } from '@/data/source';
import { useSession } from '@/state/session';

const DataContext = createContext<DataSource | null>(null);

/** Provides the data source of the signed-in person (live or demo). */
export function DataProvider({ children }: PropsWithChildren) {
  const { status, mode, me } = useSession();
  // Primitive dependencies: a token refresh must not recreate the source.
  const id = me?.id ?? null;
  const displayName = me?.displayName ?? '';
  const avatarUrl = me?.avatarUrl ?? null;
  const email = me?.email ?? null;

  const source = useMemo(() => {
    if (status !== 'signed-in' || !id) return null;
    const who = { id, displayName, avatarUrl, email };
    return mode === 'demo' ? createDemoSource(who) : createLiveSource(who);
  }, [status, mode, id, displayName, avatarUrl, email]);

  return <DataContext.Provider value={source}>{children}</DataContext.Provider>;
}

export function useOptionalSource(): DataSource | null {
  return useContext(DataContext);
}

export function useSource(): DataSource {
  const source = useContext(DataContext);
  if (!source) throw new Error('useSource needs a signed-in session');
  return source;
}
