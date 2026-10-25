import type { Persona, StoryFighter, StoryPack, Villain } from '../fighter/story-types';
import { validateStoryPack } from '../fighter/story-types';
import { DEFAULT_PUZZLE_TUNING, validateFacts } from '../puzzle/locks';
import type { Fact, PuzzleTuning } from '../puzzle/types';
import { buildPack } from './build-pack';
import type { BuiltOrder, EngineReadiness, Order } from './order-types';

const MIN_FACTS = 8;
const FRIEND_PERSONAS: readonly Persona[] = ['brawler', 'turtle', 'trickster'];

const clean = (xs: string[]): string[] => [...new Set(xs.map((x) => x.trim()).filter((x) => x !== ''))];

/**
 * One order in, every engine's pack out. Deterministic: no randomness here, so
 * every phone that opens the same link builds the same games.
 */
export function buildAll(order: Order): BuiltOrder {
  const names = clean(order.names);
  const party = buildParty(order, names);
  const locks = buildLocks(order);
  const story = buildStory(order, names);

  const readiness: EngineReadiness[] = [
    party.readiness,
    locks.readiness,
    story.readiness,
    { engine: 'motion', ready: false, missing: ['בקרוב — מחכה לפסק-דין על החיישנים'] },
    { engine: 'shanzia', ready: false, missing: ['בקרוב — הפורט מהאייפון'] },
  ];

  return { party: party.pack, locks: locks.pack, story: story.pack, readiness };
}

function buildParty(order: Order, names: string[]) {
  const built = buildPack({
    names,
    players: order.players,
    jokes: order.jokes,
    world: order.world,
    crowd: order.crowd,
    occasion: order.occasion,
  });
  const missing: string[] = [];
  if (built.jokesNeeded > 0) {
    missing.push(`עוד ${built.jokesNeeded} בדיחות כדי שלא ייכנס אף פקד גנרי (כרגע ${built.filledIn})`);
  }
  // playable with filler; the missing lines are advice, not a block
  return { pack: built.pack, readiness: { engine: 'party' as const, ready: built.errors.length === 0, missing } };
}

function buildLocks(order: Order) {
  const facts: Fact[] = order.facts
    .map((f, i) => ({ id: `f${String(i + 1).padStart(2, '0')}`, prompt: f.prompt.trim(), answer: f.answer.trim() }))
    .filter((f) => f.prompt !== '' && f.answer !== '');
  const unique = facts.filter((f, i) => facts.findIndex((g) => g.answer === f.answer) === i);

  const secondsTotal = order.crowd === 'kids' ? 420 : order.crowd === 'adults' ? 240 : 300;
  const lockCount = unique.length >= 12 ? 6 : unique.length >= 10 ? 5 : 4;
  // two phones means one holds the lock and one holds the clue: one clue per lock
  const cluesPerLock = Math.max(1, Math.min(2, order.players - 1));
  const tuning: PuzzleTuning = { ...DEFAULT_PUZZLE_TUNING, locks: lockCount, cluesPerLock, secondsTotal };

  const missing: string[] = [];
  if (unique.length < MIN_FACTS) {
    missing.push(`עוד ${MIN_FACTS - unique.length} עובדות על המשפחה (מינימום ${MIN_FACTS}, שש מנעולים צריכים 12)`);
  }
  if (unique.length < facts.length) {
    missing.push(`${facts.length - unique.length} עובדות חולקות תשובה — כל תשובה חייבת להיות שונה`);
  }
  const players = Math.max(2, order.players);
  const errors = unique.length >= MIN_FACTS ? validateFacts(unique, tuning, players) : [];
  const ready = missing.length === 0 && errors.length === 0;
  return {
    pack: ready ? { facts: unique, tuning } : null,
    readiness: { engine: 'locks' as const, ready, missing: [...missing, ...errors] },
  };
}

const RUNG_LINES = [
  (n: string, t: string) => `${n} פותח/ת את הערב. ${t} — וזה בדיוק מה שתראו עכשיו.`,
  (n: string, t: string) => `${n} חיכה/תה לזה כל השנה. ${t}, זוכרים?`,
  (n: string, t: string) => `אחרון/ה לפני הסוף: ${n}. ${t}, ואין לאן לברוח.`,
];

function buildStory(order: Order, names: string[]) {
  const missing: string[] = [];
  if (names.length < 2) {
    missing.push('צריך לפחות שני שמות כדי שיהיה קרב');
  }
  const v = order.villain;
  if (!v || v.name.trim() === '') {
    missing.push('מי הנבל? שם אחד, ולמה דווקא הוא');
  }
  const untraited = names.filter((n) => !(order.traits[n] ?? '').trim());
  if (untraited.length > 0) {
    missing.push(`תכונה אחת לכל אחד — חסר ל: ${untraited.join(', ')}`);
  }
  if (missing.length > 0 || !v) {
    return { pack: null, readiness: { engine: 'fight' as const, ready: false, missing } };
  }

  const roster: StoryFighter[] = names.map((name, i) => {
    const trait = (order.traits[name] ?? '').trim();
    return {
      id: `f${i + 1}`,
      name,
      trait,
      special: `${trait} של ${name}`,
      standIn: `${name} קופץ/ת במקום — ${trait}, כרגיל.`,
    };
  });

  const vTrait = v.trait.trim() || 'תמיד צודק';
  const taunts = clean(v.taunts);
  const villain: Villain = {
    id: 'villain',
    name: v.name.trim(),
    trait: vTrait,
    special: `${vTrait} של ${v.name.trim()}`,
    taunts: taunts.length > 0 ? taunts : [`${v.name.trim()}: "אתם באמת חושבים שתנצחו אותי?"`, 'עוד לא נולד מי שיפיל אותי.'],
    intro: v.why.trim() || `${v.name.trim()} מחכה למעלה. כולכם יודעים למה.`,
    defeatLine: `${v.name.trim()} יורד/ת מהמסך. החבורה ניצחה.`,
    hpScale: 1.5,
  };

  // leave at least one friend off the ladder so there is always a stand-in
  const friends = Math.max(1, Math.min(3, roster.length - 1));
  const ladder = roster.slice(0, friends).map((f, i) => ({
    opponent: f.id,
    intro: (RUNG_LINES[i] ?? RUNG_LINES[0]!)(f.name, f.trait),
    persona: FRIEND_PERSONAS[i % FRIEND_PERSONAS.length]!,
  }));
  ladder.push({ opponent: 'villain', intro: villain.intro, persona: 'boss' });

  const occasion = order.occasion.trim();
  const pack: StoryPack = {
    slug: `story-${order.createdAt.slice(0, 10)}`,
    title: occasion || 'הקרב',
    subtitle: `${roster.length} חברים, ${ladder.length} קרבות. למעלה מחכה ${villain.name}.`,
    roster,
    villain,
    ladder,
    ending: {
      title: `${villain.name} נפל/ה`,
      text: occasion ? `${occasion} — נגמר כמו שצריך. ${names.join(', ')}: זה היה שלכם.` : `${names.join(', ')}: זה היה שלכם.`,
    },
  };
  const errors = validateStoryPack(pack);
  return {
    pack: errors.length === 0 ? pack : null,
    readiness: { engine: 'fight' as const, ready: errors.length === 0, missing: errors },
  };
}
