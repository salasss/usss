import type { Couple } from '@/data/types';
import type { Me } from '@/state/session';

/**
 * Everything the screens need from the outside world. Two implementations:
 * `live` (Supabase + usss backend) and `demo` (local sample data, used when
 * the build has no Supabase configuration).
 */
export interface DataSource {
  readonly mode: 'live' | 'demo';
  readonly me: Me;

  getCouple(): Promise<Couple | null>;
  createCouple(): Promise<Couple>;
  joinCouple(code: string): Promise<Couple>;
  renewInvite(): Promise<Couple>;
}
