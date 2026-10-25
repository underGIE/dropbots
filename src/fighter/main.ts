import { ATTACK_LABELS, GUARD_LABELS, canSpecial, createDuel, playRound } from './duel';
import { DuelRoom, type DuelView } from './net';
import type { Attack, DuelState, Fighter, Guard } from './types';
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

function bars(s: DuelState): string {
  return `
    <div class="row">
      ${s.fighters
        .map((f, i) => {
          const pct = Math.round((s.hp[i]! / s.tuning.startHp) * 100);
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

function attackScreen(s: DuelState): string {
  const me = s.fighters[s.attacker];
  const options: Attack[] = ['strike', 'sweep', 'grab'];
  return `
    ${bars(s)}
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

function guardScreen(s: DuelState): string {
  const me = s.fighters[other(s.attacker)];
  const options: Guard[] = ['block', 'dodge', 'counter'];
  return `
    ${bars(s)}
    ${stage(s, null)}
    <div class="card">
      <div class="big">${me.name}, איך אתה מגיב?</div>
      <div class="deck" style="margin-top:10px">
        ${options.map((g) => `<button class="pad" data-guard="${g}">${GUARD_LABELS[g]}</button>`).join('')}
      </div>
      <div class="note" style="margin-top:10px">חסימה עוצרת מכה · התחמקות עוצרת סחיטת רגליים · קאונטר קוטף אחיזה ומהלך מיוחד</div>
    </div>`;
}

function revealScreen(s: DuelState, hitSide: 0 | 1 | null, footer?: string): string {
  const last = s.last!;
  return `
    ${bars(s)}
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

let mode: 'one' | 'two' = location.hash.length > 1 ? 'two' : 'one';
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
  </div>`;
}

function wireModeSwitch(): void {
  for (const b of app.querySelectorAll<HTMLButtonElement>('[data-mode]')) {
    b.addEventListener('click', () => {
      mode = b.dataset.mode === 'two' ? 'two' : 'one';
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

render();

// dev-only handle so a browser test can reach the live duel room
if (import.meta.env.DEV) {
  (window as unknown as { __fight: unknown }).__fight = { room: () => net };
}
