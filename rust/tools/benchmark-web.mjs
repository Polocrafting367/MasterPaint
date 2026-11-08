// MasterPaint — © 2026 polocrafting — https://polocrafting.fr. Voir COPYRIGHT.md.
// Usage: node rust/tools/benchmark-web.mjs [output.json]
import {readFileSync,writeFileSync} from 'node:fs';
import {performance} from 'node:perf_hooks';
const moduleUrl = new URL('../../rust-app/pkg/masterpaint_ui.js', import.meta.url);
const {default:init, mp_worker_effect} = await import('data:text/javascript;base64,' + readFileSync(moduleUrl).toString('base64'));
await init({module_or_path:readFileSync(new URL('../../rust-app/pkg/masterpaint_ui_bg.wasm', import.meta.url))});
const results=[];
for(const [w,h] of [[800,600],[2400,1800],[4000,4000]]){
 for(const div of [1,2,...(w*h>=4e6?[4]:[]),...(w*h>=16e6?[8]:[])]){
  const sw=Math.ceil(w/div),sh=Math.ceil(h/div),src=new Uint8Array(sw*sh*4);
  for(let i=0;i<src.length;i+=4){src[i]=(i/4)%251;src[i+1]=(i/4/sw)%251;src[i+2]=128;src[i+3]=255;}
  for(const effect of ['gaussian','brightness']){
   const params=new Float32Array(effect==='gaussian'?[8/div]:[10,15]);
   const ms=[];
   for(let run=0;run<4;run++){
    const start=performance.now();const out=mp_worker_effect(effect,src,sw,sh,params,new Float32Array());const elapsed=performance.now()-start;
    if(out.length!==src.length)throw new Error(effect+': invalid length '+out.length);
    if(run)ms.push(elapsed);
   }
   ms.sort((a,b)=>a-b); const row={w,h,div,effect,medianMs:Math.round(ms[1]*10)/10,bufferMiB:Math.round(src.length/1048576*10)/10};results.push(row);console.log(JSON.stringify(row));
  }
 }
}
if(process.argv[2]) writeFileSync(process.argv[2],JSON.stringify(results,null,2));
