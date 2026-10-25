export interface Fact {
  id: string;
  /** the question the lock asks */
  prompt: string;
  /** the answer only the clue holder can see */
  answer: string;
}

export interface PuzzleTuning {
  locks: number;
  cluesPerLock: number;
  secondsTotal: number;
  strikes: number;
  optionsPerQuestion: number;
}

export interface Question {
  factId: string;
  prompt: string;
  /** shuffled; one of them is the answer */
  options: string[];
  /** who holds the card that says which option is right */
  clueHolder: string;
}

export interface ClueCard {
  factId: string;
  prompt: string;
  answer: string;
}

export interface Lock {
  index: number;
  holder: string;
  questions: Question[];
  /** clue cards keyed by the player who sees them */
  clues: Record<string, ClueCard[]>;
}

export interface PuzzleState {
  phase: 'lobby' | 'live' | 'won' | 'lost';
  seed: number;
  tuning: PuzzleTuning;
  players: string[];
  locks: Lock[];
  current: number;
  strikes: number;
  startedAt: number;
  endsAt: number;
  log: string[];
}
