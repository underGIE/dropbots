import { describe, expect, it } from 'vitest';
import { DEFAULT_TUNING, canSpecial, createDuel, playRound, resolveRound } from '../src/fighter/duel';
import type { DuelState, Fighter } from '../src/fighter/types';

const AVI: Fighter = { id: 'a', name: 'אבי', trait: 'לא מוותר', special: 'הבעיטה של אבי' };
const DUDU: Fighter = { id: 'd', name: 'דודו', trait: 'תמיד מאחר', special: 'האיחור של דודו' };

const duel = (): DuelState => createDuel([AVI, DUDU]);

const resolve = (attack: Parameters<typeof resolveRound>[0], guard: Parameters<typeof resolveRound>[1]) =>
  resolveRound(attack, guard, DEFAULT_TUNING, 'אבי', 'דודו', 'הבעיטה של אבי');

describe('one round', () => {
  it('each attack is stopped by exactly one guard', () => {
    expect(resolve('strike', 'block').kind).toBe('chipped');
    expect(resolve('sweep', 'dodge').kind).toBe('chipped');
    expect(resolve('grab', 'counter').kind).toBe('countered');
  });

  it('and lands clean on the other two', () => {
    for (const [attack, guard] of [
      ['strike', 'dodge'],
      ['strike', 'counter'],
      ['sweep', 'block'],
      ['sweep', 'counter'],
      ['grab', 'block'],
    ] as const) {
      expect(resolve(attack, guard).toDefender).toBe(DEFAULT_TUNING.cleanDamage);
    }
  });

  it('a dodged grab hurts nobody', () => {
    const out = resolve('grab', 'dodge');
    expect(out.kind).toBe('whiffed');
    expect(out.toDefender + out.toAttacker).toBe(0);
  });

  it('a read grab costs the attacker, not the defender', () => {
    const out = resolve('grab', 'counter');
    expect(out.toAttacker).toBe(DEFAULT_TUNING.counterDamage);
    expect(out.toDefender).toBe(0);
  });

  it('never one-shots: the biggest hit is well under the health bar', () => {
    expect(DEFAULT_TUNING.specialDamage).toBeLessThan(DEFAULT_TUNING.startHp / 2);
  });
});

describe('the special', () => {
  it('is locked until the meter is full', () => {
    const d = duel();
    expect(canSpecial(d, 0)).toBe(false);
    expect(playRound(d, 'special', 'block')).toBe(d);
  });

  it('goes through a block but a counter punishes it', () => {
    expect(resolve('special', 'block').toDefender).toBe(DEFAULT_TUNING.specialDamage);
    expect(resolve('special', 'dodge').toDefender).toBe(DEFAULT_TUNING.specialDamage);
    const read = resolve('special', 'counter');
    expect(read.kind).toBe('special-countered');
    expect(read.toAttacker).toBe(DEFAULT_TUNING.specialPunish);
  });

  it('spends the whole meter when it is used', () => {
    let state: DuelState = { ...duel(), meter: [3, 0] };
    state = playRound(state, 'special', 'block');
    expect(state.meter[0]).toBe(0);
  });

  it('fills over a few rounds of ordinary play', () => {
    let state = duel();
    for (let i = 0; i < 6 && state.phase !== 'over'; i++) {
      state = playRound(state, 'strike', 'dodge');
    }
    expect(state.meter[0] + state.meter[1]).toBeGreaterThan(0);
  });
});

describe('the duel', () => {
  it('hands the attack to the other side every round', () => {
    let state = duel();
    expect(state.attacker).toBe(0);
    state = playRound(state, 'strike', 'dodge');
    expect(state.attacker).toBe(1);
    state = playRound(state, 'strike', 'dodge');
    expect(state.attacker).toBe(0);
  });

  it('ends when somebody is down, and names the winner', () => {
    let state: DuelState = { ...duel(), hp: [60, DEFAULT_TUNING.cleanDamage] };
    state = playRound(state, 'strike', 'dodge');
    expect(state.phase).toBe('over');
    expect(state.winner).toBe(0);
    expect(state.hp[1]).toBe(0);
  });

  it('lets the defender win on a counter, even while attacking is theirs next', () => {
    let state: DuelState = { ...duel(), hp: [DEFAULT_TUNING.counterDamage, 40] };
    state = playRound(state, 'grab', 'counter');
    expect(state.phase).toBe('over');
    expect(state.winner).toBe(1);
    expect(state.hp[0]).toBe(0);
  });

  it('ignores anything played after the knockout', () => {
    let state: DuelState = { ...duel(), hp: [60, 1] };
    state = playRound(state, 'strike', 'dodge');
    expect(playRound(state, 'strike', 'block')).toBe(state);
  });

  it('keeps a short readable log in the fighters own words', () => {
    let state = duel();
    state = playRound(state, 'grab', 'counter');
    expect(state.log[0]).toContain('דודו');
    expect(state.log).toHaveLength(1);
  });

  it('a whole duel ends in a sane number of rounds', () => {
    let state = duel();
    let rounds = 0;
    while (state.phase !== 'over' && rounds < 40) {
      state = playRound(state, 'strike', 'dodge');
      rounds++;
    }
    expect(state.phase).toBe('over');
    expect(rounds).toBeGreaterThan(4);
    expect(rounds).toBeLessThan(20);
  });
});
