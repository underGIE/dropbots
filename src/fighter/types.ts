/** One of the friends in the group, as a fighter. */
export interface Fighter {
  id: string;
  name: string;
  /** the one trait they are known for — becomes the special move's name */
  trait: string;
  special: string;
  /** two poses and a portrait: never a sprite sheet of a real person */
  art?: { portrait?: string; idle?: string; hit?: string };
}

export type Attack = 'strike' | 'sweep' | 'grab' | 'special';
export type Guard = 'block' | 'dodge' | 'counter';

export interface RoundPick {
  attack: Attack;
  guard: Guard;
}

export type RoundResultKind =
  | 'clean'
  | 'chipped'
  | 'whiffed'
  | 'countered'
  | 'special'
  | 'special-countered';

export interface RoundOutcome {
  kind: RoundResultKind;
  /** damage to the defender */
  toDefender: number;
  /** damage back to the attacker */
  toAttacker: number;
  meterToAttacker: number;
  meterToDefender: number;
  line: string;
}

export interface DuelTuning {
  startHp: number;
  cleanDamage: number;
  chipDamage: number;
  counterDamage: number;
  specialDamage: number;
  specialPunish: number;
  meterToSpecial: number;
}

export interface DuelState {
  phase: 'picking' | 'resolving' | 'over';
  tuning: DuelTuning;
  fighters: [Fighter, Fighter];
  hp: [number, number];
  meter: [number, number];
  /** index of whoever is attacking this round */
  attacker: 0 | 1;
  round: number;
  picks: { attack?: Attack; guard?: Guard };
  last: RoundOutcome | null;
  winner: 0 | 1 | null;
  log: string[];
}
