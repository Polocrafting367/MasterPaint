# MasterPaint icon source

Every SVG used for the classic MasterPaint interface is stored individually under `source/`:

- `masterpaint/`: original MasterPaint toolbar, menu, and quick-action glyphs;
- `sprite/`: MasterPaint sprite symbols;
- `tools/`: the classic tool icons;
- `fontawesome/`: Font Awesome SVG equivalents used by the interface.

The Rust generators compile directly from these paths with `include_str!`; edit an SVG here and rebuild to see the change. Each MasterPaint SVG carries the project credit: © 2026 polocrafting — https://polocrafting.fr.

Reference collections live beside this folder in `icon-packs/paintdotjs/` and `icon-packs/photocraft/`. Those files retain their upstream notices and licenses.
