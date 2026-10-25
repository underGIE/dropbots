import"./modulepreload-polyfill-B5Qt9EMX.js";/* empty css               */import{g as $,h as g,b as w}from"./order-link-B7rwvhPT.js";import{a as j}from"./pack-link-D0o8BCOw.js";const s=document.getElementById("app"),S="dropbots:order-draft",q=[{id:"techno",label:"טכנו"},{id:"trance",label:"טראנס"},{id:"disco",label:"דיסקו"},{id:"hiphop",label:"היפ-הופ"}],E=[{id:"kids",label:"ילדים"},{id:"mixed",label:"מעורב"},{id:"adults",label:"מבוגרים"}],O={party:"DROPBOTS — צועקים אחד על השני",locks:"המנעולים — פאזל שאף אחד לא פותח לבד",fight:"הקרב — versus וסטורי נגד הנבל",motion:"המשחק התנועתי",shanzia:"שנזיה"},e=R()??$();function d(t){return t.replace(/[&<>"']/g,o=>`&#${o.charCodeAt(0)};`)}function R(){try{const t=localStorage.getItem(S);return t?JSON.parse(t):null}catch{return null}}function k(){try{localStorage.setItem(S,JSON.stringify(e))}catch{}}function T(){return e.facts.map(t=>`${t.prompt} | ${t.answer}`).join(`
`)}function x(){var o,n,i,l;const t=e.names;return`
    <h1>בונים את המתנה</h1>
    <div class="sub">טופס אחד לכל המשחקים. מה שתכתבו הוא המשחק — אי אפשר לקנות את זה בחנות.</div>

    <div class="card">
      <div class="big">1 · על מי זה</div>
      <label style="margin-top:10px">למי המתנה (שמות, מופרדים בפסיק)</label>
      <input id="names" value="${d(t.join(", "))}" placeholder="אבי, שני, דודו, מיכל" />
      <label style="margin-top:10px">כמה טלפונים ישחקו ביחד</label>
      <div class="chips" id="players">${[2,3,4].map(a=>`<button class="chip ${e.players===a?"on":""}" data-players="${a}">${a}</button>`).join("")}</div>
      <label style="margin-top:10px">האירוע</label>
      <input id="occasion" value="${d(e.occasion)}" placeholder="ראש השנה אצל סבתא" />
      <label style="margin-top:10px">עולם</label>
      <div class="chips" id="world">${q.map(a=>`<button class="chip ${e.world===a.id?"on":""}" data-world="${a.id}">${a.label}</button>`).join("")}</div>
      <label style="margin-top:10px">מי משחק</label>
      <div class="chips" id="crowd">${E.map(a=>`<button class="chip ${e.crowd===a.id?"on":""}" data-crowd="${a.id}">${a.label}</button>`).join("")}</div>
    </div>

    <div class="card">
      <div class="big">2 · DROPBOTS — בדיחות הפנים</div>
      <div class="sub">שורה לכל אחת. הן הופכות לפקדים על דק ה-DJ.</div>
      <textarea id="jokes" rows="6" placeholder="תוריד את הבס של שרון&#10;סבתא על הרמקול&#10;טיפקס">${d(e.jokes.join(`
`))}</textarea>
    </div>

    <div class="card">
      <div class="big">3 · המנעולים — עובדות על המשפחה</div>
      <div class="sub">שורה לכל עובדה: <b>שאלה | תשובה</b>. התשובות מתפזרות בין הטלפונים. לפחות 8, שש מנעולים צריכים 12.</div>
      <textarea id="facts" rows="7" placeholder="איפה סבא וסבתא נפגשו? | בתור לקולנוע&#10;השיר שאמא שרה במקלחת | ימים לבנים">${d(T())}</textarea>
    </div>

    <div class="card">
      <div class="big">4 · הקרב — תכונה לכל אחד</div>
      <div class="sub">במה הוא/היא מפורסם/ת. זה הופך למהלך המיוחד שלהם.</div>
      ${t.length===0?'<div class="sub">קודם תכתבו שמות בסעיף 1.</div>':t.map(a=>`<label style="margin-top:8px">${d(a)}</label>
                <input data-trait="${d(a)}" value="${d(e.traits[a]??"")}" placeholder="תמיד מאחר" />`).join("")}
    </div>

    <div class="card">
      <div class="big">5 · הנבל</div>
      <div class="sub">מי שהחבורה מפילה בסוף הסטורי. בילד פרטי בלבד — לא מוצג בשום מקום.</div>
      <label style="margin-top:8px">שם</label>
      <input id="vname" value="${d(((o=e.villain)==null?void 0:o.name)??"")}" placeholder="שוקי מהוועד" />
      <label style="margin-top:8px">התכונה שלו</label>
      <input id="vtrait" value="${d(((n=e.villain)==null?void 0:n.trait)??"")}" placeholder="תמיד צודק" />
      <label style="margin-top:8px">למה דווקא הוא (שורת הפתיחה של הקרב האחרון)</label>
      <input id="vwhy" value="${d(((i=e.villain)==null?void 0:i.why)??"")}" placeholder="שלוש שנים של דמי ועד" />
      <label style="margin-top:8px">משפטים שהוא אומר (שורה לכל אחד)</label>
      <textarea id="vtaunts" rows="3" placeholder="שילמתם?&#10;אני אבדוק את זה בישיבה">${d((((l=e.villain)==null?void 0:l.taunts)??[]).join(`
`))}</textarea>
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
  `}function u(){const t=i=>{var l;return((l=s.querySelector(i))==null?void 0:l.value)??""},o=i=>t(i).split(`
`).map(l=>l.trim()).filter(l=>l!=="");e.names=t("#names").split(",").map(i=>i.trim()).filter(i=>i!==""),e.occasion=t("#occasion"),e.jokes=o("#jokes"),e.facts=o("#facts").map(i=>{const[l="",a=""]=i.split("|").map(v=>v.trim());return{id:"",prompt:l,answer:a}});for(const i of s.querySelectorAll("[data-trait]"))e.traits[i.dataset.trait]=i.value;const n=t("#vname");e.villain=n.trim()===""&&t("#vtrait").trim()===""&&t("#vwhy").trim()===""?null:{name:n,trait:t("#vtrait"),why:t("#vwhy"),taunts:o("#vtaunts")},k()}function y(){const t=w(e),o=s.querySelector("#readiness");o.innerHTML=`
    <div class="big">מה מוכן</div>
    ${t.readiness.map(n=>`
      <div class="tier">
        <div>${O[n.engine]}${n.missing.length>0?`<div class="what">${n.missing.map(d).join(" · ")}</div>`:""}</div>
        <div class="price" style="color:${n.ready?"var(--ok)":"var(--dim)"}">${n.ready?"✓":"—"}</div>
      </div>`).join("")}`}function f(){var a;const t=document.activeElement,o=t==null?void 0:t.id,n=(a=t==null?void 0:t.dataset)==null?void 0:a.trait,i=(t==null?void 0:t.selectionStart)??null;s.innerHTML=x(),L(),y();const l=o?s.querySelector(`#${o}`):n?s.querySelector(`[data-trait="${CSS.escape(n)}"]`):null;if(l&&(l.focus(),i!==null&&"setSelectionRange"in l))try{l.setSelectionRange(i,i)}catch{}}function L(){var o,n,i,l,a,v,h;(o=s.querySelector("#names"))==null||o.addEventListener("change",()=>{u(),f()});for(const c of["#names","#occasion","#jokes","#facts","#vname","#vtrait","#vwhy","#vtaunts"])(n=s.querySelector(c))==null||n.addEventListener("input",()=>{u(),y()});for(const c of s.querySelectorAll("[data-trait]"))c.addEventListener("input",()=>{u(),y()});const t=(c,r)=>{var p;(p=s.querySelector(c))==null||p.addEventListener("click",b=>{const m=b.target.dataset[r];m&&(r==="players"?e.players=Number(m):r==="world"?e.world=m:e.crowd=m,u(),f())})};t("#players","players"),t("#world","world"),t("#crowd","crowd"),(i=s.querySelector("#gift"))==null||i.addEventListener("click",async()=>{u(),location.href=await g(e,location.href,"../gift/")}),(l=s.querySelector("#link"))==null||l.addEventListener("click",async()=>{var p,b;u();const c=await g(e,location.href,"../gift/"),r=s.querySelector("#linkout");r.innerHTML=`
      <div class="sub" style="margin:12px 0 6px">זה הלינק למתנה. כל טלפון שפותח אותו רואה את כל המשחקים שלכם.</div>
      <input id="linkfield" readonly value="${d(c)}" />
      <button id="copy">העתק</button>`,(p=r.querySelector("#linkfield"))==null||p.select(),(b=r.querySelector("#copy"))==null||b.addEventListener("click",async()=>{try{await navigator.clipboard.writeText(c),r.querySelector("#copy").textContent="הועתק"}catch{r.querySelector("#copy").textContent="סמן והעתק ידנית"}})}),(a=s.querySelector("#cardbtn"))==null||a.addEventListener("click",async()=>{u();const c=window.open("","_blank"),r=await j(w(e).party,location.href,"../card/");c?c.location.href=r:location.href=r}),(v=s.querySelector("#download"))==null||v.addEventListener("click",()=>{u();const c=new Blob([JSON.stringify(e,null,2)],{type:"application/json"}),r=document.createElement("a");r.href=URL.createObjectURL(c),r.download=`order-${e.createdAt.slice(0,10)}.json`,r.click(),URL.revokeObjectURL(r.href)}),(h=s.querySelector("#reset"))==null||h.addEventListener("click",()=>{Object.assign(e,$()),k(),f()})}s.innerHTML=x();L();y();
