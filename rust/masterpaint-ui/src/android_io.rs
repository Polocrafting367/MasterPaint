//! Android's system document chooser and clipboard. No browser or WebView.
use super::*;
use jni::{JNIEnv, objects::{JObject, JObjectArray, JByteArray, JString, JValue}, sys::{jlong, jboolean}};
use std::{collections::HashMap, sync::{OnceLock, atomic::{AtomicU64, Ordering}}, task::{Poll, Waker}};
static APP: OnceLock<slint::android::AndroidApp> = OnceLock::new();
static NEXT: AtomicU64 = AtomicU64::new(1);
#[derive(Clone)]
pub struct FileHandle { name: String, bytes: Vec<u8> }
impl FileHandle {
    pub fn file_name(&self) -> String { self.name.clone() }
    pub async fn read(&self) -> Vec<u8> { self.bytes.clone() }
}
#[derive(Default)]
struct Pick { done: bool, files: Vec<FileHandle>, waker: Option<Waker> }
thread_local! {
    static PICKS: RefCell<HashMap<u64, Rc<RefCell<Pick>>>> = RefCell::new(HashMap::new());
    static SAVES: RefCell<HashMap<u64, Box<dyn FnOnce(bool)>>> = RefCell::new(HashMap::new());
}
pub fn initialize(app: slint::android::AndroidApp) {
    if let Some(path) = app.internal_data_path() {
        std::env::set_var("XDG_CONFIG_HOME", &path);
    }
    let _ = APP.set(app);
}
fn java<R>(f: impl FnOnce(&mut JNIEnv, JObject) -> jni::errors::Result<R>) -> Option<R> {
    let app = APP.get()?;
    let vm = unsafe { jni::JavaVM::from_raw(app.vm_as_ptr().cast()).ok()? };
    let mut env = vm.attach_current_thread().ok()?;
    let activity = unsafe { JObject::from_raw(app.activity_as_ptr().cast()) };
    let result = f(&mut env, activity);
    if result.is_err() { let _ = env.exception_clear(); }
    result.ok()
}
pub fn system_theme(color: Color, dark_icons: bool) {
    let argb=0xff000000u32 | (color.red() as u32)<<16 | (color.green() as u32)<<8 | color.blue() as u32;
    java(|env,activity| env.call_method(activity,"setSystemTheme","(IZ)V",&[JValue::Int(argb as i32),JValue::Bool(dark_icons as u8)]).map(|_| ()));
}
pub struct AsyncFileDialog;
impl AsyncFileDialog {
    pub fn new() -> Self { Self }
    pub fn add_filter(self, _: impl AsRef<str>, _: &[&str]) -> Self { self }
    pub async fn pick_file(self) -> Option<FileHandle> { self.pick(false).await?.into_iter().next() }
    pub async fn pick_files(self) -> Option<Vec<FileHandle>> { self.pick(true).await }
    async fn pick(self, multiple: bool) -> Option<Vec<FileHandle>> {
        let id = NEXT.fetch_add(1, Ordering::Relaxed);
        let state = Rc::new(RefCell::new(Pick::default()));
        PICKS.with(|p| p.borrow_mut().insert(id, state.clone()));
        if java(|env, activity| env.call_method(activity, "pickFiles", "(JZ)V", &[JValue::Long(id as i64), JValue::Bool(multiple as u8)]).map(|_| ())).is_none() {
            PICKS.with(|p| p.borrow_mut().remove(&id)); return None;
        }
        std::future::poll_fn(move |cx| {
            let mut state = state.borrow_mut();
            if state.done { Poll::Ready((!state.files.is_empty()).then(|| std::mem::take(&mut state.files))) }
            else { state.waker = Some(cx.waker().clone()); Poll::Pending }
        }).await
    }
}
pub fn save(name: &str, mime: &str, bytes: Vec<u8>, done: impl FnOnce(bool) + 'static) {
    let id = NEXT.fetch_add(1, Ordering::Relaxed);
    SAVES.with(|s| s.borrow_mut().insert(id, Box::new(done)));
    let result = java(|env, activity| {
        let name = env.new_string(name)?;
        let mime = env.new_string(mime)?;
        let data = env.byte_array_from_slice(&bytes)?;
        env.call_method(activity, "saveFile", "(JLjava/lang/String;Ljava/lang/String;[B)V", &[JValue::Long(id as i64), JValue::Object(name.as_ref()), JValue::Object(mime.as_ref()), JValue::Object(data.as_ref())])?;
        Ok(())
    });
    if result.is_none() { SAVES.with(|s| { if let Some(done) = s.borrow_mut().remove(&id) { done(false); } }); }
}
#[no_mangle]
pub extern "system" fn Java_fr_masterpaint_nativeapp_MainActivity_filesReady(mut env: JNIEnv, _: JObject, id: jlong, names: JObjectArray, data: JObjectArray) {
    let mut files = Vec::new();
    if let Ok(n) = env.get_array_length(&names) {
        for i in 0..n {
            let read = (|| -> jni::errors::Result<FileHandle> {
                let name = JString::from(env.get_object_array_element(&names, i)?);
                let name: String = env.get_string(&name)?.into();
                let bytes = JByteArray::from(env.get_object_array_element(&data, i)?);
                Ok(FileHandle { name, bytes: env.convert_byte_array(bytes)? })
            })();
            if let Ok(file) = read { files.push(file); }
        }
    }
    let _ = slint::invoke_from_event_loop(move || PICKS.with(|p| {
        if let Some(state) = p.borrow_mut().remove(&(id as u64)) {
            let mut state = state.borrow_mut(); state.files = files; state.done = true;
            if let Some(waker) = state.waker.take() { waker.wake(); }
        }
    }));
}
#[no_mangle]
pub extern "system" fn Java_fr_masterpaint_nativeapp_MainActivity_saveReady(_: JNIEnv, _: JObject, id: jlong, ok: jboolean) {
    let _ = slint::invoke_from_event_loop(move || SAVES.with(|s| {
        if let Some(done) = s.borrow_mut().remove(&(id as u64)) { done(ok != 0); }
    }));
}
// Called by the Android input backend immediately before routing each pointer.
#[no_mangle]
pub extern "C" fn masterpaint_pen_sample(pressure: f32, tool: i32) {
    pen::hardware(pressure, tool == 2 || tool == 4, tool == 4);
}
pub mod clipboard {
    use super::*;
    pub struct Clipboard;
    pub struct ImageData<'a> { pub width: usize, pub height: usize, pub bytes: std::borrow::Cow<'a, [u8]> }
    impl Clipboard {
        pub fn new() -> Result<Self, ()> { Ok(Self) }
        pub fn get_image(&mut self) -> Result<ImageData<'static>, ()> {
            let bytes = java(|env, activity| {
                let array = env.call_method(activity, "readClipboard", "()[B", &[])?.l()?;
                if array.is_null() { return Ok(Vec::new()); }
                env.convert_byte_array(JByteArray::from(array))
            }).ok_or(())?;
            let image = image::load_from_memory(&bytes).map_err(|_| ())?.to_rgba8();
            Ok(ImageData { width: image.width() as usize, height: image.height() as usize, bytes: image.into_raw().into() })
        }
        pub fn get_text(&mut self) -> Result<String, ()> { Err(()) }
        pub fn set_image(&mut self, image: ImageData<'_>) -> Result<(), ()> {
            let pixels = image::RgbaImage::from_raw(image.width as u32, image.height as u32, image.bytes.into_owned()).ok_or(())?;
            let mut out = std::io::Cursor::new(Vec::new());
            image::DynamicImage::ImageRgba8(pixels).write_to(&mut out, image::ImageFormat::Png).map_err(|_| ())?;
            java(|env, activity| {
                let data = env.byte_array_from_slice(out.get_ref())?;
                env.call_method(activity, "writeClipboard", "([B)V", &[JValue::Object(data.as_ref())]).map(|_| ())
            }).ok_or(())
        }
    }
}
