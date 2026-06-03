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
  postMessage: (data) => {
      console.log('MSG:', data);
  },
  onmessage: null
};
import('./js/libraw/index.js').then(async (mod) => {
    const LibRaw = mod.default;
    const lr = new LibRaw();
    
    // We need a dummy raw file to test. Is there any raw file?
    console.log("Loaded wrapper");
}).catch(console.error);
