import type { DataSource } from '@/data/source';
import type { Couple } from '@/data/types';
import type { Me } from '@/state/session';

export const DEMO_PARTNER_ID = 'demo-partner';

const daysAgo = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString();

/** Local sample data: the app can be explored without any server. */
export function createDemoSource(me: Me): DataSource {
  const couple: Couple = {
    id: 'demo-couple',
    complete: true,
    invite: null,
    togetherSince: '2023-02-14',
    createdAt: daysAgo(600),
    members: [
      { userId: me.id, seat: 1, displayName: me.displayName, avatarUrl: me.avatarUrl, joinedAt: daysAgo(600) },
      { userId: DEMO_PARTNER_ID, seat: 2, displayName: 'Léa', avatarUrl: null, joinedAt: daysAgo(599) },
    ],
  };

  return {
    mode: 'demo',
    me,
    getCouple: async () => couple,
    createCouple: async () => couple,
    joinCouple: async () => couple,
    renewInvite: async () => couple,
  };
}
