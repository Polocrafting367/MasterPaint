import fs from 'fs';
global.WorkerGlobalScope = true;
global.XMLHttpRequest = class {
  open(method, url) { this.url = url; }
  send() {
    try {
      const buf = fs.readFileSync('./js/libraw/libraw.wasm');
      this.status = 200;
      this.response = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
    } catch(e) { this.status = 404; console.error(e); }
  }
};
global.self = {
  name: '',
  location: { href: 'file:///opt/lampp/htdocs/MasterPaint/js/libraw/worker.js' },
  postMessage: (data) => {},
  onmessage: null
};

// We will bypass index.js and load worker.js directly, replacing `postMessage` with our own logger
let workerCode = fs.readFileSync('./js/libraw/worker.js', 'utf8');

// Patch worker.js so it defines the class globally
const target = 'on=(await an()).LibRaw; console.log("LIBRAW KEYS:", Object.getOwnPropertyNames(on.prototype)); un=new on';
const replacement = `
  const mod = await an();
  global.LibRawClass = mod.LibRaw;
`;
if (workerCode.includes('on=(await an()).LibRaw,un=new on')) {
  workerCode = workerCode.replace('on=(await an()).LibRaw,un=new on', replacement);
}
fs.writeFileSync('./scratch_worker_mod.js', workerCode);

import('./scratch_worker_mod.js').then(async () => {
    setTimeout(async () => {
        if (!global.LibRawClass) {
            console.log("Failed to load LibRawClass");
            return;
        }
        console.log("LibRawClass loaded!");
        const lr = new global.LibRawClass();
        console.log("Methods:", Object.getOwnPropertyNames(global.LibRawClass.prototype));
        
        // We need a small raw file or just a dummy byte array. It might fail to open though.
        fs.unlinkSync('./scratch_worker_mod.js');
    }, 1000);
}).catch(console.error);
