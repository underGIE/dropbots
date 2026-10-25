import { describe, expect, it } from 'vitest';
import { DEFAULT_TUNING } from '../src/fighter/duel';
import { DuelRoom, type DuelMsg, type DuelView } from '../src/fighter/net';
import type { Fighter } from '../src/fighter/types';
import { localBus } from '../src/transport/local';
import type { GameMsg, Transport } from '../src/transport/types';

const AVI: Fighter = { id: 'x', name: 'אבי', trait: 'לא מוותר', special: 'הבעיטה של אבי' };
const DUDU: Fighter = { id: 'y', name: 'דודו', trait: 'תמיד מאחר', special: 'האיחור של דודו' };

/** Wraps a transport so the test can see every snapshot that hit the wire. */
function tapped(inner: Transport, wire: DuelView[]): Transport {
  return {
    send: (m: GameMsg) => {
      const msg = m as unknown as DuelMsg;
      if (msg.t === 'duel:state') {
        wire.push(JSON.parse(JSON.stringify(msg.view)) as DuelView);
      }
      inner.send(m);
    },
    onMessage: (cb) => inner.onMessage(cb),
    close: () => inner.close(),
  };
}

function table() {
  const bus = localBus();
  const wire: DuelView[] = [];
  const host = new DuelRoom({
    transport: tapped(bus.make(), wire),
    me: { id: 'h', fighter: AVI },
    isHost: true,
    autoTick: false,
  });
  const guest = new DuelRoom({
    transport: bus.make(),
    me: { id: 'g', fighter: DUDU },
    isHost: false,
    autoTick: false,
  });
  return { bus, host, guest, wire };
}

/** Both sides pick for the open round (the reveal still needs both acks). */
function round(
  t: ReturnType<typeof table>,
  attack: 'strike' | 'sweep' | 'grab' | 'special',
  guard: 'block' | 'dodge' | 'counter',
) {
  const attacker = t.host.view.duel!.attacker === 0 ? t.host : t.guest;
  const defender = attacker === t.host ? t.guest : t.host;
  attacker.pick({ attack });
  defender.pick({ guard });
}

describe('seating', () => {
  it('host is fighter 0, the first guest is fighter 1, and the duel opens', () => {
    const { host, guest } = table();
    expect(host.mySide).toBe(0);
    expect(guest.mySide).toBe(1);
    expect(guest.view.stage).toBe('picking');
    expect(guest.view.duel?.fighters.map((f) => f.name)).toEqual(['אבי', 'דודו']);
    expect(host.myRole()).toBe('attack');
    expect(guest.myRole()).toBe('guard');
  });

  it('a third phone is told the room is full and never takes a seat', () => {
    const t = table();
    const third = new DuelRoom({
      transport: t.bus.make(),
      me: { id: 'z', fighter: { ...DUDU, name: 'שלישי' } },
      isHost: false,
      autoTick: false,
    });
    expect(third.refused).toBe(true);
    expect(third.error).toContain('מלא');
    expect(third.mySide).toBeNull();
    expect(t.host.view.seats.map((s) => s?.id)).toEqual(['h', 'g']);
    // and the heartbeat afterwards does not pull it back in
    t.host.pump();
    expect(third.refused).toBe(true);
    expect(third.view.duel).toBeNull();
  });

  it('a resent join from a seated phone changes nothing', () => {
    const { host, guest } = table();
    const before = JSON.stringify(host.view);
    guest.pump();
    expect(JSON.stringify(host.view)).toBe(before);
  });
});

describe('secret picks', () => {
  it("a guest's pick reaches the host, but the snapshot only says that it picked", () => {
    const { host, guest, wire } = table();
    host.pick({ attack: 'strike' }); // host attacks first
    guest.pick({ guard: 'block' });
    // resolved, so the pick must have arrived; now check what showed BEFORE it did
    expect(host.view.stage).toBe('reveal');
    expect(host.view.duel?.last?.kind).toBe('chipped');

    const open = wire.filter((v) => v.stage === 'picking');
    expect(open.length).toBeGreaterThan(0);
    for (const v of open) {
      expect(v.duel?.picks).toEqual({});
    }
    expect(open.at(-1)?.committed).toEqual([true, false]);
    for (const v of open) {
      expect(v.revealed).toBeNull();
    }
    // the reveal is the first time either choice is on the wire
    expect(wire.at(-1)?.revealed).toEqual({ attack: 'strike', guard: 'block' });
  });

  it('what the guest sees is identical whichever guard the other side chose', () => {
    // host defends this time: two parallel rooms, two different secret guards
    const seen = (guard: 'block' | 'counter'): string => {
      const t = table();
      round(t, 'strike', 'dodge');
      t.host.ack();
      t.guest.ack();
      expect(t.host.myRole()).toBe('guard');
      t.host.pick({ guard });
      return JSON.stringify(t.guest.view);
    };
    const a = seen('block');
    const b = seen('counter');
    expect(a).toBe(b);
    expect(JSON.parse(a).committed).toEqual([true, false]);
  });

  it('the round resolves only when both sides are in', () => {
    const { host, guest } = table();
    guest.pick({ guard: 'dodge' });
    expect(host.view.stage).toBe('picking');
    expect(host.view.committed).toEqual([false, true]);
    expect(guest.iCommitted()).toBe(true);
    expect(host.view.duel?.round).toBe(1);
    host.pick({ attack: 'sweep' });
    expect(host.view.stage).toBe('reveal');
    expect(host.view.duel?.round).toBe(2);
  });

  it('a commitment cannot be changed, and the wrong kind of pick is ignored', () => {
    const { bus, host, guest } = table();
    guest.pick({ attack: 'strike' }); // guest is defending, an attack is nonsense
    expect(guest.iCommitted()).toBe(false);
    // and the host drops it even if a phone sends it anyway, or sends junk
    const raw = bus.make();
    raw.send({ t: 'duel:pick', playerId: 'g', match: 1, round: 1, pick: { attack: 'strike' } } as unknown as GameMsg);
    raw.send({ t: 'duel:pick', playerId: 'g', match: 1, round: 1, pick: { guard: 'teleport' } } as unknown as GameMsg);
    raw.send({ t: 'duel:pick', playerId: 'nobody', match: 1, round: 1, pick: { guard: 'block' } } as unknown as GameMsg);
    expect(host.view.committed).toEqual([false, false]);
    guest.pick({ guard: 'counter' });
    guest.pick({ guard: 'block' }); // too late, already locked
    host.pick({ attack: 'grab' });
    expect(host.view.duel?.last?.kind).toBe('countered');
  });

  it('a locked special is refused instead of stalling the round', () => {
    const { host } = table();
    host.pick({ attack: 'special' });
    expect(host.view.committed).toEqual([false, false]);
  });
});

describe('the reveal', () => {
  it('is identical on both phones', () => {
    const t = table();
    round(t, 'strike', 'dodge');
    expect(t.guest.view.stage).toBe('reveal');
    expect(t.guest.view.duel).toEqual(t.host.view.duel);
    expect(t.guest.view.duel?.last?.toDefender).toBe(DEFAULT_TUNING.cleanDamage);
    expect(t.guest.view.duel?.hp).toEqual([60, 60 - DEFAULT_TUNING.cleanDamage]);
  });

  it('the next round opens only after both sides pressed next', () => {
    const t = table();
    round(t, 'strike', 'dodge');
    t.guest.ack();
    expect(t.host.view.stage).toBe('reveal');
    expect(t.guest.iAcked()).toBe(true);
    // picks during the reveal are not taken
    t.host.pick({ guard: 'block' });
    expect(t.host.view.committed).toEqual([false, false]);
    t.host.ack();
    expect(t.host.view.stage).toBe('picking');
    expect(t.guest.view.stage).toBe('picking');
    expect(t.guest.myRole()).toBe('attack');
  });

  it('a stale ack or pick from an earlier round is never counted', () => {
    const t = table();
    round(t, 'strike', 'dodge');
    t.host.ack();
    t.guest.ack();
    // a late duplicate of the guest's round-1 guard arrives during round 2
    const raw = t.bus.make();
    raw.send({ t: 'duel:pick', playerId: 'g', match: 1, round: 1, pick: { guard: 'block' } } as unknown as GameMsg);
    raw.send({ t: 'duel:ack', playerId: 'g', match: 1, round: 2 } as unknown as GameMsg);
    expect(t.host.view.stage).toBe('picking');
    expect(t.host.view.committed).toEqual([false, false]);
  });
});

describe('a whole match, then again', () => {
  function fightToTheEnd(t: ReturnType<typeof table>): void {
    for (let i = 0; i < 40 && t.host.view.stage !== 'over'; i++) {
      round(t, 'strike', 'dodge');
      t.host.ack();
      t.guest.ack();
    }
  }

  it('ends on both phones together, and a second match starts clean', () => {
    const t = table();
    fightToTheEnd(t);
    expect(t.host.view.stage).toBe('over');
    expect(t.guest.view.stage).toBe('over');
    expect(t.guest.view.duel?.winner).toBe(t.host.view.duel?.winner);

    t.guest.again();
    expect(t.host.view.stage).toBe('picking');
    expect(t.guest.view.match).toBe(2);
    expect(t.guest.view.duel?.hp).toEqual([60, 60]);
    expect(t.guest.view.duel?.round).toBe(1);

    round(t, 'grab', 'counter');
    expect(t.guest.view.duel?.last?.kind).toBe('countered');
    fightToTheEnd(t);
    expect(t.guest.view.stage).toBe('over');
  });

  it('again is ignored mid-match', () => {
    const t = table();
    round(t, 'strike', 'dodge');
    t.guest.again();
    expect(t.host.view.match).toBe(1);
    expect(t.host.view.stage).toBe('reveal');
  });
});

describe('a lossy channel', () => {
  it('a guest that opened the link before the host existed is seated by its heartbeat', () => {
    const bus = localBus();
    const guest = new DuelRoom({ transport: bus.make(), me: { id: 'g', fighter: DUDU }, isHost: false, autoTick: false });
    const host = new DuelRoom({ transport: bus.make(), me: { id: 'h', fighter: AVI }, isHost: true, autoTick: false });
    expect(host.view.seats[1]).toBeNull();
    guest.pump();
    expect(guest.mySide).toBe(1);
    expect(host.view.stage).toBe('picking');
  });

  it('a pick the host never got is resent until the snapshot shows it', () => {
    const bus = localBus();
    let drop = false;
    const inner = bus.make();
    const flaky: Transport = {
      send: (m) => {
        if (!drop) {
          inner.send(m);
        }
      },
      onMessage: (cb) => inner.onMessage(cb),
      close: () => inner.close(),
    };
    const host = new DuelRoom({ transport: bus.make(), me: { id: 'h', fighter: AVI }, isHost: true, autoTick: false });
    const guest = new DuelRoom({ transport: flaky, me: { id: 'g', fighter: DUDU }, isHost: false, autoTick: false });
    drop = true;
    guest.pick({ guard: 'block' });
    expect(host.view.committed).toEqual([false, false]);
    expect(guest.iCommitted()).toBe(true);
    drop = false;
    guest.pump();
    expect(host.view.committed).toEqual([false, true]);
  });
});
