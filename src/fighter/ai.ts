import { canSpecial } from './duel';
import type { Persona } from './story-types';
import type { Attack, DuelState, Guard } from './types';

/**
 * The computer's half of a round in story mode. Pure: the same state, persona,
 * history and rng give the same choice. Each persona is a weighted table over
 * the three ordinary choices; only the boss looks at what the human has done.
 */

/** The human's most recent choices in this fight, oldest first. */
export interface HumanHistory {
  attacks: Attack[];
  guards: Guard[];
}

type Basic = Exclude<Attack, 'special'>;

const NO_HISTORY: HumanHistory = { attacks: [], guards: [] };

export const ATTACK_TABLE: Record<Persona, Record<Basic, number>> = {
  brawler: { strike: 6, sweep: 2, grab: 2 },
  turtle: { strike: 4, sweep: 4, grab: 2 },
  trickster: { strike: 2, sweep: 3, grab: 5 },
  boss: { strike: 3, sweep: 3, grab: 3 },
};

export const GUARD_TABLE: Record<Persona, Record<Guard, number>> = {
  brawler: { block: 5, dodge: 2, counter: 3 },
  turtle: { block: 5, dodge: 1, counter: 4 },
  trickster: { block: 2, dodge: 5, counter: 3 },
  boss: { block: 3, dodge: 3, counter: 3 },
};

/** chance of firing the special on a turn it is available; the boss never waits */
export const SPECIAL_CHANCE: Record<Persona, number> = {
  brawler: 0.7,
  turtle: 0.35,
  trickster: 0.5,
  boss: 1,
};

/** mirrors duel.ts: the one guard that stops each attack */
const STOPS: Record<Attack, Guard> = { strike: 'block', sweep: 'dodge', grab: 'counter', special: 'counter' };

/** the ordinary attacks that land clean on each guard (a grab into a dodge only whiffs) */
const CLEAN_ON: Record<Guard, Basic[]> = {
  block: ['sweep', 'grab'],
  dodge: ['strike'],
  counter: ['strike', 'sweep'],
};

/** how much the boss leans on each of the human's last two choices: "a little" */
const BOSS_READ = 2;
const BOSS_FEAR_OF_SPECIAL = 3;

function weighted<K extends string>(rng: () => number, table: Record<K, number>): K {
  const keys = Object.keys(table) as K[];
  const total = keys.reduce((n, k) => n + table[k], 0);
  let r = rng() * total;
  for (const k of keys) {
    r -= table[k];
    if (r < 0) {
      return k;
    }
  }
  return keys[keys.length - 1]!;
}

export function aiAttack(
  state: DuelState,
  side: 0 | 1,
  persona: Persona,
  rng: () => number,
  history: HumanHistory = NO_HISTORY,
): Attack {
  if (canSpecial(state, side) && (persona === 'boss' || rng() < SPECIAL_CHANCE[persona])) {
    return 'special';
  }
  const table = { ...ATTACK_TABLE[persona] };
  if (persona === 'boss') {
    for (const g of history.guards.slice(-2)) {
      for (const a of CLEAN_ON[g]) {
        table[a] += BOSS_READ;
      }
    }
  }
  return weighted(rng, table);
}

export function aiGuard(
  state: DuelState,
  side: 0 | 1,
  persona: Persona,
  rng: () => number,
  history: HumanHistory = NO_HISTORY,
): Guard {
  const table = { ...GUARD_TABLE[persona] };
  if (persona === 'boss') {
    for (const a of history.attacks.slice(-2)) {
      table[STOPS[a]] += BOSS_READ;
    }
    if (canSpecial(state, (1 - side) as 0 | 1)) {
      table.counter += BOSS_FEAR_OF_SPECIAL;
    }
  }
  return weighted(rng, table);
}
