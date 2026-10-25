var H=Object.defineProperty;var L=(s,t,i)=>t in s?H(s,t,{enumerable:!0,configurable:!0,writable:!0,value:i}):s[t]=i;var r=(s,t,i)=>L(s,typeof t!="symbol"?t+"":t,i);import"./modulepreload-polyfill-B5Qt9EMX.js";/* empty css               */import{D as I,c as v,t as C,a as M,s as T,d as j,o as x,b as E,e as f,f as N}from"./order-link-B7rwvhPT.js";import{b as U}from"./broadcast-D00MJWgb.js";import"./pack-link-D0o8BCOw.js";const A=[{id:"q01",prompt:"איפה סבא וסבתא נפגשו?",answer:"בתור לקולנוע"},{id:"q02",prompt:"השיר שאמא שרה במקלחת",answer:"ימים לבנים"},{id:"q03",prompt:"מה דודו שכח בחתונה שלו?",answer:"את הטבעת"},{id:"q04",prompt:"המאכל שסבתא מכינה רק בפסח",answer:"קוגל תפוחים"},{id:"q05",prompt:'לאן נסענו בטיול הראשון בחו"ל?',answer:"קפריסין"},{id:"q06",prompt:"השם של הכלב הראשון",answer:"בונזו"},{id:"q07",prompt:"מי תמיד מגיע אחרון לארוחת שישי?",answer:"שני"},{id:"q08",prompt:"הקבוצה של אבא",answer:"הפועל באר שבע"},{id:"q09",prompt:"מה אבי שבר בבר מצווה שלו?",answer:"את היד"},{id:"q10",prompt:"המשחק של כל חג",answer:"טאקי"},{id:"q11",prompt:"הרחוב של הבית הישן",answer:"רחוב הדקל"},{id:"q12",prompt:"המילה שסבא ממציא לכל דבר",answer:"שמונצעס"},{id:"q13",prompt:"מי נרדם בכל סרט?",answer:"אבא"},{id:"q14",prompt:"הקינוח שאף פעם לא נגמר",answer:"עוגת שמרים"}],z=500;class P{constructor(t){r(this,"isHost");r(this,"me");r(this,"hostId");r(this,"state",null);r(this,"seats");r(this,"error",null);r(this,"onChange",null);r(this,"transport");r(this,"facts");r(this,"tuning");r(this,"now");r(this,"timer",null);r(this,"lastSignature","");this.transport=t.transport,this.facts=t.facts,this.tuning=t.tuning??I,this.me=t.me,this.isHost=t.isHost,this.now=t.now??(()=>Date.now()),this.hostId=t.isHost?t.me.id:null,this.seats=t.isHost?[t.me]:[],this.transport.onMessage(i=>this.receive(i)),this.isHost?(this.state=v(this.facts,[this.me.id],this.seed(),this.tuning),t.autoTick!==!1&&(this.timer=setInterval(()=>this.pump(),z))):this.transport.send({t:"join",playerId:this.me.id,name:this.me.name})}names(){const t={};for(const i of this.seats)t[i.id]=i.name;return t}begin(){this.isHost?this.hostStart():this.transport.send({t:"start"})}submit(t){this.isHost?this.apply(this.me.id,t):this.transport.send({t:"submit",playerId:this.me.id,answers:t})}again(){this.isHost?(this.state=v(this.facts,this.seats.map(t=>t.id),this.seed(),this.tuning),this.publish()):this.transport.send({t:"again"})}pump(){!this.isHost||!this.state||this.state.phase!=="live"||(this.state=C(this.state,this.now()),this.publish())}close(){this.timer&&clearInterval(this.timer),this.transport.close()}seed(){return Math.floor(Math.random()*1e9)}receive(t){var i,n;switch(t.t){case"state":this.isHost||(this.hostId=t.hostId,this.state=t.state,this.seats=t.state.players.map(a=>({id:a,name:t.names[a]??a})),(i=this.onChange)==null||i.call(this));break;case"join":this.isHost&&!this.seats.some(a=>a.id===t.playerId)&&(this.seats=[...this.seats,{id:t.playerId,name:t.name}],this.state=v(this.facts,this.seats.map(a=>a.id),((n=this.state)==null?void 0:n.seed)??1,this.tuning),this.publish());break;case"start":this.isHost&&this.hostStart();break;case"submit":this.isHost&&this.apply(t.playerId,t.answers);break;case"again":this.isHost&&this.again();break}}hostStart(){var i;if(!this.state||this.state.phase!=="lobby")return;const t=M(this.facts,this.tuning,this.seats.length);if(t.length>0){this.error=t.join(" · "),(i=this.onChange)==null||i.call(this);return}this.error=null,this.state=T(this.state,this.now()),this.publish()}apply(t,i){this.state&&(this.state=j(this.state,t,i,this.now()),this.publish())}publish(){var t;if(this.state&&this.hostId){const i=this.state,n=`${i.phase}|${i.current}|${i.strikes}|${i.players.join(",")}|${i.log[0]??""}`;n!==this.lastSignature&&(this.lastSignature=n,this.transport.send({t:"state",hostId:this.hostId,state:i,names:this.names()}))}(t=this.onChange)==null||t.call(this)}}const o=document.getElementById("app");let k=A,q;async function _(){const s=await x(new URLSearchParams(location.search)),t=s?E(s).locks:null;t&&(k=t.facts,q=t.tuning)}let e=null,b="",h={};const D=()=>Math.random().toString(36).slice(2,9),u=s=>s.replace(/[&<>"']/g,t=>`&#${t.charCodeAt(0)};`),F=()=>Math.random().toString(36).slice(2,6).toUpperCase();function $(s,t){e=new P({transport:U(s),facts:k,tuning:q,me:{id:D(),name:b.trim()||"אורח"},isHost:t}),e.onChange=p,location.hash=s,p()}function R(){const s=location.hash.replace("#","").toUpperCase();return`
    <h1>המנעולים</h1>
    <div class="sub">שורה של מנעולים על המשפחה. התשובות מפוזרות בין הטלפונים — אף אחד לא פותח לבד.</div>
    <div class="card">
      <label>איך קוראים לך</label>
      <input id="name" value="${b}" placeholder="השם שלך" />
      <button class="primary" id="host">פתח חדר</button>
      <input id="code" value="${s}" placeholder="קוד חדר" maxlength="4" style="margin-top:10px" />
      <button id="join">הצטרף</button>
    </div>
    <div class="sub">בגרסה הזו כל הטלפונים הם לשוניות באותו דפדפן; טלפונים אמיתיים מגיעים עם מפתחות Supabase.</div>
  `}function G(s){return`
    <h1>המנעולים</h1>
    <div class="card">
      <div class="sub">קוד החדר</div>
      <div class="code">${location.hash.replace("#","")}</div>
    </div>
    <div class="card">
      <div class="sub">בחדר (${s.seats.length})</div>
      <div class="names">${s.seats.map(t=>u(t.name)).join(" · ")}</div>
      ${s.seats.length<2?'<div class="sub">צריך לפחות שניים — אחד מחזיק מנעול, השני מחזיק תשובה.</div>':""}
      <button class="primary" id="start">התחילו</button>
      ${s.error?`<div class="err">${s.error}</div>`:""}
    </div>
    <div class="card">
      <div class="sub">איך משחקים</div>
      <div>טלפון אחד רואה את השאלות עם אפשרויות. הטלפונים האחרים רואים את התשובות — כל אחד תשובה אחרת. מדברים, פותחים, המנעול עובר הלאה.</div>
    </div>
  `}function m(s){const t=s.state,i=t.tuning.secondsTotal*1e3,n=Math.max(0,t.endsAt-Date.now()),a=Array.from({length:t.tuning.strikes},(l,c)=>`<i class="pip ${c<t.strikes?"on":""}"></i>`).join("");return`
    <div class="row">
      <div class="big">מנעול ${Math.min(t.current+1,t.locks.length)} / ${t.locks.length}</div>
      <div class="pips">${a}</div>
    </div>
    <div class="timer" style="margin-top:8px"><i id="clock" style="width:${n/i*100}%"></i></div>
    <div class="feed">${t.log[0]??""}</div>
  `}function K(s){var l;const t=s.state,i=N(t,s.me.id),n=f(t),a=((l=s.seats.find(c=>c.id===n.holder))==null?void 0:l.name)??"";return i.role==="lock"?`
      ${m(s)}
      <div class="card"><div class="big">המנעול אצלך</div>
      <div class="sub">השאלות פה, התשובות אצל האחרים. תשאל בקול.</div></div>
      ${i.questions.map((c,d)=>`
        <div class="card">
          <div class="big" style="font-size:17px">${u(c.prompt)}</div>
          <div class="chips" style="margin-top:10px">
            ${c.options.map((g,S)=>`<button class="chip ${h[String(d)]===g?"on":""}" data-q="${d}" data-k="${S}">${u(g)}</button>`).join("")}
          </div>
        </div>`).join("")}
      ${i.clues.length>0?y(i.clues):""}
      <div class="card"><button class="primary" id="submit">פתח את המנעול</button></div>
    `:i.role==="clue"?`
      ${m(s)}
      <div class="card"><div class="big">המנעול אצל ${u(a)}</div>
      <div class="sub">התשובה אצלך. תגיד אותה בקול — אל תראה את המסך.</div></div>
      ${y(i.clues)}
    `:`
    ${m(s)}
    <div class="card" style="text-align:center">
      <div class="big">המנעול אצל ${u(a)}</div>
      <div class="sub">הסיבוב הזה אתה נושם. תעזור להם להסכים.</div>
    </div>
  `}function y(s){return s.map(t=>`
    <div class="card" style="text-align:center">
      <div class="sub">${u(t.prompt)}</div>
      <div class="shout" style="margin-top:8px">${u(t.answer)}</div>
    </div>`).join("")}function O(s){const t=s.state;return`
    <h1>${t.phase==="won"?"הדלת נפתחה 🔓":"הדלת נשארה סגורה 🔒"}</h1>
    <div class="card">
      <div class="big">${t.current} מתוך ${t.locks.length} מנעולים</div>
      <div class="feed" style="margin-top:8px">${t.log.join(" · ")}</div>
      <button class="primary" id="again">עוד שורה</button>
    </div>
  `}let w="";function p(){if(!e||!e.state){o.innerHTML=R(),Z();return}const s=e,t=s.state;if(!t)return;const i=`${t.phase}|${t.current}|${t.strikes}|${s.seats.length}|${s.error??""}|${JSON.stringify(h)}`;i!==w&&(w=i,t.phase==="lobby"?o.innerHTML=G(s):t.phase==="live"?o.innerHTML=K(s):o.innerHTML=O(s),B())}function Z(){var i,n;const s=o.querySelector("#name"),t=o.querySelector("#code");s==null||s.addEventListener("input",()=>b=s.value),(i=o.querySelector("#host"))==null||i.addEventListener("click",()=>{const a=((t==null?void 0:t.value)||"").trim().toUpperCase();$(a.length>=3?a:F(),!0)}),(n=o.querySelector("#join"))==null||n.addEventListener("click",()=>{const a=((t==null?void 0:t.value)||"").trim().toUpperCase();a.length>=3&&$(a,!1)})}function B(){var s,t,i;(s=o.querySelector("#start"))==null||s.addEventListener("click",()=>e==null?void 0:e.begin()),(t=o.querySelector("#again"))==null||t.addEventListener("click",()=>{h={},e==null||e.again()});for(const n of o.querySelectorAll("[data-q]"))n.addEventListener("click",()=>{var d;const a=e==null?void 0:e.state,l=a?f(a):null,c=(d=l==null?void 0:l.questions[Number(n.dataset.q)])==null?void 0:d.options[Number(n.dataset.k)];c!==void 0&&(h={...h,[n.dataset.q]:c},p())});(i=o.querySelector("#submit"))==null||i.addEventListener("click",()=>{const n=e==null?void 0:e.state;if(!n)return;const l=f(n).questions.map((c,d)=>h[String(d)]??"");l.some(c=>c==="")||(h={},e==null||e.submit(l))})}setInterval(()=>{const s=e==null?void 0:e.state,t=o.querySelector("#clock");if(s&&s.phase==="live"&&t){const i=s.tuning.secondsTotal*1e3;t.style.width=`${Math.max(0,s.endsAt-Date.now())/i*100}%`}},250);async function J(){await _(),p()}J();
