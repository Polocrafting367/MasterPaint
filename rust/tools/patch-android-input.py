# MasterPaint — © 2026 polocrafting — https://polocrafting.fr. Voir COPYRIGHT.md / See COPYRIGHT.md.
"""Patch a build-only Slint copy to retain Android pen pressure before hit testing."""
import pathlib, shutil, sys
source, dest = map(pathlib.Path, sys.argv[1:])
if not (dest / '.masterpaint-pressure-v3').exists():
    shutil.copytree(source, dest, dirs_exist_ok=True)
    path = dest / 'androidwindowadapter.rs'
    text = path.read_text()
    needle = '''                    let touch_pos = |p: &android_activity::input::Pointer<'_>| {'''
    replacement = needle + '''
                        // Preserve pressure at the exact input sample, before Slint's callback.
                        unsafe extern "C" { fn masterpaint_pen_sample(pressure: f32, tool: i32); }
                        let tool = match p.tool_type() {
                            android_activity::input::ToolType::Stylus => 2,
                            android_activity::input::ToolType::Eraser => 4,
                            _ => 0,
                        };
                        unsafe { masterpaint_pen_sample(p.pressure(), tool); }
'''
    assert text.count(needle) == 1, 'Slint Android input changed; review the pressure bridge'
    text = text.replace(needle, replacement, 1)
    start = """                    let offset = self.offset.get();
                    let scale = self.window.scale_factor();
                    let touch_pos"""
    replacement = """                    let offset = self.offset.get();
                    let scale = self.window.scale_factor();
                    let pen_in_event = motion_event.pointers().any(|p| matches!(p.tool_type(), android_activity::input::ToolType::Stylus | android_activity::input::ToolType::Eraser));
                    let allowed = |p: &android_activity::input::Pointer<'_>| {
                        !matches!(p.tool_type(), android_activity::input::ToolType::Palm)
                            && (!pen_in_event || matches!(p.tool_type(), android_activity::input::ToolType::Stylus | android_activity::input::ToolType::Eraser))
                    };
                    let touch_pos"""
    assert start in text
    text = text.replace(start, replacement, 1)
    text = text.replace('for p in motion_event.pointers() {', 'for p in motion_event.pointers().filter(&allowed) {')
    text = text.replace('if let Some(p) = motion_event.pointers().next() {', 'if let Some(p) = motion_event.pointers().next().filter(&allowed) {')
    text = text.replace('if let Some(p) = motion_event.pointers().nth(idx) {', 'if let Some(p) = motion_event.pointers().nth(idx).filter(&allowed) {')
    path.write_text(text)
    (dest / '.masterpaint-pressure-v3').touch()
