async function instantiate(module, imports = {}) {
  const adaptedImports = {
    env: Object.setPrototypeOf({
      abort(message, fileName, lineNumber, columnNumber) {
        // ~lib/builtins/abort(~lib/string/String | null?, ~lib/string/String | null?, u32?, u32?) => void
        message = __liftString(message >>> 0);
        fileName = __liftString(fileName >>> 0);
        lineNumber = lineNumber >>> 0;
        columnNumber = columnNumber >>> 0;
        (() => {
          // @external.js
          throw Error(`${message} in ${fileName}:${lineNumber}:${columnNumber}`);
        })();
      },
    }, Object.assign(Object.create(globalThis), imports.env || {})),
  };
  const { exports } = await WebAssembly.instantiate(module, adaptedImports);
  const memory = exports.memory || imports.env.memory;
  const adaptedExports = Object.setPrototypeOf({
    ALPHA_ARRAY_ID: {
      // assembly/index/ALPHA_ARRAY_ID: u32
      valueOf() { return this.value; },
      get value() {
        return exports.ALPHA_ARRAY_ID.value >>> 0;
      }
    },
    createBuffer(size) {
      // assembly/index/createBuffer(i32) => ~lib/typedarray/Uint8Array
      return __liftTypedArray(Uint8Array, exports.createBuffer(size) >>> 0);
    },
    orderedDither(srcPtr, w, h, size, invert, startY, endY) {
      // assembly/filters/orderedDither(usize, i32, i32, i32, bool, i32, i32) => void
      invert = invert ? 1 : 0;
      exports.orderedDither(srcPtr, w, h, size, invert, startY, endY);
    },
    isPointOnSegment(px, py, x1, y1, x2, y2, tol) {
      // assembly/vector/isPointOnSegment(f32, f32, f32, f32, f32, f32, f32) => bool
      return exports.isPointOnSegment(px, py, x1, y1, x2, y2, tol) != 0;
    },
    detectGridCellSize(dataPtr, w, h, outPtr, minAlpha) {
      // assembly/vectorize/detectGridCellSize(usize, i32, i32, usize, i32) => bool
      return exports.detectGridCellSize(dataPtr, w, h, outPtr, minAlpha) != 0;
    },
  }, exports);
  function __liftString(pointer) {
    if (!pointer) return null;
    const
      end = pointer + new Uint32Array(memory.buffer)[pointer - 4 >>> 2] >>> 1,
      memoryU16 = new Uint16Array(memory.buffer);
    let
      start = pointer >>> 1,
      string = "";
    while (end - start > 1024) string += String.fromCharCode(...memoryU16.subarray(start, start += 1024));
    return string + String.fromCharCode(...memoryU16.subarray(start, end));
  }
  function __liftTypedArray(constructor, pointer) {
    if (!pointer) return null;
    return new constructor(
      memory.buffer,
      __getU32(pointer + 4),
      __dataview.getUint32(pointer + 8, true) / constructor.BYTES_PER_ELEMENT
    ).slice();
  }
  let __dataview = new DataView(memory.buffer);
  function __getU32(pointer) {
    try {
      return __dataview.getUint32(pointer, true);
    } catch {
      __dataview = new DataView(memory.buffer);
      return __dataview.getUint32(pointer, true);
    }
  }
  return adaptedExports;
}
export const {
  memory,
  ALPHA_ARRAY_ID,
  createBuffer,
  applyCameraRaw,
  generateThumbnail,
  chromatic,
  wave,
  twist,
  pinch,
  vignette,
  adjustBCS,
  invert,
  grayscale,
  posterize,
  boxBlur,
  crystallize,
  softglow,
  resize,
  orderedDither,
  pixelate,
  sepia,
  exposure,
  halftone,
  edgeDetect,
  scanlines,
  blendMask,
  buildDynamicMask,
  applyLuminanceMask,
  similarColor,
  colorMatch,
  grayscaleAlpha,
  getMaskOutlineSegments,
  magicWand,
  pointDistance,
  perpendicularDistance,
  isPointOnSegment,
  getCubicBezierPoint,
  labelColorRegions,
  detectGridCellSize,
  extractLabelMask,
  computeLabelBounds,
  sampleCellAverageColor,
  oilPainting,
  relief,
  frostedGlass,
  redEyeRemove,
} = await (async url => instantiate(
  await (async () => {
    const isNodeOrBun = typeof process != "undefined" && process.versions != null && (process.versions.node != null || process.versions.bun != null);
    if (isNodeOrBun) { return globalThis.WebAssembly.compile(await (await import("node:fs/promises")).readFile(url)); }
    else { return await globalThis.WebAssembly.compileStreaming(globalThis.fetch(url)); }
  })(), {
  }
))(new URL("debug.wasm", import.meta.url));
