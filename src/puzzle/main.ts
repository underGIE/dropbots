import demoFacts from './demo-facts.json';
import { currentLock, viewFor } from './locks';
import { LocksRoom, type LocksMsg } from './net';
import type { Fact, PuzzleTuning } from './types';
import { buildAll } from '../order/build-all';
import { orderFromParams } from '../share/order-link';
import { broadcastTransport } from '../transport/broadcast';

const app = document.getElementById('app')!;

// filled by boot(); a gift link (?o=) swaps in the order's facts and tuning
let FACTS: Fact[] = demoFacts as Fact[];
let TUNING: PuzzleTuning | undefined;

async function resolveLocks(): Promise<void> {
  const order = await orderFromParams(new URLSearchParams(location.search));
  const built = order ? buildAll(order).locks : null;
  if (built) {
    FACTS = built.facts;
    TUNING = built.tuning;
  }
}

let room: LocksRoom | null = null;
let draftName = '';
let picks: Record<string, string> = {};

const id = () => Math.random().toString(36).slice(2, 9);
// facts and names arrive from a link now: everything printed is escaped,
// and options are picked by index rather than by their text
const esc = (t: string) => t.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const code = () => Math.random().toString(36).slice(2, 6).toUpperCase();

function enter(roomCode: string, isHost: boolean): void {
  room = new LocksRoom({
    transport: broadcastTransport<LocksMsg>(roomCode),
    facts: FACTS,
    tuning: TUNING,
    me: { id: id(), name: draftName.trim() || 'אורח' },
    isHost,
  });
  room.onChange = render;
  location.hash = roomCode;
  render();
}

function home(): string {
  const fromLink = location.hash.replace('#', '').toUpperCase();
  return `
    <h1>המנעולים</h1>
    <div class="sub">שורה של מנעולים על המשפחה. התשובות מפוזרות בין הטלפונים — אף אחד לא פותח לבד.</div>
    <div class="card">
      <label>איך קוראים לך</label>
      <input id="name" value="${draftName}" placeholder="השם שלך" />
      <button class="primary" id="host">פתח חדר</button>
      <input id="code" value="${fromLink}" placeholder="קוד חדר" maxlength="4" style="margin-top:10px" />
      <button id="join">הצטרף</button>
    </div>
    <div class="sub">בגרסה הזו כל הטלפונים הם לשוניות באותו דפדפן; טלפונים אמיתיים מגיעים עם מפתחות Supabase.</div>
  `;
}

function lobby(r: LocksRoom): string {
  return `
    <h1>המנעולים</h1>
    <div class="card">
      <div class="sub">קוד החדר</div>
      <div class="code">${location.hash.replace('#', '')}</div>
    </div>
    <div class="card">
      <div class="sub">בחדר (${r.seats.length})</div>
      <div class="names">${r.seats.map((s) => esc(s.name)).join(' · ')}</div>
      ${r.seats.length < 2 ? '<div class="sub">צריך לפחות שניים — אחד מחזיק מנעול, השני מחזיק תשובה.</div>' : ''}
      <button class="primary" id="start">התחילו</button>
      ${r.error ? `<div class="err">${r.error}</div>` : ''}
    </div>
    <div class="card">
      <div class="sub">איך משחקים</div>
      <div>טלפון אחד רואה את השאלות עם אפשרויות. הטלפונים האחרים רואים את התשובות — כל אחד תשובה אחרת. מדברים, פותחים, המנעול עובר הלאה.</div>
    </div>
  `;
}

function head(r: LocksRoom): string {
  const s = r.state!;
  const total = s.tuning.secondsTotal * 1000;
  const left = Math.max(0, s.endsAt - Date.now());
  const strikes = Array.from({ length: s.tuning.strikes }, (_, i) => `<i class="pip ${i < s.strikes ? 'on' : ''}"></i>`).join('');
  return `
    <div class="row">
      <div class="big">מנעול ${Math.min(s.current + 1, s.locks.length)} / ${s.locks.length}</div>
      <div class="pips">${strikes}</div>
    </div>
    <div class="timer" style="margin-top:8px"><i id="clock" style="width:${(left / total) * 100}%"></i></div>
    <div class="feed">${s.log[0] ?? ''}</div>
  `;
}

function live(r: LocksRoom): string {
  const s = r.state!;
  const view = viewFor(s, r.me.id);
  const lock = currentLock(s)!;
  const holderName = r.seats.find((x) => x.id === lock.holder)?.name ?? '';

  if (view.role === 'lock') {
    return `
      ${head(r)}
      <div class="card"><div class="big">המנעול אצלך</div>
      <div class="sub">השאלות פה, התשובות אצל האחרים. תשאל בקול.</div></div>
      ${view.questions
        .map(
          (q, i) => `
        <div class="card">
          <div class="big" style="font-size:17px">${esc(q.prompt)}</div>
          <div class="chips" style="margin-top:10px">
            ${q.options
              .map((o, k) => `<button class="chip ${picks[String(i)] === o ? 'on' : ''}" data-q="${i}" data-k="${k}">${esc(o)}</button>`)
              .join('')}
          </div>
        </div>`,
        )
        .join('')}
      ${view.clues.length > 0 ? clueCards(view.clues) : ''}
      <div class="card"><button class="primary" id="submit">פתח את המנעול</button></div>
    `;
  }

  if (view.role === 'clue') {
    return `
      ${head(r)}
      <div class="card"><div class="big">המנעול אצל ${esc(holderName)}</div>
      <div class="sub">התשובה אצלך. תגיד אותה בקול — אל תראה את המסך.</div></div>
      ${clueCards(view.clues)}
    `;
  }

  return `
    ${head(r)}
    <div class="card" style="text-align:center">
      <div class="big">המנעול אצל ${esc(holderName)}</div>
      <div class="sub">הסיבוב הזה אתה נושם. תעזור להם להסכים.</div>
    </div>
  `;
}

function clueCards(clues: { prompt: string; answer: string }[]): string {
  return clues
    .map(
      (c) => `
    <div class="card" style="text-align:center">
      <div class="sub">${esc(c.prompt)}</div>
      <div class="shout" style="margin-top:8px">${esc(c.answer)}</div>
    </div>`,
    )
    .join('');
}

function over(r: LocksRoom): string {
  const s = r.state!;
  const won = s.phase === 'won';
  return `
    <h1>${won ? 'הדלת נפתחה 🔓' : 'הדלת נשארה סגורה 🔒'}</h1>
    <div class="card">
      <div class="big">${s.current} מתוך ${s.locks.length} מנעולים</div>
      <div class="feed" style="margin-top:8px">${s.log.join(' · ')}</div>
      <button class="primary" id="again">עוד שורה</button>
    </div>
  `;
}

let structure = '';

function render(): void {
  if (!room || !room.state) {
    app.innerHTML = home();
    wireHome();
    return;
  }
  const r = room;
  const s = r.state;
  if (!s) {
    return;
  }
  const signature = `${s.phase}|${s.current}|${s.strikes}|${r.seats.length}|${r.error ?? ''}|${JSON.stringify(picks)}`;
  if (signature !== structure) {
    structure = signature;
    if (s.phase === 'lobby') {
      app.innerHTML = lobby(r);
    } else if (s.phase === 'live') {
      app.innerHTML = live(r);
    } else {
      app.innerHTML = over(r);
    }
    wireRoom();
  }
}

function wireHome(): void {
  const name = app.querySelector<HTMLInputElement>('#name');
  const codeField = app.querySelector<HTMLInputElement>('#code');
  name?.addEventListener('input', () => (draftName = name.value));
  app.querySelector('#host')?.addEventListener('click', () => {
    const c = (codeField?.value || '').trim().toUpperCase();
    enter(c.length >= 3 ? c : code(), true);
  });
  app.querySelector('#join')?.addEventListener('click', () => {
    const c = (codeField?.value || '').trim().toUpperCase();
    if (c.length >= 3) {
      enter(c, false);
    }
  });
}

function wireRoom(): void {
  app.querySelector('#start')?.addEventListener('click', () => room?.begin());
  app.querySelector('#again')?.addEventListener('click', () => {
    picks = {};
    room?.again();
  });
  for (const chip of app.querySelectorAll<HTMLButtonElement>('[data-q]')) {
    chip.addEventListener('click', () => {
      const s = room?.state;
      const lock = s ? currentLock(s) : null;
      const option = lock?.questions[Number(chip.dataset.q)]?.options[Number(chip.dataset.k)];
      if (option === undefined) {
        return;
      }
      picks = { ...picks, [chip.dataset.q!]: option };
      render();
    });
  }
  app.querySelector('#submit')?.addEventListener('click', () => {
    const s = room?.state;
    if (!s) {
      return;
    }
    const lock = currentLock(s)!;
    const answers = lock.questions.map((_, i) => picks[String(i)] ?? '');
    if (answers.some((a) => a === '')) {
      return;
    }
    picks = {};
    room?.submit(answers);
  });
}

// the clock bar moves between snapshots
setInterval(() => {
  const s = room?.state;
  const bar = app.querySelector<HTMLElement>('#clock');
  if (s && s.phase === 'live' && bar) {
    const total = s.tuning.secondsTotal * 1000;
    bar.style.width = `${(Math.max(0, s.endsAt - Date.now()) / total) * 100}%`;
  }
}, 250);

if (import.meta.env.DEV) {
  (window as unknown as { __locks: unknown }).__locks = { room: () => room };
}

async function boot(): Promise<void> {
  await resolveLocks();
  render();
}

void boot();
