const STORAGE_KEY = 'vhs_studio_settings';
let timeOffset = 0; 

// Presets
const defaultParams = {
    enable_effect: true, render_format: 'sd_43', record_raw: false,
    enable_y: true, enable_r: true, enable_g: true, enable_b: true,
    luma_contrast: 1.0, luma_brightness: 0,
    crop_padding: 6, crop_feather: 4, pixel_size: 1, band_patina: 0.9,
    apply_jpeg: false, jpeg_quality: 86,
    chroma_blur: 25, chroma_bleed: 12, chroma_saturation: 2.4, edge_sat: 4.8,
    luma_smear: 0, right_pink: 0, right_pink_width: 0.4, shadow_sat: 0.0, hs_sat: 0.0, chroma_phase: 0,
    shift_y: 0, shift_r: -13, shift_g: 8, shift_b: 6,
    glitch_intensity: 0.0, glitch_jitter: true, glitch_dropouts: true, glitch_tears: true,
    noise_intensity_y: 0, noise_intensity_c: 30,
    jitter_freq: 0.39, jitter_amp: 1.0, dropout_chance: 0.0, dropout_len: 0.2, dropout_thickness: 2,
    head_switch_rows: 95, head_switch_pull: 24, head_switch_freq: 0.52, head_switch_wave: 0.5, head_switch_noise: 0,
    hs_color_tear: 0.0, tear_color: 'cyan', tear_max_height: 20, tear_length: 80, tear_thickness: 2,
    apply_color_cast: true, cast_r: 33, cast_g: -5, cast_b: -10
};

const proParams = {
    ...defaultParams,
    apply_jpeg: false, jpeg_quality: 92, crop_padding: 8, crop_feather: 8,
    chroma_blur: 15, chroma_bleed: 45, chroma_saturation: 1.5, edge_sat: 3.0,
    shift_r: -6, shift_g: 2, shift_b: 4,
    noise_intensity_y: 0, noise_intensity_c: 18,
    jitter_freq: 0.15, jitter_amp: 0.5,
    head_switch_rows: 50, head_switch_pull: 15, head_switch_freq: 0.25, head_switch_noise: 0, hs_color_tear: 0.05,
    apply_color_cast: true, cast_r: 15, cast_g: -2, cast_b: -5
};

const damagedParams = {
    ...defaultParams,
    crop_padding: 8, crop_feather: 2, luma_contrast: 1.3,
    chroma_blur: 35, chroma_bleed: 60, chroma_saturation: 2.8, edge_sat: 6.0, luma_smear: 80, right_pink: 60, right_pink_width: 0.6,
    shift_r: -20, shift_g: 5, shift_b: 15,
    glitch_intensity: 8.5,
    noise_intensity_y: 0, noise_intensity_c: 50,
    jitter_freq: 0.8, jitter_amp: 4.5, dropout_chance: 0.15, dropout_len: 0.6, dropout_thickness: 8,
    head_switch_rows: 150, head_switch_pull: 60, head_switch_wave: 2.0, head_switch_noise: 0,
    hs_color_tear: 0.8, tear_color: 'random', tear_max_height: 100, tear_length: 100, tear_thickness: 15, hs_sat: 2.0,
    apply_color_cast: true, cast_r: 10, cast_g: 15, cast_b: -20
};

const pelliculeParams = {
    ...defaultParams,
    crop_padding: 15, crop_feather: 10, luma_contrast: 1.2, luma_brightness: -10,
    chroma_blur: 5, chroma_bleed: 0, chroma_saturation: 1.2, edge_sat: 1.5, shadow_sat: -1.0,
    shift_r: 2, shift_g: 0, shift_b: -2,
    noise_intensity_y: 0, noise_intensity_c: 5,
    jitter_freq: 0.8, jitter_amp: 2.5, dropout_chance: 0.05, dropout_len: 0.05, dropout_thickness: 4,
    head_switch_rows: 0, head_switch_pull: 0, head_switch_noise: 0,
    apply_color_cast: true, cast_r: 20, cast_g: 10, cast_b: -10
};

const vintageParams = {
    ...defaultParams,
    enable_r: false, enable_g: false, enable_b: false, 
    luma_contrast: 1.4, luma_brightness: 10, crop_padding: 20, crop_feather: 15, edge_sat: 0,
    glitch_intensity: 3.0,
    noise_intensity_y: 0, noise_intensity_c: 0,
    jitter_freq: 0.6, jitter_amp: 1.5, dropout_chance: 0.1, dropout_len: 0.1, dropout_thickness: 3,
    head_switch_rows: 60, head_switch_pull: 8, head_switch_noise: 0, apply_color_cast: false
};

const photoParams = {
    ...defaultParams,
    luma_contrast: 1.5, luma_brightness: -5, crop_padding: 4, crop_feather: 2,
    chroma_blur: 8, chroma_bleed: 0, chroma_saturation: 2.0, edge_sat: 2.0, shadow_sat: -1.0,
    shift_r: 3, shift_g: 0, shift_b: -3,
    noise_intensity_y: 0, noise_intensity_c: 5,
    jitter_amp: 0.0, head_switch_rows: 0, head_switch_pull: 0, head_switch_noise: 0,
    apply_color_cast: true, cast_r: 15, cast_g: 5, cast_b: -5
};

const matrixParams = {
    ...defaultParams,
    apply_color_cast: true, cast_r: -50, cast_g: 40, cast_b: -30,
    luma_contrast: 1.4, luma_brightness: -15, shadow_sat: 2.0,
    shift_r: 0, shift_g: 15, shift_b: -5, chroma_phase: 45,
    chroma_blur: 20, chroma_bleed: 40, chroma_saturation: 3.0, edge_sat: 6.0, luma_smear: 40,
    glitch_intensity: 5.0, tear_color: 'green', hs_color_tear: 0.5,
    noise_intensity_y: 0, noise_intensity_c: 40,
    jitter_freq: 0.2, jitter_amp: 0.5, dropout_chance: 0.02, dropout_len: 0.1, dropout_thickness: 1,
    head_switch_pull: 15, head_switch_rows: 60, head_switch_noise: 0
};

const duneParams = {
    ...defaultParams,
    apply_color_cast: true, cast_r: 45, cast_g: 15, cast_b: -40,
    luma_contrast: 1.1, luma_brightness: 5, right_pink: 15, right_pink_width: 0.3, chroma_phase: -20,
    shift_r: 8, shift_g: 0, shift_b: -8,
    chroma_blur: 15, chroma_bleed: 10, chroma_saturation: 1.5, edge_sat: 2.5,
    noise_intensity_y: 0, noise_intensity_c: 10
};

const cyberpunkParams = {
    ...defaultParams,
    apply_color_cast: true, cast_r: 30, cast_g: -30, cast_b: 40,
    luma_contrast: 1.2, shadow_sat: 2.5, hs_sat: 4.0, right_pink: 40, right_pink_width: 0.8, chroma_phase: 90,
    shift_r: 25, shift_g: -5, shift_b: -20,
    chroma_blur: 40, chroma_bleed: 60, chroma_saturation: 4.5, edge_sat: 8.0, luma_smear: 60,
    glitch_intensity: 6.0, tear_color: 'magenta', hs_color_tear: 0.7, head_switch_noise: 0,
    noise_intensity_y: 0, noise_intensity_c: 60,
    jitter_freq: 1.2, jitter_amp: 2.0,
    head_switch_pull: 40
};

const vhsParams = {
    ...defaultParams,
    band_patina: 0.75,
    apply_jpeg: false, crop_padding: 10, crop_feather: 6,
    chroma_blur: 35, chroma_bleed: 30, chroma_saturation: 2.0, edge_sat: 4.0, luma_smear: 15,
    shift_r: -15, shift_g: 5, shift_b: 10,
    noise_intensity_y: 0, noise_intensity_c: 40,
    jitter_freq: 0.5, jitter_amp: 1.5,
    head_switch_rows: 100, head_switch_pull: 25, head_switch_freq: 0.5, head_switch_noise: 0,
    apply_color_cast: true, cast_r: 25, cast_g: -10, cast_b: -5
};

const minidvParams = {
    ...defaultParams,
    band_patina: 1.0, pixel_size: 1,
    apply_jpeg: false, crop_padding: 2, crop_feather: 1,
    chroma_blur: 5, chroma_bleed: 0, chroma_saturation: 1.1, edge_sat: 1.5,
    shift_r: -2, shift_g: 0, shift_b: 2,
    noise_intensity_y: 0, noise_intensity_c: 10,
    jitter_freq: 0.0, jitter_amp: 0.0,
    head_switch_rows: 0, head_switch_pull: 0, head_switch_noise: 0,
    apply_color_cast: false
};

function saveSettings() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(collectParams()));
}

function loadSettings() {
    let params = { ...defaultParams };
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) { try { params = { ...defaultParams, ...JSON.parse(saved) }; } catch (e) {} }
    applyParamsToUI(params);
}

function applyParamsToUI(params) {
    const setVal = (id, val) => { const el = document.getElementById('p_' + id); if(el) { el.value = val; updateLabelColor(id, val); } };
    const setChk = (id, val) => { const el = document.getElementById('p_' + id); if(el) el.checked = val; };

    const formatEl = document.getElementById('p_render_format'); if (formatEl) formatEl.value = params.render_format || 'sd_43';
    const tearColorEl = document.getElementById('p_tear_color'); if (tearColorEl) tearColorEl.value = params.tear_color || 'cyan';

    setChk('enable_effect', params.enable_effect !== false); setChk('record_raw', params.record_raw);
    setChk('enable_y', params.enable_y); setChk('enable_r', params.enable_r); setChk('enable_g', params.enable_g); setChk('enable_b', params.enable_b);
    
    setVal('luma_contrast', params.luma_contrast); setVal('luma_brightness', params.luma_brightness);
    setVal('crop_padding', params.crop_padding); setVal('crop_feather', params.crop_feather); setVal('pixel_size', params.pixel_size || 1); setVal('band_patina', params.band_patina || 1.0);
    setChk('apply_jpeg', params.apply_jpeg); setVal('jpeg_quality', params.jpeg_quality);
    
    setVal('chroma_blur', params.chroma_blur); setVal('chroma_bleed', params.chroma_bleed); setVal('chroma_saturation', params.chroma_saturation); 
    setVal('edge_sat', params.edge_sat !== undefined ? params.edge_sat : 4.8);
    setVal('luma_smear', params.luma_smear || 0); setVal('right_pink', params.right_pink || 0); setVal('right_pink_width', params.right_pink_width || 0.4);
    setVal('shadow_sat', params.shadow_sat || 0); setVal('hs_sat', params.hs_sat || 0); setVal('chroma_phase', params.chroma_phase || 0);
    
    setVal('shift_y', params.shift_y); setVal('shift_r', params.shift_r); setVal('shift_g', params.shift_g); setVal('shift_b', params.shift_b);
    setVal('noise_intensity_y', params.noise_intensity_y); setVal('noise_intensity_c', params.noise_intensity_c);
    
    setVal('glitch_intensity', params.glitch_intensity || 0);
    setChk('glitch_jitter', params.glitch_jitter !== false); setChk('glitch_dropouts', params.glitch_dropouts !== false); setChk('glitch_tears', params.glitch_tears !== false);
    
    setVal('jitter_freq', params.jitter_freq); setVal('jitter_amp', params.jitter_amp);
    setVal('dropout_chance', params.dropout_chance || 0); setVal('dropout_len', params.dropout_len || 0.2); setVal('dropout_thickness', params.dropout_thickness || 2);
    
    setVal('head_switch_rows', params.head_switch_rows); setVal('head_switch_pull', params.head_switch_pull); setVal('head_switch_noise', params.head_switch_noise || 0);
    setVal('head_switch_freq', params.head_switch_freq); setVal('head_switch_wave', params.head_switch_wave || 0.5); setVal('hs_color_tear', params.hs_color_tear || 0);
    setVal('tear_max_height', params.tear_max_height || 20); setVal('tear_length', params.tear_length || 80); setVal('tear_thickness', params.tear_thickness || 2);
    
    setChk('apply_color_cast', params.apply_color_cast);
    setVal('cast_r', params.cast_r); setVal('cast_g', params.cast_g); setVal('cast_b', params.cast_b);
}

function applyPreset(preset) { applyParamsToUI(preset); saveSettings(); updateCanvasSize(); renderCurrentFrame(); }

function collectParams() {
    const getVal = id => { const el = document.getElementById('p_' + id); return el ? parseFloat(el.value) : 0; };
    const getChk = id => { const el = document.getElementById('p_' + id); return el ? el.checked : false; };
    const formatEl = document.getElementById('p_render_format');
    const tearColorEl = document.getElementById('p_tear_color');
    return {
        enable_effect: getChk('enable_effect'), record_raw: getChk('record_raw'), render_format: formatEl ? formatEl.value : 'sd_43', tear_color: tearColorEl ? tearColorEl.value : 'cyan',
        enable_y: getChk('enable_y'), enable_r: getChk('enable_r'), enable_g: getChk('enable_g'), enable_b: getChk('enable_b'), 
        luma_contrast: parseFloat(getVal('luma_contrast')), luma_brightness: parseInt(getVal('luma_brightness')),
        crop_padding: parseInt(getVal('crop_padding')), crop_feather: parseInt(getVal('crop_feather')), pixel_size: parseInt(getVal('pixel_size')), band_patina: parseFloat(getVal('band_patina') || 1.0),
        apply_jpeg: getChk('apply_jpeg'), jpeg_quality: parseInt(getVal('jpeg_quality')),
        chroma_blur: parseInt(getVal('chroma_blur')), chroma_bleed: parseFloat(getVal('chroma_bleed')), chroma_saturation: parseFloat(getVal('chroma_saturation')),
        edge_sat: parseFloat(getVal('edge_sat')), luma_smear: parseInt(getVal('luma_smear')), right_pink: parseInt(getVal('right_pink')), right_pink_width: parseFloat(getVal('right_pink_width')),
        shadow_sat: parseFloat(getVal('shadow_sat')), hs_sat: parseFloat(getVal('hs_sat')), chroma_phase: parseInt(getVal('chroma_phase')),
        shift_y: parseInt(getVal('shift_y')), shift_r: parseInt(getVal('shift_r')), shift_g: parseInt(getVal('shift_g')), shift_b: parseInt(getVal('shift_b')),
        noise_intensity_y: getVal('noise_intensity_y'), noise_intensity_c: getVal('noise_intensity_c'),
        glitch_intensity: parseFloat(getVal('glitch_intensity')), glitch_jitter: getChk('glitch_jitter'), glitch_dropouts: getChk('glitch_dropouts'), glitch_tears: getChk('glitch_tears'),
        jitter_freq: parseFloat(getVal('jitter_freq')), jitter_amp: parseFloat(getVal('jitter_amp')), 
        dropout_chance: parseFloat(getVal('dropout_chance')), dropout_len: parseFloat(getVal('dropout_len')), dropout_thickness: parseInt(getVal('dropout_thickness')),
        head_switch_rows: parseInt(getVal('head_switch_rows')), head_switch_pull: parseFloat(getVal('head_switch_pull')), head_switch_noise: parseInt(getVal('head_switch_noise')),
        head_switch_freq: parseFloat(getVal('head_switch_freq')), head_switch_wave: parseFloat(getVal('head_switch_wave')), hs_color_tear: parseFloat(getVal('hs_color_tear')),
        tear_max_height: parseInt(getVal('tear_max_height')), tear_length: parseInt(getVal('tear_length')), tear_thickness: parseInt(getVal('tear_thickness')),
        apply_color_cast: getChk('apply_color_cast'), cast_r: getVal('cast_r'), cast_g: getVal('cast_g'), cast_b: getVal('cast_b')
    };
}

function updateLabelColor(id, val) {
    const label = document.getElementById(`val_${id}`);
    if(!label) return;
    label.textContent = val;
    let isRedZone = false;
    if (id === 'chroma_blur' && val > 40) isRedZone = true;
    if (id === 'chroma_bleed' && val > 70) isRedZone = true;
    if (id === 'chroma_saturation' && val > 5) isRedZone = true;
    if (id === 'edge_sat' && val > 6) isRedZone = true;
    if (id === 'shadow_sat' && Math.abs(val) > 3) isRedZone = true;
    if (id === 'hs_sat' && Math.abs(val) > 3) isRedZone = true;
    if (id === 'head_switch_pull' && val > 40) isRedZone = true;
    if (id === 'head_switch_rows' && val > 120) isRedZone = true;
    if (id === 'head_switch_wave' && val > 2.0) isRedZone = true;
    if (id === 'head_switch_noise' && val > 40) isRedZone = true;
    if (id === 'hs_color_tear' && val > 0.5) isRedZone = true;
    if (id === 'jitter_amp' && val > 5) isRedZone = true;
    if (id === 'dropout_chance' && val > 0.2) isRedZone = true;
    if (id === 'dropout_thickness' && val > 10) isRedZone = true;
    if (id === 'noise_intensity_y' && val > 40) isRedZone = true;
    if (id === 'noise_intensity_c' && val > 60) isRedZone = true;
    if (id === 'pixel_size' && val > 5) isRedZone = true;
    if (id === 'chroma_phase' && Math.abs(val) > 90) isRedZone = true;
    if (id === 'right_pink_width' && val > 0.8) isRedZone = true;
    if (id === 'tear_max_height' && val > 80) isRedZone = true;
    if (id === 'tear_thickness' && val > 15) isRedZone = true;

    if (isRedZone) label.classList.add('red-zone'); else label.classList.remove('red-zone');
}

/** Phases export MP4 : garder le bouton « Annuler le rendu » visible. */
const MP4_EXPORT_PHASES = new Set(['PRÉPARATION', 'RENDU AUDIO', 'RENDU VIDÉO MP4', 'FINALISATION']);

function showLoading(title, text = "") {
    const overlay = document.getElementById('processing-overlay');
    document.getElementById('overlay-title').innerText = title;
    const sub = document.getElementById('overlay-text');
    const btnCancel = document.getElementById('btn-cancel-render');
    const preview = document.getElementById('overlay-preview');
    const vidResult = document.getElementById('overlay-video-result');
    const actionGroup = document.getElementById('overlay-actions');
    
    vidResult.classList.add('hidden'); actionGroup.classList.add('hidden');
    if (text) { sub.innerText = text; sub.classList.remove('hidden'); } else { sub.classList.add('hidden'); }
    
    if (MP4_EXPORT_PHASES.has(title)) {
        btnCancel.classList.remove('hidden');
    } else {
        btnCancel.classList.add('hidden');
        preview.style.display = 'none';
    }
    if (MP4_EXPORT_PHASES.has(title) && title !== 'RENDU VIDÉO MP4') {
        preview.style.display = 'none';
    }
    
    overlay.classList.remove('hidden');
}

function hideLoading() {
    document.getElementById('processing-overlay').classList.add('hidden');
    document.getElementById('overlay-preview').style.display = 'none';
    document.getElementById('overlay-video-result').classList.add('hidden');
    document.getElementById('overlay-actions').classList.add('hidden');
    document.getElementById('btn-cancel-render').classList.add('hidden');
}

// --- 3. GESTION DE L'APP ---
let currentFileMode = null; 
let currentOriginalImage = null; 
const sourceVideo = document.getElementById('source-video');
let webcamStream = null;
let currentFacingMode = "user"; 

const canvas = document.getElementById('main-canvas');
const ctx = canvas.getContext('2d');
let effectScratchCanvas = null;
let effectScratchCtx = null;
const canvasContainer = document.getElementById('canvas-container');
const viewport = document.getElementById('preview-viewport');
const dropZone = document.getElementById('drop-zone');

let scale = 1.0;
let panX = 0; let panY = 0;
let isDragging = false;
let startDragX = 0; let startDragY = 0;

let isRecording = false;
let mediaRecorder = null;
let recordedChunks = [];
let videoLoopId = null;
let isRenderCancelled = false; 

function bootstrap() {
    loadSettings(); 
    setupEventListeners();
    setupCanvasInteractions();
    setupVideoControls();
    
    if (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)) {
        document.getElementById('btn-switch-cam').classList.remove('hidden');
    }

    const inputs = document.querySelectorAll('.param-input');
    inputs.forEach(input => {
        if (input.type === 'range') {
            const baseId = input.id.replace('p_', '');
            updateLabelColor(baseId, input.value);
        }
    });
}

function setupEventListeners() {
    document.getElementById('btn-menu-mobile').addEventListener('click', toggleControlPanel);
    document.getElementById('btn-close-panel').addEventListener('click', closeControlPanel);
    
    const fileInput = document.getElementById('file-upload');
    document.getElementById('btn-upload-trigger').addEventListener('click', () => fileInput.click());
    document.getElementById('btn-drop-upload').addEventListener('click', (e) => { e.stopPropagation(); fileInput.click(); });
    fileInput.addEventListener('change', handleFileUpload);

    document.getElementById('btn-webcam').addEventListener('click', startWebcam);
    document.getElementById('btn-switch-cam').addEventListener('click', () => {
        currentFacingMode = currentFacingMode === "user" ? "environment" : "user";
        if(currentFileMode === 'webcam') startWebcam();
    });

    dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('drag-over'); });
    dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
    dropZone.addEventListener('drop', e => {
        e.preventDefault(); dropZone.classList.remove('drag-over');
        if (e.dataTransfer.files.length) { fileInput.files = e.dataTransfer.files; handleFileUpload({ target: fileInput }); }
    });

    document.getElementById('btn-export').addEventListener('click', () => {
        if (!currentFileMode || isRecording) return;
        canvas.toBlob((blob) => {
            if(!blob) { alert("Erreur création image"); return; }
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a'); a.style.display = 'none'; a.href = url; a.download = 'vhs_capture.png';
            document.body.appendChild(a); a.click();
            setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 150);
        }, 'image/png');
    });

    document.getElementById('btn-record').addEventListener('click', () => toggleVideoRecording());
    document.getElementById('btn-export-full-video').addEventListener('click', renderOfflineVideo);
    document.getElementById('btn-cancel-render').addEventListener('click', () => { isRenderCancelled = true; });
    
    document.getElementById('btn-center-view').addEventListener('click', () => { resetViewport(); renderCurrentFrame(); });

    document.getElementById('p_render_format').addEventListener('change', () => { saveSettings(); updateCanvasSize(); });

    document.getElementById('p_preset_selector').addEventListener('change', (e) => {
        const val = e.target.value;
        if(val === 'default') applyPreset(defaultParams);
        else if(val === 'pro') applyPreset(proParams);
        else if(val === 'vhs') applyPreset(vhsParams);
        else if(val === 'minidv') applyPreset(minidvParams);
        else if(val === 'damaged') applyPreset(damagedParams);
        else if(val === 'pellicule') applyPreset(pelliculeParams);
        else if(val === 'vintage') applyPreset(vintageParams);
        else if(val === 'photo') applyPreset(photoParams);
        else if(val === 'matrix') applyPreset(matrixParams);
        else if(val === 'dune') applyPreset(duneParams);
        else if(val === 'cyberpunk') applyPreset(cyberpunkParams);
    });

    document.getElementById('btn-reset-shift').addEventListener('click', () => {
        ['shift_y', 'shift_r', 'shift_g', 'shift_b'].forEach(id => {
            const el = document.getElementById('p_' + id);
            if(el) { el.value = 0; updateLabelColor(id, 0); }
        });
        saveSettings(); renderCurrentFrame();
    });

    document.getElementById('btn-reset-cast').addEventListener('click', () => {
        ['cast_r', 'cast_g', 'cast_b'].forEach(id => {
            const el = document.getElementById('p_' + id);
            if(el) { el.value = 0; updateLabelColor(id, 0); }
        });
        saveSettings(); renderCurrentFrame();
    });

    const inputs = document.querySelectorAll('.param-input, select.param-input');
    inputs.forEach(input => {
        if (input.type === 'range') {
            input.addEventListener('input', (e) => {
                updateLabelColor(e.target.id.replace('p_', ''), e.target.value);
            });
            input.addEventListener('input', () => { 
                if (currentFileMode === 'image' || (currentFileMode === 'video' && sourceVideo.paused)) renderCurrentFrame();
            });
            input.addEventListener('change', () => saveSettings());
        } else {
            input.addEventListener('change', () => { saveSettings(); renderCurrentFrame(); });
        }
    });
}

async function resampleAudioToStandardRate(audioBuffer) {
    const standardRates = [8000, 11025, 12000, 16000, 22050, 24000, 32000, 44100, 48000];
    if (standardRates.includes(audioBuffer.sampleRate)) return audioBuffer;
    if (typeof OfflineAudioContext === 'undefined') return audioBuffer;
    const targetRate = 48000;
    const offline = new OfflineAudioContext(
        audioBuffer.numberOfChannels,
        Math.ceil(audioBuffer.duration * targetRate),
        targetRate
    );
    const tmpBuf = offline.createBuffer(
        audioBuffer.numberOfChannels,
        audioBuffer.length,
        audioBuffer.sampleRate
    );
    for (let c = 0; c < audioBuffer.numberOfChannels; c++) {
        tmpBuf.copyToChannel(audioBuffer.getChannelData(c), c);
    }
    const srcNode = offline.createBufferSource();
    srcNode.buffer = tmpBuf;
    srcNode.connect(offline.destination);
    srcNode.start(0);
    return await offline.startRendering();
}

/** AAC (mp4a.40.2) via WebCodecs accepte surtout la stéréo ; mono / 5.1 provoquent souvent NotSupportedError. */
function normalizeAudioBufferForAac(audioBuffer) {
    const ch = audioBuffer.numberOfChannels;
    const len = audioBuffer.length;
    const sr = audioBuffer.sampleRate;
    if (ch === 2) return audioBuffer;

    const offline = new OfflineAudioContext(2, len, sr);
    const b = offline.createBuffer(2, len, sr);
    if (ch === 1) {
        const m = audioBuffer.getChannelData(0);
        b.copyToChannel(m, 0);
        b.copyToChannel(m, 1);
        return b;
    }
    const mix = new Float32Array(len);
    for (let i = 0; i < len; i++) {
        let sum = 0;
        for (let c = 0; c < ch; c++) sum += audioBuffer.getChannelData(c)[i];
        mix[i] = sum / ch;
    }
    b.copyToChannel(mix, 0);
    b.copyToChannel(mix, 1);
    return b;
}

async function resampleAudioBufferToRate(audioBuffer, targetRate) {
    if (audioBuffer.sampleRate === targetRate) return audioBuffer;
    if (typeof OfflineAudioContext === 'undefined') return audioBuffer;
    const nCh = audioBuffer.numberOfChannels;
    const offline = new OfflineAudioContext(
        nCh,
        Math.ceil(audioBuffer.duration * targetRate),
        targetRate
    );
    const tmpBuf = offline.createBuffer(nCh, audioBuffer.length, audioBuffer.sampleRate);
    for (let c = 0; c < nCh; c++) {
        tmpBuf.copyToChannel(audioBuffer.getChannelData(c), c);
    }
    const srcNode = offline.createBufferSource();
    srcNode.buffer = tmpBuf;
    srcNode.connect(offline.destination);
    srcNode.start(0);
    return await offline.startRendering();
}

async function audioExportConfigSupported(config) {
    if (typeof AudioEncoder === 'undefined' || typeof AudioEncoder.isConfigSupported !== 'function') return false;
    try {
        const r = await AudioEncoder.isConfigSupported(config);
        return !!(r && r.supported);
    } catch (e) {
        return false;
    }
}

/**
 * Son seulement si isConfigSupported confirme AAC ou Opus (pas de dry-run : évite NotSupportedError + états bizarres WebCodecs).
 */
async function buildWebCodecsAudioPlan(audioBuffer) {
    if (typeof AudioEncoder === 'undefined') return null;
    const stereo = normalizeAudioBufferForAac(audioBuffer);
    const sr = stereo.sampleRate;
    const aacConfig = { codec: 'mp4a.40.2', sampleRate: sr, numberOfChannels: 2, bitrate: 128000 };
    const aacPlan = { muxerCodec: 'aac', encoderConfig: aacConfig, frameSamples: 1024, buffer: stereo };
    if (await audioExportConfigSupported(aacConfig)) return aacPlan;

    let opusBuf = stereo;
    if (sr !== 48000) {
        opusBuf = await resampleAudioBufferToRate(stereo, 48000);
        opusBuf = normalizeAudioBufferForAac(opusBuf);
    }
    const opusConfig = { codec: 'opus', sampleRate: 48000, numberOfChannels: 2, bitrate: 128000 };
    const opusPlan = { muxerCodec: 'opus', encoderConfig: opusConfig, frameSamples: 960, buffer: opusBuf };
    if (await audioExportConfigSupported(opusConfig)) return opusPlan;

    return null;
}

/** Chaîne de profils H.264 (du plus exigeant au plus compatible). */
const H264_CODEC_CANDIDATES = ['avc1.4d002a', 'avc1.42E01E', 'avc1.42001E'];

async function configureVideoEncoderForCanvas(videoEncoder, width, height, bitrate, framerate) {
    const base = { width, height, bitrate, framerate };
    let lastErr = null;

    const tryCodec = async (codec, useSupportCheck) => {
        const cfg = { ...base, codec };
        try {
            if (useSupportCheck && typeof VideoEncoder.isConfigSupported === 'function') {
                const r = await VideoEncoder.isConfigSupported(cfg);
                if (!r || !r.supported) return false;
            }
            videoEncoder.configure(cfg);
            return true;
        } catch (e) {
            lastErr = e;
            return false;
        }
    };

    for (const codec of H264_CODEC_CANDIDATES) {
        if (await tryCodec(codec, true)) return;
    }
    for (const codec of H264_CODEC_CANDIDATES) {
        if (await tryCodec(codec, false)) return;
    }
    throw lastErr || new Error('Aucun codec H.264 utilisable pour cet appareil.');
}

async function renderOfflineVideo() {
    if (typeof Mp4Muxer === 'undefined') { alert("Encodeur MP4 non chargé."); return; }
    if (typeof VideoEncoder === 'undefined') { alert("Navigateur non compatible pour encodage MP4 direct."); return; }
    if (currentFileMode !== 'video') return;

    isRecording = true; isRenderCancelled = false;
    cancelAnimationFrame(videoLoopId); sourceVideo.pause();

    showLoading("PRÉPARATION", "Analyse de la piste audio…");
    
    const previewImg = document.getElementById('overlay-preview');
    previewImg.style.display = 'none';

    let audioPlan = null;
    let decodedAudio = null;

    try {
        if (typeof window.AudioContext !== 'undefined' || typeof window.webkitAudioContext !== 'undefined') {
            const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            const response = await fetch(sourceVideo.src);
            const arrayBuffer = await response.arrayBuffer();
            decodedAudio = await audioCtx.decodeAudioData(arrayBuffer.slice(0));
            try { audioCtx.close(); } catch (e) { /* ignore */ }
            decodedAudio = await resampleAudioToStandardRate(decodedAudio);
            if (decodedAudio.length > 0) {
                audioPlan = await buildWebCodecsAudioPlan(decodedAudio);
                if (!audioPlan) {
                    console.warn("Export sans son : aucun encodeur audio WebCodecs utilisable (AAC / Opus).");
                }
            }
        }
    } catch (e) {
        console.warn("Pas d'audio détecté ou échec d'extraction.", e);
    }

    if (!audioPlan) {
        showLoading("PRÉPARATION", "Rendu vidéo seul (pas de son ou encodeur non disponible).");
    }

    try {
        const fps = 30;
        let baseDuration = sourceVideo.duration;
        const trimStartStr = document.getElementById('trim-start').value;
        const trimEndStr = document.getElementById('trim-end').value;
        const trimStart = parseFloat(trimStartStr) || 0;
        let trimEnd = parseFloat(trimEndStr) || 0;
        if (trimEnd <= 0) trimEnd = baseDuration;
        
        let duration = trimEnd - trimStart;

        if (!Number.isFinite(duration) || duration <= 0) {
            alert('Durée vidéo invalide ou extrait trop court.');
            hideLoading();
            sourceVideo.currentTime = trimStart;
            startVideoLoop();
            return;
        }
        const totalFrames = Math.max(1, Math.floor(duration * fps));

        let muxerConfig = {
            target: new Mp4Muxer.ArrayBufferTarget(),
            video: { codec: 'avc', width: canvas.width, height: canvas.height },
            fastStart: 'in-memory'
        };

        if (audioPlan) {
            muxerConfig.audio = {
                codec: audioPlan.muxerCodec,
                sampleRate: audioPlan.buffer.sampleRate,
                numberOfChannels: audioPlan.buffer.numberOfChannels
            };
        }

        let muxer = new Mp4Muxer.Muxer(muxerConfig);

        if (audioPlan) {
            showLoading("RENDU AUDIO", "Encodage de la piste son…");
            const frameStep = audioPlan.frameSamples;
            let audioEncError = null;
            let audioEncoder = new AudioEncoder({
                output: (chunk, meta) => muxer.addAudioChunk(chunk, meta),
                error: e => {
                    console.error("Erreur audio", e);
                    audioEncError = e;
                }
            });
            audioEncoder.configure(audioPlan.encoderConfig);

            const abuf = audioPlan.buffer;
            const sr = abuf.sampleRate;
            const channels = abuf.numberOfChannels;
            const length = abuf.length;

            for (let offset = 0; offset < length; offset += frameStep) {
                if (isRenderCancelled) break;
                if (audioEncError) throw audioEncError;
                while (audioEncoder.encodeQueueSize > 8) {
                    await new Promise(r => setTimeout(r, 10));
                    if (audioEncError) throw audioEncError;
                }
                if (audioEncoder.state !== 'configured') {
                    throw new Error("Encodeur audio fermé de façon inattendue.");
                }

                const nSrc = Math.min(frameStep, length - offset);
                const planarData = new Float32Array(channels * frameStep);
                for (let c = 0; c < channels; c++) {
                    planarData.set(abuf.getChannelData(c).subarray(offset, offset + nSrc), c * frameStep);
                }
                const audioData = new AudioData({
                    format: 'f32-planar',
                    sampleRate: sr,
                    numberOfFrames: frameStep,
                    numberOfChannels: channels,
                    timestamp: Math.round((offset / sr) * 1000000),
                    data: planarData
                });
                audioEncoder.encode(audioData);
                audioData.close();

                const audioPct = Math.min(100, Math.round((100 * offset) / length));
                if (offset === 0 || offset % (sr * 1) === 0 || offset + frameStep >= length) {
                    showLoading("RENDU AUDIO", `Progression : ${audioPct} %`);
                    await new Promise(r => requestAnimationFrame(r));
                }
            }
            await audioEncoder.flush();
            audioEncoder.close();
        }

        showLoading("RENDU VIDÉO MP4", "Progression : 0 %");
        previewImg.style.display = 'none';
        const overlayProgress = document.getElementById('overlay-text');
        overlayProgress.classList.remove('hidden');

        let videoEncError = null;
        let videoEncoder = new VideoEncoder({
            output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
            error: e => {
                console.error("Erreur vidéo", e);
                videoEncError = e;
            }
        });

        const videoBitrate = 12_000_000;
        const gopEvery = 60;
        await configureVideoEncoderForCanvas(
            videoEncoder,
            canvas.width,
            canvas.height,
            videoBitrate,
            fps
        );

        const yieldToPaint = () => new Promise(r => requestAnimationFrame(r));

        for (let i = 0; i <= totalFrames; i++) {
            if (isRenderCancelled) {
                showLoading("FINALISATION", "Sauvegarde de la portion générée…");
                break; 
            }
            if (videoEncError) throw videoEncError;

            const time = trimStart + (i / fps);
            timeOffset = time; 
            
            await new Promise(resolve => {
                const onSeeked = () => { sourceVideo.removeEventListener('seeked', onSeeked); resolve(); };
                sourceVideo.addEventListener('seeked', onSeeked);
                sourceVideo.currentTime = time;
            });

            applyVHSEffect(sourceVideo, true);

            if (videoEncError) throw videoEncError;
            if (videoEncoder.state !== 'configured') {
                throw new Error("Encodeur vidéo fermé (codec ou taille non pris en charge).");
            }

            const frame = new VideoFrame(canvas, { timestamp: i * 1000000 / fps });
            try {
                videoEncoder.encode(frame, { keyFrame: i % gopEvery === 0 });
            } finally {
                frame.close();
            }

            const pctInt = totalFrames > 0 ? Math.min(100, Math.round((100 * i) / totalFrames)) : 100;
            overlayProgress.textContent = `Progression : ${pctInt} % · ${i} / ${totalFrames} images`;
            if (i % 6 === 0 || i === totalFrames) await yieldToPaint();

            while (videoEncoder.encodeQueueSize > 32) await new Promise(r => setTimeout(r, 5));
        }

        await videoEncoder.flush(); 
        videoEncoder.close();
        muxer.finalize();

        let buffer = muxer.target.buffer;
        let blob = new Blob([buffer], { type: 'video/mp4' });
        let url = URL.createObjectURL(blob);
        
        document.getElementById('overlay-title').innerText = isRenderCancelled ? "RENDU PARTIEL TERMINÉ" : "RENDU TERMINÉ !";
        document.getElementById('overlay-text').classList.add('hidden');
        document.getElementById('overlay-preview').style.display = 'none';
        document.getElementById('btn-cancel-render').classList.add('hidden');
        
        const resultVideo = document.getElementById('overlay-video-result');
        resultVideo.src = url; resultVideo.classList.remove('hidden');
        
        const actionGroup = document.getElementById('overlay-actions');
        actionGroup.classList.remove('hidden'); actionGroup.style.display = 'flex';
        
        document.getElementById('btn-download-result').onclick = () => {
            const a = document.createElement('a'); a.style.display = 'none'; a.href = url; 
            a.download = isRenderCancelled ? 'vhs_rendu_partiel.mp4' : 'vhs_rendu_fluide.mp4';
            document.body.appendChild(a); a.click();
            setTimeout(() => { document.body.removeChild(a); }, 150);
        };
        
        document.getElementById('btn-close-result').onclick = () => { hideLoading(); sourceVideo.currentTime = 0; startVideoLoop(); };

    } catch (e) {
        console.error(e);
        alert("Erreur lors du rendu: " + e.message);
        hideLoading(); sourceVideo.currentTime = 0; startVideoLoop();
    } finally { isRecording = false; }
}

async function startWebcam() {
    showLoading("DÉMARRAGE CAMÉRA...");
    try {
        if (webcamStream) webcamStream.getTracks().forEach(track => track.stop());
        const stream = await navigator.mediaDevices.getUserMedia({ 
            video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: currentFacingMode },
            audio: true 
        });
        webcamStream = stream; currentFileMode = 'webcam'; sourceVideo.srcObject = stream; sourceVideo.play();
        
        dropZone.classList.add('hidden'); document.getElementById('video-controls').classList.add('hidden'); document.getElementById('btn-export-full-video').classList.add('hidden');
        document.getElementById('canvas-container').classList.remove('hidden');
        
        sourceVideo.onloadedmetadata = () => { updateCanvasSize(); startVideoLoop(); hideLoading(); };
    } catch (err) {
        console.error("Erreur webcam:", err); alert("Impossible d'accéder à la caméra/micro. Vérifiez les permissions."); hideLoading();
    }
}

function setupVideoControls() {
    const btnPlayPause = document.getElementById('btn-play-pause');
    const videoProgress = document.getElementById('video-progress');
    const videoTime = document.getElementById('video-time');

    btnPlayPause.addEventListener('click', () => {
        if(currentFileMode !== 'video') return;
        if (sourceVideo.paused) sourceVideo.play(); else sourceVideo.pause();
    });

    sourceVideo.addEventListener('play', () => { btnPlayPause.innerText = '⏸'; });
    sourceVideo.addEventListener('pause', () => { btnPlayPause.innerText = '▶'; renderCurrentFrame(); });

    sourceVideo.addEventListener('timeupdate', () => {
        if (!sourceVideo.duration) return;
        const progress = (sourceVideo.currentTime / sourceVideo.duration) * 100;
        if(document.activeElement !== videoProgress) videoProgress.value = progress;
        videoTime.textContent = formatTime(sourceVideo.currentTime) + ' / ' + formatTime(sourceVideo.duration);
    });

    videoProgress.addEventListener('input', (e) => {
        if (!sourceVideo.duration) return;
        sourceVideo.currentTime = (e.target.value / 100) * sourceVideo.duration;
        if (sourceVideo.paused) renderCurrentFrame();
    });

    const trimStartEl = document.getElementById('trim-start');
    const trimEndEl = document.getElementById('trim-end');
    if (trimStartEl && trimEndEl) {
        trimStartEl.addEventListener('input', updateTrimUI);
        trimEndEl.addEventListener('input', updateTrimUI);
        trimStartEl.addEventListener('change', () => { if(sourceVideo.paused) { sourceVideo.currentTime = trimStartEl.value; renderCurrentFrame(); } });
        trimEndEl.addEventListener('change', () => { if(sourceVideo.paused) { sourceVideo.currentTime = trimEndEl.value; renderCurrentFrame(); } });
    }
}

function updateTrimUI() {
    const ts = document.getElementById('trim-start');
    const te = document.getElementById('trim-end');
    const fill = document.getElementById('trim-fill');
    const display = document.getElementById('trim-display');
    if (!ts || !te || !fill || !display) return;
    
    let startVal = parseFloat(ts.value);
    let endVal = parseFloat(te.value);
    
    if (startVal >= endVal) {
        if (ts === document.activeElement) { ts.value = endVal - 0.1; startVal = endVal - 0.1; }
        else { te.value = startVal + 0.1; endVal = startVal + 0.1; }
    }
    
    const max = parseFloat(ts.max) || 100;
    const startPct = (startVal / max) * 100;
    const endPct = (endVal / max) * 100;
    
    fill.style.left = startPct + '%';
    fill.style.width = (endPct - startPct) + '%';
    
    display.textContent = `${startVal.toFixed(1)}s - ${endVal.toFixed(1)}s`;
}

function formatTime(seconds) {
    if (isNaN(seconds)) return "0:00";
    const m = Math.floor(seconds / 60); const s = Math.floor(seconds % 60);
    return m + ':' + (s < 10 ? '0' : '') + s;
}

function drawCover(ctx, img, cw, ch) {
    let iw = img.videoWidth || img.width; let ih = img.videoHeight || img.height;
    let scale = Math.max(cw / iw, ch / ih);
    let drawW = iw * scale; let drawH = ih * scale;
    let offsetX = (cw - drawW) / 2; let offsetY = (ch - drawH) / 2;
    ctx.drawImage(img, offsetX, offsetY, drawW, drawH);
}

function renderCurrentFrame() {
    if (!currentFileMode || isRecording) return;
    const frameSource = (currentFileMode === 'video' || currentFileMode === 'webcam') ? sourceVideo : currentOriginalImage;
    if (!frameSource) return;
    timeOffset = performance.now() / 1000;
    applyVHSEffect(frameSource, currentFileMode !== 'image');
}

function applyVHSEffect(frameSource, isVideo = false) {
    if (!effectScratchCanvas) {
        effectScratchCanvas = document.createElement('canvas');
        effectScratchCtx = effectScratchCanvas.getContext('2d', { willReadFrequently: true });
    }
    
    const params = collectParams();
    let iw = canvas.width;
    let ih = canvas.height;
    
    if (params.band_patina && params.band_patina < 1.0) {
        iw = Math.max(1, Math.floor(canvas.width * params.band_patina));
        ih = Math.max(1, Math.floor(canvas.height * params.band_patina));
    }

    if (effectScratchCanvas.width !== iw || effectScratchCanvas.height !== ih) {
        effectScratchCanvas.width = iw;
        effectScratchCanvas.height = ih;
    }
    const tempCanvas = effectScratchCanvas;
    const tempCtx = effectScratchCtx;
    
    drawCover(tempCtx, frameSource, iw, ih);

    if (!params.enable_effect) { 
        ctx.imageSmoothingEnabled = true;
        ctx.drawImage(tempCanvas, 0, 0, iw, ih, 0, 0, canvas.width, canvas.height);
        return; 
    }

    if (params.apply_jpeg) tempCtx.filter = `blur(${Math.max(0, 100 - params.jpeg_quality) / 20}px)`;
    else tempCtx.filter = 'none';
    if (params.apply_jpeg) drawCover(tempCtx, frameSource, iw, ih);
    
    const imageData = tempCtx.getImageData(0, 0, iw, ih);
    const resultBytes = process_hybrid_heisei(new Uint8Array(imageData.data.buffer), iw, ih, JSON.stringify(params), timeOffset);
    const newImageData = new ImageData(new Uint8ClampedArray(resultBytes.buffer), iw, ih);
    
    tempCtx.putImageData(newImageData, 0, 0);
    
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(tempCanvas, 0, 0, iw, ih, 0, 0, canvas.width, canvas.height);
}

function startVideoLoop() {
    if(videoLoopId) cancelAnimationFrame(videoLoopId);
    function loop() {
        if(currentFileMode === 'video' && !sourceVideo.paused && !sourceVideo.ended) {
            const trimStartStr = document.getElementById('trim-start').value;
            const trimEndStr = document.getElementById('trim-end').value;
            const trimStart = parseFloat(trimStartStr) || 0;
            let trimEnd = parseFloat(trimEndStr) || 0;
            if (trimEnd <= 0) trimEnd = sourceVideo.duration;

            if (sourceVideo.currentTime < trimStart) sourceVideo.currentTime = trimStart;
            if (sourceVideo.currentTime >= trimEnd) sourceVideo.currentTime = trimStart;

            timeOffset = sourceVideo.currentTime; applyVHSEffect(sourceVideo, true);
        } else if (currentFileMode === 'webcam') {
            timeOffset = performance.now() / 1000; applyVHSEffect(sourceVideo, true);
        }
        videoLoopId = requestAnimationFrame(loop);
    }
    loop();
}

function toggleVideoRecording() {
    if (!currentFileMode) return;

    const btn = document.getElementById('btn-record');
    const btnExportFull = document.getElementById('btn-export-full-video');
    const recordRaw = document.getElementById('p_record_raw').checked;

    if (isRecording) {
        try { mediaRecorder.stop(); } catch(e){}
        isRecording = false;
        btn.innerText = "Rec Live (+ Son)";
        btn.classList.remove('danger-solid'); btn.classList.add('danger');
        if(currentFileMode === 'video') btnExportFull.classList.remove('hidden');
        if(currentFileMode === 'image') { cancelAnimationFrame(videoLoopId); renderCurrentFrame(); }
    } else {
        isRecording = true;
        btn.innerText = "🔴 Stop & Sauvegarder";
        btn.classList.remove('danger'); btn.classList.add('danger-solid');
        if(currentFileMode === 'video') btnExportFull.classList.add('hidden');

        let streamToRecord;
        
        if (recordRaw) {
            if (currentFileMode === 'webcam') streamToRecord = webcamStream;
            else if (currentFileMode === 'video') {
                if (sourceVideo.captureStream) streamToRecord = sourceVideo.captureStream();
                else if (sourceVideo.mozCaptureStream) streamToRecord = sourceVideo.mozCaptureStream();
            }
        } else {
            const canvasStream = canvas.captureStream(30); 
            streamToRecord = new MediaStream([canvasStream.getVideoTracks()[0]]);
            if (currentFileMode === 'webcam' && webcamStream) webcamStream.getAudioTracks().forEach(t => streamToRecord.addTrack(t));
            else if (currentFileMode === 'video' && sourceVideo) {
                let vidStream;
                if (sourceVideo.captureStream) vidStream = sourceVideo.captureStream();
                else if (sourceVideo.mozCaptureStream) vidStream = sourceVideo.mozCaptureStream();
                if (vidStream) vidStream.getAudioTracks().forEach(t => streamToRecord.addTrack(t));
            }
        }
        
        let options = {};
        if (MediaRecorder.isTypeSupported('video/webm;codecs=vp9')) options.mimeType = 'video/webm;codecs=vp9';
        else if (MediaRecorder.isTypeSupported('video/webm')) options.mimeType = 'video/webm';
        else if (MediaRecorder.isTypeSupported('video/mp4')) options.mimeType = 'video/mp4'; 
        options.videoBitsPerSecond = 8000000; 

        try { mediaRecorder = new MediaRecorder(streamToRecord, options); } 
        catch(e) { mediaRecorder = new MediaRecorder(streamToRecord); }
        
        recordedChunks = [];
        mediaRecorder.ondataavailable = e => { if (e.data.size > 0) recordedChunks.push(e.data); };
        mediaRecorder.onstop = () => {
            const ext = mediaRecorder.mimeType.includes('mp4') ? 'mp4' : 'webm';
            const blob = new Blob(recordedChunks, { type: mediaRecorder.mimeType || 'video/webm' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a'); a.style.display = 'none'; a.href = url;
            a.download = recordRaw ? `raw_record_live.${ext}` : `vhs_record_live.${ext}`;
            document.body.appendChild(a); a.click();
            setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 150);
        };

        mediaRecorder.start();

        if (currentFileMode === 'image') {
            if(videoLoopId) cancelAnimationFrame(videoLoopId);
            function fakeLoop() {
                if(!isRecording || currentFileMode !== 'image') return;
                timeOffset = performance.now() / 1000;
                applyVHSEffect(currentOriginalImage, true);
                videoLoopId = requestAnimationFrame(fakeLoop);
            }
            fakeLoop();
        } else if (currentFileMode === 'video') {
            if(sourceVideo.paused) sourceVideo.play();
        }
    }
}

function updateCanvasSize() {
    if (!currentFileMode) return;
    const source = (currentFileMode === 'video' || currentFileMode === 'webcam') ? sourceVideo : currentOriginalImage;
    if (!source) return;

    let w = (currentFileMode === 'video' || currentFileMode === 'webcam') ? source.videoWidth : source.width;
    let h = (currentFileMode === 'video' || currentFileMode === 'webcam') ? source.videoHeight : source.height;

    const format = document.getElementById('p_render_format').value;
    if (format === 'sd_43') { w = 640; h = 480; }
    else if (format === 'sd_169') { w = 854; h = 480; }
    else if (format === 'hd_43') { w = 960; h = 720; }
    else if (format === 'hd_169') { w = 1280; h = 720; }
    else {
        const maxMobileDim = 1920; 
        if(w > maxMobileDim || h > maxMobileDim) {
            const ratio = Math.min(maxMobileDim/w, maxMobileDim/h);
            w = Math.floor(w * ratio); h = Math.floor(h * ratio);
        }
    }
    canvas.width = Math.floor(w / 2) * 2; canvas.height = Math.floor(h / 2) * 2;
    setTimeout(() => { resetViewport(); renderCurrentFrame(); }, 50);
}

function handleFileUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    showLoading("OUVERTURE DU FICHIER...");
    if (webcamStream) { webcamStream.getTracks().forEach(t => t.stop()); webcamStream = null; }
    sourceVideo.srcObject = null;
    
    const fileUrl = URL.createObjectURL(file);
    dropZone.classList.add('hidden');
    const videoControls = document.getElementById('video-controls');
    const btnExportFull = document.getElementById('btn-export-full-video');

    if (file.type.startsWith('video/')) {
        currentFileMode = 'video';
        videoControls.classList.remove('hidden'); btnExportFull.classList.remove('hidden');
        document.getElementById('canvas-container').classList.remove('hidden');
        sourceVideo.crossOrigin = "anonymous"; sourceVideo.src = fileUrl;
        sourceVideo.onloadedmetadata = () => { 
            updateCanvasSize(); 
            const ts = document.getElementById('trim-start');
            const te = document.getElementById('trim-end');
            if (ts && te) {
                ts.max = sourceVideo.duration;
                te.max = sourceVideo.duration;
                te.value = sourceVideo.duration;
                updateTrimUI();
            }
            sourceVideo.play(); 
            startVideoLoop(); 
            hideLoading(); 
        };
    } else if (file.type.startsWith('image/')) {
        currentFileMode = 'image';
        videoControls.classList.add('hidden'); btnExportFull.classList.add('hidden');
        document.getElementById('canvas-container').classList.remove('hidden');
        if(videoLoopId) cancelAnimationFrame(videoLoopId); sourceVideo.pause();
        const img = new Image(); img.crossOrigin = "anonymous";
        img.onload = () => { currentOriginalImage = img; updateCanvasSize(); hideLoading(); };
        img.src = fileUrl;
    }
}

function setupCanvasInteractions() {
    const zoomSlider = document.getElementById('zoom-slider');
    const zoomVal = document.getElementById('zoom-value');

    const applyTransform = () => { canvasContainer.style.transform = `translate(${panX}px, ${panY}px) scale(${scale})`; };

    const updateZoom = (newScale, originX = viewport.clientWidth/2, originY = viewport.clientHeight/2) => {
        if(!currentFileMode) return;
        const oldScale = scale; scale = Math.min(Math.max(0.1, newScale), 5.0);
        if(scale <= 0.05) scale = 0.05;
        panX = originX - (originX - panX) * (scale / oldScale); panY = originY - (originY - panY) * (scale / oldScale);
        zoomSlider.value = Math.round(scale * 100); zoomVal.textContent = Math.round(scale * 100) + '%';
        applyTransform();
    };

    zoomSlider.addEventListener('input', (e) => updateZoom(e.target.value / 100));

    viewport.addEventListener('mousedown', e => {
        if(e.target.closest('.drop-zone') || e.target.closest('.viewport-controls')) return;
        isDragging = true; startDragX = e.clientX - panX; startDragY = e.clientY - panY;
    });
    
    viewport.addEventListener('touchstart', e => {
        if(e.target.closest('.drop-zone') || e.target.closest('.viewport-controls')) return;
        if (e.touches.length === 1) { isDragging = true; startDragX = e.touches[0].clientX - panX; startDragY = e.touches[0].clientY - panY; }
    }, {passive: false});

    window.addEventListener('mousemove', e => { if (!isDragging) return; panX = e.clientX - startDragX; panY = e.clientY - startDragY; applyTransform(); });
    window.addEventListener('touchmove', e => { if (!isDragging) return; panX = e.touches[0].clientX - startDragX; panY = e.touches[0].clientY - startDragY; applyTransform(); }, {passive: false});
    window.addEventListener('mouseup', () => isDragging = false); window.addEventListener('touchend', () => isDragging = false);

    viewport.addEventListener('wheel', e => {
        if(e.target.closest('.viewport-controls') || e.target.closest('.sidebar')) return;
        e.preventDefault(); if(!currentFileMode) return;
        const zoomDelta = e.deltaY > 0 ? 0.95 : 1.05;
        updateZoom(scale * zoomDelta, e.clientX - viewport.getBoundingClientRect().left, e.clientY - viewport.getBoundingClientRect().top);
    }, { passive: false });
}

function resetViewport() {
    if(!currentFileMode) return;
    const vW = viewport.clientWidth; const vH = viewport.clientHeight;
    let bottomSpace = 0; const controls = document.getElementById('video-controls');
    if (currentFileMode === 'video' && !controls.classList.contains('hidden')) bottomSpace = controls.offsetHeight;
    const padding = 20; 
    
    scale = Math.min((vW - padding * 2) / canvas.width, (vH - bottomSpace - padding * 2) / canvas.height);
    if(scale <= 0.05) scale = 0.05; 

    panX = (vW - canvas.width * scale) / 2; panY = (vH - bottomSpace - canvas.height * scale) / 2;
    document.getElementById('zoom-slider').value = Math.round(scale * 100); document.getElementById('zoom-value').textContent = Math.round(scale * 100) + '%';
    canvasContainer.style.transform = `translate(${panX}px, ${panY}px) scale(${scale})`;
}

function toggleControlPanel() {
    const panel = document.getElementById('control-panel'); const viewportEl = document.getElementById('preview-viewport');
    if (panel.classList.contains('is-open')) { panel.classList.remove('is-open'); viewportEl.classList.remove('panel-open'); } 
    else { panel.classList.add('is-open'); viewportEl.classList.add('panel-open'); }
    setTimeout(() => { if(currentFileMode) resetViewport(); }, 300);
}

function closeControlPanel() {
    document.getElementById('control-panel').classList.remove('is-open'); document.getElementById('preview-viewport').classList.remove('panel-open');
    setTimeout(() => { if(window.innerWidth < 768 && currentFileMode) resetViewport(); }, 300);
}

window.addEventListener('resize', () => {
    if(window.innerWidth >= 768) { document.getElementById('control-panel').classList.remove('is-open'); document.getElementById('preview-viewport').classList.remove('panel-open'); }
    if(currentFileMode) resetViewport();
});

window.addEventListener('DOMContentLoaded', bootstrap);


