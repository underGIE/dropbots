import { buildAll } from '../order/build-all';
import type { EngineId, EngineReadiness, Order } from '../order/order-types';
import { orderFromParams } from '../share/order-link';
import './gift.css';

const app = document.getElementById('app')!;

const esc = (text: string): string => text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

interface Game {
  title: string;
  desc: string;
  /** where the game page lives, relative to the hub; absent = not built yet */
  path?: string;
}

const GAMES: Record<EngineId, Game> = {
  party: { title: 'DROPBOTS', desc: 'צועקים הוראות, לוחצים כפתורים, הקהל עולה.', path: '../play/' },
  locks: { title: 'המנעולים', desc: 'שורה של מנעולים עליכם — התשובות מפוזרות בין הטלפונים.', path: '../locks/' },
  fight: { title: 'הקרב', desc: 'סולם קרבות נגד החברים, עד הנבל שהקבוצה בחרה.', path: '../fight/' },
  motion: { title: 'תנועה', desc: 'משחק תנועה לכל החבורה.' },
  shanzia: { title: 'שאנזיה', desc: 'המשחק של שאנזיה.' },
};

const ORDER_OF_CARDS: EngineId[] = ['party', 'locks', 'fight', 'motion', 'shanzia'];

function card(r: EngineReadiness, encoded: string): string {
  const game = GAMES[r.engine];
  if (!game.path) {
    return `
      <div class="card game-card off">
        <h2>${esc(game.title)}</h2>
        <div class="desc">${esc(game.desc)}</div>
        <span class="soon">בקרוב</span>
      </div>`;
  }
  if (!r.ready) {
    return `
      <div class="card game-card off">
        <h2>${esc(game.title)}</h2>
        <div class="desc">${esc(game.desc)}</div>
        <ul class="missing">${r.missing.map((m) => `<li>${esc(m)}</li>`).join('')}</ul>
      </div>`;
  }
  const href = new URL(game.path, location.href);
  href.searchParams.set('o', encoded);
  return `
    <div class="card game-card">
      <h2>${esc(game.title)}</h2>
      <div class="desc">${esc(game.desc)}</div>
      <a class="go" href="${esc(href.toString())}">שחקו</a>
    </div>`;
}

function header(order: Order): string {
  const names = order.names.map(esc).join(' · ');
  return `
    <div class="gift-head">
      <h1>${esc(order.occasion) || 'מתנה'}</h1>
      ${names ? `<div class="sub">${names}</div>` : ''}
    </div>`;
}

async function boot(): Promise<void> {
  const params = new URLSearchParams(location.search);
  const order = await orderFromParams(params);
  if (!order) {
    app.innerHTML = `
      <div class="card">
        <div class="big">אין כאן מתנה עדיין</div>
        <div class="sub" style="margin-top:8px">ממלאים את ההזמנה בעמוד <a href="../order/">ההזמנה</a> וחוזרים עם הלינק.</div>
      </div>`;
    return;
  }
  const encoded = params.get('o')!;
  const built = buildAll(order);
  const byEngine = new Map(built.readiness.map((r) => [r.engine, r]));
  app.innerHTML =
    header(order) +
    ORDER_OF_CARDS.map((id) => {
      const r = byEngine.get(id) ?? { engine: id, ready: false, missing: [] };
      return card(r, encoded);
    }).join('');
}

void boot();
