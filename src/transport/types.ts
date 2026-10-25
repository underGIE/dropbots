import type { MatchState } from '../engine/types';

export type GameMsg =
  | { t: 'join'; playerId: string; name: string }
  | { t: 'press'; playerId: string; controlId: string }
  | { t: 'start' }
  | { t: 'again' }
  | { t: 'state'; hostId: string; state: MatchState };

/**
 * One room, one message type. Every engine brings its own union (DROPBOTS'
 * `GameMsg` is the default, the duel and the locks bring theirs); the wire is
 * the same BroadcastChannel or Supabase channel underneath.
 */
export interface Transport<M = GameMsg> {
  send(msg: M): void;
  onMessage(cb: (msg: M) => void): void;
  close(): void;
}
