import { broadcastTransport } from './broadcast';
import { clientFromEnv, supabaseTransport, type RealtimeLike } from './supabase';
import type { Transport } from './types';

/**
 * With Supabase keys a room spans real phones; without them it still plays
 * across two tabs of one browser, so no game ever depends on a backend.
 * Shared by every engine that runs a room.
 */
export function selectTransport(env: Record<string, string | undefined>): {
  online: boolean;
  makeTransport: (code: string) => Transport;
} {
  const realtime = clientFromEnv(env);
  const online = realtime !== null;
  return {
    online,
    makeTransport: (code) =>
      online ? supabaseTransport(code, realtime as unknown as RealtimeLike) : broadcastTransport(code),
  };
}
