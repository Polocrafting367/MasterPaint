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
fs.writeFileSync('./scratch_worker_mod2.js', workerCode);

import('./scratch_worker_mod2.js').then(async () => {
    setTimeout(async () => {
        if (!global.LibRawClass) {
            console.log("Failed to load LibRawClass");
            return;
        }
        const lr = new global.LibRawClass();
        
        // Let's create a dummy file. 
        // A minimal valid RAW is hard to fake, but we can see what happens.
        // Wait, does libraw require a valid raw to open? Yes.
        // But maybe we can see the source code of LibRaw bindings!
        // We can't see the C++ code, but we can dump the properties.
        console.log("LibRaw object:", lr);
    }, 1000);
}).catch(console.error);
