const fs=require('fs'),vm=require('vm'),assert=require('assert');
const text=fs.readFileSync(require('path').join(__dirname,'../../web/index.html'),'utf8');
const code=text.slice(text.indexOf('window.mpCompute = {'),text.indexOf('  // couleur d’accent',text.indexOf('window.mpCompute = {'))>0?text.indexOf('  // couleur d’accent',text.indexOf('window.mpCompute = {')):text.indexOf('  // couleur d\'accent',text.indexOf('window.mpCompute = {')));
const ctx={window:{},navigator:{hardwareConcurrency:8,deviceMemory:8},Uint8Array,Set,Map,Promise}; vm.createContext(ctx);vm.runInContext(code,ctx);
const compute=ctx.window.mpCompute;
(async()=>{
 let calls=[];
 compute.dispatch=async(msg,transfer,lane)=>{calls.push({h:msg.h,lane});return msg.data.map(x=>255-x)};
 const w=1024,h=1003,data=Uint8Array.from({length:w*h*4},(_,i)=>i%251);
 const result=await compute.run({type:'effect',name:'invert',data,w,h,lane:1,params:[]},[]);
 assert.equal(calls.length,4); assert.equal(calls.reduce((n,c)=>n+c.h,0),h); assert.deepEqual(result,data.map(x=>255-x));
 calls=[]; const preview=await compute.run({type:'effect',name:'invert',data,w,h,lane:0,params:[]},[]); assert.equal(calls.length,2); assert.deepEqual(preview,result);
 calls=[]; await compute.run({type:'effect',name:'gaussian',data,w,h,lane:1,params:[]},[]); assert.equal(calls.length,1);
 calls=[]; await compute.run({type:'effect',name:'invert',data,w,h,lane:1,params:[],post:[1]},[]); assert.equal(calls.length,1);
 console.log('Worker pool: 4 long-job bands / 2 preview bands, exact reassembly, spatial/post effects preserved');
})().catch(e=>{console.error(e);process.exitCode=1});
