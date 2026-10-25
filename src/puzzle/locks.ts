import { makeRng, shuffled } from '../engine/rng';
import type { ClueCard, Fact, Lock, PuzzleState, PuzzleTuning, Question } from './types';

export const DEFAULT_PUZZLE_TUNING: PuzzleTuning = {
  locks: 6,
  cluesPerLock: 2,
  secondsTotal: 300,
  strikes: 3,
  optionsPerQuestion: 4,
};

const LOG_LIMIT = 8;

/** What would make this content unplayable, in plain words. */
export function validateFacts(facts: Fact[], tuning: PuzzleTuning, playerCount: number): string[] {
  const errors: string[] = [];
  const needed = tuning.locks * tuning.cluesPerLock;
  if (facts.length < needed) {
    errors.push(`need ${needed} facts for ${tuning.locks} locks, have ${facts.length}`);
  }
  const answers = new Set(facts.map((f) => f.answer.trim()));
  if (answers.size !== facts.length) {
    errors.push('two facts share an answer — the options would give it away');
  }
  if (facts.some((f) => f.prompt.trim() === '' || f.answer.trim() === '')) {
    errors.push('a fact is missing its question or its answer');
  }
  if (facts.length < tuning.optionsPerQuestion) {
    errors.push(`need at least ${tuning.optionsPerQuestion} facts to build the wrong options`);
  }
  if (playerCount > 1 && tuning.cluesPerLock > playerCount - 1) {
    errors.push(`${tuning.cluesPerLock} clues per lock needs at least ${tuning.cluesPerLock + 1} players`);
  }
  return errors;
}

/** How many more facts the customer should write before this is a real round. */
export function factsNeeded(have: number, tuning: PuzzleTuning): number {
  return Math.max(0, tuning.locks * tuning.cluesPerLock - have);
}

/**
 * Deal the whole row up front, deterministically. The lock rotates through the
 * players; each clue goes to a different player who is not the lock holder,
 * so the answer is always in somebody else's hands.
 */
export function dealLocks(facts: Fact[], players: string[], tuning: PuzzleTuning, seed: number): Lock[] {
  const rng = makeRng(seed);
  const pool = shuffled(rng, facts);
  const allAnswers = facts.map((f) => f.answer);
  const locks: Lock[] = [];
  const solo = players.length === 1;

  for (let i = 0; i < tuning.locks; i++) {
    const holder = players[i % players.length] as string;
    const others = solo ? players : players.filter((p) => p !== holder);
    const assignees = shuffled(rng, others);
    const picked = pool.slice(i * tuning.cluesPerLock, (i + 1) * tuning.cluesPerLock);

    const clues: Record<string, ClueCard[]> = {};
    const questions: Question[] = picked.map((fact, k) => {
      const clueHolder = assignees[k % assignees.length] as string;
      (clues[clueHolder] ??= []).push({ factId: fact.id, prompt: fact.prompt, answer: fact.answer });
      const wrong = shuffled(
        rng,
        allAnswers.filter((a) => a !== fact.answer),
      ).slice(0, Math.max(1, tuning.optionsPerQuestion - 1));
      return {
        factId: fact.id,
        prompt: fact.prompt,
        options: shuffled(rng, [fact.answer, ...wrong]),
        clueHolder,
      };
    });

    locks.push({ index: i, holder, questions, clues });
  }
  return locks;
}

export function createPuzzle(
  facts: Fact[],
  players: string[],
  seed: number,
  tuning: PuzzleTuning = DEFAULT_PUZZLE_TUNING,
): PuzzleState {
  return {
    phase: 'lobby',
    seed,
    tuning,
    players,
    locks: dealLocks(facts, players, tuning, seed),
    current: 0,
    strikes: 0,
    startedAt: 0,
    endsAt: 0,
    log: [],
  };
}

export function startPuzzle(state: PuzzleState, now: number): PuzzleState {
  return {
    ...state,
    phase: 'live',
    startedAt: now,
    endsAt: now + state.tuning.secondsTotal * 1000,
  };
}

export function currentLock(state: PuzzleState): Lock | null {
  return state.locks[state.current] ?? null;
}

/** The lock holder submits one answer per question, in question order. */
export function submitLock(state: PuzzleState, by: string, answers: string[], now: number): PuzzleState {
  if (state.phase !== 'live') {
    return state;
  }
  const lock = currentLock(state);
  if (!lock || by !== lock.holder) {
    return state;
  }
  if (now >= state.endsAt) {
    return { ...state, phase: 'lost', log: push(state.log, 'נגמר הזמן') };
  }

  const correct = lock.questions.every((q, i) => {
    const fact = lock.clues[q.clueHolder]?.find((c) => c.factId === q.factId);
    return fact !== undefined && answers[i] === fact.answer;
  });

  if (!correct) {
    const strikes = state.strikes + 1;
    const lost = strikes >= state.tuning.strikes;
    return {
      ...state,
      strikes,
      phase: lost ? 'lost' : 'live',
      log: push(state.log, lost ? 'המנעול ננעל לתמיד' : `טעות — ${state.tuning.strikes - strikes} נותרו`),
    };
  }

  const next = state.current + 1;
  const won = next >= state.locks.length;
  return {
    ...state,
    current: next,
    phase: won ? 'won' : 'live',
    log: push(state.log, won ? 'הדלת נפתחה' : `מנעול ${lock.index + 1} נפתח`),
  };
}

export function tickPuzzle(state: PuzzleState, now: number): PuzzleState {
  if (state.phase === 'live' && now >= state.endsAt) {
    return { ...state, phase: 'lost', log: push(state.log, 'נגמר הזמן') };
  }
  return state;
}

/** What one phone is allowed to see of the current lock. */
export function viewFor(state: PuzzleState, player: string): {
  role: 'lock' | 'clue' | 'idle';
  questions: Question[];
  clues: ClueCard[];
} {
  const lock = currentLock(state);
  if (!lock) {
    return { role: 'idle', questions: [], clues: [] };
  }
  const solo = state.players.length === 1;
  if (lock.holder === player) {
    return { role: 'lock', questions: lock.questions, clues: solo ? (lock.clues[player] ?? []) : [] };
  }
  const clues = lock.clues[player] ?? [];
  return { role: clues.length > 0 ? 'clue' : 'idle', questions: [], clues };
}

function push(log: string[], line: string): string[] {
  return [line, ...log].slice(0, LOG_LIMIT);
}
