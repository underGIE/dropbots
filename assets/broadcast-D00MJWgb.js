function o(a){const n=new BroadcastChannel(`twodjs:${a}`);let e=null;return n.onmessage=s=>e==null?void 0:e(s.data),{send:s=>n.postMessage(s),onMessage:s=>{e=s},close:()=>n.close()}}export{o as b};
