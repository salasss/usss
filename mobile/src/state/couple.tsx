import { createContext, useContext, useEffect, useState, type PropsWithChildren } from 'react';
import { AppState } from 'react-native';

import { describeApiError } from '@/data/api';
import type { Couple, Member } from '@/data/types';
import { useOptionalSource } from '@/state/data';

/** `waiting`: the couple exists but the partner has not joined yet. */
export type CoupleStatus = 'idle' | 'loading' | 'error' | 'single' | 'waiting' | 'paired';

type CoupleValue = {
  status: CoupleStatus;
  couple: Couple | null;
  partner: Member | null;
  error: string | null;
  refresh: () => Promise<void>;
  create: () => Promise<void>;
  join: (code: string) => Promise<void>;
  renewInvite: () => Promise<void>;
};

type State = { status: CoupleStatus; couple: Couple | null; error: string | null };

const POLL_WHILE_WAITING_MS = 4000;

function stateOf(couple: Couple | null): State {
  if (!couple) return { status: 'single', couple: null, error: null };
  return { status: couple.complete ? 'paired' : 'waiting', couple, error: null };
}

const CoupleContext = createContext<CoupleValue | null>(null);

export function CoupleProvider({ children }: PropsWithChildren) {
  const source = useOptionalSource();
  const [state, setState] = useState<State>({ status: 'idle', couple: null, error: null });

  useEffect(() => {
    if (!source) {
      setState({ status: 'idle', couple: null, error: null });
      return;
    }
    let active = true;
    setState({ status: 'loading', couple: null, error: null });
    source
      .getCouple()
      .then((couple) => active && setState(stateOf(couple)))
      .catch((error) => active && setState({ status: 'error', couple: null, error: describeApiError(error) }));
    return () => {
      active = false;
    };
  }, [source]);

  // While waiting for the partner, check regularly whether they joined.
  useEffect(() => {
    if (!source || state.status !== 'waiting') return;
    const timer = setInterval(() => {
      if (AppState.currentState !== 'active') return;
      source
        .getCouple()
        .then((couple) => setState(stateOf(couple)))
        .catch(() => undefined);
    }, POLL_WHILE_WAITING_MS);
    return () => clearInterval(timer);
  }, [source, state.status]);

  const run = async (action: () => Promise<Couple | null>) => {
    try {
      setState(stateOf(await action()));
    } catch (error) {
      // Keep the screen as it is and let the caller show the message.
      throw new Error(describeApiError(error));
    }
  };

  const requireSource = () => {
    if (!source) throw new Error('Connecte-toi pour continuer.');
    return source;
  };

  const partner =
    state.couple && source ? (state.couple.members.find((m) => m.userId !== source.me.id) ?? null) : null;

  const value: CoupleValue = {
    ...state,
    partner,
    refresh: async () => {
      if (!source) return;
      try {
        setState(stateOf(await source.getCouple()));
      } catch (error) {
        setState((current) => ({ ...current, status: 'error', error: describeApiError(error) }));
      }
    },
    create: () => run(() => requireSource().createCouple()),
    join: (code) => run(() => requireSource().joinCouple(code)),
    renewInvite: () => run(() => requireSource().renewInvite()),
  };

  return <CoupleContext.Provider value={value}>{children}</CoupleContext.Provider>;
}

export function useCouple(): CoupleValue {
  const value = useContext(CoupleContext);
  if (!value) throw new Error('useCouple must be used inside <CoupleProvider>');
  return value;
}
