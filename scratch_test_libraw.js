import fs from 'fs';
const wasmBuffer = fs.readFileSync('/opt/lampp/htdocs/MasterPaint/js/libraw/libraw.wasm');
const source = fs.readFileSync('/opt/lampp/htdocs/MasterPaint/js/libraw/libraw.js', 'utf8');

// Try to find how imageData is defined in libraw.js
const match = source.match(/imageData/g);
console.log("imageData occurrences:", match ? match.length : 0);

const isUint16 = source.match(/Uint16Array/g);
console.log("Uint16Array occurrences:", isUint16 ? isUint16.length : 0);
