import type { MatchState } from '../engine/types';

export type GameMsg =
  | { t: 'join'; playerId: string; name: string }
  | { t: 'press'; playerId: string; controlId: string }
  | { t: 'start' }
  | { t: 'again' }
  | { t: 'state'; hostId: string; state: MatchState };

export interface Transport {
  send(msg: GameMsg): void;
  onMessage(cb: (msg: GameMsg) => void): void;
  close(): void;
}
