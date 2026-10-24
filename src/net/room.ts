import { createMatch, press, startMatch, tick, validatePack } from '../engine/match';
import type { MatchState, ThemePack } from '../engine/types';
import type { GameMsg, Transport } from '../transport/types';

export const TICK_MS = 100;
export const HEARTBEAT_MS = 1000;

export interface Seat {
  id: string;
  name: string;
}

/**
 * The host is just a client that owns the state. It applies presses, ticks the
 * clock and broadcasts snapshots; everyone else sends intents and renders.
 */
export class Room {
  readonly isHost: boolean;
  readonly me: Seat;
  hostId: string | null;
  state: MatchState | null = null;
  seats: Seat[];
  onChange: (() => void) | null = null;
  error: string | null = null;

  private readonly transport: Transport;
  private readonly pack: ThemePack;
  private timer: ReturnType<typeof setInterval> | null = null;
  private readonly now: () => number;
  private lastSignature = '';
  private lastPublish = 0;

  constructor(opts: {
    transport: Transport;
    pack: ThemePack;
    me: Seat;
    isHost: boolean;
    now?: () => number;
    autoTick?: boolean;
  }) {
    this.transport = opts.transport;
    this.pack = opts.pack;
    this.me = opts.me;
    this.isHost = opts.isHost;
    this.now = opts.now ?? (() => Date.now());
    this.hostId = opts.isHost ? opts.me.id : null;
    this.seats = opts.isHost ? [opts.me] : [];

    this.transport.onMessage((msg) => this.receive(msg));

    if (this.isHost) {
      this.state = createMatch(this.pack, this.seats, Math.floor(Math.random() * 1e9));
      if (opts.autoTick !== false) {
        this.timer = setInterval(() => this.pump(), TICK_MS);
      }
    } else {
      this.transport.send({ t: 'join', playerId: this.me.id, name: this.me.name });
    }
  }

  /** Someone tapped one of their own pads. */
  tap(controlId: string): void {
    if (this.isHost) {
      this.applyPress(this.me.id, controlId);
    } else {
      this.transport.send({ t: 'press', playerId: this.me.id, controlId });
    }
  }

  begin(): void {
    if (this.isHost) {
      this.hostStart();
    } else {
      this.transport.send({ t: 'start' });
    }
  }

  again(): void {
    if (this.isHost) {
      this.state = createMatch(this.pack, this.seats, Math.floor(Math.random() * 1e9));
      this.publish();
    } else {
      this.transport.send({ t: 'again' });
    }
  }

  /** One clock step. Called by the interval, or by hand in tests. */
  pump(): void {
    if (!this.isHost || !this.state || this.state.phase !== 'live') {
      return;
    }
    this.state = tick(this.state, this.now());
    this.publish();
  }

  close(): void {
    if (this.timer) {
      clearInterval(this.timer);
    }
    this.transport.close();
  }

  /** The deck belonging to whoever is looking at this screen. */
  myDeck() {
    return this.state?.decks[this.me.id] ?? [];
  }

  /** What I have to shout at the others. */
  myInstruction() {
    return this.state?.instructions[this.me.id] ?? null;
  }

  private receive(msg: GameMsg): void {
    switch (msg.t) {
      case 'state':
        if (!this.isHost) {
          this.hostId = msg.hostId;
          this.state = msg.state;
          this.seats = msg.state.players.map((id) => ({ id, name: msg.state.names[id] ?? id }));
          this.onChange?.();
        }
        break;
      case 'join':
        if (this.isHost && !this.seats.some((s) => s.id === msg.playerId)) {
          this.seats = [...this.seats, { id: msg.playerId, name: msg.name }];
          this.state = createMatch(this.pack, this.seats, this.state?.seed ?? 1);
          this.publish();
        }
        break;
      case 'press':
        if (this.isHost) {
          this.applyPress(msg.playerId, msg.controlId);
        }
        break;
      case 'start':
        if (this.isHost) {
          this.hostStart();
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
    const errors = validatePack(this.pack, this.seats.length);
    if (errors.length > 0) {
      this.error = errors.join(' · ');
      this.onChange?.();
      return;
    }
    this.error = null;
    this.state = startMatch(this.state, this.pack, this.now());
    this.publish();
  }

  private applyPress(playerId: string, controlId: string): void {
    if (!this.state) {
      return;
    }
    this.state = press(this.state, playerId, controlId, this.now());
    this.publish();
  }

  /**
   * Snapshots go out when something actually changed, plus a slow heartbeat for
   * a phone that joined late. Shipping 10 identical snapshots a second over a
   * realtime channel is just money.
   */
  private publish(): void {
    if (this.state && this.hostId) {
      const s = this.state;
      const signature = [
        s.phase,
        s.score,
        s.hype,
        s.dropsFired,
        s.inDrop,
        s.players.join(','),
        Object.values(s.instructions)
          .map((i) => `${i.reader}:${i.controlId}:${i.deadlineAt}`)
          .join('|'),
      ].join('~');
      const at = this.now();
      if (signature !== this.lastSignature || at - this.lastPublish >= HEARTBEAT_MS) {
        this.lastSignature = signature;
        this.lastPublish = at;
        this.transport.send({ t: 'state', hostId: this.hostId, state: s });
      }
    }
    this.onChange?.();
  }
}
