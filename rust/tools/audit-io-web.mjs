// MasterPaint — © 2026 polocrafting — https://polocrafting.fr. Voir COPYRIGHT.md.
// Mesures des chemins PNG, décodage, Camera Raw linéaire et remplissage de contenu.
import {readFileSync,writeFileSync} from 'node:fs';
import {performance} from 'node:perf_hooks';
import assert from 'node:assert/strict';
const base=new URL('../../',import.meta.url);
const {default:init,mp_worker_png,mp_worker_decode,mp_worker_camraw_lin,mp_worker_fill}=await import('data:text/javascript;base64,'+readFileSync(new URL('rust-app/pkg/masterpaint_ui.js',base)).toString('base64'));
await init({module_or_path:readFileSync(new URL('rust-app/pkg/masterpaint_ui_bg.wasm',base))});
const rows=[];
function timed(kind,w,h,fn){const t=performance.now();const out=fn();const row={kind,w,h,ms:Math.round((performance.now()-t)*10)/10,bytes:out.length,rssMiB:Math.round(process.memoryUsage().rss/1048576)};rows.push(row);console.log(JSON.stringify(row));return out;}
for(const [w,h]of [[800,600],[2400,1800],[4000,4000]]){
 const src=new Uint8Array(w*h*4);let seed=42;
 for(let i=0;i<src.length;i+=4){seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;src[i]=seed&255;src[i+1]=(seed>>>8)&255;src[i+2]=(seed>>>16)&255;src[i+3]=255;}
 const url=timed('PNG encode data URI',w,h,()=>mp_worker_png(src,w,h,false));
 const png=Buffer.from(new TextDecoder().decode(url).split(',')[1],'base64');
 const decoded=timed('PNG decode',w,h,()=>mp_worker_decode(png));
 assert.equal(new DataView(decoded.buffer,decoded.byteOffset).getUint32(0,true),w);assert.equal(decoded.length,src.length+8);assert.deepEqual(decoded.subarray(8),src);
 if(w<4000){const lin=new Float32Array(w*h*3);for(let i=0;i<lin.length;i++)lin[i]=(i%256)/255;const out=timed('Camera Raw linear defaults',w,h,()=>mp_worker_camraw_lin(lin,w,h,new Float32Array()));assert.equal(out.length,src.length);
 const mask=new Uint8Array(w*h);for(let y=h/2-8;y<h/2+8;y++)mask.fill(255,y*w+w/2-8,y*w+w/2+8);
 const filled=timed('Content fill 16x16 mask',w,h,()=>mp_worker_fill(src,mask,w,h,new Float32Array()));assert.equal(filled.length,src.length);}
}
if(process.argv[2])writeFileSync(process.argv[2],JSON.stringify(rows,null,2));
