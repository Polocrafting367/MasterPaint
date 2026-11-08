// MasterPaint — © 2026 polocrafting — https://polocrafting.fr. Voir COPYRIGHT.md / See COPYRIGHT.md.
package fr.masterpaint.nativeapp;

import android.app.NativeActivity;
import android.os.Bundle;
import android.os.Build;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;
import android.view.WindowInsetsController;
import android.content.*;
import android.net.Uri;
import android.database.Cursor;
import android.provider.OpenableColumns;
import java.io.*;
import java.util.*;
import java.util.concurrent.*;

/** Slint renders Rust directly into the Android surface. Java handles system dialogs and system bar appearance. */
public final class MainActivity extends NativeActivity {
    static { System.loadLibrary("masterpaint_ui"); }
    private int systemColor = 0xff091c39;
    private boolean darkSystemIcons;
    @Override protected void onCreate(Bundle state) {
        super.onCreate(state);
        applySystemTheme();
    }
    @Override public void onWindowFocusChanged(boolean focused) {
        super.onWindowFocusChanged(focused);
        if (focused) applySystemTheme();
    }
    public void setSystemTheme(int color, boolean darkIcons) {
        runOnUiThread(() -> {
            systemColor = color; darkSystemIcons = darkIcons;
            applySystemTheme();
        });
    }
    @SuppressWarnings("deprecation")
    private void applySystemTheme() {
        Window window = getWindow();
        window.clearFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN
            | WindowManager.LayoutParams.FLAG_TRANSLUCENT_STATUS
            | WindowManager.LayoutParams.FLAG_TRANSLUCENT_NAVIGATION);
        window.addFlags(WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS);
        // Slint receives the system/cutout insets; MasterPaint reserves them in its layout.
        if (Build.VERSION.SDK_INT >= 30) window.setDecorFitsSystemWindows(false);
        int flags = View.SYSTEM_UI_FLAG_LAYOUT_STABLE | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
            | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION;
        if (darkSystemIcons) flags |= View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR | View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR;
        window.getDecorView().setSystemUiVisibility(flags);
        window.setStatusBarColor(systemColor);
        window.setNavigationBarColor(systemColor);
        if (Build.VERSION.SDK_INT >= 29) {
            window.setStatusBarContrastEnforced(false);
            window.setNavigationBarContrastEnforced(false);
        }
        if (Build.VERSION.SDK_INT >= 30 && window.getInsetsController() != null) {
            int mask = WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS | WindowInsetsController.APPEARANCE_LIGHT_NAVIGATION_BARS;
            window.getInsetsController().setSystemBarsAppearance(darkSystemIcons ? mask : 0, mask);
        }
    }
    private native void filesReady(long id, String[] names, byte[][] data);
    private native void saveReady(long id, boolean ok);
    private final ExecutorService io = Executors.newSingleThreadExecutor();
    private final ArrayDeque<Runnable> dialogs = new ArrayDeque<>();
    private long pickId, saveId;
    private byte[] saving;
    private boolean dialogActive;
    private void enqueue(Runnable task) { runOnUiThread(() -> { dialogs.add(task); next(); }); }
    private void next() { if (!dialogActive && !dialogs.isEmpty()) { dialogActive = true; dialogs.remove().run(); } }
    private void complete() { runOnUiThread(() -> { dialogActive = false; next(); }); }
    public void pickFiles(long id, boolean multiple) {
        enqueue(() -> {
            pickId = id;
            Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT).setType("*/*").addCategory(Intent.CATEGORY_OPENABLE);
            intent.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, multiple);
            try { startActivityForResult(intent, 41); }
            catch (Exception e) { filesReady(id, new String[0], new byte[0][]); complete(); }
        });
    }
    public void saveFile(long id, String name, String mime, byte[] data) {
        enqueue(() -> {
            saveId = id; saving = data;
            Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT).setType(mime).addCategory(Intent.CATEGORY_OPENABLE);
            intent.putExtra(Intent.EXTRA_TITLE, name);
            try { startActivityForResult(intent, 42); }
            catch (Exception e) { saving = null; saveReady(id, false); complete(); }
        });
    }
    private byte[] read(Uri uri) throws IOException {
        try (InputStream in = getContentResolver().openInputStream(uri); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            if (in == null) throw new IOException("No input stream");
            byte[] buffer = new byte[65536]; int n;
            while ((n = in.read(buffer)) != -1) out.write(buffer, 0, n);
            return out.toByteArray();
        }
    }
    private String name(Uri uri) {
        try (Cursor c = getContentResolver().query(uri, new String[]{OpenableColumns.DISPLAY_NAME}, null, null, null)) {
            if (c != null && c.moveToFirst()) return c.getString(0);
        } catch (Exception ignored) {}
        return "image";
    }
    @Override protected void onActivityResult(int request, int result, Intent intent) {
        super.onActivityResult(request, result, intent);
        if (request == 41) {
            final long id = pickId;
            final ArrayList<Uri> uris = new ArrayList<>();
            if (result == RESULT_OK && intent != null) {
                if (intent.getClipData() != null) for (int i=0; i<intent.getClipData().getItemCount(); i++) uris.add(intent.getClipData().getItemAt(i).getUri());
                else if (intent.getData() != null) uris.add(intent.getData());
            }
            io.execute(() -> {
                ArrayList<String> names = new ArrayList<>(); ArrayList<byte[]> data = new ArrayList<>();
                for (Uri uri : uris) try { byte[] bytes = read(uri); names.add(name(uri)); data.add(bytes); } catch (Exception ignored) {}
                filesReady(id, names.toArray(new String[0]), data.toArray(new byte[0][])); complete();
            });
        } else if (request == 42) {
            final long id = saveId; final byte[] bytes = saving; saving = null;
            final Uri uri = result == RESULT_OK && intent != null ? intent.getData() : null;
            io.execute(() -> {
                boolean ok = false;
                if (uri != null && bytes != null) try (OutputStream out = getContentResolver().openOutputStream(uri)) {
                    if (out != null) { out.write(bytes); out.flush(); ok = true; }
                } catch (Exception ignored) {}
                saveReady(id, ok); complete();
            });
        }
    }
    public byte[] readClipboard() {
        try {
            ClipboardManager clipboard = (ClipboardManager)getSystemService(CLIPBOARD_SERVICE);
            ClipData clip = clipboard.getPrimaryClip();
            if (clip == null || clip.getItemCount() == 0 || clip.getItemAt(0).getUri() == null) return null;
            return read(clip.getItemAt(0).getUri());
        } catch (Exception ignored) { return null; }
    }
    public void writeClipboard(byte[] data) {
        try {
            try (FileOutputStream out = new FileOutputStream(new File(getCacheDir(), "clipboard.png"))) { out.write(data); }
            runOnUiThread(() -> {
                Uri uri = Uri.parse("content://" + getPackageName() + ".clipboard/image.png");
                ((ClipboardManager)getSystemService(CLIPBOARD_SERVICE)).setPrimaryClip(ClipData.newUri(getContentResolver(), "MasterPaint", uri));
            });
        } catch (Exception ignored) {}
    }
}
