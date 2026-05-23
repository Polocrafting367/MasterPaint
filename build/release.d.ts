/** Exported memory */
export declare const memory: WebAssembly.Memory;
/** assembly/index/ALPHA_ARRAY_ID */
export declare const ALPHA_ARRAY_ID: {
  /** @type `u32` */
  get value(): number
};
/**
 * assembly/index/createBuffer
 * @param size `i32`
 * @returns `~lib/typedarray/Uint8Array`
 */
export declare function createBuffer(size: number): Uint8Array;
/**
 * assembly/camera_raw/applyCameraRaw
 * @param dataPtr `usize`
 * @param width `i32`
 * @param height `i32`
 * @param exposure `f32`
 * @param contrast `f32`
 * @param highlights `f32`
 * @param shadows `f32`
 * @param temperature `f32`
 * @param tint `f32`
 * @param vibrance `f32`
 * @param saturation `f32`
 * @param red `f32`
 * @param redHi `f32`
 * @param redSh `f32`
 * @param green `f32`
 * @param greenHi `f32`
 * @param greenSh `f32`
 * @param blue `f32`
 * @param blueHi `f32`
 * @param blueSh `f32`
 * @param hslPtr `usize`
 * @param lutPtr `usize`
 * @param startY `i32`
 * @param endY `i32`
 */
export declare function applyCameraRaw(dataPtr: number, width: number, height: number, exposure: number, contrast: number, highlights: number, shadows: number, temperature: number, tint: number, vibrance: number, saturation: number, red: number, redHi: number, redSh: number, green: number, greenHi: number, greenSh: number, blue: number, blueHi: number, blueSh: number, hslPtr: number, lutPtr: number, startY: number, endY: number): void;
/**
 * assembly/camera_raw/generateThumbnail
 * @param srcPtr `usize`
 * @param dstPtr `usize`
 * @param srcW `i32`
 * @param srcH `i32`
 * @param dstW `i32`
 * @param dstH `i32`
 */
export declare function generateThumbnail(srcPtr: number, dstPtr: number, srcW: number, srcH: number, dstW: number, dstH: number): void;
/**
 * assembly/filters/chromatic
 * @param srcPtr `usize`
 * @param dstPtr `usize`
 * @param w `i32`
 * @param h `i32`
 * @param shift `i32`
 * @param startY `i32`
 * @param endY `i32`
 */
export declare function chromatic(srcPtr: number, dstPtr: number, w: number, h: number, shift: number, startY: number, endY: number): void;
/**
 * assembly/filters/wave
 * @param srcPtr `usize`
 * @param dstPtr `usize`
 * @param w `i32`
 * @param h `i32`
 * @param amp `f32`
 * @param freq `f32`
 * @param startY `i32`
 * @param endY `i32`
 */
export declare function wave(srcPtr: number, dstPtr: number, w: number, h: number, amp: number, freq: number, startY: number, endY: number): void;
/**
 * assembly/filters/twist
 * @param srcPtr `usize`
 * @param dstPtr `usize`
 * @param w `i32`
 * @param h `i32`
 * @param angle `f32`
 * @param startY `i32`
 * @param endY `i32`
 */
export declare function twist(srcPtr: number, dstPtr: number, w: number, h: number, angle: number, startY: number, endY: number): void;
/**
 * assembly/filters/pinch
 * @param srcPtr `usize`
 * @param dstPtr `usize`
 * @param w `i32`
 * @param h `i32`
 * @param amount `f32`
 * @param startY `i32`
 * @param endY `i32`
 */
export declare function pinch(srcPtr: number, dstPtr: number, w: number, h: number, amount: number, startY: number, endY: number): void;
/**
 * assembly/filters/vignette
 * @param srcPtr `usize`
 * @param w `i32`
 * @param h `i32`
 * @param amount `f32`
 * @param startY `i32`
 * @param endY `i32`
 */
export declare function vignette(srcPtr: number, w: number, h: number, amount: number, startY: number, endY: number): void;
/**
 * assembly/filters/adjustBCS
 * @param srcPtr `usize`
 * @param w `i32`
 * @param h `i32`
 * @param brightness `f32`
 * @param contrast `f32`
 * @param startY `i32`
 * @param endY `i32`
 */
export declare function adjustBCS(srcPtr: number, w: number, h: number, brightness: number, contrast: number, startY: number, endY: number): void;
/**
 * assembly/filters/invert
 * @param srcPtr `usize`
 * @param w `i32`
 * @param h `i32`
 * @param startY `i32`
 * @param endY `i32`
 */
export declare function invert(srcPtr: number, w: number, h: number, startY: number, endY: number): void;
/**
 * assembly/filters/grayscale
 * @param srcPtr `usize`
 * @param w `i32`
 * @param h `i32`
 * @param startY `i32`
 * @param endY `i32`
 */
export declare function grayscale(srcPtr: number, w: number, h: number, startY: number, endY: number): void;
/**
 * assembly/filters/posterize
 * @param srcPtr `usize`
 * @param w `i32`
 * @param h `i32`
 * @param levels `f32`
 * @param startY `i32`
 * @param endY `i32`
 */
export declare function posterize(srcPtr: number, w: number, h: number, levels: number, startY: number, endY: number): void;
/**
 * assembly/filters/boxBlur
 * @param srcPtr `usize`
 * @param dstPtr `usize`
 * @param w `i32`
 * @param h `i32`
 * @param radius `i32`
 * @param startY `i32`
 * @param endY `i32`
 */
export declare function boxBlur(srcPtr: number, dstPtr: number, w: number, h: number, radius: number, startY: number, endY: number): void;
/**
 * assembly/filters/crystallize
 * @param srcPtr `usize`
 * @param dstPtr `usize`
 * @param w `i32`
 * @param h `i32`
 * @param size `f32`
 * @param startY `i32`
 * @param endY `i32`
 */
export declare function crystallize(srcPtr: number, dstPtr: number, w: number, h: number, size: number, startY: number, endY: number): void;
/**
 * assembly/filters/softglow
 * @param srcPtr `usize`
 * @param w `i32`
 * @param h `i32`
 * @param amount `f32`
 * @param startY `i32`
 * @param endY `i32`
 */
export declare function softglow(srcPtr: number, w: number, h: number, amount: number, startY: number, endY: number): void;
/**
 * assembly/filters/resize
 * @param srcPtr `usize`
 * @param dstPtr `usize`
 * @param sw `i32`
 * @param sh `i32`
 * @param dw `i32`
 * @param dh `i32`
 */
export declare function resize(srcPtr: number, dstPtr: number, sw: number, sh: number, dw: number, dh: number): void;
/**
 * assembly/filters/orderedDither
 * @param srcPtr `usize`
 * @param w `i32`
 * @param h `i32`
 * @param size `i32`
 * @param invert `bool`
 * @param startY `i32`
 * @param endY `i32`
 */
export declare function orderedDither(srcPtr: number, w: number, h: number, size: number, invert: boolean, startY: number, endY: number): void;
/**
 * assembly/filters/pixelate
 * @param srcPtr `usize`
 * @param dstPtr `usize`
 * @param w `i32`
 * @param h `i32`
 * @param size `i32`
 * @param startY `i32`
 * @param endY `i32`
 */
export declare function pixelate(srcPtr: number, dstPtr: number, w: number, h: number, size: number, startY: number, endY: number): void;
/**
 * assembly/filters/sepia
 * @param srcPtr `usize`
 * @param w `i32`
 * @param h `i32`
 * @param startY `i32`
 * @param endY `i32`
 */
export declare function sepia(srcPtr: number, w: number, h: number, startY: number, endY: number): void;
/**
 * assembly/filters/exposure
 * @param srcPtr `usize`
 * @param w `i32`
 * @param h `i32`
 * @param exp `f32`
 * @param gamma `f32`
 * @param startY `i32`
 * @param endY `i32`
 */
export declare function exposure(srcPtr: number, w: number, h: number, exp: number, gamma: number, startY: number, endY: number): void;
/**
 * assembly/filters/halftone
 * @param srcPtr `usize`
 * @param w `i32`
 * @param h `i32`
 * @param dotSize `f32`
 * @param startY `i32`
 * @param endY `i32`
 */
export declare function halftone(srcPtr: number, w: number, h: number, dotSize: number, startY: number, endY: number): void;
/**
 * assembly/filters/edgeDetect
 * @param srcPtr `usize`
 * @param dstPtr `usize`
 * @param w `i32`
 * @param h `i32`
 * @param sensitivity `f32`
 * @param startY `i32`
 * @param endY `i32`
 */
export declare function edgeDetect(srcPtr: number, dstPtr: number, w: number, h: number, sensitivity: number, startY: number, endY: number): void;
/**
 * assembly/filters/scanlines
 * @param srcPtr `usize`
 * @param w `i32`
 * @param h `i32`
 * @param density `f32`
 * @param opacity `f32`
 * @param startY `i32`
 * @param endY `i32`
 */
export declare function scanlines(srcPtr: number, w: number, h: number, density: number, opacity: number, startY: number, endY: number): void;
/**
 * assembly/filters/blendMask
 * @param basePtr `usize`
 * @param filteredPtr `usize`
 * @param maskPtr `usize`
 * @param outPtr `usize`
 * @param w `i32`
 * @param h `i32`
 * @param startY `i32`
 * @param endY `i32`
 */
export declare function blendMask(basePtr: number, filteredPtr: number, maskPtr: number, outPtr: number, w: number, h: number, startY: number, endY: number): void;
/**
 * assembly/filters/buildDynamicMask
 * @param layerPtr `usize`
 * @param maskPtr `usize`
 * @param lw `i32`
 * @param lh `i32`
 * @param lx `i32`
 * @param ly `i32`
 * @param dw `i32`
 * @param dh `i32`
 * @param opacity `f32`
 */
export declare function buildDynamicMask(layerPtr: number, maskPtr: number, lw: number, lh: number, lx: number, ly: number, dw: number, dh: number, opacity: number): void;
/**
 * assembly/filters/applyLuminanceMask
 * @param layerPtr `usize`
 * @param maskPtr `usize`
 * @param outPtr `usize`
 * @param lw `i32`
 * @param lh `i32`
 * @param lx `i32`
 * @param ly `i32`
 * @param mw `i32`
 * @param mh `i32`
 * @param dw `i32`
 * @param dh `i32`
 */
export declare function applyLuminanceMask(layerPtr: number, maskPtr: number, outPtr: number, lw: number, lh: number, lx: number, ly: number, mw: number, mh: number, dw: number, dh: number): void;
/**
 * assembly/filters/similarColor
 * @param dataPtr `usize`
 * @param maskPtr `usize`
 * @param w `i32`
 * @param h `i32`
 * @param sr `u8`
 * @param sg `u8`
 * @param sb `u8`
 * @param sa `u8`
 * @param tol `f32`
 */
export declare function similarColor(dataPtr: number, maskPtr: number, w: number, h: number, sr: number, sg: number, sb: number, sa: number, tol: number): void;
/**
 * assembly/filters/colorMatch
 * @param dataPtr `usize`
 * @param maskPtr `usize`
 * @param w `i32`
 * @param h `i32`
 * @param r0 `u8`
 * @param g0 `u8`
 * @param b0 `u8`
 * @param a0 `u8`
 * @param rgbMax `f32`
 * @param alphaMax `f32`
 */
export declare function colorMatch(dataPtr: number, maskPtr: number, w: number, h: number, r0: number, g0: number, b0: number, a0: number, rgbMax: number, alphaMax: number): void;
/**
 * assembly/filters/grayscaleAlpha
 * @param srcPtr `usize`
 * @param dstPtr `usize`
 * @param w `i32`
 * @param h `i32`
 */
export declare function grayscaleAlpha(srcPtr: number, dstPtr: number, w: number, h: number): void;
/**
 * assembly/filters/getMaskOutlineSegments
 * @param maskPtr `usize`
 * @param w `i32`
 * @param h `i32`
 * @param startX `i32`
 * @param startY `i32`
 * @param endX `i32`
 * @param endY `i32`
 * @param stride `i32`
 * @param outPtr `usize`
 * @param maxSegments `i32`
 * @returns `i32`
 */
export declare function getMaskOutlineSegments(maskPtr: number, w: number, h: number, startX: number, startY: number, endX: number, endY: number, stride: number, outPtr: number, maxSegments: number): number;
/**
 * assembly/filters/magicWand
 * @param dataPtr `usize`
 * @param maskPtr `usize`
 * @param w `i32`
 * @param h `i32`
 * @param startX `i32`
 * @param startY `i32`
 * @param sr `u8`
 * @param sg `u8`
 * @param sb `u8`
 * @param sa `u8`
 * @param tol `f32`
 */
export declare function magicWand(dataPtr: number, maskPtr: number, w: number, h: number, startX: number, startY: number, sr: number, sg: number, sb: number, sa: number, tol: number): void;
/**
 * assembly/vector/pointDistance
 * @param x1 `f32`
 * @param y1 `f32`
 * @param x2 `f32`
 * @param y2 `f32`
 * @returns `f32`
 */
export declare function pointDistance(x1: number, y1: number, x2: number, y2: number): number;
/**
 * assembly/vector/perpendicularDistance
 * @param px `f32`
 * @param py `f32`
 * @param x1 `f32`
 * @param y1 `f32`
 * @param x2 `f32`
 * @param y2 `f32`
 * @returns `f32`
 */
export declare function perpendicularDistance(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number;
/**
 * assembly/vector/isPointOnSegment
 * @param px `f32`
 * @param py `f32`
 * @param x1 `f32`
 * @param y1 `f32`
 * @param x2 `f32`
 * @param y2 `f32`
 * @param tol `f32`
 * @returns `bool`
 */
export declare function isPointOnSegment(px: number, py: number, x1: number, y1: number, x2: number, y2: number, tol: number): boolean;
/**
 * assembly/vector/getCubicBezierPoint
 * @param t `f32`
 * @param x1 `f32`
 * @param y1 `f32`
 * @param cp1x `f32`
 * @param cp1y `f32`
 * @param cp2x `f32`
 * @param cp2y `f32`
 * @param x2 `f32`
 * @param y2 `f32`
 * @returns `f32`
 */
export declare function getCubicBezierPoint(t: number, x1: number, y1: number, cp1x: number, cp1y: number, cp2x: number, cp2y: number, x2: number, y2: number): number;
/**
 * assembly/pdn_effects/oilPainting
 * @param srcPtr `usize`
 * @param dstPtr `usize`
 * @param w `i32`
 * @param h `i32`
 * @param brushSize `i32`
 * @param coarseness `i32`
 * @param startY `i32`
 * @param endY `i32`
 */
export declare function oilPainting(srcPtr: number, dstPtr: number, w: number, h: number, brushSize: number, coarseness: number, startY: number, endY: number): void;
/**
 * assembly/pdn_effects/relief
 * @param srcPtr `usize`
 * @param dstPtr `usize`
 * @param w `i32`
 * @param h `i32`
 * @param angle `f32`
 * @param startY `i32`
 * @param endY `i32`
 */
export declare function relief(srcPtr: number, dstPtr: number, w: number, h: number, angle: number, startY: number, endY: number): void;
/**
 * assembly/pdn_effects/frostedGlass
 * @param srcPtr `usize`
 * @param dstPtr `usize`
 * @param w `i32`
 * @param h `i32`
 * @param minRadius `f32`
 * @param maxRadius `f32`
 * @param samples `i32`
 * @param startY `i32`
 * @param endY `i32`
 */
export declare function frostedGlass(srcPtr: number, dstPtr: number, w: number, h: number, minRadius: number, maxRadius: number, samples: number, startY: number, endY: number): void;
/**
 * assembly/pdn_effects/redEyeRemove
 * @param srcPtr `usize`
 * @param dstPtr `usize`
 * @param w `i32`
 * @param h `i32`
 * @param tolerance `i32`
 * @param saturation `f32`
 * @param startY `i32`
 * @param endY `i32`
 */
export declare function redEyeRemove(srcPtr: number, dstPtr: number, w: number, h: number, tolerance: number, saturation: number, startY: number, endY: number): void;
