import { giftLink } from '../share/order-link';
import { playLink } from '../share/pack-link';
import { buildAll } from './build-all';
import type { Crowd, World } from './build-pack';
import { emptyOrder, type EngineId, type Order } from './order-types';

const app = document.getElementById('app')!;
const DRAFT_KEY = 'dropbots:order-draft';

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
const ENGINE_NAMES: Record<EngineId, string> = {
  party: 'DROPBOTS — צועקים אחד על השני',
  locks: 'המנעולים — פאזל שאף אחד לא פותח לבד',
  fight: 'הקרב — versus וסטורי נגד הנבל',
  motion: 'המשחק התנועתי',
  shanzia: 'שנזיה',
};

const order: Order = loadDraft() ?? emptyOrder();

function esc(text: string): string {
  return text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

function loadDraft(): Order | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    return raw ? (JSON.parse(raw) as Order) : null;
  } catch {
    return null;
  }
}

function saveDraft(): void {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(order));
  } catch {
    // private mode: the form still works, it just forgets on reload
  }
}

/** facts are typed one per line as "שאלה | תשובה" */
function factsText(): string {
  return order.facts.map((f) => `${f.prompt} | ${f.answer}`).join('\n');
}

function form(): string {
  const names = order.names;
  return `
    <h1>בונים את המתנה</h1>
    <div class="sub">טופס אחד לכל המשחקים. מה שתכתבו הוא המשחק — אי אפשר לקנות את זה בחנות.</div>

    <div class="card">
      <div class="big">1 · על מי זה</div>
      <label style="margin-top:10px">למי המתנה (שמות, מופרדים בפסיק)</label>
      <input id="names" value="${esc(names.join(', '))}" placeholder="אבי, שני, דודו, מיכל" />
      <label style="margin-top:10px">כמה טלפונים ישחקו ביחד</label>
      <div class="chips" id="players">${[2, 3, 4].map((n) => `<button class="chip ${order.players === n ? 'on' : ''}" data-players="${n}">${n}</button>`).join('')}</div>
      <label style="margin-top:10px">האירוע</label>
      <input id="occasion" value="${esc(order.occasion)}" placeholder="ראש השנה אצל סבתא" />
      <label style="margin-top:10px">עולם</label>
      <div class="chips" id="world">${WORLDS.map((w) => `<button class="chip ${order.world === w.id ? 'on' : ''}" data-world="${w.id}">${w.label}</button>`).join('')}</div>
      <label style="margin-top:10px">מי משחק</label>
      <div class="chips" id="crowd">${CROWDS.map((c) => `<button class="chip ${order.crowd === c.id ? 'on' : ''}" data-crowd="${c.id}">${c.label}</button>`).join('')}</div>
    </div>

    <div class="card">
      <div class="big">2 · DROPBOTS — בדיחות הפנים</div>
      <div class="sub">שורה לכל אחת. הן הופכות לפקדים על דק ה-DJ.</div>
      <textarea id="jokes" rows="6" placeholder="תוריד את הבס של שרון&#10;סבתא על הרמקול&#10;טיפקס">${esc(order.jokes.join('\n'))}</textarea>
    </div>

    <div class="card">
      <div class="big">3 · המנעולים — עובדות על המשפחה</div>
      <div class="sub">שורה לכל עובדה: <b>שאלה | תשובה</b>. התשובות מתפזרות בין הטלפונים. לפחות 8, שש מנעולים צריכים 12.</div>
      <textarea id="facts" rows="7" placeholder="איפה סבא וסבתא נפגשו? | בתור לקולנוע&#10;השיר שאמא שרה במקלחת | ימים לבנים">${esc(factsText())}</textarea>
    </div>

    <div class="card">
      <div class="big">4 · הקרב — תכונה לכל אחד</div>
      <div class="sub">במה הוא/היא מפורסם/ת. זה הופך למהלך המיוחד שלהם.</div>
      ${
        names.length === 0
          ? '<div class="sub">קודם תכתבו שמות בסעיף 1.</div>'
          : names
              .map(
                (n) => `<label style="margin-top:8px">${esc(n)}</label>
                <input data-trait="${esc(n)}" value="${esc(order.traits[n] ?? '')}" placeholder="תמיד מאחר" />`,
              )
              .join('')
      }
    </div>

    <div class="card">
      <div class="big">5 · הנבל</div>
      <div class="sub">מי שהחבורה מפילה בסוף הסטורי. בילד פרטי בלבד — לא מוצג בשום מקום.</div>
      <label style="margin-top:8px">שם</label>
      <input id="vname" value="${esc(order.villain?.name ?? '')}" placeholder="שוקי מהוועד" />
      <label style="margin-top:8px">התכונה שלו</label>
      <input id="vtrait" value="${esc(order.villain?.trait ?? '')}" placeholder="תמיד צודק" />
      <label style="margin-top:8px">למה דווקא הוא (שורת הפתיחה של הקרב האחרון)</label>
      <input id="vwhy" value="${esc(order.villain?.why ?? '')}" placeholder="שלוש שנים של דמי ועד" />
      <label style="margin-top:8px">משפטים שהוא אומר (שורה לכל אחד)</label>
      <textarea id="vtaunts" rows="3" placeholder="שילמתם?&#10;אני אבדוק את זה בישיבה">${esc((order.villain?.taunts ?? []).join('\n'))}</textarea>
    </div>

    <div class="card" id="readiness"></div>

    <div class="card">
      <button class="primary" id="gift">צור את המתנה</button>
      <button id="link">צור לינק לשליחה</button>
      <button id="cardbtn">כרטיס מתנה להדפסה (DROPBOTS)</button>
      <button id="download">הורד את ההזמנה (JSON)</button>
      <button id="reset">נקה טופס</button>
      <div id="linkout"></div>
    </div>
  `;
}

function readForm(): void {
  const val = (sel: string) => app.querySelector<HTMLInputElement | HTMLTextAreaElement>(sel)?.value ?? '';
  const lines = (sel: string) => val(sel).split('\n').map((l) => l.trim()).filter((l) => l !== '');

  order.names = val('#names').split(',').map((n) => n.trim()).filter((n) => n !== '');
  order.occasion = val('#occasion');
  order.jokes = lines('#jokes');
  order.facts = lines('#facts').map((line) => {
    const [prompt = '', answer = ''] = line.split('|').map((s) => s.trim());
    return { id: '', prompt, answer };
  });
  for (const input of app.querySelectorAll<HTMLInputElement>('[data-trait]')) {
    order.traits[input.dataset.trait!] = input.value;
  }
  const vname = val('#vname');
  order.villain =
    vname.trim() === '' && val('#vtrait').trim() === '' && val('#vwhy').trim() === ''
      ? null
      : { name: vname, trait: val('#vtrait'), why: val('#vwhy'), taunts: lines('#vtaunts') };
  saveDraft();
}

function paintReadiness(): void {
  const built = buildAll(order);
  const el = app.querySelector('#readiness')!;
  el.innerHTML = `
    <div class="big">מה מוכן</div>
    ${built.readiness
      .map(
        (r) => `
      <div class="tier">
        <div>${ENGINE_NAMES[r.engine]}${
          r.missing.length > 0 ? `<div class="what">${r.missing.map(esc).join(' · ')}</div>` : ''
        }</div>
        <div class="price" style="color:${r.ready ? 'var(--ok)' : 'var(--dim)'}">${r.ready ? '✓' : '—'}</div>
      </div>`,
      )
      .join('')}`;
}

function rerender(): void {
  const active = document.activeElement as HTMLElement | null;
  const id = active?.id;
  const trait = active?.dataset?.['trait'];
  const pos = (active as HTMLInputElement | null)?.selectionStart ?? null;
  app.innerHTML = form();
  wire();
  paintReadiness();
  const again = id
    ? app.querySelector<HTMLInputElement>(`#${id}`)
    : trait
      ? app.querySelector<HTMLInputElement>(`[data-trait="${CSS.escape(trait)}"]`)
      : null;
  if (again) {
    again.focus();
    if (pos !== null && 'setSelectionRange' in again) {
      try {
        again.setSelectionRange(pos, pos);
      } catch {
        // number-ish inputs refuse; fine
      }
    }
  }
}

function wire(): void {
  // names change the trait inputs, so that one rebuilds the form
  app.querySelector('#names')?.addEventListener('change', () => {
    readForm();
    rerender();
  });
  for (const sel of ['#names', '#occasion', '#jokes', '#facts', '#vname', '#vtrait', '#vwhy', '#vtaunts']) {
    app.querySelector(sel)?.addEventListener('input', () => {
      readForm();
      paintReadiness();
    });
  }
  for (const input of app.querySelectorAll<HTMLInputElement>('[data-trait]')) {
    input.addEventListener('input', () => {
      readForm();
      paintReadiness();
    });
  }
  const chips = (group: string, key: 'players' | 'world' | 'crowd') => {
    app.querySelector(group)?.addEventListener('click', (e) => {
      const v = (e.target as HTMLElement).dataset[key];
      if (!v) {
        return;
      }
      if (key === 'players') {
        order.players = Number(v);
      } else if (key === 'world') {
        order.world = v as World;
      } else {
        order.crowd = v as Crowd;
      }
      readForm();
      rerender();
    });
  };
  chips('#players', 'players');
  chips('#world', 'world');
  chips('#crowd', 'crowd');

  app.querySelector('#gift')?.addEventListener('click', async () => {
    readForm();
    location.href = await giftLink(order, location.href, '../gift/');
  });
  app.querySelector('#link')?.addEventListener('click', async () => {
    readForm();
    const url = await giftLink(order, location.href, '../gift/');
    const out = app.querySelector('#linkout')!;
    out.innerHTML = `
      <div class="sub" style="margin:12px 0 6px">זה הלינק למתנה. כל טלפון שפותח אותו רואה את כל המשחקים שלכם.</div>
      <input id="linkfield" readonly value="${esc(url)}" />
      <button id="copy">העתק</button>`;
    out.querySelector<HTMLInputElement>('#linkfield')?.select();
    out.querySelector('#copy')?.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(url);
        out.querySelector('#copy')!.textContent = 'הועתק';
      } catch {
        out.querySelector('#copy')!.textContent = 'סמן והעתק ידנית';
      }
    });
  });
  app.querySelector('#cardbtn')?.addEventListener('click', async () => {
    readForm();
    const tab = window.open('', '_blank');
    const url = await playLink(buildAll(order).party, location.href, '../card/');
    if (tab) {
      tab.location.href = url;
    } else {
      location.href = url;
    }
  });
  app.querySelector('#download')?.addEventListener('click', () => {
    readForm();
    const blob = new Blob([JSON.stringify(order, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `order-${order.createdAt.slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  });
  app.querySelector('#reset')?.addEventListener('click', () => {
    Object.assign(order, emptyOrder());
    saveDraft();
    rerender();
  });
}

app.innerHTML = form();
wire();
paintReadiness();
