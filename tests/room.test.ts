import { describe, expect, it } from 'vitest';
import pack from '../packs/demo-family.json';
import { HEARTBEAT_MS, Room } from '../src/net/room';
import { localBus } from '../src/transport/local';
import type { ThemePack } from '../src/engine/types';
import type { GameMsg } from '../src/transport/types';

const PACK = pack as ThemePack;

function table() {
  const bus = localBus();
  let clock = 1_000_000;
  const now = () => clock;
  const host = new Room({
    transport: bus.make(),
    pack: PACK,
    me: { id: 'h', name: 'אבי' },
    isHost: true,
    now,
    autoTick: false,
  });
  const guest = new Room({
    transport: bus.make(),
    pack: PACK,
    me: { id: 'g', name: 'שני' },
    isHost: false,
    now,
    autoTick: false,
  });
  return { host, guest, advance: (ms: number) => (clock += ms), now };
}

describe('two clients in a room', () => {
  it('seats the guest on the host and mirrors it back', () => {
    const { host, guest } = table();
    expect(host.seats.map((s) => s.id)).toEqual(['h', 'g']);
    expect(guest.state?.players).toEqual(['h', 'g']);
    expect(guest.state?.names['h']).toBe('אבי');
  });

  it('a guest can start the match and both sides go live', () => {
    const { host, guest } = table();
    guest.begin();
    expect(host.state?.phase).toBe('live');
    expect(guest.state?.phase).toBe('live');
    expect(guest.myDeck()).toHaveLength(8);
    expect(guest.myInstruction()?.reader).toBe('g');
  });

  it('each side only sees its own deck and its own instruction', () => {
    const { host, guest } = table();
    guest.begin();
    const mine = new Set(guest.myDeck().map((c) => c.id));
    const theirs = new Set(host.myDeck().map((c) => c.id));
    expect([...mine].some((id) => theirs.has(id))).toBe(false);
    expect(guest.myInstruction()!.owner).toBe('h');
  });

  it("a guest's press reaches the host and scores", () => {
    const { host, guest } = table();
    guest.begin();
    const asked = guest.state!.instructions['h']!;
    expect(asked.owner).toBe('g');
    guest.tap(asked.controlId);
    expect(host.state?.score).toBe(1);
    expect(guest.state?.score).toBe(1);
  });

  it('the clock only runs on the host, and the guest sees the result', () => {
    const { host, guest, advance } = table();
    guest.begin();
    const hypeBefore = host.state!.hype;
    advance(PACK.tuning.baseDeadlineMs + 50);
    guest.pump();
    expect(host.state!.hype).toBe(hypeBefore);
    host.pump();
    expect(host.state!.hype).toBeLessThan(hypeBefore);
    expect(guest.state!.hype).toBe(host.state!.hype);
  });

  it('refuses to start a table the pack cannot seat', () => {
    const bus = localBus();
    const thin: ThemePack = { ...PACK, controls: PACK.controls.slice(0, 4) };
    const host = new Room({
      transport: bus.make(),
      pack: thin,
      me: { id: 'h', name: 'אבי' },
      isHost: true,
      autoTick: false,
    });
    new Room({
      transport: bus.make(),
      pack: thin,
      me: { id: 'g', name: 'שני' },
      isHost: false,
      autoTick: false,
    });
    host.begin();
    expect(host.state?.phase).toBe('lobby');
    expect(host.error).toContain('needs 8');
  });
});

describe('traffic', () => {
  it('only broadcasts when something changed, plus a slow heartbeat', () => {
    const bus = localBus();
    let clock = 1_000_000;
    const inner = bus.make();
    let states = 0;
    const counting = {
      send: (m: GameMsg) => {
        if (m.t === 'state') {
          states += 1;
        }
        inner.send(m);
      },
      onMessage: (cb: (m: GameMsg) => void) => inner.onMessage(cb),
      close: () => inner.close(),
    };
    const host = new Room({
      transport: counting,
      pack: PACK,
      me: { id: 'h', name: 'אבי' },
      isHost: true,
      now: () => clock,
      autoTick: false,
    });
    host.begin();
    const afterStart = states;

    // ten frames of absolutely nothing happening, inside one heartbeat window
    for (let i = 0; i < 10; i++) {
      clock += 50;
      host.pump();
    }
    expect(states).toBe(afterStart);

    clock += HEARTBEAT_MS;
    host.pump();
    expect(states).toBe(afterStart + 1);

    // a real event always goes out
    const asked = Object.values(host.state!.instructions)[0]!;
    host.tap(asked.controlId);
    expect(states).toBe(afterStart + 2);
  });
});

describe('solo practice', () => {
  it('plays alone with instructions for your own deck', () => {
    const bus = localBus();
    const solo = new Room({
      transport: bus.make(),
      pack: PACK,
      me: { id: 's', name: 'לבד' },
      isHost: true,
      autoTick: false,
    });
    solo.begin();
    expect(solo.state?.phase).toBe('live');
    const asked = solo.myInstruction()!;
    expect(asked.owner).toBe('s');
    solo.tap(asked.controlId);
    expect(solo.state?.score).toBe(1);
  });
});
