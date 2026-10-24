import { MIN_DECK, validatePack } from '../engine/match';
import type { ControlDef, Skin, ThemePack, Tuning } from '../engine/types';

export type World = 'techno' | 'trance' | 'disco' | 'hiphop';
export type Crowd = 'kids' | 'mixed' | 'adults';

export interface Answers {
  /** who is getting the gift — printed before the first round */
  names: string[];
  /** how many phones will be in the room */
  players: number;
  /** the inside jokes: these become the controls, and they are the whole gift */
  jokes: string[];
  world: World;
  crowd: Crowd;
  occasion: string;
}

export interface BuiltPack {
  pack: ThemePack;
  /** how many more jokes they should write before this is a good gift */
  jokesNeeded: number;
  /** controls we had to invent because they did not write enough */
  filledIn: number;
  errors: string[];
}

const SKINS: Record<World, Skin> = {
  techno: { bg: '#07080c', box: '#121622', box2: '#1b2233', ink: '#e8f1ff', dim: '#7c8aa3', ok: '#17e5b0', bad: '#ff3b6b', hot: '#b14cff' },
  trance: { bg: '#060b1f', box: '#101a38', box2: '#17254d', ink: '#eaf4ff', dim: '#8098c4', ok: '#36d8ff', bad: '#ff5d7a', hot: '#9ad7ff' },
  disco: { bg: '#140d0a', box: '#241812', box2: '#32221a', ink: '#fff3e2', dim: '#b79a86', ok: '#f0b429', bad: '#e2574c', hot: '#ff5fa2' },
  hiphop: { bg: '#0d0d0d', box: '#1b1b1b', box2: '#272727', ink: '#f5f5f5', dim: '#9a9a9a', ok: '#ff7a1a', bad: '#d93b3b', hot: '#ffd166' },
};

const TEMPLATES: Record<World, string[]> = {
  techno: ['{label} — עכשיו!', 'מי על {label}?', 'תן {label}', '{label}, לפני הדרופ!'],
  trance: ['תרים {label}', '{label}, לאט…', 'מי לוקח {label}?', 'עכשיו {label}!'],
  disco: ['{label}!', 'הקהל רוצה {label}', 'מהר — {label}', 'תן לי {label}'],
  hiphop: ['{label}!', 'מי על {label}?', 'תזרוק {label}', '{label}, עכשיו עכשיו'],
};

/** Filler so a thin order is still playable — every one of these is a worse gift. */
const FALLBACK: Record<World, string[]> = {
  techno: ['תוריד את הבס', 'תרים את הפילטר', 'סירנה', 'תאט את הקצב', 'ריברב ענק', 'תוריד הכל', 'דאבל דרופ', 'תן לופ'],
  trance: ['תרים את הפאד', 'הפוגה', 'סופר-סו', 'תן ארפג׳יו', 'ריברב ענק', 'תוריד הכל', 'עלייה', 'דרופ'],
  disco: ['מחיאות כפיים', 'כדור מראות', 'תן גיטרה', 'קלאפ', 'שריקה', 'תוריד הכל', 'בס דיסקו', 'צעקה של הקהל'],
  hiphop: ['סקראצ׳', 'בום בפ', 'תשתיק את הווקאל', 'צופר', 'תן לופ', 'תוריד הכל', 'בס כבד', 'אייר הורן'],
};

const KINDS = ['pad', 'knob', 'fader', 'fx'] as const;

const TUNING: Record<Crowd, Tuning> = {
  kids: { targetScore: 15, startHype: 65, baseDeadlineMs: 9000, dropEverySec: 40, hypeUp: 5, hypeDown: 5 },
  mixed: { targetScore: 20, startHype: 60, baseDeadlineMs: 7500, dropEverySec: 35, hypeUp: 4, hypeDown: 6 },
  adults: { targetScore: 25, startHype: 55, baseDeadlineMs: 6500, dropEverySec: 30, hypeUp: 4, hypeDown: 7 },
};

export function slugify(occasion: string): string {
  const clean = occasion.trim().replace(/\s+/g, '-').slice(0, 24);
  return clean === '' ? 'gift' : clean;
}

/**
 * Turn the six intake answers into a pack. Pure: the form, a script or a test
 * can all call it, and the result is validated with the engine's own rules.
 */
export function buildPack(answers: Answers): BuiltPack {
  const players = Math.max(1, Math.min(4, answers.players));
  const wanted = players * MIN_DECK * 2; // two decks' worth each, so decks stay interesting
  const jokes = answers.jokes.map((j) => j.trim()).filter((j) => j !== '');
  const unique = [...new Set(jokes)];

  const filler = FALLBACK[answers.world].filter((f) => !unique.includes(f));
  const labels = [...unique, ...filler].slice(0, Math.max(wanted, players * MIN_DECK));
  // a four-phone table needs 16 controls; the filler bank alone cannot promise that
  for (let n = 1; labels.length < players * MIN_DECK; n++) {
    const spare = `ערוץ ${n}`;
    if (!labels.includes(spare)) {
      labels.push(spare);
    }
  }
  const filledIn = Math.max(0, labels.length - unique.length);

  const controls: ControlDef[] = labels.map((label, i) => ({
    id: `c${String(i + 1).padStart(2, '0')}`,
    label,
    kind: KINDS[i % KINDS.length]!,
  }));

  const pack: ThemePack = {
    slug: slugify(answers.occasion),
    title: 'DROPBOTS',
    subtitle: answers.occasion.trim() || 'הקהל מחכה. תצעקו אחד על השני.',
    intro: { names: answers.names.map((n) => n.trim()).filter((n) => n !== '') },
    theme: SKINS[answers.world],
    tuning: TUNING[answers.crowd],
    instructionTemplates: TEMPLATES[answers.world],
    controls,
  };

  return {
    pack,
    jokesNeeded: Math.max(0, wanted - unique.length),
    filledIn,
    errors: validatePack(pack, players),
  };
}
