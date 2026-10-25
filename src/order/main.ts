import { playLink } from '../share/pack-link';
import { buildPack, type Answers, type Crowd, type World } from './build-pack';

const app = document.getElementById('app')!;
const CUSTOM_KEY = 'dropbots:pack';

const WORLDS: Array<{ id: World; label: string }> = [
  { id: 'techno', label: 'טכנו' },
  { id: 'trance', label: 'טראנס' },
  { id: 'disco', label: 'דיסקו' },
  { id: 'hiphop', label: 'היפ-הופ' },
];

const CROWDS: Array<{ id: Crowd; label: string }> = [
  { id: 'kids', label: 'ילדים' },
  { id: 'mixed', label: 'מעורב' },
  { id: 'adults', label: 'מבוגרים' },
];

const answers: Answers = {
  names: [],
  players: 2,
  jokes: [],
  world: 'techno',
  crowd: 'mixed',
  occasion: '',
};

function form(): string {
  return `
    <h1>בונים את המתנה</h1>
    <div class="sub">שש שאלות. מה שתכתוב בבדיחות הפנים הוא המשחק עצמו — זה החלק שאי אפשר לקנות בחנות.</div>

    <div class="card">
      <label>1 · למי המתנה (שמות, מופרדים בפסיק)</label>
      <input id="names" placeholder="אבי, שני, דודו" />
    </div>

    <div class="card">
      <label>2 · כמה טלפונים ישחקו ביחד</label>
      <div class="chips" id="players">
        ${[2, 3, 4].map((n) => `<button class="chip" data-players="${n}">${n}</button>`).join('')}
      </div>
    </div>

    <div class="card">
      <label>3 · בדיחות הפנים — שורה לכל אחת</label>
      <textarea id="jokes" rows="7" placeholder="תוריד את הבס של שרון&#10;סבתא על הרמקול&#10;טיפקס&#10;צופר החתונה של דודו"></textarea>
      <div class="sub" id="jokecount" style="margin:8px 0 0"></div>
    </div>

    <div class="card">
      <label>4 · עולם</label>
      <div class="chips" id="world">
        ${WORLDS.map((w) => `<button class="chip" data-world="${w.id}">${w.label}</button>`).join('')}
      </div>
    </div>

    <div class="card">
      <label>5 · מי משחק</label>
      <div class="chips" id="crowd">
        ${CROWDS.map((c) => `<button class="chip" data-crowd="${c.id}">${c.label}</button>`).join('')}
      </div>
    </div>

    <div class="card">
      <label>6 · האירוע (מופיע על המסך לפני הסיבוב הראשון)</label>
      <input id="occasion" placeholder="ראש השנה אצל סבתא" />
    </div>

    <div class="card" id="verdict"></div>

    <div class="card">
      <button class="primary" id="play">בנה ושחק עכשיו</button>
      <button id="link">צור לינק לשליחה</button>
      <button id="cardbtn">כרטיס מתנה להדפסה</button>
      <button id="download">הורד את קובץ הפאק</button>
      <div id="linkout"></div>
    </div>
  `;
}

function readForm(): void {
  const names = (app.querySelector<HTMLInputElement>('#names')?.value ?? '')
    .split(',')
    .map((n) => n.trim())
    .filter((n) => n !== '');
  const jokes = (app.querySelector<HTMLTextAreaElement>('#jokes')?.value ?? '')
    .split('\n')
    .map((j) => j.trim())
    .filter((j) => j !== '');
  answers.names = names;
  answers.jokes = jokes;
  answers.occasion = app.querySelector<HTMLInputElement>('#occasion')?.value ?? '';
}

function paintChips(): void {
  for (const chip of app.querySelectorAll<HTMLElement>('[data-players]')) {
    chip.classList.toggle('on', Number(chip.dataset.players) === answers.players);
  }
  for (const chip of app.querySelectorAll<HTMLElement>('[data-world]')) {
    chip.classList.toggle('on', chip.dataset.world === answers.world);
  }
  for (const chip of app.querySelectorAll<HTMLElement>('[data-crowd]')) {
    chip.classList.toggle('on', chip.dataset.crowd === answers.crowd);
  }
}

function paintVerdict(): void {
  const built = buildPack(answers);
  const el = app.querySelector('#verdict')!;
  const count = app.querySelector('#jokecount')!;
  count.textContent = `${answers.jokes.length} בדיחות`;
  const lines: string[] = [];
  lines.push(`<div class="big">${built.pack.controls.length} פקדים · ${answers.players} דקים</div>`);
  if (built.jokesNeeded > 0) {
    lines.push(
      `<div class="sub" style="margin:6px 0 0">כתוב עוד <b>${built.jokesNeeded}</b> בדיחות כדי שהמשחק יהיה כולו שלהם. בינתיים נשלים ${built.filledIn} פקדים גנריים.</div>`,
    );
  } else {
    lines.push('<div class="sub" style="margin:6px 0 0">מספיק בדיחות — אף פקד גנרי לא נכנס.</div>');
  }
  if (built.errors.length > 0) {
    lines.push(`<div class="err">${built.errors.join(' · ')}</div>`);
  }
  el.innerHTML = lines.join('');
}

function refresh(): void {
  readForm();
  paintChips();
  paintVerdict();
}

function wire(): void {
  for (const id of ['#names', '#jokes', '#occasion']) {
    app.querySelector(id)?.addEventListener('input', refresh);
  }
  app.querySelector('#players')?.addEventListener('click', (e) => {
    const n = (e.target as HTMLElement).dataset['players'];
    if (n) {
      answers.players = Number(n);
      refresh();
    }
  });
  app.querySelector('#world')?.addEventListener('click', (e) => {
    const w = (e.target as HTMLElement).dataset['world'];
    if (w) {
      answers.world = w as World;
      refresh();
    }
  });
  app.querySelector('#crowd')?.addEventListener('click', (e) => {
    const c = (e.target as HTMLElement).dataset['crowd'];
    if (c) {
      answers.crowd = c as Crowd;
      refresh();
    }
  });
  app.querySelector('#play')?.addEventListener('click', () => {
    readForm();
    const { pack } = buildPack(answers);
    try {
      localStorage.setItem(CUSTOM_KEY, JSON.stringify(pack));
    } catch {
      // private mode: fall through, the demo pack still plays
    }
    location.href = playLink(pack, location.href);
  });
  app.querySelector('#link')?.addEventListener('click', () => {
    readForm();
    const { pack } = buildPack(answers);
    const url = playLink(pack, location.href);
    const out = app.querySelector('#linkout')!;
    out.innerHTML = `
      <div class="sub" style="margin:12px 0 6px">זה הלינק. כל טלפון שפותח אותו מקבל את המשחק שלכם — בלי התקנה ובלי חשבון.</div>
      <input id="linkfield" readonly value="${url}" />
      <button id="copy">העתק</button>`;
    out.querySelector<HTMLInputElement>('#linkfield')?.select();
    out.querySelector('#copy')?.addEventListener('click', async () => {
      const field = out.querySelector<HTMLInputElement>('#linkfield')!;
      field.select();
      try {
        await navigator.clipboard.writeText(url);
        out.querySelector('#copy')!.textContent = 'הועתק';
      } catch {
        out.querySelector('#copy')!.textContent = 'סמן והעתק ידנית';
      }
    });
  });
  app.querySelector('#cardbtn')?.addEventListener('click', () => {
    readForm();
    const { pack } = buildPack(answers);
    window.open(playLink(pack, location.href, '../card/'), '_blank');
  });
  app.querySelector('#download')?.addEventListener('click', () => {
    readForm();
    const { pack } = buildPack(answers);
    const blob = new Blob([JSON.stringify(pack, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${pack.slug}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  });
}

app.innerHTML = form();
wire();
refresh();
