import { describe, expect, it } from 'vitest';
import { buildPack, type Answers } from '../src/order/build-pack';
import { createMatch, startMatch } from '../src/engine/match';

const BASE: Answers = {
  names: ['אבי', 'שני'],
  players: 2,
  jokes: ['טיפקס', 'סבתא על הרמקול', 'צופר חתונה'],
  world: 'techno',
  crowd: 'adults',
  occasion: 'ראש השנה',
};

describe('intake to pack', () => {
  it('always returns a pack the engine will accept', () => {
    const built = buildPack(BASE);
    expect(built.errors).toEqual([]);
    expect(built.pack.controls.length).toBeGreaterThanOrEqual(8);
  });

  it('keeps every joke they wrote, in order, before any filler', () => {
    const built = buildPack(BASE);
    expect(built.pack.controls.slice(0, 3).map((c) => c.label)).toEqual(BASE.jokes);
    expect(built.filledIn).toBeGreaterThan(0);
  });

  it('says how many more jokes make it a real gift', () => {
    expect(buildPack(BASE).jokesNeeded).toBe(16 - 3);
    expect(buildPack({ ...BASE, jokes: Array.from({ length: 20 }, (_, i) => `בדיחה ${i}`) }).jokesNeeded).toBe(0);
  });

  it('drops blanks and duplicates', () => {
    const built = buildPack({ ...BASE, jokes: ['טיפקס', '  ', 'טיפקס', 'שופר'] });
    const labels = built.pack.controls.map((c) => c.label);
    expect(labels.slice(0, 2)).toEqual(['טיפקס', 'שופר']);
    expect(new Set(labels).size).toBe(labels.length);
  });

  it('never invents filler that repeats a joke they wrote', () => {
    const built = buildPack({ ...BASE, jokes: ['סירנה', 'תן לופ'] });
    const labels = built.pack.controls.map((c) => c.label);
    expect(new Set(labels).size).toBe(labels.length);
  });

  it('eases the clock for kids and tightens it for adults', () => {
    expect(buildPack({ ...BASE, crowd: 'kids' }).pack.tuning.baseDeadlineMs).toBeGreaterThan(
      buildPack({ ...BASE, crowd: 'adults' }).pack.tuning.baseDeadlineMs,
    );
    expect(buildPack({ ...BASE, crowd: 'kids' }).pack.tuning.targetScore).toBeLessThan(
      buildPack({ ...BASE, crowd: 'adults' }).pack.tuning.targetScore,
    );
  });

  it('skins the pack by world and carries the names onto the intro', () => {
    expect(buildPack({ ...BASE, world: 'disco' }).pack.theme?.hot).toBe('#ff5fa2');
    expect(buildPack(BASE).pack.intro.names).toEqual(['אבי', 'שני']);
  });

  it('seats four players', () => {
    const built = buildPack({ ...BASE, players: 4, names: ['א', 'ב', 'ג', 'ד'] });
    expect(built.errors).toEqual([]);
    expect(built.pack.controls.length).toBeGreaterThanOrEqual(16);
  });

  it('produces a pack that actually starts a match', () => {
    const { pack } = buildPack(BASE);
    const seats = [{ id: 'p1', name: 'אבי' }, { id: 'p2', name: 'שני' }];
    const state = startMatch(createMatch(pack, seats, 5), pack, 1000);
    expect(state.phase).toBe('live');
    expect(Object.keys(state.instructions)).toHaveLength(2);
  });
});
