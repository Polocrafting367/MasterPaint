# MasterPaint renderer bridge

Based on `i-slint-renderer-femtovg` 1.18.1; original licenses are in `LICENSES/`.

* FemtoVG 0.28 supplies `Canvas::blur_path`: a GPU filter of the current render target.
* `widgets.slint::BackdropBlur` uses the reserved RGB brush `#4d5042`; its alpha byte encodes sigma (1–24 px).
  Both rectangle drawing paths intercept it before painting and blur the actual
  framebuffer inside the rectangle (including its corner radii), with the requested
  logical sigma. The marker is never painted by this renderer.
* Put this item before the title tint, text and controls, outside cached opacity
  or rounded clipping layers. This is only used by `FloatWindow` title bars.
* SVG data decoded by the browser has straight alpha. Its PREMULTIPLIED flag is
  removed only on wasm, preserving the existing MasterPaint icon fix.

This small bridge avoids upgrading the whole UI to unreleased Slint. Once Slint's
native `backdrop-blur` is available, replace the reserved brush with that property
and remove the renderer override. Software rendering retains ordinary translucency.

Unlike the former simulated effect, this does not sample the document, build a CPU
preview, change the main toolbar, or affect the main toolbar. Independent transparency/blur Yes/No switches live in Appearance settings.
Transparency starts enabled; blur starts disabled.
