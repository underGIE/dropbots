import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PUZZLE_TUNING,
  createPuzzle,
  dealLocks,
  factsNeeded,
  startPuzzle,
  submitLock,
  tickPuzzle,
  validateFacts,
  viewFor,
} from '../src/puzzle/locks';
import type { Fact, PuzzleState } from '../src/puzzle/types';

const FACTS: Fact[] = Array.from({ length: 20 }, (_, i) => ({
  id: `f${i + 1}`,
  prompt: `שאלה ${i + 1}`,
  answer: `תשובה ${i + 1}`,
}));
const PLAYERS = ['a', 'b', 'c'];
const T0 = 1_000_000;

function live(players = PLAYERS, seed = 3): PuzzleState {
  return startPuzzle(createPuzzle(FACTS, players, seed), T0);
}

/** the right answers for the current lock, read off the clue cards */
function rightAnswers(state: PuzzleState): string[] {
  const lock = state.locks[state.current]!;
  return lock.questions.map((q) => lock.clues[q.clueHolder]!.find((c) => c.factId === q.factId)!.answer);
}

describe('content rules', () => {
  it('accepts enough unique facts', () => {
    expect(validateFacts(FACTS, DEFAULT_PUZZLE_TUNING, 3)).toEqual([]);
  });

  it('counts how many more facts the customer owes', () => {
    expect(factsNeeded(5, DEFAULT_PUZZLE_TUNING)).toBe(7);
    expect(factsNeeded(20, DEFAULT_PUZZLE_TUNING)).toBe(0);
  });

  it('refuses shared answers, blanks, and too few facts', () => {
    const dupe = [...FACTS.slice(0, 12), { id: 'x', prompt: 'עוד', answer: 'תשובה 1' }];
    expect(validateFacts(dupe, DEFAULT_PUZZLE_TUNING, 3).join(' ')).toContain('share an answer');
    const blank = FACTS.map((f, i) => (i === 0 ? { ...f, answer: ' ' } : f));
    expect(validateFacts(blank, DEFAULT_PUZZLE_TUNING, 3).join(' ')).toContain('missing');
    expect(validateFacts(FACTS.slice(0, 5), DEFAULT_PUZZLE_TUNING, 3).join(' ')).toContain('need 12');
  });

  it('needs enough other players to hold the clues', () => {
    expect(validateFacts(FACTS, { ...DEFAULT_PUZZLE_TUNING, cluesPerLock: 3 }, 3).join(' ')).toContain('at least 4 players');
    expect(validateFacts(FACTS, { ...DEFAULT_PUZZLE_TUNING, cluesPerLock: 3 }, 4)).toEqual([]);
  });
});

describe('dealing', () => {
  it('rotates the lock so everyone holds it', () => {
    const holders = new Set(live().locks.map((l) => l.holder));
    expect(holders).toEqual(new Set(PLAYERS));
  });

  it('never gives the lock holder their own clue', () => {
    for (const lock of live().locks) {
      expect(lock.clues[lock.holder] ?? []).toEqual([]);
      for (const q of lock.questions) {
        expect(q.clueHolder).not.toBe(lock.holder);
      }
    }
  });

  it('uses each fact at most once across the row', () => {
    const used = live().locks.flatMap((l) => l.questions.map((q) => q.factId));
    expect(new Set(used).size).toBe(used.length);
  });

  it('hides the answer among other facts answers', () => {
    const lock = live().locks[0]!;
    for (const q of lock.questions) {
      expect(q.options).toHaveLength(DEFAULT_PUZZLE_TUNING.optionsPerQuestion);
      expect(new Set(q.options).size).toBe(q.options.length);
      const answer = lock.clues[q.clueHolder]!.find((c) => c.factId === q.factId)!.answer;
      expect(q.options).toContain(answer);
      for (const o of q.options) {
        expect(FACTS.some((f) => f.answer === o)).toBe(true);
      }
    }
  });

  it('is the same deal for the same seed', () => {
    expect(JSON.stringify(dealLocks(FACTS, PLAYERS, DEFAULT_PUZZLE_TUNING, 9))).toEqual(
      JSON.stringify(dealLocks(FACTS, PLAYERS, DEFAULT_PUZZLE_TUNING, 9)),
    );
    expect(JSON.stringify(dealLocks(FACTS, PLAYERS, DEFAULT_PUZZLE_TUNING, 9))).not.toEqual(
      JSON.stringify(dealLocks(FACTS, PLAYERS, DEFAULT_PUZZLE_TUNING, 10)),
    );
  });
});

describe('what each phone sees', () => {
  it('the holder sees questions and no answers; others see only their cards', () => {
    const s = live();
    const lock = s.locks[0]!;
    const holderView = viewFor(s, lock.holder);
    expect(holderView.role).toBe('lock');
    expect(holderView.clues).toEqual([]);
    expect(holderView.questions.length).toBe(DEFAULT_PUZZLE_TUNING.cluesPerLock);

    const others = PLAYERS.filter((p) => p !== lock.holder);
    const roles = others.map((p) => viewFor(s, p).role);
    expect(roles.filter((r) => r === 'clue').length).toBeGreaterThan(0);
    for (const p of others) {
      expect(viewFor(s, p).questions).toEqual([]);
    }
  });

  it('alone, you get the cards too, so it is still a quiz', () => {
    const s = live(['solo']);
    const v = viewFor(s, 'solo');
    expect(v.role).toBe('lock');
    expect(v.clues.length).toBe(DEFAULT_PUZZLE_TUNING.cluesPerLock);
  });
});

describe('playing the row', () => {
  it('only the lock holder can submit', () => {
    const s = live();
    const stranger = PLAYERS.find((p) => p !== s.locks[0]!.holder)!;
    expect(submitLock(s, stranger, rightAnswers(s), T0 + 1)).toBe(s);
  });

  it('a right answer opens the lock and moves on', () => {
    const s = live();
    const next = submitLock(s, s.locks[0]!.holder, rightAnswers(s), T0 + 1000);
    expect(next.current).toBe(1);
    expect(next.strikes).toBe(0);
    expect(next.log[0]).toContain('נפתח');
  });

  it('a wrong answer is a strike, three strikes is the end', () => {
    let s = live();
    const holder = s.locks[0]!.holder;
    const wrong = rightAnswers(s).map(() => 'לא זה');
    s = submitLock(s, holder, wrong, T0 + 1);
    s = submitLock(s, holder, wrong, T0 + 2);
    expect(s.phase).toBe('live');
    expect(s.strikes).toBe(2);
    s = submitLock(s, holder, wrong, T0 + 3);
    expect(s.phase).toBe('lost');
  });

  it('opening every lock wins', () => {
    let s = live();
    for (let i = 0; i < DEFAULT_PUZZLE_TUNING.locks; i++) {
      s = submitLock(s, s.locks[s.current]!.holder, rightAnswers(s), T0 + 1000 * (i + 1));
    }
    expect(s.phase).toBe('won');
  });

  it('the clock ends it', () => {
    const s = live();
    expect(tickPuzzle(s, s.endsAt - 1).phase).toBe('live');
    expect(tickPuzzle(s, s.endsAt).phase).toBe('lost');
    expect(submitLock(s, s.locks[0]!.holder, rightAnswers(s), s.endsAt + 1).phase).toBe('lost');
  });
});
