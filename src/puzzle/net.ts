import type { GameMsg, Transport } from '../transport/types';
import { createPuzzle, startPuzzle, submitLock, tickPuzzle, validateFacts } from './locks';
import type { Fact, PuzzleState, PuzzleTuning } from './types';
import { DEFAULT_PUZZLE_TUNING } from './locks';

export type LocksMsg =
  | { t: 'join'; playerId: string; name: string }
  | { t: 'start' }
  | { t: 'submit'; playerId: string; answers: string[] }
  | { t: 'again' }
  | { t: 'state'; hostId: string; state: PuzzleState; names: Record<string, string> };

export interface Seat {
  id: string;
  name: string;
}

export const LOCKS_TICK_MS = 500;

/**
 * Same shape as the DROPBOTS room: the host is a client that owns the state.
 * v1 ships the full state to every phone and each phone renders only its own
 * view; a determined cheat could read the snapshot. Acceptable for a gift
 * among family — noted in the spec as the thing to tighten if it ever matters.
 */
export class LocksRoom {
  readonly isHost: boolean;
  readonly me: Seat;
  hostId: string | null;
  state: PuzzleState | null = null;
  seats: Seat[];
  error: string | null = null;
  onChange: (() => void) | null = null;

  // the transport is typed for DROPBOTS' messages; until it is made generic
  // (one change, after the parallel work lands) this room adapts at the edge
  private readonly transport: { send(m: LocksMsg): void; onMessage(cb: (m: LocksMsg) => void): void; close(): void };
  private readonly facts: Fact[];
  private readonly tuning: PuzzleTuning;
  private readonly now: () => number;
  private timer: ReturnType<typeof setInterval> | null = null;
  private lastSignature = '';

  constructor(opts: {
    transport: Transport;
    facts: Fact[];
    me: Seat;
    isHost: boolean;
    tuning?: PuzzleTuning;
    now?: () => number;
    autoTick?: boolean;
  }) {
    const raw = opts.transport;
    this.transport = {
      send: (m) => raw.send(m as unknown as GameMsg),
      onMessage: (cb) => raw.onMessage((m) => cb(m as unknown as LocksMsg)),
      close: () => raw.close(),
    };
    this.facts = opts.facts;
    this.tuning = opts.tuning ?? DEFAULT_PUZZLE_TUNING;
    this.me = opts.me;
    this.isHost = opts.isHost;
    this.now = opts.now ?? (() => Date.now());
    this.hostId = opts.isHost ? opts.me.id : null;
    this.seats = opts.isHost ? [opts.me] : [];
    this.transport.onMessage((m) => this.receive(m));
    if (this.isHost) {
      this.state = createPuzzle(this.facts, [this.me.id], this.seed(), this.tuning);
      if (opts.autoTick !== false) {
        this.timer = setInterval(() => this.pump(), LOCKS_TICK_MS);
      }
    } else {
      this.transport.send({ t: 'join', playerId: this.me.id, name: this.me.name });
    }
  }

  names(): Record<string, string> {
    const out: Record<string, string> = {};
    for (const s of this.seats) {
      out[s.id] = s.name;
    }
    return out;
  }

  begin(): void {
    this.isHost ? this.hostStart() : this.transport.send({ t: 'start' });
  }

  submit(answers: string[]): void {
    this.isHost
      ? this.apply(this.me.id, answers)
      : this.transport.send({ t: 'submit', playerId: this.me.id, answers });
  }

  again(): void {
    if (this.isHost) {
      this.state = createPuzzle(this.facts, this.seats.map((s) => s.id), this.seed(), this.tuning);
      this.publish();
    } else {
      this.transport.send({ t: 'again' });
    }
  }

  pump(): void {
    if (!this.isHost || !this.state || this.state.phase !== 'live') {
      return;
    }
    this.state = tickPuzzle(this.state, this.now());
    this.publish();
  }

  close(): void {
    if (this.timer) {
      clearInterval(this.timer);
    }
    this.transport.close();
  }

  private seed(): number {
    return Math.floor(Math.random() * 1e9);
  }

  private receive(msg: LocksMsg): void {
    switch (msg.t) {
      case 'state':
        if (!this.isHost) {
          this.hostId = msg.hostId;
          this.state = msg.state;
          this.seats = msg.state.players.map((id) => ({ id, name: msg.names[id] ?? id }));
          this.onChange?.();
        }
        break;
      case 'join':
        if (this.isHost && !this.seats.some((s) => s.id === msg.playerId)) {
          this.seats = [...this.seats, { id: msg.playerId, name: msg.name }];
          this.state = createPuzzle(this.facts, this.seats.map((s) => s.id), this.state?.seed ?? 1, this.tuning);
          this.publish();
        }
        break;
      case 'start':
        if (this.isHost) {
          this.hostStart();
        }
        break;
      case 'submit':
        if (this.isHost) {
          this.apply(msg.playerId, msg.answers);
        }
        break;
      case 'again':
        if (this.isHost) {
          this.again();
        }
        break;
    }
  }

  private hostStart(): void {
    if (!this.state || this.state.phase !== 'lobby') {
      return;
    }
    const errors = validateFacts(this.facts, this.tuning, this.seats.length);
    if (errors.length > 0) {
      this.error = errors.join(' · ');
      this.onChange?.();
      return;
    }
    this.error = null;
    this.state = startPuzzle(this.state, this.now());
    this.publish();
  }

  private apply(by: string, answers: string[]): void {
    if (!this.state) {
      return;
    }
    this.state = submitLock(this.state, by, answers, this.now());
    this.publish();
  }

  private publish(): void {
    if (this.state && this.hostId) {
      const s = this.state;
      const signature = `${s.phase}|${s.current}|${s.strikes}|${s.players.join(',')}|${s.log[0] ?? ''}`;
      if (signature !== this.lastSignature) {
        this.lastSignature = signature;
        this.transport.send({ t: 'state', hostId: this.hostId, state: s, names: this.names() });
      }
    }
    this.onChange?.();
  }
}
