import fs from 'fs';
global.WorkerGlobalScope = true;

const wasmBuf = fs.readFileSync('./js/libraw/libraw.wasm');
global.fetch = async (url) => {
    return {
        ok: true,
        arrayBuffer: async () => wasmBuf.buffer.slice(wasmBuf.byteOffset, wasmBuf.byteOffset + wasmBuf.byteLength)
    };
};
global.WebAssembly.instantiateStreaming = undefined;

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
fs.writeFileSync('./scratch_worker_mod7.js', workerCode);

import('./scratch_worker_mod7.js').then(async () => {
    setTimeout(async () => {
        const lr = new global.LibRawClass();
        const rawBuf = fs.readFileSync('sample.dng');
        const u8 = new Uint8Array(rawBuf);
        
        try {
            console.log("Calling open with gamm...");
            const res = await lr.open(u8, {
                outputBps: 16,
                useCameraWb: true,
                noAutoBright: true,
                gamm: [1.0, 1.0], // TRYING gamm
                outputColor: 0
            });
            console.log("Open result:", res);
        } catch(e) {
            console.error("Error:", e);
        }
    }, 1000);
}).catch(console.error);
