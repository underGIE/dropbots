import { describe, expect, it } from 'vitest';
import facts from '../src/puzzle/demo-facts.json';
import { viewFor } from '../src/puzzle/locks';
import { LocksRoom } from '../src/puzzle/net';
import type { Fact } from '../src/puzzle/types';
import { localBus } from '../src/transport/local';

const FACTS = facts as Fact[];

function table() {
  const bus = localBus();
  let clock = 1_000_000;
  const now = () => clock;
  const mk = (id: string, name: string, isHost: boolean) =>
    new LocksRoom({ transport: bus.make(), facts: FACTS, me: { id, name }, isHost, now, autoTick: false });
  const host = mk('h', 'אבי', true);
  const g1 = mk('g1', 'שני', false);
  const g2 = mk('g2', 'דודו', false);
  return { host, g1, g2, advance: (ms: number) => (clock += ms) };
}

describe('three phones around the locks', () => {
  it('seats everyone and mirrors names', () => {
    const { host, g2 } = table();
    expect(host.seats.map((s) => s.id)).toEqual(['h', 'g1', 'g2']);
    expect(g2.state?.players).toEqual(['h', 'g1', 'g2']);
    expect(g2.seats.find((s) => s.id === 'g1')?.name).toBe('שני');
  });

  it('a guest can start, and every phone gets a different view', () => {
    const { host, g1, g2 } = table();
    g1.begin();
    expect(host.state?.phase).toBe('live');
    const roles = [host, g1, g2].map((r) => viewFor(r.state!, r.me.id).role);
    expect(roles.filter((r) => r === 'lock')).toHaveLength(1);
    expect(roles.filter((r) => r === 'clue').length).toBeGreaterThan(0);
  });

  it('the lock holder submits through whichever phone they hold', () => {
    const { host, g1, g2 } = table();
    g1.begin();
    const rooms = [host, g1, g2];
    const holderId = host.state!.locks[0]!.holder;
    const holder = rooms.find((r) => r.me.id === holderId)!;
    const lock = host.state!.locks[0]!;
    const right = lock.questions.map((q) => lock.clues[q.clueHolder]!.find((c) => c.factId === q.factId)!.answer);
    holder.submit(right);
    for (const r of rooms) {
      expect(r.state?.current).toBe(1);
    }
  });

  it('a non-holder submitting changes nothing', () => {
    const { host, g1, g2 } = table();
    g1.begin();
    const holderId = host.state!.locks[0]!.holder;
    const other = [host, g1, g2].find((r) => r.me.id !== holderId)!;
    other.submit(['x', 'y']);
    expect(host.state?.current).toBe(0);
    expect(host.state?.strikes).toBe(0);
  });

  it('the host clock ends the row for everyone', () => {
    const { host, g1, advance } = table();
    g1.begin();
    advance(host.state!.tuning.secondsTotal * 1000 + 1);
    host.pump();
    expect(host.state?.phase).toBe('lost');
    expect(g1.state?.phase).toBe('lost');
  });

  it('refuses a table the content cannot seat', () => {
    const bus = localBus();
    const thin = FACTS.slice(0, 4);
    const host = new LocksRoom({ transport: bus.make(), facts: thin, me: { id: 'h', name: 'אבי' }, isHost: true, autoTick: false });
    new LocksRoom({ transport: bus.make(), facts: thin, me: { id: 'g', name: 'שני' }, isHost: false, autoTick: false });
    host.begin();
    expect(host.state?.phase).toBe('lobby');
    expect(host.error).toContain('need 12');
  });
});
