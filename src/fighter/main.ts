import { ATTACK_LABELS, GUARD_LABELS, canSpecial, createDuel, playRound } from './duel';
import { DuelRoom, type DuelView } from './net';
import { START_CONTINUES, afterFight, beginFight, createStory, currentRung, humanPick, humanRole, type StoryState } from './story';
import { validateStoryPack, type StoryPack } from './story-types';
import type { Attack, DuelState, Fighter, Guard } from './types';
import storyPackJson from '../../packs/fighter-demo.json';
import { buildAll } from '../order/build-all';
import { orderFromParams } from '../share/order-link';
import { selectTransport } from '../transport/select';
import './fighter.css';

const app = document.getElementById('app')!;

const DEFAULTS: [Fighter, Fighter] = [
  { id: 'f1', name: 'אבי', trait: 'לא מוותר', special: 'הבעיטה של אבי' },
  { id: 'f2', name: 'דודו', trait: 'תמיד מאחר', special: 'האיחור של דודו' },
];

let fighters: [Fighter, Fighter] = [{ ...DEFAULTS[0] }, { ...DEFAULTS[1] }];
let duel: DuelState | null = null;
/** hot seat: the phone is handed over, so each pick is hidden from the other */
let screen: 'setup' | 'handover-attack' | 'attack' | 'handover-guard' | 'guard' | 'reveal' = 'setup';
let pendingAttack: Attack | null = null;

const other = (i: 0 | 1): 0 | 1 => (1 - i) as 0 | 1;

function setup(): string {
  return `
    <h1>הקרב</h1>
    ${modeSwitch()}
    <div class="sub">שני אנשים, טלפון אחד. מוסרים אותו הלאה כדי שהבחירה תישאר סודית.</div>
    ${fighters
      .map(
        (f, i) => `
      <div class="card">
        <label>לוחם ${i + 1}</label>
        <input data-name="${i}" value="${f.name}" placeholder="שם" />
        <label style="margin-top:10px">במה הוא מפורסם</label>
        <input data-trait="${i}" value="${f.trait}" placeholder="תמיד מאחר" />
      </div>`,
      )
      .join('')}
    <div class="card">
      <button class="primary" id="begin">לקרב</button>
      <div class="note" style="margin-top:8px">התכונה הופכת למהלך המיוחד. אוספים שלושה מחזורים כדי להשתמש בו.</div>
    </div>
  `;
}

/** `maxHp` is the full bar per side; only story mode passes it (the villain's runs longer) */
type MaxHp = readonly [number, number];

function bars(s: DuelState, maxHp?: MaxHp): string {
  return `
    <div class="row">
      ${s.fighters
        .map((f, i) => {
          const full = maxHp?.[i] ?? s.tuning.startHp;
          const pct = Math.min(100, Math.round((s.hp[i]! / full) * 100));
          const pips = Array.from({ length: s.tuning.meterToSpecial }, (_, p) =>
            `<i class="pip ${p < s.meter[i]! ? 'on' : ''}"></i>`,
          ).join('');
          return `<div class="side ${s.attacker === i ? 'active' : ''}">
            <div class="who">${f.name}</div>
            <div class="hpbar ${pct < 30 ? 'low' : ''}"><i style="width:${pct}%"></i></div>
            <div class="pips">${pips}</div>
          </div>`;
        })
        .join('')}
    </div>`;
}

function stage(s: DuelState, hitSide: 0 | 1 | null): string {
  return `<div class="stage">
    ${s.fighters
      .map((f, i) => {
        const art = i === hitSide ? f.art?.hit : f.art?.idle;
        const pose = art
          ? `<img src="${art}" alt="${f.name}" />`
          : `<div class="posebox ${i === hitSide ? 'hit' : ''}">${f.name}</div>`;
        return `<div class="fighter">${pose}</div>`;
      })
      .join('')}
  </div>`;
}

function handover(to: string, what: string): string {
  return `
    <div class="card" style="text-align:center">
      <div class="big">תן את הטלפון ל${to}</div>
      <div class="sub" style="margin-top:6px">${what}</div>
      <button class="primary" id="ready">קיבלתי</button>
    </div>`;
}

function attackScreen(s: DuelState, maxHp?: MaxHp): string {
  const me = s.fighters[s.attacker];
  const options: Attack[] = ['strike', 'sweep', 'grab'];
  return `
    ${bars(s, maxHp)}
    ${stage(s, null)}
    <div class="card">
      <div class="big">${me.name}, איך אתה נכנס?</div>
      <div class="deck" style="margin-top:10px">
        ${options.map((a) => `<button class="pad" data-attack="${a}">${ATTACK_LABELS[a]}</button>`).join('')}
        ${
          canSpecial(s, s.attacker)
            ? `<button class="pad special" data-attack="special">${me.special}</button>`
            : ''
        }
      </div>
    </div>`;
}

function guardScreen(s: DuelState, maxHp?: MaxHp): string {
  const me = s.fighters[other(s.attacker)];
  const options: Guard[] = ['block', 'dodge', 'counter'];
  return `
    ${bars(s, maxHp)}
    ${stage(s, null)}
    <div class="card">
      <div class="big">${me.name}, איך אתה מגיב?</div>
      <div class="deck" style="margin-top:10px">
        ${options.map((g) => `<button class="pad" data-guard="${g}">${GUARD_LABELS[g]}</button>`).join('')}
      </div>
      <div class="note" style="margin-top:10px">חסימה עוצרת מכה · התחמקות עוצרת סחיטת רגליים · קאונטר קוטף אחיזה ומהלך מיוחד</div>
    </div>`;
}

function revealScreen(s: DuelState, hitSide: 0 | 1 | null, footer?: string, maxHp?: MaxHp): string {
  const last = s.last!;
  return `
    ${bars(s, maxHp)}
    ${stage(s, hitSide)}
    <div class="card" style="text-align:center">
      <div class="big">${last.line}</div>
      <div class="sub" style="margin-top:6px">${
        last.toDefender > 0 ? `${last.toDefender} נזק` : last.toAttacker > 0 ? `${last.toAttacker} נזק חוזר` : 'אפס נזק'
      }</div>
      ${footer ?? `<button class="primary" id="next">${s.phase === 'over' ? 'תוצאה' : 'הסיבוב הבא'}</button>`}
    </div>`;
}

function overScreen(s: DuelState): string {
  const winner = s.fighters[s.winner ?? 0];
  return `
    <h1>${winner.name} לקח את זה</h1>
    ${stage(s, other(s.winner ?? 0))}
    <div class="card">
      <div class="sub">${s.round - 1} סיבובים</div>
      <div class="feed" style="margin-top:8px">${s.log.join(' · ')}</div>
      <button class="primary" id="again">עוד קרב</button>
    </div>`;
}

function render(): void {
  if (net) {
    renderTwo(net);
    return;
  }
  if (mode === 'story') {
    renderStory();
    return;
  }
  if (mode === 'two') {
    app.innerHTML = setupTwo();
    wireModeSwitch();
    wireSetupTwo();
    return;
  }
  if (!duel) {
    app.innerHTML = setup();
    wireModeSwitch();
    wireSetup();
    return;
  }
  const s = duel;
  if (s.phase === 'over' && screen === 'reveal') {
    app.innerHTML = revealScreen(s, lastHitSide(s));
  } else if (s.phase === 'over') {
    app.innerHTML = overScreen(s);
  } else if (screen === 'handover-attack') {
    app.innerHTML = bars(s) + handover(s.fighters[s.attacker].name, 'תורו לתקוף');
  } else if (screen === 'attack') {
    app.innerHTML = attackScreen(s);
  } else if (screen === 'handover-guard') {
    app.innerHTML = bars(s) + handover(s.fighters[other(s.attacker)].name, 'מישהו בא עליך');
  } else if (screen === 'guard') {
    app.innerHTML = guardScreen(s);
  } else {
    app.innerHTML = revealScreen(s, lastHitSide(s));
  }
  wireRound();
}

/** who visibly took it, so the hit pose shows on the right side */
function lastHitSide(s: DuelState): 0 | 1 | null {
  if (!s.last) {
    return null;
  }
  // the attack has already passed to the other side by the time we draw
  const attacker = other(s.attacker);
  if (s.last.toDefender > 0) {
    return other(attacker);
  }
  if (s.last.toAttacker > 0) {
    return attacker;
  }
  return null;
}

function wireSetup(): void {
  for (const input of app.querySelectorAll<HTMLInputElement>('[data-name]')) {
    input.addEventListener('input', () => {
      const i = Number(input.dataset.name) as 0 | 1;
      fighters[i]!.name = input.value.trim() || DEFAULTS[i]!.name;
    });
  }
  for (const input of app.querySelectorAll<HTMLInputElement>('[data-trait]')) {
    input.addEventListener('input', () => {
      const i = Number(input.dataset.trait) as 0 | 1;
      fighters[i]!.trait = input.value.trim() || DEFAULTS[i]!.trait;
      fighters[i]!.special = `${fighters[i]!.trait} של ${fighters[i]!.name}`;
    });
  }
  app.querySelector('#begin')?.addEventListener('click', () => {
    duel = createDuel([{ ...fighters[0] }, { ...fighters[1] }]);
    screen = 'handover-attack';
    render();
  });
}

function wireRound(): void {
  app.querySelector('#ready')?.addEventListener('click', () => {
    screen = screen === 'handover-attack' ? 'attack' : 'guard';
    render();
  });
  for (const b of app.querySelectorAll<HTMLButtonElement>('[data-attack]')) {
    b.addEventListener('click', () => {
      pendingAttack = b.dataset.attack as Attack;
      screen = 'handover-guard';
      render();
    });
  }
  for (const b of app.querySelectorAll<HTMLButtonElement>('[data-guard]')) {
    b.addEventListener('click', () => {
      if (!duel || !pendingAttack) {
        return;
      }
      duel = playRound(duel, pendingAttack, b.dataset.guard as Guard);
      pendingAttack = null;
      screen = 'reveal';
      render();
    });
  }
  app.querySelector('#next')?.addEventListener('click', () => {
    screen = duel?.phase === 'over' ? 'reveal' : 'handover-attack';
    if (duel?.phase === 'over') {
      duel = { ...duel };
      app.innerHTML = overScreen(duel);
      wireRound();
      return;
    }
    render();
  });
  app.querySelector('#again')?.addEventListener('click', () => {
    duel = createDuel([{ ...fighters[0] }, { ...fighters[1] }]);
    screen = 'handover-attack';
    render();
  });
}

/* ------------------------------------------------------------------------- *
 * Two phones: each device picks in secret, the host resolves, one reveal.
 * The hot-seat flow above is untouched; this only runs in "שני טלפונים".
 * ------------------------------------------------------------------------- */

let mode: 'one' | 'two' | 'story' = location.hash.length > 1 ? 'two' : 'one';
let net: DuelRoom | null = null;
const draftMe = { name: '', trait: '' };
let draftCode = location.hash.replace('#', '').toUpperCase();
let notice = '';
let structure = '';

const { online, makeTransport } = selectTransport(
  import.meta.env as unknown as Record<string, string | undefined>,
);

const roomCode = () => Math.random().toString(36).slice(2, 6).toUpperCase();

/** Everything on screen in this mode came over the wire from the other phone. */
const esc = (text: string): string =>
  text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

function safeDuel(s: DuelState): DuelState {
  const f = (x: Fighter): Fighter => ({
    id: x.id,
    name: esc(String(x.name)),
    trait: esc(String(x.trait)),
    special: esc(String(x.special)),
  });
  return {
    ...s,
    fighters: [f(s.fighters[0]), f(s.fighters[1])],
    last: s.last ? { ...s.last, line: esc(String(s.last.line)) } : null,
    log: s.log.map((l) => esc(String(l))),
  };
}

function modeSwitch(): string {
  return `<div class="chips fight-mode">
    <button class="chip ${mode === 'one' ? 'on' : ''}" data-mode="one">טלפון אחד</button>
    <button class="chip ${mode === 'two' ? 'on' : ''}" data-mode="two">שני טלפונים</button>
    <button class="chip ${mode === 'story' ? 'on' : ''}" data-mode="story">סטורי</button>
  </div>`;
}

function wireModeSwitch(): void {
  for (const b of app.querySelectorAll<HTMLButtonElement>('[data-mode]')) {
    b.addEventListener('click', () => {
      mode = b.dataset.mode === 'two' ? 'two' : b.dataset.mode === 'story' ? 'story' : 'one';
      render();
    });
  }
}

/** Your own fighter only: the other phone fills in theirs. */
function myFighter(isHost: boolean): Fighter {
  const base = DEFAULTS[isHost ? 0 : 1];
  const name = draftMe.name.trim();
  const trait = draftMe.trait.trim();
  if (!name && !trait) {
    return { ...base };
  }
  const n = name || base.name;
  const t = trait || base.trait;
  return { id: base.id, name: n, trait: t, special: `${t} של ${n}` };
}

/** A reloaded phone keeps its seat: same id per room, per tab. */
function memberId(code: string): string {
  const key = `fight:me:${code}`;
  try {
    const kept = sessionStorage.getItem(key);
    if (kept) {
      return kept;
    }
  } catch {
    // private mode: a reload just joins as a new phone
  }
  const fresh = Math.random().toString(36).slice(2, 9);
  try {
    sessionStorage.setItem(key, fresh);
  } catch {
    // same
  }
  return fresh;
}

function setupTwo(): string {
  // arriving on a link with a code means this is almost always the guest
  const linked = location.hash.length > 1;
  return `
    <h1>הקרב</h1>
    ${modeSwitch()}
    <div class="sub">כל אחד בוחר בטלפון שלו, בסוד. מה קרה רואים שניכם ביחד.</div>
    <div class="card">
      <label>השם שלך</label>
      <input id="me-name" value="${esc(draftMe.name)}" placeholder="שם" />
      <label style="margin-top:10px">במה אתה מפורסם</label>
      <input id="me-trait" value="${esc(draftMe.trait)}" placeholder="תמיד מאחר" />
      <button class="${linked ? '' : 'primary'}" id="host">פתח חדר</button>
    </div>
    <div class="card">
      <label>או הצטרף לחדר</label>
      <input id="code" value="${esc(draftCode)}" placeholder="קוד חדר" maxlength="4" />
      <button class="${linked ? 'primary' : ''}" id="join">הצטרף</button>
    </div>
    <div class="note">${
      online
        ? 'מחובר לשרת: פתח חדר כאן, ושלח את הלינק לטלפון השני.'
        : 'מצב מקומי: שני הצדדים חייבים להיות באותו דפדפן (שתי לשוניות). הוסף מפתחות Supabase ב-.env.local כדי לשחק בין טלפונים.'
    }</div>
  `;
}

function wireSetupTwo(): void {
  const name = app.querySelector<HTMLInputElement>('#me-name');
  const trait = app.querySelector<HTMLInputElement>('#me-trait');
  const code = app.querySelector<HTMLInputElement>('#code');
  name?.addEventListener('input', () => (draftMe.name = name.value));
  trait?.addEventListener('input', () => (draftMe.trait = trait.value));
  code?.addEventListener('input', () => (draftCode = code.value.toUpperCase()));
  // a link can carry the room code, exactly as DROPBOTS does
  const fromLink = location.hash.replace('#', '').toUpperCase();
  app.querySelector('#host')?.addEventListener('click', () =>
    enterTwo(fromLink.length >= 3 ? fromLink : roomCode(), true),
  );
  app.querySelector('#join')?.addEventListener('click', () => {
    const c = (code?.value || '').trim().toUpperCase();
    if (c.length < 3) {
      notice = 'צריך קוד חדר';
      render();
      return;
    }
    enterTwo(c, false);
  });
  if (notice) {
    const el = document.createElement('div');
    el.className = 'err';
    el.textContent = notice;
    app.append(el);
    notice = '';
  }
}

function enterTwo(code: string, isHost: boolean): void {
  net = new DuelRoom({
    // its own channel name, so a DROPBOTS room with the same code never shares it
    transport: makeTransport(`fight-${code}`),
    me: { id: memberId(code), fighter: myFighter(isHost) },
    isHost,
  });
  net.onChange = render;
  location.hash = code;
  structure = '';
  render();
}

function leaveTwo(): void {
  net?.close();
  net = null;
  structure = '';
  history.replaceState(null, '', location.pathname + location.search);
  draftCode = '';
  render();
}

function shareLink(): string {
  return `${location.origin}${location.pathname}${location.search}${location.hash}`;
}

function lobbyTwo(): string {
  const code = location.hash.replace('#', '');
  return `
    <h1>הקרב</h1>
    <div class="card">
      <div class="sub" style="margin-bottom:6px">קוד החדר</div>
      <div class="code">${esc(code) || '—'}</div>
      <div class="note fight-link">${esc(shareLink())}</div>
      <button id="share">שלח לינק לטלפון השני</button>
    </div>
    <div class="card fight-wait"><span class="dot"></span> מחכה ליריב…</div>
    <button id="leave">יציאה</button>`;
}

function waitingFor(who: string): string {
  return `<div class="fight-wait"><span class="dot"></span> מחכה ל${who}…</div>`;
}

function twoScreen(r: DuelRoom): string {
  const v: DuelView = r.view;
  const side = r.mySide;
  if (r.refused) {
    return `
      <h1>הקרב</h1>
      <div class="card" style="text-align:center">
        <div class="big">החדר מלא</div>
        <div class="sub" style="margin-top:6px">כבר יש בו שני לוחמים. אפשר לפתוח חדר חדש.</div>
        <button class="primary" id="leave">חזרה</button>
      </div>`;
  }
  if (side === null) {
    return `
      <h1>הקרב</h1>
      <div class="card">${waitingFor('חדר ' + esc(location.hash.replace('#', '')))}
        <div class="note" style="margin-top:8px">${
          online ? 'אם זה לוקח הרבה זמן, בדוק שהטלפון השני פתח את החדר.' : 'מצב מקומי: החדר חייב להיות פתוח בלשונית אחרת באותו דפדפן.'
        }</div>
      </div>
      <button id="leave">יציאה</button>`;
  }
  if (v.stage === 'lobby' || !v.duel) {
    return lobbyTwo();
  }
  const s = safeDuel(v.duel);
  const foeSide = other(side);
  const foe = s.fighters[foeSide].name;

  if (v.stage === 'picking') {
    if (r.iCommitted()) {
      return `
        ${bars(s)}
        ${stage(s, null)}
        <div class="card" style="text-align:center">
          <div class="big">הבחירה נעולה</div>
          ${waitingFor(foe)}
        </div>`;
    }
    const foeStatus = `<div class="fight-foe ${v.committed[foeSide] ? 'ready' : ''}">${
      v.committed[foeSide] ? `${foe} כבר בחר` : `${foe} חושב…`
    }</div>`;
    return (r.myRole() === 'attack' ? attackScreen(s) : guardScreen(s)) + foeStatus;
  }

  if (v.stage === 'reveal') {
    const attackerSide = other(s.attacker);
    const chose = v.revealed
      ? `<div class="fight-picks">${s.fighters[attackerSide].name}: ${ATTACK_LABELS[v.revealed.attack]} · ${
          s.fighters[s.attacker].name
        }: ${GUARD_LABELS[v.revealed.guard]}</div>`
      : '';
    const button = r.iAcked()
      ? waitingFor(foe)
      : `<button class="primary" id="next">${s.phase === 'over' ? 'תוצאה' : 'הסיבוב הבא'}</button>`;
    return revealScreen(s, lastHitSide(s), chose + button);
  }

  return overScreen(s) + `<button id="leave">יציאה</button>`;
}

function renderTwo(r: DuelRoom): void {
  const v = r.view;
  // rebuild only when the screen's shape changes: a heartbeat must never
  // replace a button under a finger that is about to lift
  const signature = [
    r.refused,
    v.stage,
    v.match,
    v.duel?.round ?? 0,
    r.mySide ?? '-',
    v.seats.map((x) => x?.id ?? '').join(','),
    r.iCommitted(),
    r.iAcked(),
    v.committed.join(','),
  ].join('|');
  if (signature === structure) {
    return;
  }
  structure = signature;
  app.innerHTML = twoScreen(r);
  wireTwo(r);
}

function wireTwo(r: DuelRoom): void {
  for (const b of app.querySelectorAll<HTMLButtonElement>('[data-attack]')) {
    b.addEventListener('click', () => r.pick({ attack: b.dataset.attack as Attack }));
  }
  for (const b of app.querySelectorAll<HTMLButtonElement>('[data-guard]')) {
    b.addEventListener('click', () => r.pick({ guard: b.dataset.guard as Guard }));
  }
  app.querySelector('#next')?.addEventListener('click', () => r.ack());
  app.querySelector('#again')?.addEventListener('click', () => r.again());
  app.querySelector('#leave')?.addEventListener('click', leaveTwo);
  app.querySelector('#share')?.addEventListener('click', async () => {
    const url = shareLink();
    try {
      if (navigator.share) {
        await navigator.share({ title: 'הקרב', url });
        return;
      }
      await navigator.clipboard.writeText(url);
      const b = app.querySelector<HTMLButtonElement>('#share');
      if (b) {
        b.textContent = 'הלינק הועתק';
      }
    } catch {
      // the share sheet was dismissed: nothing to do
    }
  });
}

/* ------------------------------------------------------------------------- *
 * Story: one phone, one human, a ladder of computer-driven friends up to the
 * villain. All of it is pack data (packs/fighter-demo.json); the rules are in
 * story.ts. Reuses the attack/guard/reveal screens above for the human's side.
 * ------------------------------------------------------------------------- */

let storyErrors = validateStoryPack(storyPackJson);

/** pack text lands in innerHTML, so escape it once, before the engine builds lines from it */
function deepEsc(x: unknown): unknown {
  if (typeof x === 'string') {
    return esc(x);
  }
  if (Array.isArray(x)) {
    return x.map(deepEsc);
  }
  if (x && typeof x === 'object') {
    return Object.fromEntries(Object.entries(x).map(([k, v]) => [k, deepEsc(v)]));
  }
  return x;
}

let storyPack: StoryPack | null = storyErrors.length ? null : (deepEsc(storyPackJson) as StoryPack);
let story: StoryState | null = null;
let storyScreen: 'pick' | 'intro' | 'fight' | 'reveal' | 'result' | 'ending' = 'pick';

function continuesLeft(n: number): string {
  if (n <= 0) {
    return 'אין יותר המשכים';
  }
  return n === 1 ? 'נשאר לך המשך אחד' : `נשארו לך ${n} המשכים`;
}

function storyPickScreen(p: StoryPack): string {
  return `
    <h1>${p.title}</h1>
    ${modeSwitch()}
    <div class="sub">${p.subtitle}</div>
    <div class="card">
      <div class="big">מי אתה?</div>
      <div class="story-roster">
        ${p.roster
          .map(
            (f) => `<button class="story-fighter" data-hero="${f.id}">
              <span class="story-name">${f.name}</span>
              <span class="story-trait">${f.trait}</span>
            </button>`,
          )
          .join('')}
      </div>
      <div class="note" style="margin-top:10px">${p.ladder.length} קרבות, טלפון אחד. בסוף מחכה ${p.villain.name}.</div>
    </div>`;
}

/** the climb so far: grey boxes, the current one lit, the villain last */
function ladderStrip(s: StoryState): string {
  return `<div class="story-ladder">${s.ladder
    .map(
      (o, i) =>
        `<div class="story-rung ${i < s.rung ? 'done' : i === s.rung ? 'now' : ''} ${o.isVillain ? 'boss' : ''}">${o.fighter.name}</div>`,
    )
    .join('')}</div>`;
}

function storyIntroScreen(s: StoryState): string {
  const { number, total, opponent } = currentRung(s);
  const foe = opponent.fighter;
  const villain = opponent.isVillain
    ? `<div class="sub" style="margin-top:10px">${s.pack.villain.intro}</div>
       <div class="story-taunt">${s.taunt ?? ''}</div>`
    : '';
  return `
    ${ladderStrip(s)}
    <div class="card story-intro ${opponent.isVillain ? 'boss' : ''}">
      <div class="story-count">הקרב ${number} מתוך ${total} — נגד ${foe.name}</div>
      <div class="big">${s.intro}</div>
      ${villain}
      <div class="note" style="margin-top:10px">${foe.trait} · המהלך המיוחד: ${foe.special}</div>
      <button class="primary" id="story-fight">לקרב</button>
      <div class="note" style="margin-top:8px">${continuesLeft(s.continues)}</div>
    </div>
    <button id="story-quit">יציאה</button>`;
}

function storyFightScreen(s: StoryState): string {
  const d = s.duel!;
  const foe = d.fighters[1].name;
  return humanRole(s) === 'attack'
    ? attackScreen(d, s.maxHp) + `<div class="fight-foe">התור שלך לתקוף. ההגנה של ${foe} כבר נעולה</div>`
    : guardScreen(d, s.maxHp) + `<div class="fight-foe">התור של ${foe} לתקוף. ההתקפה כבר נעולה</div>`;
}

function storyRevealScreen(s: StoryState): string {
  const d = s.duel!;
  const picked = s.lastRound;
  const attackerSide = other(d.attacker);
  const chose = picked
    ? `<div class="fight-picks">${d.fighters[attackerSide].name}: ${ATTACK_LABELS[picked.attack]} · ${
        d.fighters[d.attacker].name
      }: ${GUARD_LABELS[picked.guard]}</div>`
    : '';
  const button = `<button class="primary" id="story-next">${d.phase === 'over' ? 'תוצאה' : 'הסיבוב הבא'}</button>`;
  return revealScreen(d, lastHitSide(d), chose + button, s.maxHp);
}

function storyResultScreen(s: StoryState): string {
  const card = (big: string, sub: string, id: string, label: string) => `
    ${ladderStrip(s)}
    <div class="card story-result" style="text-align:center">
      <div class="big">${big}</div>
      <div class="sub" style="margin-top:6px">${sub}</div>
      <button class="primary" id="${id}">${label}</button>
    </div>`;
  if (s.phase === 'ending') {
    // the pack has no gender field, so these lines avoid gendered verbs
    return card(s.pack.villain.defeatLine, `הניצחון של ${s.hero.name} על ${s.pack.villain.name}`, 'story-end', 'הסוף');
  }
  const { number, total, opponent } = currentRung(s);
  if (s.phase === 'over') {
    return card(
      'נגמרו ההמשכים',
      `נעצרת בקרב ${number} מתוך ${total}, מול ${opponent.fighter.name}`,
      'story-restart',
      'מההתחלה',
    );
  }
  if (s.lastResult === 'won') {
    const beaten = s.ladder[s.rung - 1]?.fighter.name ?? '';
    return card('ניצחת, הלאה', `${beaten} בחוץ. הבא בתור: ${opponent.fighter.name}`, 'story-on', 'לקרב הבא');
  }
  return card(`נפלת — ${continuesLeft(s.continues)}`, `עוד ניסיון מול ${opponent.fighter.name}, עם בר מלא`, 'story-on', 'עוד פעם');
}

function storyEndingScreen(s: StoryState): string {
  const used = START_CONTINUES - s.continues;
  return `
    <h1>${s.pack.ending.title}</h1>
    <div class="card story-ending">
      <div class="big">${s.pack.ending.text}</div>
      <div class="sub" style="margin-top:10px">${s.hero.name} · ${s.rounds} סיבובים · ${
        used === 0 ? 'בלי המשכים' : used === 1 ? 'המשך אחד' : `${used} המשכים`
      }</div>
      <button class="primary" id="story-restart">שוב מההתחלה</button>
    </div>`;
}

function renderStory(): void {
  if (!storyPack) {
    app.innerHTML = `
      <h1>הקרב</h1>
      ${modeSwitch()}
      <div class="card">
        <div class="big">הסטורי לא נטען</div>
        <div class="err">${storyErrors.map(esc).join('<br>')}</div>
      </div>`;
    wireModeSwitch();
    return;
  }
  if (!story || storyScreen === 'pick') {
    app.innerHTML = storyPickScreen(storyPack);
    wireModeSwitch();
    wireStory();
    return;
  }
  const s = story;
  // a fight screen with no turn to take (should not happen) falls back to the intro
  const screenNow = storyScreen === 'fight' && !humanRole(s) ? 'intro' : storyScreen;
  app.innerHTML =
    screenNow === 'intro' && s.phase === 'intro'
      ? storyIntroScreen(s)
      : screenNow === 'fight'
        ? storyFightScreen(s)
        : screenNow === 'reveal' && s.duel?.last
          ? storyRevealScreen(s)
          : screenNow === 'ending' && s.phase === 'ending'
            ? storyEndingScreen(s)
            : storyResultScreen(s);
  wireStory();
}

function wireStory(): void {
  const go = (next: StoryState | null, screenNext: typeof storyScreen) => {
    story = next;
    storyScreen = screenNext;
    renderStory();
  };
  for (const b of app.querySelectorAll<HTMLButtonElement>('[data-hero]')) {
    b.addEventListener('click', () => {
      if (storyPack) {
        // the seed only has to differ between plays; the engine never touches Math.random
        go(createStory(storyPack, b.dataset.hero ?? '', Date.now() >>> 0), 'intro');
      }
    });
  }
  app.querySelector('#story-fight')?.addEventListener('click', () => story && go(beginFight(story), 'fight'));
  for (const b of app.querySelectorAll<HTMLButtonElement>('[data-attack], [data-guard]')) {
    b.addEventListener('click', () => {
      if (!story) {
        return;
      }
      const next = humanPick(story, (b.dataset.attack ?? b.dataset.guard) as Attack | Guard);
      if (next !== story) {
        go(next, 'reveal');
      }
    });
  }
  app.querySelector('#story-next')?.addEventListener('click', () => {
    if (!story) {
      return;
    }
    if (story.duel?.phase === 'over') {
      go(afterFight(story), 'result');
    } else {
      go(story, 'fight');
    }
  });
  app.querySelector('#story-on')?.addEventListener('click', () => go(story, 'intro'));
  app.querySelector('#story-end')?.addEventListener('click', () => go(story, 'ending'));
  for (const id of ['#story-restart', '#story-quit']) {
    app.querySelector(id)?.addEventListener('click', () => go(null, 'pick'));
  }
}

/**
 * A gift link (?o=) wins over the demo: story mode plays the order's pack, and
 * the versus setup starts from its first two friends instead of the defaults.
 * Without ?o= nothing here runs and all three modes behave as before.
 */
async function boot(): Promise<void> {
  const order = await orderFromParams(new URLSearchParams(location.search));
  const built = order ? buildAll(order).story : null;
  if (built) {
    storyErrors = validateStoryPack(built);
    storyPack = storyErrors.length ? null : (deepEsc(built) as StoryPack);
    const [a, b] = built.roster;
    if (a && b && !storyErrors.length) {
      // deepEsc'd like the pack: the setup and the hot-seat screens print these raw
      const seed = (f: typeof a, id: string): Fighter => ({
        id,
        name: esc(f.name),
        trait: esc(f.trait),
        special: esc(f.special || `${f.trait} של ${f.name}`),
      });
      DEFAULTS[0] = seed(a, 'f1');
      DEFAULTS[1] = seed(b, 'f2');
      fighters = [{ ...DEFAULTS[0] }, { ...DEFAULTS[1] }];
    }
  }
  render();
}

void boot();

// dev-only handle so a browser test can reach the live duel room and the story
if (import.meta.env.DEV) {
  (window as unknown as { __fight: unknown }).__fight = { room: () => net, story: () => story };
}
