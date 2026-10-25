import type { Fighter } from './types';

/**
 * Story mode is content, not code: everything that makes it one group's gift
 * (who is in it, who the villain is, what each fight opens with, how it ends)
 * lives in a pack JSON with this shape. See FIGHTER_SPEC.md §story.
 */

export type Persona = 'brawler' | 'turtle' | 'trickster' | 'boss';
export const PERSONAS: readonly Persona[] = ['brawler', 'turtle', 'trickster', 'boss'];

/** the ladder names the villain with this word, never by the villain's id */
export const VILLAIN = 'villain';

/** A friend in the roster. `standIn` is their line when they fill the hero's own rung. */
export interface StoryFighter extends Fighter {
  standIn?: string;
}

export interface Villain extends Fighter {
  taunts: string[];
  intro: string;
  defeatLine: string;
  /** the villain's starting HP is the friends' start HP times this (1–3) */
  hpScale: number;
}

export interface Rung {
  /** a roster id, or "villain" */
  opponent: string;
  /** one line on the card before the fight */
  intro: string;
  persona: Persona;
}

export interface StoryPack {
  slug: string;
  title: string;
  subtitle: string;
  roster: StoryFighter[];
  villain: Villain;
  ladder: Rung[];
  ending: { title: string; text: string };
}

/** One rung as this particular hero meets it, stand-ins already applied. */
export interface Opponent {
  fighter: Fighter;
  persona: Persona;
  intro: string;
  isVillain: boolean;
  /** set when this friend took the rung that was written for the hero */
  standInFor: string | null;
}

const asFighter = (f: Fighter): Fighter => {
  const out: Fighter = { id: f.id, name: f.name, trait: f.trait, special: f.special };
  if (f.art) {
    out.art = { ...f.art };
  }
  return out;
};

/**
 * The ladder as `heroId` climbs it. Nobody fights themself: a rung written for
 * the hero goes to the first friend who is not on the ladder at all (in roster
 * order), and each such friend stands in once. No friend left → an error.
 */
export function resolveLadder(pack: StoryPack, heroId: string): Opponent[] | string {
  const hero = pack.roster.find((f) => f.id === heroId);
  if (!hero) {
    return `there is no fighter "${heroId}" in the roster`;
  }
  const onLadder = new Set(pack.ladder.map((r) => r.opponent));
  const bench = pack.roster.filter((f) => f.id !== heroId && !onLadder.has(f.id));
  const out: Opponent[] = [];
  for (const rung of pack.ladder) {
    if (rung.opponent === VILLAIN) {
      out.push({ fighter: asFighter(pack.villain), persona: rung.persona, intro: rung.intro, isVillain: true, standInFor: null });
      continue;
    }
    if (rung.opponent === heroId) {
      const sub = bench.shift();
      if (!sub) {
        return `if ${hero.name} plays, the ladder makes them fight themself and there is no other friend to take that fight`;
      }
      out.push({
        fighter: asFighter(sub),
        persona: rung.persona,
        intro: sub.standIn ?? `${sub.name} תופס את המקום הפנוי בזירה`,
        isVillain: false,
        standInFor: heroId,
      });
      continue;
    }
    const friend = pack.roster.find((f) => f.id === rung.opponent);
    if (!friend) {
      return `the ladder names "${rung.opponent}", who is not in the roster`;
    }
    out.push({ fighter: asFighter(friend), persona: rung.persona, intro: rung.intro, isVillain: false, standInFor: null });
  }
  return out;
}

const isObj = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);
const isText = (x: unknown): x is string => typeof x === 'string' && x.trim().length > 0;

function checkFighter(x: unknown, where: string, errors: string[]): void {
  if (!isObj(x)) {
    errors.push(`${where} is not a fighter`);
    return;
  }
  for (const key of ['id', 'name', 'trait', 'special'] as const) {
    if (!isText(x[key])) {
      errors.push(`${where} has no ${key}`);
    }
  }
  if (x.art !== undefined && !isObj(x.art)) {
    errors.push(`${where}: art must be an object of picture links`);
  }
}

/**
 * Every problem with a story pack, in plain words. Empty means it will play.
 * Takes `unknown` because packs arrive as JSON from an order form.
 */
export function validateStoryPack(pack: unknown): string[] {
  const errors: string[] = [];
  if (!isObj(pack)) {
    return ['the pack is not a JSON object'];
  }
  for (const key of ['slug', 'title'] as const) {
    if (!isText(pack[key])) {
      errors.push(`the pack has no ${key}`);
    }
  }
  if (typeof pack.subtitle !== 'string') {
    errors.push('the pack has no subtitle (an empty one is fine)');
  }

  const roster = Array.isArray(pack.roster) ? pack.roster : null;
  const ids = new Set<string>();
  if (!roster) {
    errors.push('the pack has no roster');
  } else {
    if (roster.length < 2) {
      errors.push(`the roster needs at least 2 fighters, it has ${roster.length}`);
    }
    roster.forEach((f, i) => {
      checkFighter(f, `fighter ${i + 1} in the roster`, errors);
      if (!isObj(f)) {
        return;
      }
      if (f.standIn !== undefined && !isText(f.standIn)) {
        errors.push(`fighter ${i + 1} in the roster has an empty stand-in line`);
      }
      if (typeof f.id === 'string') {
        if (f.id === VILLAIN) {
          errors.push(`fighter ${i + 1} in the roster uses the id "${VILLAIN}", which is reserved for the villain`);
        }
        if (ids.has(f.id)) {
          errors.push(`two fighters in the roster share the id "${f.id}"`);
        }
        ids.add(f.id);
      }
    });
  }

  const villain = pack.villain;
  if (!isObj(villain)) {
    errors.push('the pack has no villain');
  } else {
    checkFighter(villain, 'the villain', errors);
    if (typeof villain.id === 'string' && ids.has(villain.id)) {
      errors.push(`the villain shares the id "${villain.id}" with someone in the roster`);
    }
    if (!Array.isArray(villain.taunts) || villain.taunts.length === 0) {
      errors.push('the villain has no taunts');
    } else if (!villain.taunts.every(isText)) {
      errors.push('one of the villain\'s taunts is empty');
    }
    if (!isText(villain.intro)) {
      errors.push('the villain has no intro line');
    }
    if (!isText(villain.defeatLine)) {
      errors.push('the villain has no defeat line');
    }
    const scale = villain.hpScale;
    if (typeof scale !== 'number' || !Number.isFinite(scale) || scale < 1 || scale > 3) {
      errors.push('the villain\'s hpScale must be a number from 1 to 3');
    }
  }

  const ladder = Array.isArray(pack.ladder) ? pack.ladder : null;
  if (!ladder || ladder.length === 0) {
    errors.push('the ladder is empty');
  } else {
    ladder.forEach((r, i) => {
      const where = `fight ${i + 1} on the ladder`;
      if (!isObj(r)) {
        errors.push(`${where} is not a fight`);
        return;
      }
      if (!isText(r.opponent)) {
        errors.push(`${where} has no opponent`);
      } else if (r.opponent !== VILLAIN && !ids.has(r.opponent)) {
        errors.push(`${where} names "${r.opponent}", who is not in the roster`);
      }
      if (!isText(r.intro)) {
        errors.push(`${where} has no intro line`);
      }
      if (typeof r.persona !== 'string' || !(PERSONAS as readonly string[]).includes(r.persona)) {
        errors.push(`${where} has persona "${String(r.persona)}"; use one of ${PERSONAS.join(', ')}`);
      }
    });
    const villainRungs = ladder.filter((r) => isObj(r) && r.opponent === VILLAIN).length;
    const last = ladder[ladder.length - 1];
    if (villainRungs !== 1 || !isObj(last) || last.opponent !== VILLAIN) {
      errors.push('the villain must be the last fight on the ladder, and only the last');
    }
  }

  const ending = pack.ending;
  if (!isObj(ending) || !isText(ending.title) || !isText(ending.text)) {
    errors.push('the ending needs a title and a text');
  }

  // only once the shape is sound: walk the ladder as each possible hero
  if (errors.length === 0) {
    const sound = pack as unknown as StoryPack;
    for (const f of sound.roster) {
      const result = resolveLadder(sound, f.id);
      if (typeof result === 'string') {
        errors.push(result);
      }
    }
  }
  return errors;
}
