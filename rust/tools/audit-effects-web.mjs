// MasterPaint — © 2026 polocrafting — https://polocrafting.fr. Voir COPYRIGHT.md.
// Audit CPU/WASM de tous les effets enregistrés. Aucun navigateur ni compilation native.
// node rust/tools/audit-effects-web.mjs /tmp/masterpaint-effects.json
// Tailles : SIZES='[[1600,1200]]' ; délai par effet : TMO=60000 (ms).
import {readFileSync, writeFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {performance} from 'node:perf_hooks';
const base=new URL('../../',import.meta.url);
if(process.argv[2]==='--one'){
 const [name,ws,hs]=process.argv.slice(3),w=+ws,h=+hs;
 const js=readFileSync(new URL('rust-app/pkg/masterpaint_ui.js',base));
 const {default:init,mp_worker_effect}=await import('data:text/javascript;base64,'+js.toString('base64'));
 await init({module_or_path:readFileSync(new URL('rust-app/pkg/masterpaint_ui_bg.wasm',base))});
 const src=new Uint8Array(w*h*4); for(let i=0;i<src.length;i+=4){src[i]=(i/4)%251;src[i+1]=Math.floor(i/4/w)%251;src[i+2]=128;src[i+3]=255;}
 mp_worker_effect(name,src.subarray(0,32*32*4),32,32,new Float32Array(),new Float32Array());
 const start=performance.now();const out=mp_worker_effect(name,src,w,h,new Float32Array(),new Float32Array());
 console.log(JSON.stringify({name,w,h,ms:Math.round((performance.now()-start)*10)/10,valid:out.length===src.length,rssMiB:Math.round(process.memoryUsage().rss/1048576)}));
}else{
 const core=readFileSync(new URL('rust/masterpaint-core/src/lib.rs',base),'utf8');
 const names=[...core.split('pub const EFFECTS:')[1].split('];')[0].matchAll(/"([^"]+)"/g)].map(m=>m[1]);
 const rows=[];
 for(const [w,h] of (process.env.SIZES?JSON.parse(process.env.SIZES):[[320,240],[1600,1200]]))for(const name of names){
  const result=spawnSync(process.execPath,[fileURLToPath(import.meta.url),'--one',name,''+w,''+h],{encoding:'utf8',timeout:+(process.env.TMO||15000),maxBuffer:65536});
  let row;try{row=JSON.parse(result.stdout.trim().split('\n').at(-1));}catch{row={name,w,h,status:result.error?.code||'failed',error:(result.stderr||'').slice(-200)};}
  rows.push(row);writeFileSync(process.argv[2]||'/tmp/masterpaint-effects.json',JSON.stringify(rows,null,2));
  console.log(name,w+'x'+h,row.ms??row.status);
 }
}
