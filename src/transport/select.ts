import { broadcastTransport } from './broadcast';
import { clientFromEnv, supabaseTransport, type RealtimeLike } from './supabase';
import type { GameMsg, Transport } from './types';

/**
 * With Supabase keys a room spans real phones; without them it still plays
 * across two tabs of one browser, so no game ever depends on a backend.
 * Shared by every engine that runs a room.
 */
export function selectTransport(env: Record<string, string | undefined>): {
  online: boolean;
  makeTransport: <M = GameMsg>(code: string) => Transport<M>;
} {
  const realtime = clientFromEnv(env);
  const online = realtime !== null;
  return {
    online,
    makeTransport: <M = GameMsg>(code: string): Transport<M> =>
      online
        ? supabaseTransport<M>(code, realtime as unknown as RealtimeLike)
        : broadcastTransport<M>(code),
  };
}
