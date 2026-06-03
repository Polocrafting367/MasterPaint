import fs from 'fs';
global.WorkerGlobalScope = true;

const wasmBuf = fs.readFileSync('./js/libraw/libraw.wasm');
global.fetch = async (url) => {
    return {
        ok: true,
        arrayBuffer: async () => wasmBuf.buffer.slice(wasmBuf.byteOffset, wasmBuf.byteOffset + wasmBuf.byteLength)
    };
};
global.WebAssembly.instantiateStreaming = undefined; // Force fallback to arrayBuffer

global.self = {
  name: '',
  location: { href: 'file:///opt/lampp/htdocs/MasterPaint/js/libraw/worker.js' },
  postMessage: (data) => {},
  onmessage: null
};

let workerCode = fs.readFileSync('./js/libraw/worker.js', 'utf8');

const replacement = `
  const mod = await an();
  global.LibRawClass = mod.LibRaw;
`;
if (workerCode.includes('on=(await an()).LibRaw,un=new on')) {
  workerCode = workerCode.replace('on=(await an()).LibRaw,un=new on', replacement);
}
fs.writeFileSync('./scratch_worker_mod3.js', workerCode);

import('./scratch_worker_mod3.js').then(async () => {
    setTimeout(async () => {
        const lr = new global.LibRawClass();
        console.log("open length:", lr.open.length);
        console.log("open argCount:", lr.open.argCount);
        console.log("open overloadTable:", lr.open.overloadTable);
    }, 1000);
}).catch(console.error);
