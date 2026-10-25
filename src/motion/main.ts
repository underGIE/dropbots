import './motion.css';
import {
  DEFAULT_DEBOUNCE_MS,
  DEFAULT_SHAKE_THRESHOLD,
  fmt,
  initialShake,
  pruneOld,
  sampleRate,
  shakeStrength,
  stepShake,
  tiltToOffset,
  type PermissionState,
} from './detect';

/* The spike: can a phone's own motion be a controller in the browser?
   Nothing is requested on load. iOS 13+ only grants motion access from a
   user gesture, so everything starts at the button. */

type IosPermissionApi = { requestPermission?: () => Promise<'granted' | 'denied'> };
const MotionEv = (window as unknown as { DeviceMotionEvent?: IosPermissionApi }).DeviceMotionEvent;
const OrientEv = (window as unknown as { DeviceOrientationEvent?: IosPermissionApi }).DeviceOrientationEvent;

const app = document.getElementById('app')!;
app.innerHTML = `
  <h1>MOTION</h1>
  <div class="sub">בדיקה: האם הטלפון עצמו יכול להיות שלט</div>
  <div class="card"><div class="state not-requested" id="state">not-requested</div></div>
  <button class="primary" id="start">הפעל חיישנים</button>
  <div class="card" style="margin-top:12px">
    <div class="title">קצב דגימה (Hz, שנייה אחרונה)</div>
    <div class="hz" id="hz">—</div>
  </div>
  <div class="card">
    <div class="title">תאוצה ללא כבידה (m/s²)</div>
    <div class="grid">
      <div class="cell"><span>x</span><b id="lx">—</b></div>
      <div class="cell"><span>y</span><b id="ly">—</b></div>
      <div class="cell"><span>z</span><b id="lz">—</b></div>
    </div>
    <div class="title" style="margin-top:10px">תאוצה עם כבידה (m/s²)</div>
    <div class="grid">
      <div class="cell"><span>x</span><b id="gx">—</b></div>
      <div class="cell"><span>y</span><b id="gy">—</b></div>
      <div class="cell"><span>z</span><b id="gz">—</b></div>
    </div>
  </div>
  <div class="card">
    <div class="title">כיוון המכשיר (מעלות): alpha / beta / gamma</div>
    <div class="grid">
      <div class="cell"><span>alpha</span><b id="oa">—</b></div>
      <div class="cell"><span>beta</span><b id="ob">—</b></div>
      <div class="cell"><span>gamma</span><b id="og">—</b></div>
    </div>
    <div class="title" style="margin-top:10px">מהירות סיבוב (°/s): alpha / beta / gamma</div>
    <div class="grid">
      <div class="cell"><span>alpha</span><b id="ra">—</b></div>
      <div class="cell"><span>beta</span><b id="rb">—</b></div>
      <div class="cell"><span>gamma</span><b id="rg">—</b></div>
    </div>
  </div>
  <div class="card">
    <div class="title">ניעור (סף ${DEFAULT_SHAKE_THRESHOLD} m/s²)</div>
    <div class="shake" id="shake"><div class="n" id="shakeN">0</div><div>נערו את הטלפון</div></div>
  </div>
  <div class="card">
    <div class="title">הטיה</div>
    <div class="square"><div class="dot" id="dot"></div></div>
  </div>
  <div class="card">
    <div class="title">יומן</div>
    <div class="log" id="log"></div>
  </div>`;

const $ = (id: string): HTMLElement => document.getElementById(id)!;
const set = (id: string, text: string): void => {
  $(id).textContent = text;
};

const t0 = performance.now();
function log(msg: string): void {
  const secs = ((performance.now() - t0) / 1000).toFixed(2).padStart(7);
  const el = $('log');
  el.textContent += `${secs}s  ${msg}\n`;
  el.scrollTop = el.scrollHeight;
}

let state: PermissionState = 'not-requested';
function setState(next: PermissionState): void {
  state = next;
  const el = $('state');
  el.textContent = next;
  el.className = `state ${next}`;
  log(`state -> ${next}`);
}

window.addEventListener('error', (e) => log(`ERROR: ${e.message}`));
window.addEventListener('unhandledrejection', (e) => log(`REJECTION: ${String(e.reason)}`));

log(`secure context: ${window.isSecureContext}`);
log(`DeviceMotionEvent: ${MotionEv ? 'yes' : 'no'}, DeviceOrientationEvent: ${OrientEv ? 'yes' : 'no'}`);
log(`iOS-style requestPermission: ${typeof MotionEv?.requestPermission === 'function' ? 'yes' : 'no'}`);
log(`UA: ${navigator.userAgent}`);

// ---- live data ----
let motionStamps: number[] = [];
let shake = initialShake;
let firstMotion = false;
let firstOrient = false;
let tilt = { x: 0, y: 0 };
let flashTimer = 0;

function onMotion(e: DeviceMotionEvent): void {
  const now = performance.now();
  if (!firstMotion) {
    firstMotion = true;
    log(`first devicemotion sample (interval reported: ${e.interval} ms)`);
  }
  motionStamps.push(now);

  const lin = e.acceleration;
  const grav = e.accelerationIncludingGravity;
  set('lx', fmt(lin?.x));
  set('ly', fmt(lin?.y));
  set('lz', fmt(lin?.z));
  set('gx', fmt(grav?.x));
  set('gy', fmt(grav?.y));
  set('gz', fmt(grav?.z));
  const rr = e.rotationRate;
  set('ra', fmt(rr?.alpha, 1));
  set('rb', fmt(rr?.beta, 1));
  set('rg', fmt(rr?.gamma, 1));

  const linear = lin && lin.x != null && lin.y != null && lin.z != null ? { x: lin.x, y: lin.y, z: lin.z } : null;
  const withG = grav && grav.x != null && grav.y != null && grav.z != null ? { x: grav.x, y: grav.y, z: grav.z } : null;
  const step = stepShake(shake, shakeStrength(linear, withG), now, DEFAULT_SHAKE_THRESHOLD, DEFAULT_DEBOUNCE_MS);
  shake = step.state;
  if (step.fired) {
    set('shakeN', String(shake.count));
    const box = $('shake');
    box.classList.add('flash');
    window.clearTimeout(flashTimer);
    flashTimer = window.setTimeout(() => box.classList.remove('flash'), 120);
    log(`shake #${shake.count}`);
  }
}

function onOrientation(e: DeviceOrientationEvent): void {
  if (!firstOrient) {
    firstOrient = true;
    log('first deviceorientation sample');
  }
  set('oa', fmt(e.alpha, 1));
  set('ob', fmt(e.beta, 1));
  set('og', fmt(e.gamma, 1));
  tilt = tiltToOffset(e.beta, e.gamma);
}

// the dot follows the latest tilt every frame, so it feels immediate
function frame(): void {
  const sq = $('dot').parentElement!;
  const half = sq.clientWidth / 2;
  $('dot').style.transform = `translate(${tilt.x * (half - 18)}px, ${tilt.y * (half - 18)}px)`;
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

window.setInterval(() => {
  const now = performance.now();
  motionStamps = pruneOld(motionStamps, now);
  set('hz', state === 'granted' ? sampleRate(motionStamps, now).toFixed(0) : '—');
}, 250);

// ---- permission ----
let listening = false;
function listen(): void {
  if (listening) return;
  listening = true;
  window.addEventListener('devicemotion', onMotion);
  window.addEventListener('deviceorientation', onOrientation);
  log('listeners attached');
  // a "granted" that never produces a sample is its own failure mode
  window.setTimeout(() => {
    if (!firstMotion) log('WARNING: no devicemotion sample after 2 s (desktop, or sensors blocked?)');
  }, 2000);
}

async function start(): Promise<void> {
  if (!MotionEv && !OrientEv) {
    setState('unsupported');
    log('this browser has no motion events');
    return;
  }
  try {
    // both prompts must start inside the tap, so fire them together
    const asks: Promise<string>[] = [];
    if (typeof MotionEv?.requestPermission === 'function') asks.push(MotionEv.requestPermission());
    if (typeof OrientEv?.requestPermission === 'function') asks.push(OrientEv.requestPermission());
    if (asks.length === 0) {
      log('no permission API on this browser (Android / desktop): listening directly');
      setState('granted');
      listen();
      return;
    }
    const results = await Promise.all(asks);
    log(`permission result: ${results.join(', ')}`);
    if (results.every((r) => r === 'granted')) {
      setState('granted');
      listen();
    } else {
      setState('denied');
      log('denied. On iOS, quit Safari / clear the site setting to be asked again.');
    }
  } catch (err) {
    setState('denied');
    log(`permission error: ${err instanceof Error ? `${err.name}: ${err.message}` : String(err)}`);
  }
}

$('start').addEventListener('click', () => {
  log('button tapped');
  void start();
});
