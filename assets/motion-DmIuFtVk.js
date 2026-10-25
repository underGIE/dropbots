import"./modulepreload-polyfill-B5Qt9EMX.js";/* empty css               */const T=9.81,b=15,k=350;function y(t,s,e){return Math.sqrt(t*t+s*s+e*e)}function L(t,s){return t?y(t.x,t.y,t.z):s?Math.abs(y(s.x,s.y,s.z)-T):0}const N={count:0,lastAt:-1/0};function I(t,s,e,i=b,a=k){return s>=i&&e-t.lastAt>=a?{state:{count:t.count+1,lastAt:e},fired:!0}:{state:t,fired:!1}}function x(t,s,e){return Math.min(e,Math.max(s,t))}function R(t,s,e=45){const i=t??0;return{x:x((s??0)/e,-1,1),y:x(i/e,-1,1)}}function P(t,s,e=1e3){let i=0;for(const a of t)s-a<=e&&a<=s&&(i+=1);return i*1e3/e}function D(t,s,e=1e3){return t.filter(i=>s-i<=e)}function d(t,s=2){return t==null||Number.isNaN(t)?"—":t.toFixed(s)}const l=window.DeviceMotionEvent,c=window.DeviceOrientationEvent,F=document.getElementById("app");F.innerHTML=`
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
    <div class="title">ניעור (סף ${b} m/s²)</div>
    <div class="shake" id="shake"><div class="n" id="shakeN">0</div><div>נערו את הטלפון</div></div>
  </div>
  <div class="card">
    <div class="title">הטיה</div>
    <div class="square"><div class="dot" id="dot"></div></div>
  </div>
  <div class="card">
    <div class="title">יומן</div>
    <div class="log" id="log"></div>
  </div>`;const r=t=>document.getElementById(t),o=(t,s)=>{r(t).textContent=s},M=performance.now();function n(t){const s=((performance.now()-M)/1e3).toFixed(2).padStart(7),e=r("log");e.textContent+=`${s}s  ${t}
`,e.scrollTop=e.scrollHeight}let q="not-requested";function v(t){q=t;const s=r("state");s.textContent=t,s.className=`state ${t}`,n(`state -> ${t}`)}window.addEventListener("error",t=>n(`ERROR: ${t.message}`));window.addEventListener("unhandledrejection",t=>n(`REJECTION: ${String(t.reason)}`));n(`secure context: ${window.isSecureContext}`);n(`DeviceMotionEvent: ${l?"yes":"no"}, DeviceOrientationEvent: ${c?"yes":"no"}`);n(`iOS-style requestPermission: ${typeof(l==null?void 0:l.requestPermission)=="function"?"yes":"no"}`);n(`UA: ${navigator.userAgent}`);let p=[],u=N,m=!1,w=!1,f={x:0,y:0},$=0;function C(t){const s=performance.now();m||(m=!0,n(`first devicemotion sample (interval reported: ${t.interval} ms)`)),p.push(s);const e=t.acceleration,i=t.accelerationIncludingGravity;o("lx",d(e==null?void 0:e.x)),o("ly",d(e==null?void 0:e.y)),o("lz",d(e==null?void 0:e.z)),o("gx",d(i==null?void 0:i.x)),o("gy",d(i==null?void 0:i.y)),o("gz",d(i==null?void 0:i.z));const a=t.rotationRate;o("ra",d(a==null?void 0:a.alpha,1)),o("rb",d(a==null?void 0:a.beta,1)),o("rg",d(a==null?void 0:a.gamma,1));const A=e&&e.x!=null&&e.y!=null&&e.z!=null?{x:e.x,y:e.y,z:e.z}:null,O=i&&i.x!=null&&i.y!=null&&i.z!=null?{x:i.x,y:i.y,z:i.z}:null,g=I(u,L(A,O),s,b,k);if(u=g.state,g.fired){o("shakeN",String(u.count));const h=r("shake");h.classList.add("flash"),window.clearTimeout($),$=window.setTimeout(()=>h.classList.remove("flash"),120),n(`shake #${u.count}`)}}function H(t){w||(w=!0,n("first deviceorientation sample")),o("oa",d(t.alpha,1)),o("ob",d(t.beta,1)),o("og",d(t.gamma,1)),f=R(t.beta,t.gamma)}function S(){const s=r("dot").parentElement.clientWidth/2;r("dot").style.transform=`translate(${f.x*(s-18)}px, ${f.y*(s-18)}px)`,requestAnimationFrame(S)}requestAnimationFrame(S);window.setInterval(()=>{const t=performance.now();p=D(p,t),o("hz",q==="granted"?P(p,t).toFixed(0):"—")},250);let z=!1;function E(){z||(z=!0,window.addEventListener("devicemotion",C),window.addEventListener("deviceorientation",H),n("listeners attached"),window.setTimeout(()=>{m||n("WARNING: no devicemotion sample after 2 s (desktop, or sensors blocked?)")},2e3))}async function U(){if(!l&&!c){v("unsupported"),n("this browser has no motion events");return}try{const t=[];if(typeof(l==null?void 0:l.requestPermission)=="function"&&t.push(l.requestPermission()),typeof(c==null?void 0:c.requestPermission)=="function"&&t.push(c.requestPermission()),t.length===0){n("no permission API on this browser (Android / desktop): listening directly"),v("granted"),E();return}const s=await Promise.all(t);n(`permission result: ${s.join(", ")}`),s.every(e=>e==="granted")?(v("granted"),E()):(v("denied"),n("denied. On iOS, quit Safari / clear the site setting to be asked again."))}catch(t){v("denied"),n(`permission error: ${t instanceof Error?`${t.name}: ${t.message}`:String(t)}`)}}r("start").addEventListener("click",()=>{n("button tapped"),U()});
