import type {
  Attack,
  DuelState,
  DuelTuning,
  Fighter,
  Guard,
  RoundOutcome,
} from './types';

export const DEFAULT_TUNING: DuelTuning = {
  startHp: 60,
  cleanDamage: 13,
  chipDamage: 3,
  counterDamage: 9,
  specialDamage: 20,
  specialPunish: 14,
  meterToSpecial: 3,
};

/**
 * Each attack is stopped by exactly one guard, and beats the other two. No frame
 * data, no execution: a round is a read and a commitment, so an uncle who never
 * plays can beat a gamer, which is the whole point of a group gift.
 */
const STOPPED_BY: Record<Exclude<Attack, 'special'>, Guard> = {
  strike: 'block',
  sweep: 'dodge',
  grab: 'counter',
};

const LOG_LIMIT = 8;

export function createDuel(
  fighters: [Fighter, Fighter],
  tuning: DuelTuning = DEFAULT_TUNING,
): DuelState {
  return {
    phase: 'picking',
    tuning,
    fighters,
    hp: [tuning.startHp, tuning.startHp],
    meter: [0, 0],
    attacker: 0,
    round: 1,
    picks: {},
    last: null,
    winner: null,
    log: [],
  };
}

export function canSpecial(state: DuelState, side: 0 | 1): boolean {
  return state.meter[side] >= state.tuning.meterToSpecial;
}

/** Pure: what this pair of choices does, before any state is touched. */
export function resolveRound(
  attack: Attack,
  guard: Guard,
  tuning: DuelTuning,
  attackerName: string,
  defenderName: string,
  specialName: string,
): RoundOutcome {
  if (attack === 'special') {
    if (guard === 'counter') {
      return {
        kind: 'special-countered',
        toDefender: 0,
        toAttacker: tuning.specialPunish,
        meterToAttacker: 0,
        meterToDefender: 1,
        line: `${defenderName} קרא את ${specialName} וקטף את ${attackerName}`,
      };
    }
    return {
      kind: 'special',
      toDefender: tuning.specialDamage,
      toAttacker: 0,
      meterToAttacker: 0,
      meterToDefender: 1,
      line: `${specialName}! ${defenderName} ספג את זה במלואו`,
    };
  }

  if (guard === STOPPED_BY[attack]) {
    const countered = attack === 'grab';
    if (countered) {
      return {
        kind: 'countered',
        toDefender: 0,
        toAttacker: tuning.counterDamage,
        meterToAttacker: 0,
        meterToDefender: 2,
        line: `${defenderName} הפך את ${attackerName} באוויר`,
      };
    }
    return {
      kind: 'chipped',
      toDefender: tuning.chipDamage,
      toAttacker: 0,
      meterToAttacker: 1,
      meterToDefender: 1,
      line: `${defenderName} עצר את זה, אבל ספג`,
    };
  }

  if (guard === 'dodge' && attack === 'grab') {
    return {
      kind: 'whiffed',
      toDefender: 0,
      toAttacker: 0,
      meterToAttacker: 1,
      meterToDefender: 1,
      line: `${defenderName} חמק מהאחיזה`,
    };
  }

  return {
    kind: 'clean',
    toDefender: tuning.cleanDamage,
    toAttacker: 0,
    meterToAttacker: 1,
    meterToDefender: 1,
    line: `${attackerName} נכנס נקי`,
  };
}

/** Apply a resolved round and hand the attack to the other side. */
export function playRound(state: DuelState, attack: Attack, guard: Guard): DuelState {
  if (state.phase === 'over') {
    return state;
  }
  const a = state.attacker;
  const d = (1 - a) as 0 | 1;
  if (attack === 'special' && !canSpecial(state, a)) {
    return state;
  }

  const outcome = resolveRound(
    attack,
    guard,
    state.tuning,
    state.fighters[a].name,
    state.fighters[d].name,
    state.fighters[a].special,
  );

  const hp: [number, number] = [...state.hp] as [number, number];
  hp[d] = Math.max(0, hp[d] - outcome.toDefender);
  hp[a] = Math.max(0, hp[a] - outcome.toAttacker);

  const meter: [number, number] = [...state.meter] as [number, number];
  meter[a] = attack === 'special' ? 0 : Math.min(state.tuning.meterToSpecial, meter[a] + outcome.meterToAttacker);
  meter[d] = Math.min(state.tuning.meterToSpecial, meter[d] + outcome.meterToDefender);

  // a round only ever damages one side, so there is no double knockout to settle
  const downed = hp[0] <= 0 || hp[1] <= 0;
  const winner: 0 | 1 | null = !downed ? null : hp[1] <= 0 ? 0 : 1;

  return {
    ...state,
    hp,
    meter,
    attacker: d,
    round: state.round + 1,
    picks: {},
    last: outcome,
    phase: downed ? 'over' : 'picking',
    winner,
    log: [outcome.line, ...state.log].slice(0, LOG_LIMIT),
  };
}

export const ATTACK_LABELS: Record<Attack, string> = {
  strike: 'מכה',
  sweep: 'סחיטת רגליים',
  grab: 'אחיזה',
  special: 'מהלך מיוחד',
};

export const GUARD_LABELS: Record<Guard, string> = {
  block: 'חסימה',
  dodge: 'התחמקות',
  counter: 'קאונטר',
};
