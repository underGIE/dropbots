import { describe, expect, it } from 'vitest';
import pack from '../packs/demo-family.json';
import {
  createMatch,
  deadlineMs,
  deckSize,
  press,
  startMatch,
  tick,
  validatePack,
} from '../src/engine/match';
import type { MatchState, ThemePack } from '../src/engine/types';

const PACK = pack as ThemePack;
const T0 = 1_000_000;

function seats(n: number) {
  return Array.from({ length: n }, (_, i) => ({ id: `p${i + 1}`, name: `player ${i + 1}` }));
}

function live(n: number, seed = 7): MatchState {
  return startMatch(createMatch(PACK, seats(n), seed), PACK, T0);
}

/** the control the given player is currently being asked for, if any */
function askedOf(state: MatchState, player: string): string | undefined {
  return Object.values(state.instructions).find((i) => i.owner === player)?.controlId;
}

describe('pack validation', () => {
  it('accepts the demo pack for 1..4 players', () => {
    for (const n of [1, 2, 3, 4]) {
      expect(validatePack(PACK, n)).toEqual([]);
    }
  });

  it('rejects a pack with too few controls for the table', () => {
    const thin: ThemePack = { ...PACK, controls: PACK.controls.slice(0, 6) };
    expect(validatePack(thin, 4).join(' ')).toContain('needs 16');
  });

  it('rejects duplicate control ids and empty labels', () => {
    const dupe: ThemePack = { ...PACK, controls: [PACK.controls[0]!, PACK.controls[0]!] };
    expect(validatePack(dupe, 1).join(' ')).toContain('duplicate');
    const blank: ThemePack = {
      ...PACK,
      controls: PACK.controls.map((c, i) => (i === 0 ? { ...c, label: '  ' } : c)),
    };
    expect(validatePack(blank, 1).join(' ')).toContain('empty label');
  });
});

describe('dealing', () => {
  it('keeps decks between 4 and 8 controls', () => {
    expect(deckSize(32, 4)).toBe(8);
    expect(deckSize(32, 1)).toBe(8);
    expect(deckSize(12, 3)).toBe(4);
    expect(deckSize(6, 4)).toBe(4);
  });

  it('gives every player a deck and never the same control twice', () => {
    const s = live(4);
    const all = s.players.flatMap((p) => s.decks[p]!.map((c) => c.id));
    expect(all).toHaveLength(32);
    expect(new Set(all).size).toBe(32);
  });
});

describe('the shout loop', () => {
  it('gives each player an instruction for somebody else', () => {
    const s = live(3);
    expect(Object.keys(s.instructions).sort()).toEqual(['p1', 'p2', 'p3']);
    for (const i of Object.values(s.instructions)) {
      expect(i.owner).not.toBe(i.reader);
      expect(s.decks[i.owner]!.some((c) => c.id === i.controlId)).toBe(true);
      expect(i.text).not.toContain('{label}');
    }
  });

  it('targets your own deck in solo practice', () => {
    const s = live(1);
    const only = s.instructions['p1']!;
    expect(only.owner).toBe('p1');
  });

  it('scores a correct press and re-rolls that reader', () => {
    const s = live(2);
    const asked = Object.values(s.instructions)[0]!;
    const after = press(s, asked.owner, asked.controlId, T0 + 500);
    expect(after.score).toBe(1);
    expect(after.hype).toBe(s.hype + PACK.tuning.hypeUp);
    expect(after.instructions[asked.reader]!.deadlineAt).toBeGreaterThan(T0 + 500);
    expect(after.feed[0]).toContain('✓');
  });

  it('punishes a press nobody asked for', () => {
    const s = live(2);
    const unasked = s.decks['p1']!.find((c) => askedOf(s, 'p1') !== c.id)!;
    const after = press(s, 'p1', unasked.id, T0 + 500);
    expect(after.score).toBe(0);
    expect(after.hype).toBe(s.hype - PACK.tuning.hypeDown);
  });

  it('ignores presses once the match is over', () => {
    const s = { ...live(2), phase: 'over' as const };
    expect(press(s, 'p1', s.decks['p1']![0]!.id, T0 + 1)).toBe(s);
  });
});

describe('time', () => {
  it('drains hype on a missed deadline and asks again', () => {
    const s = live(2);
    const before = Object.values(s.instructions)[0]!;
    const after = tick(s, before.deadlineAt + 1);
    expect(after.hype).toBeLessThan(s.hype);
    expect(after.instructions[before.reader]!.deadlineAt).toBeGreaterThan(before.deadlineAt);
    expect(after.feed).toContain('⏱ פספוס');
  });

  it('fires a drop on schedule and shortens the deadline', () => {
    const s = live(2);
    const calm = deadlineMs(s);
    const dropped = tick(s, T0 + PACK.tuning.dropEverySec * 1000 + 10);
    expect(dropped.inDrop).toBe(true);
    expect(dropped.dropsFired).toBe(1);
    expect(deadlineMs(dropped)).toBeLessThan(calm);
    expect(deadlineMs(dropped)).toBeGreaterThanOrEqual(2000);
  });

  it('doubles the hype swing while the drop is running', () => {
    const s = live(2);
    const dropped = tick(s, T0 + PACK.tuning.dropEverySec * 1000 + 10);
    const asked = Object.values(dropped.instructions)[0]!;
    const after = press(dropped, asked.owner, asked.controlId, dropped.dropUntil - 100);
    expect(after.hype - dropped.hype).toBe(PACK.tuning.hypeUp * 2);
  });

  it('leaves the drop window when it expires', () => {
    const s = tick(live(2), T0 + PACK.tuning.dropEverySec * 1000 + 10);
    expect(tick(s, s.dropUntil + 1).inDrop).toBe(false);
  });
});

describe('ending', () => {
  it('loses when the crowd walks out', () => {
    let s: MatchState = { ...live(2), hype: PACK.tuning.hypeDown };
    const wrong = s.decks['p1']!.find((c) => askedOf(s, 'p1') !== c.id)!;
    s = press(s, 'p1', wrong.id, T0 + 10);
    expect(s.phase).toBe('over');
    expect(s.won).toBe(false);
    expect(s.hype).toBe(0);
  });

  it('wins at the target score', () => {
    let s: MatchState = { ...live(2), score: PACK.tuning.targetScore - 1 };
    const asked = Object.values(s.instructions)[0]!;
    s = press(s, asked.owner, asked.controlId, T0 + 10);
    expect(s.phase).toBe('over');
    expect(s.won).toBe(true);
  });
});

describe('determinism', () => {
  it('replays identically from the same seed', () => {
    const a = live(3, 42);
    const b = live(3, 42);
    expect(JSON.stringify(a)).toEqual(JSON.stringify(b));
  });

  it('differs on a different seed', () => {
    const a = live(3, 1);
    const b = live(3, 2);
    expect(JSON.stringify(a.decks)).not.toEqual(JSON.stringify(b.decks));
  });
});
