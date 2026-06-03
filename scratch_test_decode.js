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
fs.writeFileSync('./scratch_worker_mod5.js', workerCode);

import('./scratch_worker_mod5.js').then(async () => {
    setTimeout(async () => {
        const lr = new global.LibRawClass();
        const rawBuf = fs.readFileSync('sample.dng');
        const u8 = new Uint8Array(rawBuf);
        
        try {
            console.log("Calling open...");
            const res = await lr.open(u8, {
                outputBps: 16,
                useCameraWb: true,
                noAutoBright: true,
                gamma: [1.0, 1.0],
                outputColor: 0
            });
            console.log("Open result:", res);
            
            console.log("Calling imageData...");
            const imgDataRaw = await lr.imageData();
            
            console.log("Width:", imgDataRaw.width);
            console.log("Height:", imgDataRaw.height);
            console.log("Data Constructor:", imgDataRaw.data.constructor.name);
            console.log("Data length:", imgDataRaw.data.length);
            console.log("Expected RGB len (W*H*3):", imgDataRaw.width * imgDataRaw.height * 3);
            console.log("Expected RGBA len (W*H*4):", imgDataRaw.width * imgDataRaw.height * 4);
            console.log("Expected 16-bit RGB len (W*H*6):", imgDataRaw.width * imgDataRaw.height * 6);
            
            // Check first few pixel values
            if (imgDataRaw.data.length > 0) {
                console.log("Sample pixel:", Array.from(imgDataRaw.data.slice(0, 12)));
            }
            
        } catch(e) {
            console.error("Error:", e);
        }
    }, 1000);
}).catch(console.error);
