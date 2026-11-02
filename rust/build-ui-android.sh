#!/usr/bin/env bash
# APK ARM64: Rust + Slint/GLES, no WebView. Android SDK/NDK and a signing config are required.
set -euo pipefail
cd "$(dirname "$0")"
export PATH="$HOME/.cargo/bin:$PATH"
export JAVA_HOME="${JAVA_HOME:-$HOME/.local/share/android-build/jdk}"
export ANDROID_HOME="${ANDROID_HOME:-$HOME/.local/share/android-build/sdk}"
export ANDROID_NDK_ROOT="${ANDROID_NDK_ROOT:-$ANDROID_HOME/ndk/27.2.12479018}"
ndkbin="$ANDROID_NDK_ROOT/toolchains/llvm/prebuilt/linux-x86_64/bin"
export CARGO_TARGET_AARCH64_LINUX_ANDROID_LINKER="$ndkbin/aarch64-linux-android26-clang"
export CC_aarch64_linux_android="$CARGO_TARGET_AARCH64_LINUX_ANDROID_LINKER"
export AR_aarch64_linux_android="$ndkbin/llvm-ar"
export PATH="$JAVA_HOME/bin:$PATH"
[[ -x $CARGO_TARGET_AARCH64_LINUX_ANDROID_LINKER ]] || { echo 'Android NDK missing'; exit 1; }
target=$(cargo metadata --no-deps --format-version 1 | python3 -c 'import json,sys;print(json.load(sys.stdin)["target_directory"])')
source=$(printf '%s\n' "$HOME"/.cargo/registry/src/*/i-slint-backend-android-activity-1.18.1 | head -1)
backend="$target/slint-android-pressure"
python3 tools/patch-android-input.py "$source" "$backend"
cargo build -p masterpaint-ui --lib --release --target aarch64-linux-android --config "patch.crates-io.i-slint-backend-android-activity.path='$backend'" --config "target.aarch64-linux-android.rustflags=['-C','link-arg=-Wl,-z,max-page-size=16384']"
stage="$target/android-native"
rm -rf "$stage/classes" "$stage/dex" "$stage/package"
rm -f "$stage/icons.zip" "$stage/unsigned.apk" "$stage/aligned.apk"
mkdir -p "$stage/classes" "$stage/dex" "$stage/package/lib/arm64-v8a"
bt="$ANDROID_HOME/build-tools/34.0.0"
jar="$ANDROID_HOME/platforms/android-34/android.jar"
python3 - "$stage/AndroidManifest.xml" <<'PY'
import pathlib,sys,tomllib
v=tomllib.loads(pathlib.Path('masterpaint-ui/Cargo.toml').read_text())['package']['version']
a,b,c=map(int,v.split('.')); text=pathlib.Path('android/AndroidManifest.xml').read_text()
text=text.replace('android:versionCode="30400"',f'android:versionCode="{a*10000+b*100+c}"').replace('android:versionName="3.4.0"',f'android:versionName="{v}"')
pathlib.Path(sys.argv[1]).write_text(text)
PY
"$bt/aapt2" compile --dir desktop/icons/android -o "$stage/icons.zip"
"$bt/aapt2" link -I "$jar" --manifest "$stage/AndroidManifest.xml" -o "$stage/unsigned.apk" "$stage/icons.zip"
javac --release 8 -classpath "$jar" -d "$stage/classes" android/java/fr/masterpaint/nativeapp/*.java
mapfile -t classes < <(find "$stage/classes" -name '*.class')
"$bt/d8" --lib "$jar" --min-api 26 --output "$stage/dex" "${classes[@]}"
cp "$stage/dex/classes.dex" "$stage/package/"
cp "$target/aarch64-linux-android/release/libmasterpaint_ui.so" "$stage/package/lib/arm64-v8a/"
"$ndkbin/llvm-strip" --strip-unneeded "$stage/package/lib/arm64-v8a/libmasterpaint_ui.so"
cp "$ANDROID_NDK_ROOT/toolchains/llvm/prebuilt/linux-x86_64/sysroot/usr/lib/aarch64-linux-android/libc++_shared.so" "$stage/package/lib/arm64-v8a/"
(cd "$stage/package" && zip -q -u "$stage/unsigned.apk" classes.dex lib/arm64-v8a/*.so)
"$bt/zipalign" -f -p 4 "$stage/unsigned.apk" "$stage/aligned.apk"
# Credentials stay out of command lines/logs. Reuse the existing local Android signing identity.
cfg="${MP_ANDROID_SIGNING_CONFIG:-/opt/lampp/htdocs/WebApk/apps/masterpaint/masterpaint.properties}"
python3 - "$cfg" "$bt/apksigner" "$stage/aligned.apk" ../downloads/MasterPaint-android-native.apk <<'PY'
import os,pathlib,subprocess,sys
cfg,tool,source,dest=sys.argv[1:]
p={}
for line in pathlib.Path(cfg).read_text().splitlines():
    if '=' in line and not line.lstrip().startswith('#'):
        k,v=line.split('=',1);p[k.strip()]=v.strip()
key=pathlib.Path(p['keystore.file'])
if not key.is_absolute():key=pathlib.Path(cfg).parent/key
env=os.environ.copy();env['MP_APK_PASSWORD']=p['keystore.password']
subprocess.run([tool,'sign','--ks',str(key),'--ks-key-alias',p.get('keystore.alias','webapk'),'--ks-pass','env:MP_APK_PASSWORD','--out',dest,source],env=env,check=True)
subprocess.run([tool,'verify',dest],check=True)
PY
echo 'APK natif : downloads/MasterPaint-android-native.apk (ARM64, Android 8+)'
