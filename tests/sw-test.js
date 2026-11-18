// Simula el service worker: comprueba que los archivos versionados salen del caché y que index/sw van primero a la red. Uso: node tests/sw-test.js
const fs=require('fs'),vm=require('vm');
const code=fs.readFileSync(require('path').join(__dirname,'..','sw.js'),'utf8');
const handlers={};
const store={};
const caches={
  match:async(req,o)=>{const k=req.url; return store[k]||(o&&o.ignoreSearch?store[k.split('?')[0]]:undefined);},
  open:async()=>({put:async(r,v)=>{store[r.url]=v;},addAll:async(l)=>{l.forEach(u=>store['https://x.github.io/Gymtrack/'+u.replace('./','')]='pre')}}),
  keys:async()=>[],delete:async()=>{}
};
let fetched=[];
const self={location:{origin:'https://x.github.io'},addEventListener:(t,f)=>{handlers[t]=f},skipWaiting(){},clients:{claim(){}}};
const ctx={self,caches,fetch:async(r)=>{fetched.push(r.url);return {ok:true,clone(){return this}}},URL,console};
vm.createContext(ctx);vm.runInContext(code,ctx);
(async()=>{
 await new Promise(r=>{handlers.install({waitUntil:p=>p.then(r)})});
 const run=async(url)=>{let out;await new Promise(r=>{handlers.fetch({request:{method:'GET',url},respondWith:p=>{out=p;r()}}); setTimeout(r,20)}); return out&&await out;};
 const V=/migymtrack-v(\d+)/.exec(code)[1];
 fetched=[]; let r=await run('https://x.github.io/Gymtrack/js/db.js?v='+V); console.log('versionado precacheado → red:',fetched.length===0?'NO (caché) ✓':'SI ✗', r);
 fetched=[]; r=await run('https://x.github.io/Gymtrack/js/db.js?v=1'); console.log('versión vieja → red:',fetched.length?'SI ✓':'NO ✗');
 fetched=[]; r=await run('https://x.github.io/Gymtrack/index.html'); console.log('index → red primero:',fetched.length?'SI ✓':'NO ✗');
 
})();
