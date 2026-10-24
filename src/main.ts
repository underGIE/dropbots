import pack from '../packs/demo-family.json';
import { deadlineMs } from './engine/match';
import type { ThemePack } from './engine/types';
import { Room } from './net/room';
import { broadcastTransport } from './transport/broadcast';

const PACK = pack as ThemePack;
const app = document.getElementById('app')!;

let room: Room | null = null;
let draftName = '';
let draftCode = '';
let notice = '';

const id = () => Math.random().toString(36).slice(2, 9);
const roomCode = () => Math.random().toString(36).slice(2, 6).toUpperCase();

function enter(code: string, isHost: boolean, solo = false): void {
  const name = draftName.trim() || 'DJ';
  room = new Room({
    transport: broadcastTransport(solo ? `solo-${id()}` : code),
    pack: PACK,
    me: { id: id(), name },
    isHost,
  });
  room.onChange = render;
  if (solo) {
    room.begin();
  }
  location.hash = solo ? '' : code;
  render();
}

function home(): string {
  return `
    <h1>${PACK.title}</h1>
    <div class="sub">${PACK.subtitle}</div>
    <div class="card">
      <label>איך קוראים לך</label>
      <input id="name" value="${draftName}" placeholder="השם שלך" />
      <button class="primary" id="host">פתח חדר</button>
    </div>
    <div class="card">
      <label>או הצטרף לחדר קיים</label>
      <input id="code" value="${draftCode}" placeholder="קוד חדר" maxlength="4" />
      <button id="join">הצטרף</button>
    </div>
    <div class="card">
      <button id="solo">תרגול לבד</button>
    </div>
    <div class="sub">שני טלפונים? פתח חדר כאן, והשני מצטרף עם הקוד.
    בגרסה הזו שני הצדדים חייבים להיות באותו דפדפן (שתי לשוניות) — חיבור בין טלפונים נפרדים מגיע עם Supabase.</div>
  `;
}

function lobby(r: Room): string {
  return `
    <h1>${PACK.title}</h1>
    <div class="card">
      <div class="sub">קוד החדר</div>
      <div class="code">${location.hash.replace('#', '') || '—'}</div>
    </div>
    <div class="card">
      <div class="sub">בחדר (${r.seats.length})</div>
      <div class="names">${r.seats.map((s) => s.name).join(' · ') || '—'}</div>
      ${r.seats.length < 2 ? '<div class="sub">מחכה לעוד שחקן… אפשר גם להתחיל לבד.</div>' : ''}
      <button class="primary" id="start">התחילו</button>
      ${r.error ? `<div class="err">${r.error}</div>` : ''}
    </div>
    <div class="card">
      <div class="sub">איך משחקים</div>
      <div>על המסך שלך תופיע הוראה — היא שייכת ל<b>דק של מישהו אחר</b>.
      תצעק אותה. מי שיש לו את הכפתור לוחץ. הקהל עולה.</div>
    </div>
  `;
}

function play(r: Room): string {
  const s = r.state!;
  return `
    <div class="row">
      <div class="big" id="score"></div>
      <div class="sub" id="mode" style="margin:0"></div>
    </div>
    <div class="hype" id="hype"><i></i></div>
    <div class="shout" id="shout" style="margin-top:12px"></div>
    <div class="timer" id="timer"><i></i></div>
    <div class="feed" id="feed"></div>
    <div class="deck">
      ${r
        .myDeck()
        .map(
          (c) =>
            `<button class="pad" data-pad="${c.id}">${c.label}<small>${c.kind}</small></button>`,
        )
        .join('')}
    </div>
  `;
}

/**
 * Repaint the live numbers WITHOUT touching the deck. Re-rendering the whole
 * screen every frame yanked the pads out from under the player's finger.
 */
function paint(r: Room): void {
  const s = r.state;
  if (!s || s.phase !== 'live') {
    return;
  }
  const instruction = r.myInstruction();
  const span = deadlineMs(s);
  const left = instruction ? Math.max(0, instruction.deadlineAt - Date.now()) : 0;

  const set = (sel: string, text: string) => {
    const el = app.querySelector(sel);
    if (el && el.textContent !== text) {
      el.textContent = text;
    }
  };
  set('#score', `${s.score} מתוך ${s.tuning.targetScore}`);
  set('#mode', s.inDrop ? '\u26a1 DROP' : 'קהל');
  set('#shout', instruction ? instruction.text : 'מחכה…');
  set('#feed', s.feed.join('   '));

  const hype = app.querySelector<HTMLElement>('#hype');
  hype?.classList.toggle('low', s.hype < 30);
  const hypeBar = app.querySelector<HTMLElement>('#hype > i');
  if (hypeBar) {
    hypeBar.style.width = `${s.hype}%`;
  }
  const timer = app.querySelector<HTMLElement>('#timer > i');
  if (timer) {
    timer.style.width = `${span > 0 ? (left / span) * 100 : 0}%`;
  }
  app.querySelector('#shout')?.classList.toggle('drop', s.inDrop);
}

function over(r: Room): string {
  const s = r.state!;
  return `
    <h1>${s.won ? 'הקהל השתגע 🎉' : 'הקהל הלך הביתה 💀'}</h1>
    <div class="card">
      <div class="big">${s.score} לחיצות נכונות</div>
      <div class="sub">${s.won ? 'סיימתם את הסט.' : 'נסו שוב — הפעם תצעקו יותר חזק.'}</div>
      <button class="primary" id="again">עוד סט</button>
    </div>
  `;
}

let structure = '';

function render(): void {
  if (!room || !room.state) {
    structure = 'home';
    app.innerHTML = home();
    wireHome();
    return;
  }
  const r = room;
  const s = r.state;
  if (!s) {
    return;
  }
  // the deck identity is what must not be rebuilt under a finger
  const signature = [s.phase, r.myDeck().map((c) => c.id).join(','), r.seats.length, r.error ?? '']
    .join('|');
  if (signature !== structure) {
    structure = signature;
    app.innerHTML = s.phase === 'lobby' ? lobby(r) : s.phase === 'live' ? play(r) : over(r);
    wireRoom();
  }
  if (s.phase === 'live') {
    paint(r);
  }
}

function wireHome(): void {
  const name = app.querySelector<HTMLInputElement>('#name');
  const code = app.querySelector<HTMLInputElement>('#code');
  name?.addEventListener('input', () => (draftName = name.value));
  code?.addEventListener('input', () => (draftCode = code.value.toUpperCase()));
  // a gift arrives as a link with the room code already in it
  const fromLink = location.hash.replace('#', '').toUpperCase();
  app.querySelector('#host')?.addEventListener('click', () =>
    enter(fromLink.length >= 3 ? fromLink : roomCode(), true),
  );
  app.querySelector('#join')?.addEventListener('click', () => {
    const c = (code?.value || '').trim().toUpperCase();
    if (c.length < 3) {
      notice = 'צריך קוד חדר';
      render();
      return;
    }
    enter(c, false);
  });
  app.querySelector('#solo')?.addEventListener('click', () => enter('solo', true, true));
  if (notice) {
    const el = document.createElement('div');
    el.className = 'err';
    el.textContent = notice;
    app.append(el);
    notice = '';
  }
}

function wireRoom(): void {
  app.querySelector('#start')?.addEventListener('click', () => room?.begin());
  app.querySelector('#again')?.addEventListener('click', () => room?.again());
  for (const pad of app.querySelectorAll<HTMLButtonElement>('[data-pad]')) {
    pad.addEventListener('click', () => room?.tap(pad.dataset.pad!));
  }
}

// the deadline bar has to move even when no state arrives
setInterval(() => {
  if (room?.state?.phase === 'live') {
    paint(room);
  }
}, 120);

if (location.hash.length > 1) {
  draftCode = location.hash.replace('#', '').toUpperCase();
}
render();

// dev-only handle so a browser test can reach the live room
if (import.meta.env.DEV) {
  (window as unknown as { __twodjs: unknown }).__twodjs = { room: () => room };
}
