import"./modulepreload-polyfill-B5Qt9EMX.js";/* empty css               */import{o as r,b as l}from"./order-link-B7rwvhPT.js";import"./pack-link-D0o8BCOw.js";const o=document.getElementById("app"),e=s=>s.replace(/[&<>"']/g,a=>`&#${a.charCodeAt(0)};`),h={party:{title:"DROPBOTS",desc:"צועקים הוראות, לוחצים כפתורים, הקהל עולה.",path:"../play/"},locks:{title:"המנעולים",desc:"שורה של מנעולים עליכם — התשובות מפוזרות בין הטלפונים.",path:"../locks/"},fight:{title:"הקרב",desc:"סולם קרבות נגד החברים, עד הנבל שהקבוצה בחרה.",path:"../fight/"},motion:{title:"תנועה",desc:"משחק תנועה לכל החבורה."},shanzia:{title:"שאנזיה",desc:"המשחק של שאנזיה."}},m=["party","locks","fight","motion","shanzia"];function p(s,a){const i=h[s.engine];if(!i.path)return`
      <div class="card game-card off">
        <h2>${e(i.title)}</h2>
        <div class="desc">${e(i.desc)}</div>
        <span class="soon">בקרוב</span>
      </div>`;if(!s.ready)return`
      <div class="card game-card off">
        <h2>${e(i.title)}</h2>
        <div class="desc">${e(i.desc)}</div>
        <ul class="missing">${s.missing.map(n=>`<li>${e(n)}</li>`).join("")}</ul>
      </div>`;const c=new URL(i.path,location.href);return c.searchParams.set("o",a),`
    <div class="card game-card">
      <h2>${e(i.title)}</h2>
      <div class="desc">${e(i.desc)}</div>
      <a class="go" href="${e(c.toString())}">שחקו</a>
    </div>`}function g(s){const a=s.names.map(e).join(" · ");return`
    <div class="gift-head">
      <h1>${e(s.occasion)||"מתנה"}</h1>
      ${a?`<div class="sub">${a}</div>`:""}
    </div>`}async function v(){const s=new URLSearchParams(location.search),a=await r(s);if(!a){o.innerHTML=`
      <div class="card">
        <div class="big">אין כאן מתנה עדיין</div>
        <div class="sub" style="margin-top:8px">ממלאים את ההזמנה בעמוד <a href="../order/">ההזמנה</a> וחוזרים עם הלינק.</div>
      </div>`;return}const i=s.get("o"),c=l(a),n=new Map(c.readiness.map(t=>[t.engine,t]));o.innerHTML=g(a)+m.map(t=>{const d=n.get(t)??{engine:t,ready:!1,missing:[]};return p(d,i)}).join("")}v();
