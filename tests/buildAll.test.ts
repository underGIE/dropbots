import { describe, expect, it } from 'vitest';
import { resolveLadder, validateStoryPack } from '../src/fighter/story-types';
import { createStory } from '../src/fighter/story';
import { createPuzzle, startPuzzle } from '../src/puzzle/locks';
import { buildAll } from '../src/order/build-all';
import { emptyOrder, looksLikeOrder, type Order } from '../src/order/order-types';

const FULL: Order = {
  ...emptyOrder(),
  names: ['אבי', 'שני', 'דודו', 'מיכל'],
  players: 4,
  occasion: 'ראש השנה אצל סבתא',
  world: 'disco',
  crowd: 'mixed',
  jokes: Array.from({ length: 32 }, (_, i) => `בדיחה ${i + 1}`),
  facts: Array.from({ length: 12 }, (_, i) => ({ id: '', prompt: `שאלה ${i + 1}`, answer: `תשובה ${i + 1}` })),
  traits: { אבי: 'לא מוותר', שני: 'יודעת הכל ראשונה', דודו: 'תמיד מאחר', מיכל: 'לא שוכחת כלום' },
  villain: { name: 'שוקי מהוועד', trait: 'תמיד צודק', why: 'שלוש שנים של דמי ועד', taunts: ['שילמתם?'] },
  createdAt: '2026-10-25T09:00:00.000Z',
};

const by = (b: ReturnType<typeof buildAll>, e: string) => b.readiness.find((r) => r.engine === e)!;

describe('one order, every engine', () => {
  it('a full order makes all three playable packs', () => {
    const b = buildAll(FULL);
    expect(by(b, 'party').ready).toBe(true);
    expect(by(b, 'locks').ready).toBe(true);
    expect(by(b, 'fight').ready).toBe(true);
    expect(b.locks?.facts).toHaveLength(12);
    expect(b.locks?.tuning.locks).toBe(6);
    expect(b.story?.roster.map((f) => f.name)).toEqual(FULL.names);
    expect(validateStoryPack(b.story)).toEqual([]);
  });

  it('is deterministic — two phones build the same games from the same link', () => {
    expect(JSON.stringify(buildAll(FULL))).toEqual(JSON.stringify(buildAll(FULL)));
  });

  it('the packs actually start their engines', () => {
    const b = buildAll(FULL);
    const seats = FULL.names.map((n, i) => `p${i}`);
    const puzzle = startPuzzle(createPuzzle(b.locks!.facts, seats, 1, b.locks!.tuning), 1000);
    expect(puzzle.phase).toBe('live');
    for (const hero of b.story!.roster) {
      expect(Array.isArray(resolveLadder(b.story!, hero.id))).toBe(true);
      expect(createStory(b.story!, hero.id, 7).phase).not.toBe('over');
    }
  });

  it('an empty order plays DROPBOTS on filler and says what everything else needs', () => {
    const b = buildAll({ ...emptyOrder(), names: ['אבי'] });
    expect(by(b, 'party').ready).toBe(true);
    expect(by(b, 'party').missing[0]).toContain('בדיחות');
    expect(by(b, 'locks').ready).toBe(false);
    expect(by(b, 'locks').missing.join(' ')).toContain('עובדות');
    expect(by(b, 'fight').ready).toBe(false);
    expect(by(b, 'fight').missing.join(' ')).toContain('הנבל');
    expect(b.locks).toBeNull();
    expect(b.story).toBeNull();
  });

  it('locks: fewer facts means fewer locks, shared answers are called out', () => {
    const ten = { ...FULL, facts: FULL.facts.slice(0, 10) };
    expect(buildAll(ten).locks?.tuning.locks).toBe(5);
    const dupe = { ...FULL, facts: [...FULL.facts.slice(0, 11), { id: '', prompt: 'עוד', answer: 'תשובה 1' }] };
    expect(by(buildAll(dupe), 'locks').missing.join(' ')).toContain('חולקות תשובה');
  });

  it('locks: two phones get one clue per lock, four phones get two', () => {
    const two = buildAll({ ...FULL, players: 2 });
    expect(by(two, 'locks').ready).toBe(true);
    expect(two.locks?.tuning.cluesPerLock).toBe(1);
    expect(buildAll({ ...FULL, players: 4 }).locks?.tuning.cluesPerLock).toBe(2);
  });

  it('locks: the crowd sets the clock', () => {
    expect(buildAll({ ...FULL, crowd: 'kids' }).locks?.tuning.secondsTotal).toBe(420);
    expect(buildAll({ ...FULL, crowd: 'adults' }).locks?.tuning.secondsTotal).toBe(240);
  });

  it('story: two friends still make a ladder nobody has to fight themself on', () => {
    const two = { ...FULL, names: ['אבי', 'שני'], players: 2 };
    const b = buildAll(two);
    expect(by(b, 'fight').ready).toBe(true);
    expect(b.story?.ladder.map((r) => r.opponent)).toEqual(['f1', 'villain']);
    expect(Array.isArray(resolveLadder(b.story!, 'f1'))).toBe(true);
    expect(Array.isArray(resolveLadder(b.story!, 'f2'))).toBe(true);
  });

  it('story: a missing trait is named, a villain without taunts gets defaults', () => {
    const noTrait = { ...FULL, traits: { ...FULL.traits, דודו: '' } };
    expect(by(buildAll(noTrait), 'fight').missing.join(' ')).toContain('דודו');
    const quiet = { ...FULL, villain: { ...FULL.villain!, taunts: [] } };
    expect(buildAll(quiet).story?.villain.taunts.length).toBeGreaterThan(0);
  });

  it('story: the villain is bigger and the boss comes last', () => {
    const b = buildAll(FULL);
    expect(b.story?.villain.hpScale).toBe(1.5);
    expect(b.story?.ladder.at(-1)).toMatchObject({ opponent: 'villain', persona: 'boss' });
  });

  it('the order shape check refuses junk', () => {
    expect(looksLikeOrder(FULL)).toBe(true);
    expect(looksLikeOrder({ ...FULL, version: 2 })).toBe(false);
    expect(looksLikeOrder(null)).toBe(false);
    expect(looksLikeOrder({ names: [] })).toBe(false);
  });
});
