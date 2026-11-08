# MasterPaint renderer adjustments

Based on `i-slint-renderer-femtovg` 1.18.1; original licenses are in `LICENSES/`.

SVG data decoded by the browser has straight alpha. Its PREMULTIPLIED flag is
removed only on wasm, preserving the existing MasterPaint icon fix.

The experimental floating-title backdrop filter and its reserved brush have been
removed. Ordinary title transparency remains available independently.
