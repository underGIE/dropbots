import { describe, expect, it } from 'vitest';
import raw from '../packs/fighter-demo.json';
import { ATTACK_TABLE, aiAttack, aiGuard } from '../src/fighter/ai';
import { DEFAULT_TUNING, canSpecial, createDuel } from '../src/fighter/duel';
import {
  FOE,
  HERO,
  START_CONTINUES,
  afterFight,
  aiChoice,
  beginFight,
  createStory,
  currentRung,
  humanPick,
  humanRole,
  type StoryState,
} from '../src/fighter/story';
import { PERSONAS, validateStoryPack, type StoryPack } from '../src/fighter/story-types';
import { makeRng } from '../src/engine/rng';
import type { Attack, Fighter, Guard } from '../src/fighter/types';

const PACK = raw as unknown as StoryPack;
const fresh = (): StoryPack => JSON.parse(JSON.stringify(PACK)) as StoryPack;
const errorsOf = (mutate: (p: StoryPack) => void): string[] => {
  const p = fresh();
  mutate(p);
  return validateStoryPack(p);
};

const STOPS: Record<Attack, Guard> = { strike: 'block', sweep: 'dodge', grab: 'counter', special: 'counter' };

/** a human who always reads the computer right (the test peeks at its choice) */
function perfect(s: StoryState): Attack | Guard {
  const ai = aiChoice(s)!;
  if ('attack' in ai) {
    return STOPS[ai.attack];
  }
  if (ai.guard !== 'counter' && canSpecial(s.duel!, HERO)) {
    return 'special';
  }
  return ai.guard === 'block' ? 'sweep' : 'strike';
}

/** a human who always reads the computer wrong */
function worst(s: StoryState): Attack | Guard {
  const ai = aiChoice(s)!;
  if ('attack' in ai) {
    return ai.attack === 'sweep' ? 'block' : ai.attack === 'strike' ? 'dodge' : 'block';
  }
  return ai.guard === 'block' ? 'strike' : ai.guard === 'dodge' ? 'sweep' : 'grab';
}

/** a human who never looks: same two buttons every round */
const stubborn = (s: StoryState): Attack | Guard => (humanRole(s) === 'attack' ? 'strike' : 'block');

function fight(s: StoryState, policy: (s: StoryState) => Attack | Guard): StoryState {
  let state = beginFight(s);
  for (let i = 0; humanRole(state) && i < 200; i++) {
    state = humanPick(state, policy(state));
  }
  return state;
}

function playStory(s: StoryState, policy: (s: StoryState) => Attack | Guard): StoryState {
  let state = s;
  for (let i = 0; state.phase === 'intro' && i < 20; i++) {
    state = afterFight(fight(state, policy));
  }
  return state;
}

describe('validateStoryPack', () => {
  it('the demo pack is clean', () => {
    expect(validateStoryPack(PACK)).toEqual([]);
  });

  it('refuses something that is not a pack at all', () => {
    expect(validateStoryPack(null)).toHaveLength(1);
    expect(validateStoryPack([1, 2])).toHaveLength(1);
  });

  it('catches a ladder that names someone not in the roster', () => {
    const errors = errorsOf((p) => (p.ladder[0]!.opponent = 'yossi'));
    expect(errors.join(' ')).toContain('"yossi", who is not in the roster');
  });

  it('catches a roster with fewer than 2 fighters', () => {
    const errors = errorsOf((p) => {
      p.roster = p.roster.slice(0, 1);
      p.ladder = [p.ladder[3]!];
    });
    expect(errors.join(' ')).toContain('at least 2 fighters');
  });

  it('catches a hero who would have to fight themself with no one to stand in', () => {
    const errors = errorsOf((p) => {
      p.ladder = [{ opponent: 'avi', intro: 'אבי', persona: 'brawler' }, ...p.ladder];
    });
    // every friend is on the ladder now, so whoever plays meets their own rung
    expect(errors.some((e) => e.includes('fight themself'))).toBe(true);
  });

  it('catches empty taunts, and an empty taunt line', () => {
    expect(errorsOf((p) => (p.villain.taunts = []))).toContain('the villain has no taunts');
    expect(errorsOf((p) => (p.villain.taunts = ['שלום', ' ']))).toContain("one of the villain's taunts is empty");
  });

  it('catches a villain who is not the last fight, or appears twice', () => {
    const last = 'the villain must be the last fight on the ladder, and only the last';
    expect(errorsOf((p) => p.ladder.reverse())).toContain(last);
    expect(errorsOf((p) => p.ladder.unshift({ ...p.ladder[3]! }))).toContain(last);
  });

  it('catches an unknown persona, a silly hpScale, and missing lines', () => {
    expect(errorsOf((p) => ((p.ladder[1] as { persona: string }).persona = 'ninja')).join(' ')).toContain('persona "ninja"');
    expect(errorsOf((p) => (p.villain.hpScale = 0.5))).toContain("the villain's hpScale must be a number from 1 to 3");
    expect(errorsOf((p) => (p.villain.defeatLine = ''))).toContain('the villain has no defeat line');
    expect(errorsOf((p) => (p.ladder[2]!.intro = ''))).toContain('fight 3 on the ladder has no intro line');
    expect(errorsOf((p) => (p.ending.text = ''))).toContain('the ending needs a title and a text');
  });

  it('catches clashing ids', () => {
    expect(errorsOf((p) => (p.roster[1]!.id = 'avi')).join(' ')).toContain('share the id "avi"');
    expect(errorsOf((p) => (p.villain.id = 'dudu')).join(' ')).toContain('the villain shares the id "dudu"');
    expect(errorsOf((p) => (p.roster[0]!.id = 'villain')).join(' ')).toContain('reserved for the villain');
  });

  it('createStory refuses an unknown hero', () => {
    expect(() => createStory(PACK, 'nobody', 1)).toThrow();
  });
});

describe('the ladder', () => {
  it('the hero never fights themself, whoever they pick', () => {
    for (const f of PACK.roster) {
      const s = createStory(PACK, f.id, 7);
      expect(s.ladder).toHaveLength(PACK.ladder.length);
      expect(s.ladder.every((o) => o.fighter.id !== f.id)).toBe(true);
      const friends = s.ladder.filter((o) => !o.isVillain).map((o) => o.fighter.id);
      expect(new Set(friends).size).toBe(friends.length);
      expect(s.ladder[s.ladder.length - 1]!.isVillain).toBe(true);
    }
  });

  it('a friend off the ladder takes the hero\'s own rung, with their own line', () => {
    const s = createStory(PACK, 'dudu', 7);
    const first = currentRung(s);
    expect(first.number).toBe(1);
    expect(first.total).toBe(4);
    expect(first.opponent.fighter.id).toBe('avi');
    expect(first.opponent.standInFor).toBe('dudu');
    expect(s.intro).toBe(PACK.roster[0]!.standIn);
    expect(first.opponent.persona).toBe(PACK.ladder[0]!.persona);
  });

  it('carries the rung intro, and a taunt only at the top', () => {
    let s = createStory(PACK, 'avi', 3);
    expect(s.intro).toBe(PACK.ladder[0]!.intro);
    expect(s.taunt).toBeNull();
    for (let i = 0; i < 3; i++) {
      s = afterFight(fight(s, perfect));
    }
    expect(currentRung(s).opponent.isVillain).toBe(true);
    expect(PACK.villain.taunts).toContain(s.taunt);
  });

  it('the villain has more HP, and the friends a full bar every fight', () => {
    let s = createStory(PACK, 'avi', 11);
    for (let i = 0; i < 3; i++) {
      const started = beginFight(s);
      expect(started.duel!.hp).toEqual([DEFAULT_TUNING.startHp, DEFAULT_TUNING.startHp]);
      s = afterFight(fight(s, perfect));
    }
    const boss = beginFight(s);
    const expected = Math.round(DEFAULT_TUNING.startHp * PACK.villain.hpScale);
    expect(boss.duel!.hp).toEqual([DEFAULT_TUNING.startHp, expected]);
    expect(boss.maxHp).toEqual([DEFAULT_TUNING.startHp, expected]);
    expect(boss.duel!.hp[FOE]).toBeGreaterThan(boss.duel!.hp[HERO]);
    // same damage numbers: the bar is longer, the hits are not softer
    expect(boss.duel!.tuning).toEqual(DEFAULT_TUNING);
  });
});

describe('the computer', () => {
  const duelWith = (meter: [number, number], attacker: 0 | 1) => ({
    ...createDuel([PACK.roster[0] as Fighter, PACK.villain]),
    meter,
    attacker,
  });

  it('never uses a locked special, whatever the persona', () => {
    for (const persona of PERSONAS) {
      for (let seed = 0; seed < 200; seed++) {
        expect(aiAttack(duelWith([0, 2], 1), 1, persona, makeRng(seed))).not.toBe('special');
      }
    }
  });

  it('the boss fires the special the moment it is available', () => {
    for (let seed = 0; seed < 200; seed++) {
      expect(aiAttack(duelWith([0, 3], 1), 1, 'boss', makeRng(seed))).toBe('special');
      expect(aiAttack(duelWith([3, 0], 0), 0, 'boss', makeRng(seed))).toBe('special');
    }
  });

  it('the other personas use it sometimes, not always', () => {
    const used = Array.from({ length: 200 }, (_, seed) => aiAttack(duelWith([0, 3], 1), 1, 'turtle', makeRng(seed)));
    expect(used).toContain('special');
    expect(used.some((a) => a !== 'special')).toBe(true);
  });

  it('is seeded: the same rng gives the same choice', () => {
    for (const persona of PERSONAS) {
      const d = duelWith([1, 1], 1);
      expect(aiAttack(d, 1, persona, makeRng(42))).toBe(aiAttack(d, 1, persona, makeRng(42)));
      expect(aiGuard(d, 0, persona, makeRng(42))).toBe(aiGuard(d, 0, persona, makeRng(42)));
    }
  });

  it('personas lean the way they are named', () => {
    const count = <T>(xs: T[], x: T) => xs.filter((y) => y === x).length;
    const d = duelWith([0, 0], 1);
    const n = 2000;
    const brawler = Array.from({ length: n }, (_, i) => aiAttack(d, 1, 'brawler', makeRng(i)));
    expect(count(brawler, 'strike')).toBeGreaterThan(n / 2);
    const turtle = Array.from({ length: n }, (_, i) => aiGuard(d, 0, 'turtle', makeRng(i)));
    expect(count(turtle, 'block') + count(turtle, 'counter')).toBeGreaterThan(n * 0.8);
    const trickster = Array.from({ length: n }, (_, i) => aiAttack(d, 1, 'trickster', makeRng(i)));
    expect(count(trickster, 'grab')).toBeGreaterThan(count(trickster, 'strike'));
  });

  it('the boss leans into the human\'s last two choices', () => {
    const d = duelWith([0, 0], 1);
    const n = 2000;
    const strikes = (guards: Guard[]) =>
      Array.from({ length: n }, (_, i) => aiAttack(d, 1, 'boss', makeRng(i), { attacks: [], guards })).filter(
        (a) => a === 'strike',
      ).length;
    // a human who keeps blocking stops strikes, so the boss strikes less
    expect(strikes(['block', 'block'])).toBeLessThan(strikes([]) * 0.7);
    expect(ATTACK_TABLE.boss.strike).toBeGreaterThan(0);

    const counters = (attacks: Attack[]) =>
      Array.from({ length: n }, (_, i) => aiGuard(d, 0, 'boss', makeRng(i), { attacks, guards: [] })).filter(
        (g) => g === 'counter',
      ).length;
    expect(counters(['grab', 'grab'])).toBeGreaterThan(counters([]) * 1.4);
  });
});

describe('a story', () => {
  it('is reproducible from its seed', () => {
    const a = playStory(createStory(PACK, 'shani', 2026), stubborn);
    const b = playStory(createStory(PACK, 'shani', 2026), stubborn);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('different seeds roll different fights', () => {
    const rolls = new Set<string>();
    for (let seed = 1; seed <= 10; seed++) {
      let s = beginFight(createStory(PACK, 'avi', seed));
      const seq: string[] = [];
      for (let i = 0; i < 6 && humanRole(s); i++) {
        seq.push(JSON.stringify(aiChoice(s)));
        s = humanPick(s, stubborn(s));
      }
      rolls.add(seq.join());
    }
    expect(rolls.size).toBeGreaterThan(1);
  });

  it('alternates: the human attacks, then defends', () => {
    let s = beginFight(createStory(PACK, 'avi', 5));
    expect(humanRole(s)).toBe('attack');
    expect('guard' in aiChoice(s)!).toBe(true);
    s = humanPick(s, 'strike');
    expect(humanRole(s)).toBe('guard');
    expect('attack' in aiChoice(s)!).toBe(true);
  });

  it('ignores a pick that does not fit the turn', () => {
    const s = beginFight(createStory(PACK, 'avi', 5));
    expect(humanPick(s, 'block')).toBe(s);
    expect(humanPick(s, 'special')).toBe(s);
  });

  it('a scripted win climbs every rung to the ending', () => {
    let s = createStory(PACK, 'michal', 99);
    const met: string[] = [];
    for (let i = 0; i < PACK.ladder.length; i++) {
      expect(s.phase).toBe('intro');
      met.push(currentRung(s).opponent.fighter.id);
      const done = fight(s, perfect);
      expect(done.duel!.winner).toBe(HERO);
      s = afterFight(done);
      expect(s.lastResult).toBe('won');
    }
    expect(s.phase).toBe('ending');
    expect(s.continues).toBe(START_CONTINUES);
    expect(met).toEqual(['dudu', 'shani', 'avi', 'shuki']);
  });

  it('two losses cost two continues, and a third ends it', () => {
    let s = createStory(PACK, 'avi', 13);
    expect(s.continues).toBe(2);
    for (const left of [1, 0]) {
      s = afterFight(fight(s, worst));
      expect(s.lastResult).toBe('lost');
      expect(s.phase).toBe('intro');
      expect(s.rung).toBe(0);
      expect(s.continues).toBe(left);
    }
    s = afterFight(fight(s, worst));
    expect(s.phase).toBe('over');
    expect(s.lastResult).toBe('lost');
  });

  it('with perfect reads, finishes in a sane number of rounds', () => {
    for (const hero of PACK.roster) {
      for (const seed of [1, 2, 3]) {
        const s = playStory(createStory(PACK, hero.id, seed), perfect);
        expect(s.phase).toBe('ending');
        expect(s.rounds).toBeGreaterThan(PACK.ladder.length * 4);
        expect(s.rounds).toBeLessThan(80);
      }
    }
  });
});
