import type { ThemePack } from '../engine/types';
import type { StoryPack } from '../fighter/story-types';
import type { Fact, PuzzleTuning } from '../puzzle/types';
import type { Crowd, World } from './build-pack';

/**
 * ONE order feeds every engine. The customer fills this once; each game page
 * derives its own pack from it, deterministically, so every phone that opens
 * the same link builds the same game.
 */
export interface Order {
  version: 1;
  /** who the gift is for — printed on every intro card */
  names: string[];
  players: number;
  occasion: string;
  world: World;
  crowd: Crowd;
  /** DROPBOTS: the inside jokes that become controls */
  jokes: string[];
  /** THE LOCKS: questions about the group with their answers */
  facts: Fact[];
  /** the fighter: one trait per person; the roster is built from `names` */
  traits: Record<string, string>;
  /** the fighter: the villain the group names */
  villain: { name: string; trait: string; why: string; taunts: string[] } | null;
  /** iso timestamp; also the seed for every deterministic build */
  createdAt: string;
}

export type EngineId = 'party' | 'locks' | 'fight' | 'motion' | 'shanzia';

export interface EngineReadiness {
  engine: EngineId;
  /** can a phone play this right now from this order */
  ready: boolean;
  /** plain Hebrew, what the customer still has to add */
  missing: string[];
}

export interface BuiltOrder {
  party: ThemePack;
  locks: { facts: Fact[]; tuning: PuzzleTuning } | null;
  story: StoryPack | null;
  readiness: EngineReadiness[];
}

export function emptyOrder(): Order {
  return {
    version: 1,
    names: [],
    players: 2,
    occasion: '',
    world: 'techno',
    crowd: 'mixed',
    jokes: [],
    facts: [],
    traits: {},
    villain: null,
    createdAt: new Date().toISOString(),
  };
}

/** An order from a link is untrusted: check the shape before building from it. */
export function looksLikeOrder(value: unknown): value is Order {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const o = value as Partial<Order>;
  return (
    o.version === 1 &&
    Array.isArray(o.names) &&
    typeof o.players === 'number' &&
    typeof o.occasion === 'string' &&
    typeof o.world === 'string' &&
    typeof o.crowd === 'string' &&
    Array.isArray(o.jokes) &&
    Array.isArray(o.facts) &&
    typeof o.traits === 'object' &&
    o.traits !== null &&
    typeof o.createdAt === 'string'
  );
}
