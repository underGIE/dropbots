import './card.css';
import { decodePack, playLink } from '../share/pack-link';
import { qrSvg } from '../share/qr';

const app = document.getElementById('app')!;

function esc(text: string): string {
  return text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

function render(): void {
  const encoded = new URLSearchParams(location.search).get('p');
  const pack = encoded ? decodePack(encoded) : null;
  if (!pack) {
    app.innerHTML = '<div class="msg">אין כאן משחק. חזרו לטופס ההזמנה וצרו את הכרטיס משם.</div>';
    return;
  }

  // Same hop as the order page: one level up and into /play/, so the link is
  // right at the domain root and under /dropbots/ alike.
  const url = playLink(pack, location.href);
  let qr: string;
  try {
    qr = `<div class="qr">${qrSvg(url)}</div>`;
  } catch {
    qr = '<div class="qr-fail">הלינק ארוך מדי לקוד QR. קצרו את הבדיחות ונסו שוב.</div>';
  }

  const names = pack.intro?.names ?? [];
  app.innerHTML = `
    <div class="sheet">
      <div class="occasion">${esc(pack.subtitle ?? '')}</div>
      <h1>${esc(pack.title)}</h1>
      ${names.length > 0 ? `<div class="to"><span>למי:</span> ${esc(names.join(', '))}</div>` : ''}
      ${qr}
      <div class="how">סרקו, פתחו, שחקו ביחד — בלי התקנה</div>
    </div>
    <div class="bar"><button id="print">הדפס</button></div>`;
  app.querySelector('#print')?.addEventListener('click', () => window.print());
}

render();
