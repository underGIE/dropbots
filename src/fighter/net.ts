/**
 * The duel over two phones, on the same host-as-client room shape as DROPBOTS
 * (src/net/room.ts): the host is fighter 0 and owns the DuelState, the first
 * guest is fighter 1, a third joiner is told the room is full.
 *
 * SECRET PICKS. The host keeps both pending picks in a private field, never in
 * the published state. While a round is open every snapshot carries only
 * `committed: [boolean, boolean]`, and `duel.picks` is always `{}`, so a
 * snapshot taken after a guest picked "block" is byte-identical to one taken
 * after it picked "counter". Only when BOTH picks are in does the host call
 * `playRound`, and the reveal goes out as one snapshot to both screens.
 *
 * REVEAL PACING — decision: an explicit `ack`. After `playRound` the room sits
 * in `stage: 'reveal'` and the host refuses picks for the next round until both
 * sides have pressed "הסיבוב הבא". Why not the simpler "next round opens at
 * once and each phone dismisses the reveal locally":
 *   - the reveal is the social moment of the game: both people look up from
 *     their phones at the same time. With a local dismiss the fast reader is
 *     already choosing while the other is still reading, and the slow one
 *     comes back to a "your opponent already picked" badge. That is pressure
 *     the uncle never asked for, and it rewards skipping the line on screen.
 *   - one shared clock for "the round is open" makes `committed` meaningful:
 *     it can only flip on after both have seen the same result.
 * The cost is one tiny message per side per round and a "מחכה ל…" state on the
 * faster phone. The KO reveal is acked the same way and then both go to the
 * result screen together. A phone that locked its screen mid-reveal simply
 * stalls the round; the heartbeat below resends the ack on wake.
 *
 * Divergences from `Room`, each on purpose:
 *   - Messages ride the existing `Transport`, which is typed to DROPBOTS'
 *     `GameMsg`. Every duel message has a `duel:` tag and goes through one
 *     cast in `duelTransport()`; anything without the tag is ignored, so a
 *     DROPBOTS client on the same channel cannot confuse the duel. (The clean
 *     fix is making `Transport` generic over its message type; that file is
 *     shared and outside this change.)
 *   - No game clock, so `pump()` is a pure heartbeat: the host re-sends the
 *     snapshot, and a guest re-sends whatever it is still owed — its join
 *     until it is seated, its pick until `committed` shows it, its ack until
 *     `acked` shows it. Room sends a join once; on a lossy realtime channel a
 *     lost pick here would freeze the duel, a lost press in DROPBOTS does not.
 *   - Picks and acks carry `match` and `round`, so a late duplicate from an
 *     earlier round or an earlier match can never be counted in the current one.
 *   - Snapshots go out on change only (no per-tick signature check needed:
 *     the whole public view is the signature), plus that heartbeat.
 *
 * Known limit: the transports are broadcast channels, so the guest's `pick`
 * message itself is on the wire where the host's code reads it. The host
 * screen renders only the public view, but someone opening devtools on the
 * host phone could read a guest pick early. Fine for a party game; a
 * commit-reveal hash would close it if it ever matters.
 */
import { canSpecial, createDuel, playRound } from './duel';
import type { Attack, DuelState, Fighter, Guard } from './types';
import type { GameMsg, Transport } from '../transport/types';

export const DUEL_HEARTBEAT_MS = 1000;

export type Side = 0 | 1;

export interface DuelSeat {
  id: string;
  fighter: Fighter;
}

export type DuelPick = { attack: Attack } | { guard: Guard };

export type DuelStage = 'lobby' | 'picking' | 'reveal' | 'over';

/** The only thing that ever leaves the host: the same for both screens. */
export interface DuelView {
  stage: DuelStage;
  /** bumps on every "again", so stale picks from the last match are dropped */
  match: number;
  seats: [DuelSeat | null, DuelSeat | null];
  /** `picks` is always empty here: the pending picks never leave the host */
  duel: DuelState | null;
  /** who has locked in for the open round, never what */
  committed: [boolean, boolean];
  /** who has pressed "הסיבוב הבא" on the current reveal */
  acked: [boolean, boolean];
  /** both choices of the round just played: set at the reveal, null while a round is open */
  revealed: { attack: Attack; guard: Guard } | null;
}

export type DuelMsg =
  | { t: 'duel:join'; playerId: string; fighter: Fighter }
  | { t: 'duel:full'; playerId: string }
  | { t: 'duel:pick'; playerId: string; match: number; round: number; pick: DuelPick }
  | { t: 'duel:ack'; playerId: string; match: number; round: number }
  | { t: 'duel:again'; playerId: string }
  | { t: 'duel:state'; hostId: string; view: DuelView };

export interface DuelTransport {
  send(msg: DuelMsg): void;
  onMessage(cb: (msg: DuelMsg) => void): void;
  close(): void;
}

const ATTACKS: readonly Attack[] = ['strike', 'sweep', 'grab', 'special'];
const GUARDS: readonly Guard[] = ['block', 'dodge', 'counter'];

function isDuelMsg(raw: unknown): raw is DuelMsg {
  const t = (raw as { t?: unknown } | null)?.t;
  return typeof t === 'string' && t.startsWith('duel:');
}

/** The one place a duel message is passed through the DROPBOTS-typed transport. */
export function duelTransport(inner: Transport): DuelTransport {
  return {
    send: (msg) => inner.send(msg as unknown as GameMsg),
    onMessage: (cb) =>
      inner.onMessage((raw) => {
        if (isDuelMsg(raw)) {
          cb(raw);
        }
      }),
    close: () => inner.close(),
  };
}

const other = (s: Side): Side => (1 - s) as Side;

function emptyView(host: DuelSeat | null): DuelView {
  return {
    stage: 'lobby',
    match: 1,
    seats: [host, null],
    duel: null,
    committed: [false, false],
    acked: [false, false],
    revealed: null,
  };
}

/** Network input is untrusted: only a real attack or a real guard counts. */
function cleanPick(pick: unknown): DuelPick | null {
  const p = pick as { attack?: unknown; guard?: unknown } | null;
  if (p && typeof p.attack === 'string' && (ATTACKS as readonly string[]).includes(p.attack)) {
    return { attack: p.attack as Attack };
  }
  if (p && typeof p.guard === 'string' && (GUARDS as readonly string[]).includes(p.guard)) {
    return { guard: p.guard as Guard };
  }
  return null;
}

export class DuelRoom {
  readonly isHost: boolean;
  readonly me: DuelSeat;
  hostId: string | null;
  view: DuelView;
  /** a third phone: the room already has two fighters */
  refused = false;
  error: string | null = null;
  onChange: (() => void) | null = null;

  private readonly transport: DuelTransport;
  private timer: ReturnType<typeof setInterval> | null = null;
  /** host only, and never published: what each side locked in this round */
  private pending: [DuelPick | null, DuelPick | null] = [null, null];
  private lastSent = '';
  /** guest only: what this phone still owes the host, resent on heartbeat */
  private sentPick: { match: number; round: number; pick: DuelPick } | null = null;
  private sentAck: { match: number; round: number } | null = null;

  constructor(opts: {
    transport: Transport;
    me: DuelSeat;
    isHost: boolean;
    autoTick?: boolean;
  }) {
    this.transport = duelTransport(opts.transport);
    this.me = { id: opts.me.id, fighter: { ...opts.me.fighter, id: opts.me.id } };
    this.isHost = opts.isHost;
    this.hostId = opts.isHost ? this.me.id : null;
    this.view = emptyView(opts.isHost ? this.me : null);

    this.transport.onMessage((msg) => this.receive(msg));

    if (opts.autoTick !== false) {
      this.timer = setInterval(() => this.pump(), DUEL_HEARTBEAT_MS);
    }
    if (this.isHost) {
      this.publish();
    } else {
      this.sendJoin();
    }
  }

  /** Which fighter this phone is, once seated. */
  get mySide(): Side | null {
    const [a, b] = this.view.seats;
    if (a?.id === this.me.id) {
      return 0;
    }
    if (b?.id === this.me.id) {
      return 1;
    }
    return null;
  }

  /** What this phone has to choose right now, if anything. */
  myRole(): 'attack' | 'guard' | null {
    const side = this.mySide;
    const d = this.view.duel;
    if (side === null || !d || this.view.stage !== 'picking') {
      return null;
    }
    return d.attacker === side ? 'attack' : 'guard';
  }

  /** Locked in for the open round: the host says so, or this phone just sent it. */
  iCommitted(): boolean {
    const side = this.mySide;
    if (side === null) {
      return false;
    }
    if (this.view.committed[side]) {
      return true;
    }
    const d = this.view.duel;
    return (
      !!d &&
      this.view.stage === 'picking' &&
      this.sentPick?.match === this.view.match &&
      this.sentPick.round === d.round
    );
  }

  iAcked(): boolean {
    const side = this.mySide;
    if (side === null) {
      return false;
    }
    if (this.view.acked[side]) {
      return true;
    }
    const d = this.view.duel;
    return (
      !!d &&
      this.view.stage === 'reveal' &&
      this.sentAck?.match === this.view.match &&
      this.sentAck.round === d.round
    );
  }

  /** This phone's secret choice for the open round. */
  pick(pick: DuelPick): void {
    const d = this.view.duel;
    const side = this.mySide;
    const role = this.myRole();
    // checked here too, so a phone never thinks it is locked in on a pick the host drops
    if (!d || side === null || !role || this.iCommitted() || role !== ('attack' in pick ? 'attack' : 'guard')) {
      return;
    }
    if ('attack' in pick && pick.attack === 'special' && !canSpecial(d, side)) {
      return;
    }
    if (this.isHost) {
      this.applyPick(this.me.id, this.view.match, d.round, pick);
      return;
    }
    this.sentPick = { match: this.view.match, round: d.round, pick };
    this.transport.send({ t: 'duel:pick', playerId: this.me.id, ...this.sentPick });
    this.onChange?.();
  }

  /** "הסיבוב הבא": this side has seen the reveal. */
  ack(): void {
    const d = this.view.duel;
    if (!d || this.view.stage !== 'reveal' || this.iAcked()) {
      return;
    }
    if (this.isHost) {
      this.applyAck(this.me.id, this.view.match, d.round);
      return;
    }
    this.sentAck = { match: this.view.match, round: d.round };
    this.transport.send({ t: 'duel:ack', playerId: this.me.id, ...this.sentAck });
    this.onChange?.();
  }

  again(): void {
    if (this.isHost) {
      this.hostAgain();
    } else {
      this.transport.send({ t: 'duel:again', playerId: this.me.id });
    }
  }

  /**
   * Heartbeat. The host re-sends the snapshot for a phone that joined late or
   * missed one; a guest re-sends anything the snapshot shows the host never got.
   */
  pump(): void {
    if (this.isHost) {
      this.send(true);
      return;
    }
    if (this.refused) {
      return;
    }
    const side = this.mySide;
    if (side === null) {
      this.sendJoin();
      return;
    }
    const d = this.view.duel;
    if (!d) {
      return;
    }
    const sp = this.sentPick;
    if (
      sp &&
      this.view.stage === 'picking' &&
      sp.match === this.view.match &&
      sp.round === d.round &&
      !this.view.committed[side]
    ) {
      this.transport.send({ t: 'duel:pick', playerId: this.me.id, ...sp });
    }
    const sa = this.sentAck;
    if (
      sa &&
      this.view.stage === 'reveal' &&
      sa.match === this.view.match &&
      sa.round === d.round &&
      !this.view.acked[side]
    ) {
      this.transport.send({ t: 'duel:ack', playerId: this.me.id, ...sa });
    }
  }

  close(): void {
    if (this.timer) {
      clearInterval(this.timer);
    }
    this.transport.close();
  }

  private sendJoin(): void {
    this.transport.send({ t: 'duel:join', playerId: this.me.id, fighter: this.me.fighter });
  }

  private receive(msg: DuelMsg): void {
    switch (msg.t) {
      case 'duel:state':
        if (!this.isHost && !this.refused) {
          this.hostId = msg.hostId;
          this.view = msg.view;
          // seats never free up: if fighter 1 is somebody else, this phone is out
          const second = msg.view.seats[1];
          if (second && second.id !== this.me.id && msg.view.seats[0]?.id !== this.me.id) {
            this.refuse();
            return;
          }
          this.onChange?.();
        }
        break;
      case 'duel:full':
        if (!this.isHost && msg.playerId === this.me.id) {
          this.refuse();
        }
        break;
      case 'duel:join':
        if (this.isHost) {
          this.hostJoin(msg.playerId, msg.fighter);
        }
        break;
      case 'duel:pick':
        if (this.isHost) {
          this.applyPick(msg.playerId, msg.match, msg.round, msg.pick);
        }
        break;
      case 'duel:ack':
        if (this.isHost) {
          this.applyAck(msg.playerId, msg.match, msg.round);
        }
        break;
      case 'duel:again':
        if (this.isHost && this.sideOf(msg.playerId) !== null) {
          this.hostAgain();
        }
        break;
    }
  }

  private refuse(): void {
    this.refused = true;
    this.error = 'החדר מלא: כבר יש שני לוחמים';
    this.onChange?.();
  }

  private sideOf(playerId: string): Side | null {
    const [a, b] = this.view.seats;
    if (a?.id === playerId) {
      return 0;
    }
    if (b?.id === playerId) {
      return 1;
    }
    return null;
  }

  private hostJoin(playerId: string, fighter: Fighter): void {
    if (this.sideOf(playerId) !== null) {
      // a reloaded phone or a resent join: just show it where things stand
      this.send(true);
      return;
    }
    if (this.view.seats[1]) {
      this.transport.send({ t: 'duel:full', playerId });
      return;
    }
    const host = this.view.seats[0] ?? this.me;
    const guest: DuelSeat = {
      id: playerId,
      fighter: {
        id: playerId,
        name: String(fighter?.name ?? '').slice(0, 40) || 'אורח',
        trait: String(fighter?.trait ?? '').slice(0, 60),
        special: String(fighter?.special ?? '').slice(0, 80) || 'המהלך המיוחד',
      },
    };
    // exactly two seats, so the duel starts the moment the second one fills
    this.view = {
      ...this.view,
      stage: 'picking',
      seats: [host, guest],
      duel: createDuel([host.fighter, guest.fighter]),
      committed: [false, false],
      acked: [false, false],
      revealed: null,
    };
    this.pending = [null, null];
    this.publish();
  }

  private applyPick(playerId: string, match: number, round: number, raw: unknown): void {
    const side = this.sideOf(playerId);
    const d = this.view.duel;
    const pick = cleanPick(raw);
    if (
      side === null ||
      !d ||
      !pick ||
      this.view.stage !== 'picking' ||
      match !== this.view.match ||
      round !== d.round
    ) {
      return;
    }
    if (this.view.committed[side]) {
      // a commitment is a commitment; a resent duplicate just gets the view again
      this.send(true);
      return;
    }
    const attacking = d.attacker === side;
    if (attacking !== ('attack' in pick)) {
      return;
    }
    if ('attack' in pick && pick.attack === 'special' && !canSpecial(d, side)) {
      return;
    }

    this.pending[side] = pick;
    const committed: [boolean, boolean] = [...this.view.committed];
    committed[side] = true;
    this.view = { ...this.view, committed };

    const a = this.pending[d.attacker];
    const g = this.pending[other(d.attacker)];
    if (a && 'attack' in a && g && 'guard' in g) {
      const next = playRound(d, a.attack, g.guard);
      this.pending = [null, null];
      this.view = {
        ...this.view,
        stage: 'reveal',
        duel: { ...next, picks: {} },
        committed: [false, false],
        acked: [false, false],
        revealed: { attack: a.attack, guard: g.guard },
      };
    }
    this.publish();
  }

  private applyAck(playerId: string, match: number, round: number): void {
    const side = this.sideOf(playerId);
    const d = this.view.duel;
    if (side === null || !d || this.view.stage !== 'reveal' || match !== this.view.match || round !== d.round) {
      return;
    }
    const acked: [boolean, boolean] = [...this.view.acked];
    acked[side] = true;
    if (acked[0] && acked[1]) {
      this.view = {
        ...this.view,
        stage: d.phase === 'over' ? 'over' : 'picking',
        acked: [false, false],
        committed: [false, false],
        // the KO's choices stay on the result screen; a fresh round shows none
        revealed: d.phase === 'over' ? this.view.revealed : null,
      };
    } else {
      this.view = { ...this.view, acked };
    }
    this.publish();
  }

  private hostAgain(): void {
    const [a, b] = this.view.seats;
    if (!a || !b || this.view.stage !== 'over') {
      return;
    }
    this.pending = [null, null];
    this.view = {
      ...this.view,
      stage: 'picking',
      match: this.view.match + 1,
      duel: createDuel([a.fighter, b.fighter], this.view.duel?.tuning),
      committed: [false, false],
      acked: [false, false],
      revealed: null,
    };
    this.publish();
  }

  /** Snapshots go out when the public view changed, or on the heartbeat. */
  private publish(): void {
    this.send(false);
    this.onChange?.();
  }

  private send(force: boolean): void {
    if (!this.isHost || !this.hostId) {
      return;
    }
    const body = JSON.stringify(this.view);
    if (force || body !== this.lastSent) {
      this.lastSent = body;
      this.transport.send({ t: 'duel:state', hostId: this.hostId, view: this.view });
    }
  }
}
