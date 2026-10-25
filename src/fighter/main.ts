import { ATTACK_LABELS, GUARD_LABELS, canSpecial, createDuel, playRound } from './duel';
import type { Attack, DuelState, Fighter, Guard } from './types';

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

function revealScreen(s: DuelState, hitSide: 0 | 1 | null): string {
  const last = s.last!;
  return `
    ${bars(s)}
    ${stage(s, hitSide)}
    <div class="card" style="text-align:center">
      <div class="big">${last.line}</div>
      <div class="sub" style="margin-top:6px">${
        last.toDefender > 0 ? `${last.toDefender} נזק` : last.toAttacker > 0 ? `${last.toAttacker} נזק חוזר` : 'אפס נזק'
      }</div>
      <button class="primary" id="next">${s.phase === 'over' ? 'תוצאה' : 'הסיבוב הבא'}</button>
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
  if (!duel) {
    app.innerHTML = setup();
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

render();
