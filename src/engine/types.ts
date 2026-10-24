export type ControlKind = 'pad' | 'knob' | 'fader' | 'fx';

export interface ControlDef {
  id: string;
  label: string;
  kind: ControlKind;
}

export interface Tuning {
  targetScore: number;
  startHype: number;
  baseDeadlineMs: number;
  dropEverySec: number;
  hypeUp: number;
  hypeDown: number;
}

export interface ThemePack {
  slug: string;
  title: string;
  subtitle: string;
  intro: { names: string[] };
  controls: ControlDef[];
  instructionTemplates: string[];
  tuning: Tuning;
}

export interface Instruction {
  /** who sees it on their screen and reads it out loud */
  reader: string;
  /** who owns the control and must press it */
  owner: string;
  controlId: string;
  text: string;
  deadlineAt: number;
}

export type Phase = 'lobby' | 'live' | 'over';

export interface MatchState {
  phase: Phase;
  seed: number;
  /** how many random draws have happened — keeps the engine deterministic */
  rolls: number;
  tuning: Tuning;
  /** instruction phrasings, copied from the pack at create time */
  templates: string[];
  players: string[];
  names: Record<string, string>;
  decks: Record<string, ControlDef[]>;
  /** one live instruction per reader */
  instructions: Record<string, Instruction>;
  hype: number;
  score: number;
  dropsFired: number;
  /** ms timestamp the match went live */
  startedAt: number;
  /** true while a drop wave is running */
  inDrop: boolean;
  dropUntil: number;
  won: boolean;
  /** rolling feed of what just happened, newest first */
  feed: string[];
}
