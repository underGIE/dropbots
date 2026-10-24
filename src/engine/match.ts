import { makeRng, pick, shuffled } from './rng';
import type { ControlDef, Instruction, MatchState, ThemePack } from './types';

export const MIN_DECK = 4;
export const MAX_DECK = 8;
const DROP_WINDOW_MS = 8000;
const MIN_DEADLINE_MS = 2000;
const FEED_LEN = 6;

export interface PlayerSeat {
  id: string;
  name: string;
}

/** Everything that would make a pack unplayable, in plain words. */
export function validatePack(pack: ThemePack, playerCount: number): string[] {
  const errors: string[] = [];
  if (playerCount < 1) {
    errors.push('need at least one player');
  }
  if (pack.controls.length < playerCount * MIN_DECK) {
    errors.push(
      `pack has ${pack.controls.length} controls, needs ${playerCount * MIN_DECK} for ${playerCount} players`,
    );
  }
  if (pack.instructionTemplates.length === 0) {
    errors.push('pack has no instruction templates');
  }
  if (new Set(pack.controls.map((c) => c.id)).size !== pack.controls.length) {
    errors.push('duplicate control ids');
  }
  if (pack.controls.some((c) => c.label.trim() === '')) {
    errors.push('a control has an empty label');
  }
  return errors;
}

export function deckSize(controlCount: number, playerCount: number): number {
  const even = Math.floor(controlCount / Math.max(1, playerCount));
  return Math.max(MIN_DECK, Math.min(MAX_DECK, even));
}

export function createMatch(pack: ThemePack, seats: PlayerSeat[], seed: number): MatchState {
  const names: Record<string, string> = {};
  for (const seat of seats) {
    names[seat.id] = seat.name;
  }
  return {
    phase: 'lobby',
    seed,
    rolls: 0,
    tuning: pack.tuning,
    templates: pack.instructionTemplates,
    players: seats.map((s) => s.id),
    names,
    decks: {},
    instructions: {},
    hype: pack.tuning.startHype,
    score: 0,
    dropsFired: 0,
    startedAt: 0,
    inDrop: false,
    dropUntil: 0,
    won: false,
    feed: [],
  };
}

function draw(state: MatchState): { rng: () => number; rolls: number } {
  return { rng: makeRng(state.seed + state.rolls), rolls: state.rolls + 1 };
}

export function dealDecks(state: MatchState, pack: ThemePack): MatchState {
  const { rng, rolls } = draw(state);
  const per = deckSize(pack.controls.length, state.players.length);
  const pool = shuffled(rng, pack.controls);
  const decks: Record<string, ControlDef[]> = {};
  state.players.forEach((id, index) => {
    decks[id] = pool.slice(index * per, index * per + per);
  });
  return { ...state, rolls, decks };
}

/** Milliseconds a player gets to find a control, right now. */
export function deadlineMs(state: MatchState): number {
  const decay = Math.pow(0.92, state.dropsFired);
  const base = state.tuning.baseDeadlineMs * decay * (state.inDrop ? 0.6 : 1);
  return Math.max(MIN_DEADLINE_MS, Math.round(base));
}

function hypeStep(state: MatchState, direction: 'up' | 'down'): number {
  const raw = direction === 'up' ? state.tuning.hypeUp : state.tuning.hypeDown;
  return state.inDrop ? raw * 2 : raw;
}

function addFeed(state: MatchState, line: string): string[] {
  return [line, ...state.feed].slice(0, FEED_LEN);
}

/**
 * Roll a fresh instruction for one reader. The control it names belongs to
 * somebody else whenever there is somebody else — that is the whole game.
 */
export function rollInstruction(state: MatchState, reader: string, now: number): MatchState {
  const solo = state.players.length === 1;
  const candidates = solo ? state.players : state.players.filter((p) => p !== reader);
  const live = new Set(
    Object.values(state.instructions)
      .filter((i) => i.reader !== reader)
      .map((i) => i.controlId),
  );

  let next = { ...state };
  const { rng, rolls } = draw(next);
  next = { ...next, rolls };

  const owner = pick(rng, candidates);
  const deck = next.decks[owner] ?? [];
  const free = deck.filter((c) => !live.has(c.id));
  const control = pick(rng, free.length > 0 ? free : deck);
  const template = pick(rng, next.templates);

  const instruction: Instruction = {
    reader,
    owner,
    controlId: control.id,
    text: template.replace('{label}', control.label),
    deadlineAt: now + deadlineMs(next),
  };
  return { ...next, instructions: { ...next.instructions, [reader]: instruction } };
}

export function startMatch(state: MatchState, pack: ThemePack, now: number): MatchState {
  let next = dealDecks(state, pack);
  next = {
    ...next,
    phase: 'live',
    startedAt: now,
    instructions: {},
    templates: pack.instructionTemplates,
  };
  for (const reader of next.players) {
    next = rollInstruction(next, reader, now);
  }
  return next;
}

/** A player hit one of their own pads. */
export function press(state: MatchState, playerId: string, controlId: string, now: number): MatchState {
  if (state.phase !== 'live') {
    return state;
  }
  const hit = Object.values(state.instructions).find(
    (i) => i.owner === playerId && i.controlId === controlId,
  );
  const label =
    (state.decks[playerId] ?? []).find((c) => c.id === controlId)?.label ?? controlId;

  if (!hit) {
    const hype = Math.max(0, state.hype - hypeStep(state, 'down'));
    return settle({ ...state, hype, feed: addFeed(state, `✗ ${label}`) });
  }

  let next: MatchState = {
    ...state,
    hype: Math.min(100, state.hype + hypeStep(state, 'up')),
    score: state.score + 1,
    feed: addFeed(state, `✓ ${label}`),
  };
  const remaining = { ...next.instructions };
  delete remaining[hit.reader];
  next = { ...next, instructions: remaining };
  next = rollInstruction(next, hit.reader, now);
  return settle(next);
}

/** Time passing: expiries and drop waves. */
export function tick(state: MatchState, now: number): MatchState {
  if (state.phase !== 'live') {
    return state;
  }
  let next = { ...state };

  const elapsedSec = (now - next.startedAt) / 1000;
  const due = Math.floor(elapsedSec / Math.max(1, next.tuning.dropEverySec));
  if (due > next.dropsFired) {
    next = {
      ...next,
      dropsFired: due,
      inDrop: true,
      dropUntil: now + DROP_WINDOW_MS,
      feed: addFeed(next, '⚡ DROP'),
    };
  } else if (next.inDrop && now >= next.dropUntil) {
    next = { ...next, inDrop: false };
  }

  for (const instruction of Object.values(next.instructions)) {
    if (instruction.deadlineAt <= now) {
      next = {
        ...next,
        hype: Math.max(0, next.hype - hypeStep(next, 'down')),
        feed: addFeed(next, '⏱ פספוס'),
      };
      const remaining = { ...next.instructions };
      delete remaining[instruction.reader];
      next = { ...next, instructions: remaining };
      next = rollInstruction(next, instruction.reader, now);
    }
  }
  return settle(next);
}

function settle(state: MatchState): MatchState {
  if (state.score >= state.tuning.targetScore) {
    return { ...state, phase: 'over', won: true };
  }
  if (state.hype <= 0) {
    return { ...state, phase: 'over', won: false, hype: 0 };
  }
  return state;
}
