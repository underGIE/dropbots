import { aiAttack, aiGuard, type HumanHistory } from './ai';
import { DEFAULT_TUNING, canSpecial, createDuel, playRound } from './duel';
import { makeRng, pick } from '../engine/rng';
import { resolveLadder, validateStoryPack, type Opponent, type StoryPack } from './story-types';
import type { Attack, DuelState, DuelTuning, Fighter, Guard } from './types';

/**
 * Story mode on top of the duel engine: one human, a ladder of computer
 * opponents, the villain at the top. Combat is duel.ts untouched; this file
 * only decides who fights whom, rolls the computer's choice and keeps score.
 * Every function is pure and every random roll comes from the story's seed.
 */

/** the human is always side 0 and so opens every fight as the attacker */
export const HERO = 0 as const;
export const FOE = 1 as const;
export const START_CONTINUES = 2;
const HISTORY_KEPT = 2;

export interface StoryState {
  pack: StoryPack;
  hero: Fighter;
  /** the ladder as this hero climbs it */
  ladder: Opponent[];
  seed: number;
  tuning: DuelTuning;
  /** index into `ladder` */
  rung: number;
  /** how many times this rung has been tried before (0 on the first go) */
  attempt: number;
  continues: number;
  phase: 'intro' | 'fight' | 'ending' | 'over';
  /** the line on the card before this fight */
  intro: string;
  /** the villain's line for this attempt, null below the top */
  taunt: string | null;
  duel: DuelState | null;
  /** the full bar for each side; the villain's is bigger */
  maxHp: [number, number];
  history: HumanHistory;
  lastRound: { attack: Attack; guard: Guard } | null;
  /** how the previous fight went, for the card between fights */
  lastResult: 'won' | 'lost' | null;
  /** rounds played across the whole story, every attempt included */
  rounds: number;
}

/** a small integer hash so each roll has its own seed and nothing mutates */
function mix(...parts: number[]): number {
  let h = 0x811c9dc5;
  for (const p of parts) {
    h = Math.imul(h ^ (p >>> 0), 0x01000193) >>> 0;
    h ^= h >>> 13;
  }
  return h >>> 0;
}

function enterRung(s: StoryState): StoryState {
  const opp = s.ladder[s.rung];
  if (!opp) {
    return s;
  }
  const taunt = opp.isVillain ? pick(makeRng(mix(s.seed, s.rung, s.attempt, 0)), s.pack.villain.taunts) : null;
  return {
    ...s,
    phase: 'intro',
    intro: opp.intro,
    taunt,
    duel: null,
    maxHp: [s.tuning.startHp, s.tuning.startHp],
    history: { attacks: [], guards: [] },
    lastRound: null,
  };
}

/** Throws on a broken pack or an unknown hero: both are build-time mistakes. */
export function createStory(pack: StoryPack, heroId: string, seed: number, tuning: DuelTuning = DEFAULT_TUNING): StoryState {
  const errors = validateStoryPack(pack);
  if (errors.length > 0) {
    throw new Error(`story pack "${pack.slug}" will not play: ${errors.join('; ')}`);
  }
  const ladder = resolveLadder(pack, heroId);
  if (typeof ladder === 'string') {
    throw new Error(ladder);
  }
  const hero = pack.roster.find((f) => f.id === heroId)!;
  return enterRung({
    pack,
    hero: { id: hero.id, name: hero.name, trait: hero.trait, special: hero.special, ...(hero.art ? { art: hero.art } : {}) },
    ladder,
    seed: seed >>> 0,
    tuning,
    rung: 0,
    attempt: 0,
    continues: START_CONTINUES,
    phase: 'intro',
    intro: '',
    taunt: null,
    duel: null,
    maxHp: [tuning.startHp, tuning.startHp],
    history: { attacks: [], guards: [] },
    lastRound: null,
    lastResult: null,
    rounds: 0,
  });
}

export function currentRung(s: StoryState): { number: number; total: number; opponent: Opponent } {
  return { number: s.rung + 1, total: s.ladder.length, opponent: s.ladder[s.rung]! };
}

/**
 * Start the rung's fight at full health. The villain's extra health is an HP
 * override on the fresh duel (hp[1] = startHp × hpScale), not a tuning change,
 * so every hit still does the same damage and the bar just runs longer.
 */
export function beginFight(s: StoryState): StoryState {
  if (s.phase !== 'intro') {
    return s;
  }
  const { opponent } = currentRung(s);
  const start = s.tuning.startHp;
  const foeHp = opponent.isVillain ? Math.round(start * s.pack.villain.hpScale) : start;
  const fresh = createDuel([s.hero, opponent.fighter], s.tuning);
  return {
    ...s,
    phase: 'fight',
    duel: { ...fresh, hp: [start, foeHp] },
    maxHp: [start, foeHp],
    history: { attacks: [], guards: [] },
    lastRound: null,
  };
}

/** the attacker alternates every round, so the human is sometimes defending */
export function humanRole(s: StoryState): 'attack' | 'guard' | null {
  if (s.phase !== 'fight' || !s.duel || s.duel.phase === 'over') {
    return null;
  }
  return s.duel.attacker === HERO ? 'attack' : 'guard';
}

/** The computer's choice for the round about to be played. Peekable on purpose (tests). */
export function aiChoice(s: StoryState): { attack: Attack } | { guard: Guard } | null {
  const role = humanRole(s);
  if (!role || !s.duel) {
    return null;
  }
  const { persona } = currentRung(s).opponent;
  const rng = makeRng(mix(s.seed, s.rung, s.attempt, s.duel.round));
  return role === 'attack'
    ? { guard: aiGuard(s.duel, FOE, persona, rng, s.history) }
    : { attack: aiAttack(s.duel, FOE, persona, rng, s.history) };
}

const ATTACKS: readonly string[] = ['strike', 'sweep', 'grab', 'special'];
const GUARDS: readonly string[] = ['block', 'dodge', 'counter'];

const keep = <T>(list: T[], item: T): T[] => [...list, item].slice(-HISTORY_KEPT);

/**
 * The human's half of the round: an attack when attacking, a guard when
 * defending. Rolls the computer's half with the rung's persona and plays the
 * round through duel.ts. A choice that does not fit (a guard on an attack turn,
 * a special that is still locked) changes nothing.
 */
export function humanPick(s: StoryState, choice: Attack | Guard): StoryState {
  const role = humanRole(s);
  const ai = aiChoice(s);
  if (!role || !ai || !s.duel) {
    return s;
  }
  let attack: Attack;
  let guard: Guard;
  let history: HumanHistory;
  if (role === 'attack') {
    if (!ATTACKS.includes(choice) || !('guard' in ai)) {
      return s;
    }
    attack = choice as Attack;
    if (attack === 'special' && !canSpecial(s.duel, HERO)) {
      return s;
    }
    guard = ai.guard;
    history = { ...s.history, attacks: keep(s.history.attacks, attack) };
  } else {
    if (!GUARDS.includes(choice) || !('attack' in ai)) {
      return s;
    }
    guard = choice as Guard;
    attack = ai.attack;
    history = { ...s.history, guards: keep(s.history.guards, guard) };
  }
  return {
    ...s,
    duel: playRound(s.duel, attack, guard),
    history,
    lastRound: { attack, guard },
    rounds: s.rounds + 1,
  };
}

/**
 * Once a fight is over: a win climbs a rung (or reaches the ending), a loss
 * spends a continue and retries the same rung at full health, and a loss with
 * no continues left ends the story.
 */
export function afterFight(s: StoryState): StoryState {
  if (s.phase !== 'fight' || !s.duel || s.duel.phase !== 'over') {
    return s;
  }
  if (s.duel.winner === HERO) {
    if (s.rung + 1 >= s.ladder.length) {
      return { ...s, phase: 'ending', lastResult: 'won' };
    }
    return enterRung({ ...s, rung: s.rung + 1, attempt: 0, lastResult: 'won' });
  }
  if (s.continues <= 0) {
    return { ...s, phase: 'over', lastResult: 'lost' };
  }
  return enterRung({ ...s, continues: s.continues - 1, attempt: s.attempt + 1, lastResult: 'lost' });
}
