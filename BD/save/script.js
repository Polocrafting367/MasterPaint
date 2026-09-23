

 let autoStartAfterProfileSelection = false; // Témoin pour le lancement auto



// 1. On met tout le code d'initialisation dans une fonction nommée
function initApp() {
    console.log("🚀 Démarrage de l'application..."); // Pour vérifier dans la console
    showOneTimeMessage(2, "Mise à jour du code appliquée ! v1.2.10");
    migrateOldData(); 
migrateOldSchedule();
initStatisticsModule();
    loadData(); 

    // Gestion des profils par défaut (seulement si vide)
    if (!profiles || profiles.length === 0) {
        console.log("Aucun profil trouvé, création des défauts...");
        profiles = [
            { id: 1, name: "Matin", start: "05:30", end: "13:30", pause: 30, color: "#c733db", days: [0, 1, 2, 3, 4] },
            { id: 2, name: "Journée", start: "08:30", end: "16:00", pause: 30, color: "#90db33", days: [0, 1, 2, 3, 4] }
        ];
        saveData(); 
    }

    loadLogsForView();

    // Init Settings UI
    if(document.getElementById('setting-ignore-early')) {
        document.getElementById('setting-ignore-early').checked = appSettings.ignoreEarlyStart;
        document.getElementById('setting-calc-ot').checked = appSettings.countOvertime;
        document.getElementById('setting-deduct-pause').checked = appSettings.deductPause;
        document.getElementById('setting-count-neg').checked = appSettings.countNegative;
        document.getElementById('setting-weekly-base').value = appSettings.weeklyBase;
        document.getElementById('setting-ot-step').value = appSettings.otStep;
        document.getElementById('settings-night-start').value = appSettings.nightStart || "21:00";
        document.getElementById('settings-night-end').value = appSettings.nightEnd || "06:00";
        document.getElementById('setting-auto-backup').checked = appSettings.autoBackup === true;
           document.getElementById('setting-force-local').checked = appSettings.forceLocal === true;

    }

    renderSettingsList();
    renderCalendar();
    renderHistory();
    checkAlreadyLogged();
    
    // Navigation initiale
    const navBtn = document.querySelector('.nav-item[onclick*="page-chrono"]');
    navTo('page-chrono', navBtn);

    // Restauration UI Chrono
    if (currentSession) {
        restoreTimerUI();
    }
    
    checkTodaySchedule();

    const dateDisplay = document.getElementById('current-date-display');
    if(dateDisplay) {
        const options = { weekday: 'long', day: 'numeric', month: 'long' };
        dateDisplay.textContent = new Date().toLocaleDateString('fr-FR', options);
    }

    // Android Listener
    window.addEventListener('android-stop-timer', () => {
        if(currentSession) stopTimer();
    });
    runDailyAutoExport();
}


const allowedColors = [
    // 🌑 NEUTRES & GRIS
    "#000000", // Noir
    "#1a1a1a", // Anthracite
    "#424949", // Gris charbon
    "#7f8c8d", // Gris moyen

    // 🔴 ROUGES & BRUNS
        "#a52a2a", // Marron terre

    "#4f2121", // Brun-rouge profond
    "#b71c1c", // Rouge sang sombre
    "#c0392b", // Rouge brique
    "#e74c3c", // Rouge vif

    // 🍊 ORANGES
    "#472b21", // Terre d'ombre
    "#bf360c", // Orange brûlé
    "#d35400", // Citrouille
    "#e67e22", // Carotte
    "#a04000", // Sienne

    // ☀️ JAUNES & DORÉS
    "#d4ac0d", // Or sombre
    "#b7950b", // Moutarde
    "#fbc02d", // Jaune soleil
    "#f39c12", // Orange-Jaune

    // 🍀 VERTS
    "#394528", // Vert olive très sombre
    "#1b5e20", // Vert forêt
    "#196f3d", // Vert sapin
    "#27ae60", // Émeraude
    "#689f38", // Vert herbe

    // 💎 TURQUOISES & CYANS
    "#004d40", // Vert canard profond
    "#00796b", // Sarcelle (Teal)
    "#16a085", // Turquoise sombre
    "#0097a7", // Cyan

    // 🔵 BLEUS
    "#1b4f72", // Bleu pétrole
    "#0d47a1", // Bleu royal
    "#1565c0", // Bleu dynamique
    "#2980b9", // Bleu ciel soutenu
    "#2c3e50", // Midnight Blue

    // 🍇 VIOLETS & PRUNES
    "#4a148c", // Violet profond
    "#6a1b9a", // Pourpre
    "#8e44ad", // Violet
    "#9b59b6", // Améthyste
    "#241f31", // Gris-Violet sombre (rgb(36, 31, 49))

    // 🌸 ROSES & MAGENTA
    "#880e4f", // Bordeaux / Prune
    "#ad1457", // Magenta sombre
    "#e91e63", // Pink
    "#f06292"  // Rose poudré
];
function initColorPicker() {
    const container = document.getElementById('color-picker-container');
    container.innerHTML = "";
    const currentColor = document.getElementById('new-p-color').value.toLowerCase();

    allowedColors.forEach(color => {
        const dot = document.createElement('div');
        dot.className = "color-dot";
        dot.style.backgroundColor = color;

        // Si c'est la couleur sélectionnée
        if (color.toLowerCase() === currentColor) {
            dot.style.borderColor = "white";
            dot.style.transform = "scale(1.1)";
            dot.innerHTML = '<i class="fas fa-check" style="color:white; font-size:14px;"></i>';
            dot.style.boxShadow = "0 0 12px rgba(255,255,255,0.4)";
        }

        dot.onclick = () => selectColor(color, dot);
        container.appendChild(dot);
    });
}
function openColorModal() {
initColorPicker(); // Rafraîchir pour montrer la sélection actuelle
document.getElementById('color-modal').style.display = 'flex';
}

function selectColor(color, element) {
// 1. Mise à jour de la valeur et de la preview
document.getElementById('new-p-color').value = color;
document.getElementById('current-color-preview').style.backgroundColor = color;

// 2. Visuel de la pastille
document.querySelectorAll('.color-dot').forEach(d => {
    d.style.borderColor = "transparent";
    d.style.transform = "scale(1)";
});
element.style.borderColor = "white";
element.style.transform = "scale(1.1)";

// Optionnel : fermer la modale automatiquement après sélection (si vous préférez)
// setTimeout(() => { document.getElementById('color-modal').style.display = 'none'; }, 200);
}

// Helper indispensable pour la comparaison
function hexToRgb(hex) {
const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
return `rgb(${r}, ${g}, ${b})`;
}
    // --- ETAT GLOBAL ---
    let profiles = [];
    let schedule = {};
    let logs = []; // Représente désormais UNIQUEMENT les logs du mois affiché dans l'historique
// Ajoutez ignoreEarlyStart dans vos réglages par défaut
// Configuration des réglages par défaut
let appSettings = {
    countOvertime: true,      // setting-calc-ot: true
    ignoreEarlyStart: true,   // setting-ignore-early: true
    deductPause: true,        // setting-deduct-pause: true
    countNegative: false,     // setting-count-neg: false
    weeklyBase: 35,
    otStep: 15,
    nightStart: "21:00",
    nightEnd: "06:00",
    autoBackup: false,
        forceLocal: false

};

    let currentSession = null;
    let pendingLogData = null;
    let timerInterval = null;

    let currentPlanningDate = new Date();
    let currentHistoryDate = new Date(); // Mois affiché dans l'historique

    let selectedDayForModal = null;
    let selectedDaysInForm = [];

    let multiSelectMode = false;
    let selectedBatchDates = new Set();
    let longPressTimer;

    // --- GESTION STOCKAGE PAR MOIS ---

    // Génère la clé "pt_logs_YYYY_MM"
    function getStorageKey(date) {
        let d = new Date(date);
        // Si le format n'est pas standard (DD/MM/YYYY utilisé dans l'affichage parfois)
        if(isNaN(d.getTime())) {
            const parts = date.split('/');
            if(parts.length === 3) d = new Date(parts[2], parts[1]-1, parts[0]);
        }
        if(isNaN(d.getTime())) d = new Date(); // Fallback aujourd'hui

        const m = (d.getMonth() + 1).toString().padStart(2, '0');
        return `pt_logs_${d.getFullYear()}_${m}`;
    }

    // Migration unique : Découpe l'ancien tableau monolithique en fichiers mensuels
    function migrateOldData() {
        const old = localStorage.getItem('pt_logs');
        if (old) {
            try {
                const all = JSON.parse(old);
                if (Array.isArray(all) && all.length > 0) {
                    const buckets = {};
                    all.forEach(log => {
                        // On se base sur dateStr (ISO) ou date (Locale)
                        const k = getStorageKey(log.dateStr || log.date);
                        if (!buckets[k]) buckets[k] = [];
                        buckets[k].push(log);
                    });

                    // Sauvegarde dans les nouveaux buckets
                    for (const [key, val] of Object.entries(buckets)) {
                        // Fusionner avec existant si jamais (sécurité)
                        const existing = localStorage.getItem(key);
                        let combined = val;
                        if (existing) {
                            combined = [...JSON.parse(existing), ...val];
                        }
                        localStorage.setItem(key, JSON.stringify(combined));
                    }
                }
                localStorage.removeItem('pt_logs'); // Nettoyage ancien
                console.log("Migration des données effectuée (Stockage par mois).");
            } catch (e) {
                console.error("Erreur migration", e);
            }
        }
    }

    // Charge les logs pour le mois visualisé (currentHistoryDate)
    function loadLogsForView() {
        const key = getStorageKey(currentHistoryDate);
        const raw = localStorage.getItem(key);
        logs = raw ? JSON.parse(raw) : [];
    }

    // Sauvegarde le tableau 'logs' (qui correspond au mois visualisé)
    function saveLogsCurrentView() {
        const key = getStorageKey(currentHistoryDate);
        localStorage.setItem(key, JSON.stringify(logs));
    }

    // Ajoute ou met à jour un log dans son fichier mensuel approprié
    // (Gère le cas où on ajoute un log pour un mois différent de celui affiché)
    function saveLogToStorage(log) {
        const targetKey = getStorageKey(log.dateStr || log.date);
        const currentViewKey = getStorageKey(currentHistoryDate);

        // Si le log appartient au mois qu'on regarde actuellement
        if (targetKey === currentViewKey) {
            // On l'ajoute à la variable globale et on sauvegarde
            // (Note: Cette fonction est appelée après un unshift/push dans les fonctions d'ajout)
            // Donc on sauvegarde juste la vue courante
            saveLogsCurrentView();
        } else {
            // Le log est pour un autre mois (ex: on pointe Octobre mais on regarde Septembre)
            const raw = localStorage.getItem(targetKey);
            let targetLogs = raw ? JSON.parse(raw) : [];
            targetLogs.unshift(log); // Ajout en début
            localStorage.setItem(targetKey, JSON.stringify(targetLogs));
        }
    }

    // Met à jour un log existant (Edition/Suppression)
    // Ici on suppose qu'on édite toujours un log visible, donc dans 'logs'
    // Si on change la date d'un log vers un autre mois, c'est plus complexe,
    // mais pour l'instant restons simple : on sauvegarde la vue courante.
    // Si la date change de mois, idéalement il faudrait déplacer le log,
    // mais pour cette version on garde dans le fichier d'origine ou on sauvegarde currentView.
    function saveLogsAfterEdit() {
         // On part du principe que l'édition se fait sur le mois affiché
         saveLogsCurrentView();
    }

function exportData() {
    const data = {};
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key.startsWith('pt_')) {
            data[key] = localStorage.getItem(key);
        }
    }
    
    const jsonString = JSON.stringify(data, null, 2);
    const fileName = `pointeuse_backup_${new Date().toISOString().split('T')[0]}.json`;

    // --- LA CLÉ EST ICI ---
    if (window.Android && window.Android.saveFile) {
        // On appelle directement la fonction Kotlin
        window.Android.saveFile(jsonString, fileName);
    } else {
        // Fallback pour navigateur PC uniquement
        const blob = new Blob([jsonString], {type: 'application/json'});
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        a.click();
    }
}

function importData() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';

    input.onchange = e => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = event => {
            try {
                const importedData = JSON.parse(event.target.result);
                
                if (confirm("Voulez-vous vraiment importer ces données ? Cela remplacera tout.")) {
                    // 1. Nettoyer le LocalStorage (uniquement les clés de l'app)
                    for (let i = localStorage.length - 1; i >= 0; i--) {
                        const key = localStorage.key(i);
                        if (key && key.startsWith('pt_')) localStorage.removeItem(key);
                    }

                    // 2. Injecter dans le LocalStorage
                    Object.keys(importedData).forEach(key => {
                        localStorage.setItem(key, importedData[key]);
                    });

                    // 3. MISE À JOUR DES VARIABLES JAVASCRIPT (Le "Moteur")
                    // On appelle loadData() pour que 'profiles', 'schedule', etc. soient à jour
                    loadData(); 
                    
                    // 4. MISE À JOUR DES LOGS (Cas particulier car stocké par mois)
                    loadLogsForView(); 

                    alert("Importation réussie ! L'interface va se rafraîchir.");
                    
                    // 5. Rafraîchir l'UI sans forcément recharger toute la page
                    // Ou utiliser location.reload() pour être 100% sûr
                    location.reload(); 
                }
            } catch (err) {
                alert("Erreur lors de l'importation : " + err.message);
            }
        };
        reader.readAsText(file);
    };
    input.click();
}
    function triggerImport() {
        document.getElementById('import-file-input').click();
    }
function handleImport(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            // 1. On transforme le fichier texte en Objet JavaScript
            const data = JSON.parse(e.target.result);

            if (confirm("ATTENTION : L'importation écrasera définitivement toutes les données actuelles. Continuer ?")) {
                
                // 2. Nettoyage préventif
                const keysToRemove = [];
                for (let i = 0; i < localStorage.length; i++) {
                    if (localStorage.key(i).startsWith('pt_')) {
                        keysToRemove.push(localStorage.key(i));
                    }
                }
                keysToRemove.forEach(k => localStorage.removeItem(k));

                // 3. Restauration avec SÉCURITÉ DE TYPE
                for (const [key, value] of Object.entries(data)) {
                    // C'EST ICI QUE CA BUGAIT :
                    // Si 'value' est un objet/tableau, il faut le remettre en String JSON pour le localStorage
                    const valToStore = typeof value === 'object' ? JSON.stringify(value) : value;
                    localStorage.setItem(key, valToStore);
                }

                // 4. Mise à jour immédiate des variables en mémoire (pour éviter le bug d'écrasement)
                loadData();       // Recharge profiles, schedule, settings
                loadLogsForView(); // Recharge les logs du mois

                alert("Importation réussie ! L'application va redémarrer.");
                location.reload();
            }
        } catch (err) {
            console.error(err);
            alert("Erreur lors de la lecture du fichier : " + err.message);
        }
        // Reset input
        event.target.value = '';
    };
    reader.readAsText(file);
}



// 2. Le lanceur intelligent (à mettre tout à la fin du fichier)
if (document.readyState === 'loading') {
    // Si la page charge encore, on attend
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    // Si la page est DÉJÀ chargée (le cas qui posait problème), on lance tout de suite
    initApp();
}

    // --- UTILS ---
    function getWeekNumber(d) {
        d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
        d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay()||7));
        var yearStart = new Date(Date.UTC(d.getUTCFullYear(),0,1));
        return Math.ceil(( ( (d - yearStart) / 86400000) + 1)/7);
    }

function calculateOvertime(durationMs, p, actualStartMs) {
const [hS, mS] = p.start.split(':').map(Number);
const [hE, mE] = p.end.split(':').map(Number);

const startTimeTheo = new Date(actualStartMs);
startTimeTheo.setHours(hS, mS, 0, 0);

let effectiveDurationMs = durationMs;

// RÈGLE : Si l'option est activée et qu'on est en avance, on soustrait l'avance de la durée
if (appSettings.ignoreEarlyStart && actualStartMs < startTimeTheo.getTime()) {
    const deltaAvance = startTimeTheo.getTime() - actualStartMs;
    effectiveDurationMs = Math.max(0, durationMs - deltaAvance);
}

// Calcul de la durée théorique contractuelle
let spanMins = (hE * 60 + mE) - (hS * 60 + mS);
if(spanMins < 0) spanMins += 1440;
const netTargetMins = spanMins - p.pause;

let finalDurationMs = effectiveDurationMs;
// Déduction de la pause si l'option globale est cochée
if(appSettings.deductPause) {
    finalDurationMs -= (p.pause * 60000);
}

return finalDurationMs - (netTargetMins * 60000);
}

function getAccentColor(baseColor) {
    if (!baseColor) return 'var(--primary)';
    
    const ctx = document.createElement('canvas').getContext('2d');
    ctx.fillStyle = baseColor;
    const colorRgb = ctx.fillStyle; 
    
    let r = parseInt(colorRgb.substring(1, 3), 16) / 255;
    let g = parseInt(colorRgb.substring(3, 5), 16) / 255;
    let b = parseInt(colorRgb.substring(5, 7), 16) / 255;

    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h, s, l = (max + min) / 2;

    if (max === min) {
        h = s = 0;
    } else {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case g: h = (b - r) / d + 2; break;
            case b: h = (r - g) / d + 4; break;
        }
        h /= 6;
    }

    // --- LOGIQUE DE CONTRASTE UNIQUE ---
    const percent = 0.3; 
    if (l < 0.1) { l = 0.55; } // Noir -> Gris clair
    else if (l > 0.4 && l < 0.6) { l = l; } // Milieu -> Ne pas toucher
    else if (l >= 0.6) { l = l - percent; } // Très clair -> Assombrir
    else { l = Math.min(0.85, l + percent); }

    const hue2rgb = (p, q, t) => {
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        if (t < 1/6) return p + (q - p) * 6 * t;
        if (t < 1/2) return q;
        if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
        return p;
    };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    const fR = Math.round(hue2rgb(p, q, h + 1/3) * 255);
    const fG = Math.round(hue2rgb(p, q, h) * 255);
    const fB = Math.round(hue2rgb(p, q, h - 1/3) * 255);

    return `rgb(${fR}, ${fG}, ${fB})`;
}
function updateThemeColor(pageId) {
    const root = document.documentElement;
    let baseColor = '#3498db'; // Bleu par défaut

    if (pageId) {
        const todayKey = new Date().toISOString().split('T')[0];
        if (currentSession && currentSession.profileSnap) {
            baseColor = currentSession.profileSnap.color;
        } else {
            const data = getScheduleData(todayKey);
            if (data) {
                const p = profiles.find(x => x.id === data.id);
                if (p) baseColor = p.color;
            }
        }
    }
    
    // On applique la transformation
    root.style.setProperty('--primary', getAccentColor(baseColor));
}
    // --- NAVIGATION ---
function navTo(pageId, btnElement) {
    // 1. Gestion des classes actives sur les pages
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById(pageId).classList.add('active');

    // 2. Gestion des classes actives sur les boutons de navigation
    document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
    
    if (btnElement) {
        // Si on a passé l'élément (clic manuel)
        btnElement.classList.add('active');
    } else {
        // Si on appelle la fonction programmatiquement (ex: navTo('page-chrono'))
        // On cherche le bouton qui possède le onclick correspondant à cette page
        const targetBtn = document.querySelector(`.nav-item[onclick*="${pageId}"]`);
        if (targetBtn) targetBtn.classList.add('active');
    }

    // 3. Mise à jour de la couleur primary dynamique (ton code précédent)
    updateThemeColor(pageId);

    // 4. Remonter en haut et logiques spécifiques
    const targetPage = document.getElementById(pageId);
    if (targetPage) targetPage.scrollTop = 0;
    
    if(pageId === 'page-chrono') {
        checkTodaySchedule();
        checkAlreadyLogged();
    }
    if(pageId === 'page-history') renderHistory();
    if(pageId === 'page-planning') {
        renderCalendar();
        if (typeof exitMultiSelect === 'function') exitMultiSelect();
    }
}
    function goToSettingsFromModal() {
        document.getElementById('day-modal').style.display = 'none';
        const btn = document.querySelector('button[onclick*="page-settings"]');
        navTo('page-settings', btn);
        document.getElementById('profile-form-card').scrollIntoView();
    }

    // --- HELPER DATA STRUCTURE ---
    function getScheduleData(dateKey) {
        const entry = schedule[dateKey];
        if (!entry) return null;
        if (typeof entry === 'object') return entry;
        return { id: entry, note: "" };
    }

function updateSettings() {
    appSettings.countOvertime = document.getElementById('setting-calc-ot').checked;
    appSettings.weeklyBase = parseFloat(document.getElementById('setting-weekly-base').value) || 35;
    appSettings.otStep = parseInt(document.getElementById('setting-ot-step').value) || 15;
    appSettings.deductPause = document.getElementById('setting-deduct-pause').checked;
    appSettings.countNegative = document.getElementById('setting-count-neg').checked;
    appSettings.ignoreEarlyStart = document.getElementById('setting-ignore-early').checked;
    appSettings.autoBackup = document.getElementById('setting-auto-backup').checked; // <--- AJOUT
    appSettings.forceLocal = document.getElementById('setting-force-local').checked; // <--- AJOUT
    appSettings.nightStart = document.getElementById('settings-night-start').value;
    appSettings.nightEnd = document.getElementById('settings-night-end').value;

    saveData();
    if(document.getElementById('page-history').classList.contains('active')) renderHistory();
}
    // --- LOGIQUE PLANNING (CALENDRIER) ---
    function changeMonth(delta) {
        currentPlanningDate.setMonth(currentPlanningDate.getMonth() + delta);
        renderCalendar();
    }

function renderCalendar() {
    loadScheduleForMonthView(); // <--- AJOUTE CECI
const year = currentPlanningDate.getFullYear();
    const month = currentPlanningDate.getMonth();
    const monthNames = ["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"];
    
    const calTitle = document.getElementById('cal-month-year');
    calTitle.textContent = `${monthNames[month]} ${year}`;
    calTitle.style.fontSize = "1em";
    
    const feries = getJoursFeries(year);
    const firstDayOfMonth = new Date(year, month, 1);
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    let startDay = firstDayOfMonth.getDay();
    startDay = (startDay === 0) ? 6 : startDay - 1;

    const grid = document.getElementById('calendar-body');
    grid.innerHTML = "";

    for(let i=0; i<startDay; i++) {
        const empty = document.createElement('div');
        empty.className = "cal-day empty";
        grid.appendChild(empty);
    }

    const todayStr = new Date().toISOString().split('T')[0];

    for(let d=1; d<=daysInMonth; d++) {
        const cell = document.createElement('div');
        cell.className = "cal-day";
        const dateObj = new Date(year, month, d);
        dateObj.setHours(12, 0, 0, 0);
        const dateKey = dateObj.toISOString().split('T')[0];

        if(dateKey === todayStr) cell.classList.add('today');
        if(multiSelectMode && selectedBatchDates.has(dateKey)) {
            cell.classList.add('multi-selected');
        }

        const ferieObj = feries.find(f => f.d.getDate() === d && f.d.getMonth() === month);
        if(ferieObj) {
            cell.classList.add('ferie');
            const nameBadge = document.createElement('div');
            nameBadge.className = "ferie-name";
            nameBadge.textContent = ferieObj.n; 
            cell.appendChild(nameBadge);
        }

        const numSpan = document.createElement('span');
        numSpan.className = 'cal-day-num';
        numSpan.textContent = d;
        cell.appendChild(numSpan);
        
        if (dateObj.getDay() === 1) {
            const weekBadge = document.createElement('span');
            weekBadge.className = 'week-badge';
            weekBadge.textContent = 'S.' + getWeekNumber(dateObj);
            cell.appendChild(weekBadge);
        }

        // Récupération des profils du jour (Logs + Planning)
        const dayData = getDayProfiles(dateKey); 
        
        const labelsContainer = document.createElement('div');
        labelsContainer.style.cssText = "width: 100%; display: flex; flex-direction: column; align-items: center; gap: 2px; margin-top: 14px; padding: 0 2px; overflow: hidden;";
        
        // On n'affiche l'heure en dessous que s'il y a un profil unique
        const showHours = dayData.list.length === 1;

        dayData.list.forEach(p => {
            // 1. Étiquette du nom du profil
            const label = document.createElement('div');
            label.className = "cal-profile-label";
            label.style.backgroundColor = p.color;
            label.style.color = "#fff";
            label.style.fontSize = "0.75rem"; 
            label.style.width = "95%";
            label.style.textAlign = "center";
            label.style.borderRadius = "3px";
            label.style.whiteSpace = "nowrap";
            label.style.overflow = "hidden";
            label.style.textOverflow = "ellipsis";
            
            if (p.source === 'log') {
                label.innerHTML = `<i class="fas fa-check" style="font-size:0.6rem; margin-right:2px;"></i> ${p.name}`;
            } else {
                label.textContent = p.name;
            }
            labelsContainer.appendChild(label);

            // 2. Affichage de l'heure en dessous (si profil unique)
            if (showHours && p.start && p.end) {
                const timeSpan = document.createElement('span');
                timeSpan.className = "cal-time-label";
                timeSpan.style.fontSize = "0.75rem";
                timeSpan.style.marginTop = "1px";
                timeSpan.style.opacity = "0.9";
                timeSpan.textContent = `${p.start} - ${p.end}`;
                labelsContainer.appendChild(timeSpan);
            }

            // Teinte de la case
            if (cell.style.backgroundColor === "") {
                const hex = p.color;
                const r = parseInt(hex.slice(1, 3), 16);
                const g = parseInt(hex.slice(3, 5), 16);
                const b = parseInt(hex.slice(5, 7), 16);
                cell.style.backgroundColor = `rgba(${r}, ${g}, ${b}, 0.15)`;
            }
        });

        cell.appendChild(labelsContainer);

        if(dayData.note) {
            const noteDiv = document.createElement('div');
            noteDiv.className = "cal-note-preview";
            noteDiv.textContent = dayData.note;
            cell.appendChild(noteDiv);
        }

        cell.addEventListener('touchstart', (e) => startLongPress(dateKey), {passive: true});
        cell.addEventListener('mousedown', (e) => startLongPress(dateKey));
        ['touchend', 'touchmove', 'mouseup', 'mouseleave'].forEach(evt => {
            cell.addEventListener(evt, cancelLongPress);
        });
        cell.onclick = (e) => {
            if(multiSelectMode) toggleBatchSelection(dateKey);
            else openDayModal(dateKey);
        };
        grid.appendChild(cell);
    }
}
    // --- MULTI-SELECT & MODALS ---
    function startLongPress(dateKey) {
        longPressTimer = setTimeout(() => {
            if(!multiSelectMode) {
                enterMultiSelect();
                toggleBatchSelection(dateKey);
                if(navigator.vibrate) navigator.vibrate(50);
            }
        }, 600);
    }
    function cancelLongPress() { clearTimeout(longPressTimer); }
    function enterMultiSelect() {
        multiSelectMode = true;
        selectedBatchDates.clear();
        document.getElementById('multi-select-bar').classList.add('visible');
        renderCalendar();
    }
    function exitMultiSelect() {
        multiSelectMode = false;
        selectedBatchDates.clear();
        document.getElementById('multi-select-bar').classList.remove('visible');
        renderCalendar();
    }
    function toggleBatchSelection(dateKey) {
        if(selectedBatchDates.has(dateKey)) selectedBatchDates.delete(dateKey);
        else selectedBatchDates.add(dateKey);
        document.getElementById('multi-count').textContent = `${selectedBatchDates.size} sélectionné(s)`;
        renderCalendar();
    }

// --- 1. VARIABLE GLOBALE (Indispensable pour stocker le choix) ---
let batchSelectedId = null; 

// --- 2. OUVERTURE DE LA MODAL ---
function openBatchModal() {
    if (selectedBatchDates.size === 0) return alert("Sélectionnez au moins un jour.");

    // Nettoyage préventif
    const existingModal = document.getElementById('dynamic-batch-modal');
    if (existingModal) existingModal.remove();

    // Réinitialisation de la sélection
    batchSelectedId = null;

    // Création de la modal
    const modalDiv = document.createElement('div');
    modalDiv.id = 'dynamic-batch-modal';
    modalDiv.className = 'modal-overlay';
    modalDiv.style.display = 'flex';
    
    // HTML (Liste + Bouton)
    modalDiv.innerHTML = `
        <div class="modal-content" onclick="event.stopPropagation()">
            <h3 style="margin-top:0;">Modifier ${selectedBatchDates.size} jours</h3>
            
            <label>Choisir le profil à appliquer :</label>
            <div id="batch-profiles-list" style="display:flex; flex-direction:column; gap:8px; max-height:300px; overflow-y:auto; margin-bottom:15px;">
                </div>

            <button id="btn-save-batch" class="btn-primary" style="width:100%; margin-top:10px;">Enregistrer</button>
        </div>
    `;

    // Fermeture au clic sur le fond
    modalDiv.onclick = (e) => {
        if (e.target === modalDiv) closeDynamicBatchModal();
    };

    // Ajout au DOM (IMPORTANT : Faire ça AVANT de chercher le bouton par ID)
    document.body.appendChild(modalDiv);

    // Branchement du bouton (Une fois que l'élément est dans la page)
    const btn = document.getElementById('btn-save-batch');
    if (btn) {
        btn.onclick = saveBatchSchedule;
    } else {
        console.error("Erreur : Le bouton de sauvegarde n'a pas été trouvé.");
    }

    // Premier rendu de la liste
    renderBatchListItems();
}

// --- 3. DESSIN DE LA LISTE (Tuiles) ---
function renderBatchListItems() {
    const container = document.getElementById('batch-profiles-list');
    if (!container) return;
    container.innerHTML = ""; 

    // Option Repos
    const isReposSelected = (batchSelectedId === null);
    const reposBtn = document.createElement('div');
    reposBtn.style.cssText = `
        padding: 12px; 
        background: #2c2c2c; 
        border-radius: 8px; 
        cursor: pointer; 
        text-align: center; 
        border: 2px solid ${isReposSelected ? 'var(--primary)' : 'transparent'};
        transition: all 0.2s;
    `;
    reposBtn.innerHTML = `<i class="fas fa-umbrella-beach"></i> Repos / Effacer`;
    reposBtn.onclick = () => {
        batchSelectedId = null;
        renderBatchListItems(); 
    };
    container.appendChild(reposBtn);

    // Liste des profils
    if (typeof profiles !== 'undefined') {
        profiles.forEach(p => {
            const isSelected = (p.id === batchSelectedId);
            const btn = document.createElement('div');
            btn.style.cssText = `
                padding: 10px 15px;
                background: #2c2c2c;
                border-radius: 8px;
                border: 2px solid ${isSelected ? p.color : 'transparent'};
                border-left: 6px solid ${p.color};
                cursor: pointer;
                display: flex;
                justify-content: space-between;
                align-items: center;
                transition: all 0.2s;
            `;
            btn.innerHTML = `
                <div>
                    <strong style="color:${isSelected ? '#fff' : '#aaa'};">${p.name}</strong><br>
                    <small style="color:#666;">${p.start} - ${p.end}</small>
                </div>
                ${isSelected ? `<i class="fas fa-check-circle" style="color:${p.color}"></i>` : ''}
            `;
            btn.onclick = () => {
                batchSelectedId = p.id;
                renderBatchListItems(); 
            };
            container.appendChild(btn);
        });
    }
}

// --- 4. SAUVEGARDE (Version corrigée qui lit la variable) ---
function saveBatchSchedule() {
    const selectedProfileId = batchSelectedId;
    const batchUpdates = {};

    selectedBatchDates.forEach(dateKey => {
        if (selectedProfileId === null) {
            // Suppression
            batchUpdates[dateKey] = null;
        } else {
            // Création / Modif
            const currentNote = (schedule[dateKey] && schedule[dateKey].note) ? schedule[dateKey].note : "";
            batchUpdates[dateKey] = {
                id: parseInt(selectedProfileId), 
                note: currentNote
            };
        }
    });

    // Appel unique qui gère les mois différents automatiquement
    saveBatchScheduleEntries(batchUpdates);
    
    renderCalendar(); 
    closeDynamicBatchModal(); 
    
    if (typeof exitMultiSelect === 'function') {
        exitMultiSelect();
    } else {
        selectedBatchDates.clear();
        const bar = document.getElementById('multi-select-bar');
        if(bar) bar.classList.remove('visible');
        renderCalendar();
    }
}

// --- 5. FERMETURE ---
function closeDynamicBatchModal() {
    const m = document.getElementById('dynamic-batch-modal');
    if (m) m.remove();
}

function openBatchModal() {
    // 1. Sécurité
    if (selectedBatchDates.size === 0) return alert("Sélectionnez au moins un jour.");

    // 2. Nettoyage préventif
    const existingModal = document.getElementById('dynamic-batch-modal');
    if (existingModal) existingModal.remove();

    // 3. Réinitialisation de la sélection (par défaut sur "Rien" ou null)
    batchSelectedId = null;

    // 4. Création du squelette de la modal
    const modalDiv = document.createElement('div');
    modalDiv.id = 'dynamic-batch-modal';
    modalDiv.className = 'modal-overlay';
    modalDiv.style.display = 'flex';
    
    // Structure HTML (Sans bouton annuler, avec conteneur pour la liste)
    modalDiv.innerHTML = `
        <div class="modal-content" onclick="event.stopPropagation()">
            <h3 style="margin-top:0;">Modifier ${selectedBatchDates.size} jours</h3>
            
            <label>Choisir le profil à appliquer :</label>
            <div id="batch-profiles-list" style="display:flex; flex-direction:column; gap:8px; max-height:300px; overflow-y:auto; margin-bottom:15px;"></div>

            <button id="btn-save-batch" class="btn-primary" style="width:100%; margin-top:10px;">Enregistrer</button>
        </div>
    `;

    // 5. Fermeture au clic sur le fond
    modalDiv.onclick = (e) => {
        if (e.target === modalDiv) closeDynamicBatchModal();
    };

    // 6. Ajout au DOM
    document.body.appendChild(modalDiv);

    // 7. Branchement du bouton Sauvegarder
    document.getElementById('btn-save-batch').onclick = saveBatchSchedule;

    // 8. Premier rendu de la liste
    renderBatchListItems();
}

// Fonction interne pour dessiner les tuiles (similaire à renderProfilesInModal)
function renderBatchListItems() {
    const container = document.getElementById('batch-profiles-list');
    if (!container) return;
    container.innerHTML = ""; // On vide

    // --- OPTION A : REPOS / EFFACER ---
    const isReposSelected = (batchSelectedId === null);
    const reposBtn = document.createElement('div');
    reposBtn.style.cssText = `
        padding: 12px; 
        background: #2c2c2c; 
        border-radius: 8px; 
        cursor: pointer; 
        text-align: center; 
        border: 2px solid ${isReposSelected ? 'var(--primary)' : 'transparent'};
        transition: all 0.2s;
    `;
    reposBtn.innerHTML = `<i class="fas fa-umbrella-beach"></i> Repos / Effacer`;
    reposBtn.onclick = () => {
        batchSelectedId = null;
        renderBatchListItems(); // On redessine pour mettre à jour la bordure
    };
    container.appendChild(reposBtn);

    // --- OPTION B : LISTE DES PROFILS ---
    if (typeof profiles !== 'undefined') {
        profiles.forEach(p => {
            // Est-ce que ce profil est celui sélectionné ?
            // Attention : p.id est un nombre, batchSelectedId aussi normalement
            const isSelected = (p.id === batchSelectedId);
            
            const btn = document.createElement('div');
            btn.style.cssText = `
                padding: 10px 15px;
                background: #2c2c2c;
                border-radius: 8px;
                border: 2px solid ${isSelected ? p.color : 'transparent'};
                border-left: 6px solid ${p.color};
                cursor: pointer;
                display: flex;
                justify-content: space-between;
                align-items: center;
                transition: all 0.2s;
            `;
            
            btn.innerHTML = `
                <div>
                    <strong style="color:${isSelected ? '#fff' : '#aaa'};">${p.name}</strong><br>
                    <small style="color:#666;">${p.start} - ${p.end}</small>
                </div>
                ${isSelected ? `<i class="fas fa-check-circle" style="color:${p.color}"></i>` : ''}
            `;
            
            btn.onclick = () => {
                batchSelectedId = p.id;
                renderBatchListItems(); // On redessine pour déplacer la sélection
            };
            container.appendChild(btn);
        });
    }
}



    let tempSelectedProfileId = null; // Variable temporaire pour stocker le choix
function openDayModal(dateKey) {
    selectedDayForModal = dateKey;
    const [y, m, d] = dateKey.split('-');
    document.getElementById('modal-date-title').textContent = `${d}/${m}/${y}`;
    
    const data = getScheduleData(dateKey);
    tempSelectedProfileId = data ? data.id : null;
    document.getElementById('modal-note').value = data ? data.note : "";

    renderProfilesInModal(); // On appelle la fonction pour dessiner la liste
    document.getElementById('day-modal').style.display = 'flex';
}
function renderProfilesInModal() {
    const container = document.getElementById('modal-profiles-list');
    container.innerHTML = "";

    // 1. Option "Repos / Effacer"
    const reposBtn = document.createElement('div');
    reposBtn.style.cssText = `padding:12px; background:#2c2c2c; border-radius:8px; cursor:pointer; text-align:center; border: 2px solid ${tempSelectedProfileId === null ? 'var(--primary)' : 'transparent'};`;
    reposBtn.innerHTML = `<i class="fas fa-umbrella-beach"></i> Repos / Aucun`;
    reposBtn.onclick = () => { tempSelectedProfileId = null; renderProfilesInModal(); };
    container.appendChild(reposBtn);

    // 2. Liste des profils
    profiles.forEach(p => {
        const isSelected = p.id == tempSelectedProfileId;
        const btn = document.createElement('div');
        btn.style.cssText = `
            padding: 10px 15px;
            background: #2c2c2c;
            border-radius: 8px;
            border: 2px solid ${isSelected ? p.color : 'transparent'};
            border-left: 6px solid ${p.color};
            cursor: pointer;
            display: flex;
            justify-content: space-between;
            align-items: center;
            transition: all 0.2s;
        `;
        
        btn.innerHTML = `
            <div>
                <strong style="color:${isSelected ? '#fff' : '#aaa'};">${p.name}</strong><br>
                <small style="color:#666;">${p.start} - ${p.end}</small>
            </div>
            ${isSelected ? `<i class="fas fa-check-circle" style="color:${p.color}"></i>` : ''}
        `;
        
        btn.onclick = () => {
            tempSelectedProfileId = p.id;
            renderProfilesInModal(); // Rafraîchir pour montrer la sélection
        };
        container.appendChild(btn);
    });
}
    function closeModal(e, id) { if(e.target.id === id) document.getElementById(id).style.display = 'none'; }

function saveDaySchedule() {
    const val = tempSelectedProfileId; // On utilise la variable mise à jour par les clics
    const noteVal = document.getElementById('modal-note').value;
    const dateKey = selectedDayForModal;

let dataToSave = null;
    if (val !== null || noteVal !== "") {
        dataToSave = { id: parseInt(val), note: noteVal };
    }
saveScheduleEntry(dateKey, dataToSave);

    const pid = val === null ? null : parseInt(val);
    if (pid) schedule[dateKey] = { id: pid, note: noteVal };
    else delete schedule[dateKey];

    const p = profiles.find(x => x.id === pid);
    
    if (pid && p && p.days && p.days.length > 0) {
        document.getElementById('confirm-week-modal').style.display = 'flex';
        // Les boutons "Toute la semaine" / "Ce jour" restent les mêmes
        document.getElementById('btn-apply-week').onclick = () => {
            fillWeekWithProfile(dateKey, pid, p.days);
            closeAndRefresh();
        };
        document.getElementById('btn-apply-day').onclick = () => closeAndRefresh();
    } else {
        closeAndRefresh();
    }
}
// Fonction utilitaire pour fermer et rafraîchir
function closeAndRefresh() {
    //saveData();
    renderCalendar();
    document.getElementById('day-modal').style.display = 'none';
    document.getElementById('confirm-week-modal').style.display = 'none';
}
function fillWeekWithProfile(refDateKey, profileId, activeDays) {
    const refDate = new Date(refDateKey + 'T12:00:00');
    const dayOfWeek = refDate.getDay(); 
    
    // Calage sur le Lundi
    const distToMon = (dayOfWeek + 6) % 7;
    const monday = new Date(refDate);
    monday.setDate(refDate.getDate() - distToMon);

    const batchUpdates = {}; // Le panier des modifications

    for (let i = 0; i < 7; i++) {
        // Si ce jour de la semaine n'est pas sélectionné dans le profil, on passe
        if (!activeDays.includes(i)) continue;

        const d = new Date(monday);
        d.setDate(monday.getDate() + i);
        const k = d.toISOString().split('T')[0];
        
        // --- LA MODIFICATION EST ICI ---
        // On vérifie si une donnée existe déjà pour cette date 'k'
        if (schedule[k]) {
            // Si oui, on ne touche à rien, on passe au jour suivant
            continue; 
        }
        // -------------------------------
        
        // Si on arrive ici, c'est que la case est vide, donc on remplit
        batchUpdates[k] = { id: profileId, note: "" };
    }

    // On lance la sauvegarde seulement s'il y a des choses à modifier
    if (Object.keys(batchUpdates).length > 0) {
        saveBatchScheduleEntries(batchUpdates);
    } else {
        console.log("Aucun jour vide trouvé, aucune modification effectuée.");
    }
}

    // --- LOGIQUE CHRONO ---
    function checkAlreadyLogged() {
        const container = document.getElementById('already-logged-container');
        const today = new Date();
        const todayIso = today.toISOString().split('T')[0];

        let todayLogs = [];
        if (getStorageKey(currentHistoryDate) === getStorageKey(today)) {
            todayLogs = logs;
        } else {
            const key = getStorageKey(today);
            const raw = localStorage.getItem(key);
            todayLogs = raw ? JSON.parse(raw) : [];
        }

        const todaysLogsFiltered = todayLogs.filter(l => {
             if(l.dateStr) return l.dateStr === todayIso;
             const parts = l.date.split('/');
             const d = new Date(parts[2], parts[1]-1, parts[0]);
             return d.toISOString().split('T')[0] === todayIso;
        });

        if(todaysLogsFiltered.length > 0) {
            container.style.display = "block";
            container.innerHTML = "";
            todaysLogsFiltered.forEach(l => {
                const div = document.createElement('div');
                div.className = "already-logged-info";
                div.innerHTML = `<i class="fas fa-check-circle"></i> Déjà enregistré : <strong>${l.startTime} - ${l.endTime}</strong>`;
                container.appendChild(div);
            });
        } else {
            container.style.display = "none";
        }
    }

function checkTodaySchedule() {
    const infoBox = document.getElementById('today-schedule-info');
    const timerUi = document.getElementById('timer-ui');
    const btnText = document.getElementById('btn-change-profile-text');
    const profileNameDisplay = document.getElementById('today-profile-name');
    const hoursDisplay = document.getElementById('today-profile-hours');
    
    const todayKey = new Date().toISOString().split('T')[0];

    // On s'assure que l'infoBox est TOUJOURS visible
    infoBox.style.display = "block";

    // --- 1. SI UN CHRONO EST EN COURS ---
    if (currentSession) {
        const p = currentSession.profileSnap || profiles.find(x => x.id === currentSession.profileId);
        if (p) {
            const accentColor = getAccentColor(p.color);
            
            profileNameDisplay.textContent = "En cours : " + p.name;
            profileNameDisplay.style.color = accentColor;
            hoursDisplay.textContent = `${p.start} - ${p.end}`;
            
            timerUi.style.borderColor = accentColor;
            timerUi.style.boxShadow = `0 0 30px ${accentColor}40`;
            
            btnText.textContent = "Modifier le profil actuel";
            
            // Mise à jour de la couleur de statut et du thème global
            document.getElementById('timer-status').style.color = accentColor;
            updateThemeColor('page-chrono');
            return; 
        }
    }

    // --- 2. SI UN POINTAGE EST DÉJÀ FINI POUR AUJOURD'HUI ---
    // On cherche dans les logs du mois en cours
    const alreadyLogged = logs.find(l => l.dateStr === todayKey);
    
    // On vérifie le planning
    const data = getScheduleData(todayKey);
    let plannedProfile = null;
    if (data && data.id) {
        const baseP = profiles.find(x => x.id === data.id);
        if (baseP) plannedProfile = getProfileParams(baseP, new Date());
    }

    if (alreadyLogged) {
        profileNameDisplay.textContent = "Pointage terminé";
        profileNameDisplay.style.color = "var(--success)"; // Vert succès par défaut
        hoursDisplay.textContent = `Dernier : ${alreadyLogged.startTime} - ${alreadyLogged.endTime}`;
        timerUi.style.borderColor = "#333";
        timerUi.style.boxShadow = "none";
        btnText.textContent = "Créer un nouveau pointage";
    } 
    // --- 3. SI PLANNING DÉFINI (MAIS PAS ENCORE POINTÉ) ---
    else if (plannedProfile) {
        const accentColor = getAccentColor(plannedProfile.color);
        
        profileNameDisplay.textContent = plannedProfile.name + (data.note ? ` (${data.note})` : "");
        profileNameDisplay.style.color = accentColor;
        hoursDisplay.textContent = `${plannedProfile.start} - ${plannedProfile.end}`;
        
        timerUi.style.borderColor = accentColor;
        timerUi.style.boxShadow = `0 0 20px ${accentColor}20`;
        btnText.textContent = "Modifier le profil prévu";
    }
    // --- 4. SI RIEN AU PLANNING ET PAS DE CHRONO ---
    else {
        profileNameDisplay.textContent = "Rien de défini";
        profileNameDisplay.style.color = "#888"; 
        hoursDisplay.textContent = "Choisissez un profil pour pointer";
        timerUi.style.borderColor = "#333";
        timerUi.style.boxShadow = "none";
        btnText.textContent = "Choisir un profil";
    }

    // On rafraîchit la couleur primaire de l'interface (icônes, etc.)
    updateThemeColor('page-chrono');
}
function toggleTimer() {
    if (!currentSession) {
        const today = new Date();
        const todayIso = today.toISOString().split('T')[0];
        tempSelectedProfileId = null;
        // 1. Déterminer quel profil utiliser
        // Priorité : 1. Choix manuel via ton bouton | 2. Planning
        let pid = tempSelectedProfileId; // La variable mise à jour par ton bouton "crayon"

        if (!pid) {
            const data = getScheduleData(todayIso);
            if (data) pid = data.id;
        }

if (!pid) {
            autoStartAfterProfileSelection = true; // On lève le drapeau !
            openChangeProfileModal(); // On ouvre la liste
            return;
        }

        // 2. Vérification si déjà pointé aujourd'hui
        let todayLogs = [];
        const key = getStorageKey(today);
        const raw = localStorage.getItem(key);
        todayLogs = raw ? JSON.parse(raw) : [];
        const alreadyLog = todayLogs.some(l => (l.dateStr || '').startsWith(todayIso));

        if(alreadyLog && !confirm("Déjà pointé aujourd'hui. Continuer ?")) return;

        // 3. Lancement de la session
        const baseP = profiles.find(x => x.id === pid);
        const pSnapshot = getProfileParams(baseP, today);
        
        currentSession = { 
            start: Date.now(), 
            profileId: pid, 
            profileSnap: pSnapshot 
        };
        
        saveData();
        restoreTimerUI();
        tempSelectedProfileId = null; // Reset pour la prochaine fois

    } else {
        stopTimer();
    }
}
function restoreTimerUI() {
    if (!currentSession) return;

    // Sécurité : on récupère le snapshot ou le profil, avec un repli (fallback)
    const p = currentSession.profileSnap || profiles.find(x => x.id === currentSession.profileId) || { color: '#3498db', name: 'Inconnu', start: '--:--', end: '--:--' };
    if (!p) return;


const profileNameDisplay = document.getElementById('today-profile-name');
    if (profileNameDisplay) {
        profileNameDisplay.textContent = "En cours : " + p.name;
        profileNameDisplay.style.color = p.color;
    }
    document.getElementById('today-profile-hours').textContent = `${p.start} - ${p.end}`;


        const btn = document.getElementById('btn-main-action');
        const ui = document.getElementById('timer-ui');

    // Utilisation d'une couleur par défaut si p.color est absent pour une raison X
    const accentColor = p.color || '#3498db';

    ui.style.borderColor = accentColor;
    ui.style.boxShadow = `0 0 30px ${accentColor}60`;

const nameDisp = document.getElementById('today-profile-name');
    nameDisp.style.color = accentColor;


    document.getElementById('timer-status').textContent = "EN COURS";
    document.getElementById('timer-status').style.color = accentColor;
    
    btn.textContent = "TERMINER";
    btn.className = "btn-primary btn-danger";
    
    document.getElementById('active-edit-btn').style.display = 'block';
    document.getElementById('active-start-val').textContent = new Date(currentSession.start).toLocaleTimeString('fr-FR', {hour:'2-digit', minute:'2-digit'});
    document.getElementById('estimated-end-block').style.display = 'block';

    if(typeof Android !== 'undefined' && Android.startChrono) {
        Android.startChrono(p.end);
    }

    startInterval();
}

function editActiveStartTime() {
    if(!currentSession) return;
    
    // On récupère l'heure actuelle du chrono pour pré-remplir l'input
    const startDate = new Date(currentSession.start);
    const hh = startDate.getHours().toString().padStart(2, '0');
    const mm = startDate.getMinutes().toString().padStart(2, '0');
    
    document.getElementById('edit-active-start-input').value = `${hh}:${mm}`;
    document.getElementById('edit-start-modal').style.display = 'flex';
}
function saveActiveStartTime() {
    const newVal = document.getElementById('edit-active-start-input').value;
    if(!newVal) return;

    const [h, m] = newVal.split(':').map(Number);
    const now = new Date();
    let startDate = new Date(); // On part d'aujourd'hui par défaut

    // Convertir les deux heures en minutes depuis minuit pour comparer
    const minsSaisies = h * 60 + m;
    const minsActuelles = now.getHours() * 60 + now.getMinutes();

    // LOGIQUE : Si l'heure saisie est supérieure à l'heure actuelle
    // (ex: saisie 22:00 alors qu'il est 08:00 du matin)
    if (minsSaisies > minsActuelles) {
        startDate.setDate(startDate.getDate() - 1); // Passer au timestamp d'hier
    }

    startDate.setHours(h, m, 0, 0);
    
    // Mise à jour de la session avec le timestamp précis (hier ou aujourd'hui)
    currentSession.start = startDate.getTime();
    saveData();
    
    // Mise à jour de l'affichage (on peut ajouter "Hier" visuellement pour confirmer)
    const prefix = (minsSaisies > minsActuelles) ? "Hier " : "";
    document.getElementById('active-start-val').textContent = prefix + newVal;
    
    document.getElementById('edit-start-modal').style.display = 'none';
    
    // Relancer l'intervalle pour recalculer la durée totale et la fin prévue
    startInterval();
}
function startInterval() {
    if (timerInterval) clearInterval(timerInterval);
    
    // 1. SÉCURITÉ : Vérifier si la session existe
    if (!currentSession) return;

    // 2. SÉCURITÉ : Trouver le profil ou utiliser un profil par défaut (fallback)
const p = currentSession.profileSnap || profiles.find(x => x.id === currentSession.profileId);
    
    if (!p || !p.start || !p.end) {
        console.warn("Profil manquant pour le chrono actif.");
        
        // Au lieu de crash, on demande à l'utilisateur de choisir
        const choice = alert("Le profil utilisé pour ce chrono n'existe plus. Veuillez le sélectionner à nouveau.");
        
        // On affiche le chrono simple en attendant
        runSimpleTimer(); 
        
        // On affiche le sélecteur manuel pour qu'il puisse corriger
        document.getElementById('no-schedule-warning').style.display = 'block';
        return;
    }
    // Calcul de la fin prévue
    const [hS, mS] = p.start.split(':').map(Number);
    const [hE, mE] = p.end.split(':').map(Number);
    let spanMins = (hE * 60 + mE) - (hS * 60 + mS);
    if(spanMins < 0) spanMins += 1440;
    const targetTimestamp = currentSession.start + (spanMins * 60000);

    const estimatedEndEl = document.getElementById('estimated-end-display');
    if (estimatedEndEl) estimatedEndEl.textContent = p.end;

    timerInterval = setInterval(() => {
        const now = Date.now();
        
        // Calcul du temps écoulé réel
        const diff = now - currentSession.start;
        const absDiff = Math.max(0, diff);

        const hrs = Math.floor(absDiff / 3600000);
        const mins = Math.floor((absDiff % 3600000) / 60000);
        const secs = Math.floor((absDiff % 60000) / 1000);
        
        const displayEl = document.getElementById('timer-display');
        if (displayEl) {
            displayEl.textContent = `${hrs.toString().padStart(2,'0')}:${mins.toString().padStart(2,'0')}:${secs.toString().padStart(2,'0')}`;
        }

        // Gestion des Heures Sup
        const otBlock = document.getElementById('overtime-timer-block');
        const otDisplay = document.getElementById('overtime-timer-display');
        
        if (otBlock && otDisplay) {
            if(now > targetTimestamp) {
                const otDiff = now - targetTimestamp;
                const oHrs = Math.floor(otDiff / 3600000);
                const oMins = Math.floor((otDiff % 3600000) / 60000);
                const oSecs = Math.floor((otDiff % 60000) / 1000);
                otDisplay.textContent = `+ ${oHrs.toString().padStart(2,'0')}:${oMins.toString().padStart(2,'0')}:${oSecs.toString().padStart(2,'0')}`;
                otBlock.style.display = 'block';
            } else {
                otBlock.style.display = 'none';
            }
        }
    }, 1000);
}

// Fonction de secours si le profil est corrompu (affiche juste le temps qui passe)
function runSimpleTimer() {
    timerInterval = setInterval(() => {
        if (!currentSession) return clearInterval(timerInterval);
        const diff = Date.now() - currentSession.start;
        const hrs = Math.floor(diff / 3600000);
        const mins = Math.floor((diff % 3600000) / 60000);
        const secs = Math.floor((diff % 60000) / 1000);
        document.getElementById('timer-display').textContent = 
            `${hrs.toString().padStart(2,'0')}:${mins.toString().padStart(2,'0')}:${secs.toString().padStart(2,'0')}`;
    }, 1000);
}
function resetTimerUI() {
    document.getElementById('timer-display').textContent = "00:00";
    document.getElementById('timer-status').textContent = "PRÊT";
    document.getElementById('timer-status').style.color = "#aaa";
    document.getElementById('timer-ui').style.borderColor = "#333";
    document.getElementById('timer-ui').style.boxShadow = "none";
    
    const btn = document.getElementById('btn-main-action');
    btn.textContent = "POINTER L'ENTRÉE";
    btn.className = "btn-primary";
    
    document.getElementById('active-edit-btn').style.display = 'none';
    document.getElementById('estimated-end-block').style.display = 'none';
    document.getElementById('overtime-timer-block').style.display = 'none';
}
function stopTimer() {
    // 1. Vérification cruciale de la session
    if (!currentSession || !currentSession.start) {
        console.warn("Session introuvable ou corrompue, réinitialisation de l'UI.");
        resetTimerUI();
        return;
    }

    const end = Date.now();
    // 2. Vérification du profil
    const p = currentSession.profileSnap || profiles.find(x => x.id === currentSession.profileId);
    
    if (!p) {
        alert("Erreur : Impossible de retrouver le profil de cette session.");
        resetTimerUI();
        return;
    }

    const actualStartMs = currentSession.start;
    


// Calcul de la durée à enregistrer (respecte le switch)
const [hS, mS] = p.start.split(':').map(Number);
const startTimeTheo = new Date(actualStartMs);
startTimeTheo.setHours(hS, mS, 0, 0);

let durationToSave = end - actualStartMs;
if (appSettings.ignoreEarlyStart && actualStartMs < startTimeTheo.getTime()) {
    durationToSave = end - startTimeTheo.getTime();
}

const rawOvertimeMs = calculateOvertime(end - actualStartMs, p, actualStartMs);

pendingLogData = {
    dateStr: new Date(actualStartMs).toISOString().split('T')[0],
    date: new Date(actualStartMs).toLocaleDateString('fr-FR'),
    startTime: new Date(actualStartMs).toLocaleTimeString('fr-FR', {hour:'2-digit', minute:'2-digit'}),
    endTime: new Date(end).toLocaleTimeString('fr-FR', {hour:'2-digit', minute:'2-digit'}),
    duration: durationToSave,
    overtime: rawOvertimeMs,
    profileName: p.name,
    color: p.color,
    profileSnap: p
};

if(appSettings.countOvertime && rawOvertimeMs > 0) {
    document.getElementById('ot-modal-text').textContent = "Vous avez dépassé l'horaire de " + msToTime(rawOvertimeMs);
    document.getElementById('ot-comment-input').value = "";
    document.getElementById('ot-comment-modal').style.display = 'flex';
} else {
    finalizeStopTimer();
}
}

function finalizeStopTimer() {
    // 1. Récupération des infos brutes (Saisie utilisateur + Chrono)
    const comment = document.getElementById('ot-comment-input').value;
    const takeAccount = document.getElementById('ot-modal-take-account').checked;
    
    const actualStartMs = currentSession.start;
    const endMs = Date.now();
    const p = pendingLogData.profileSnap; // Le profil utilisé

    // 2. Création d'une coquille vide (Brouillon minimaliste)
    // On met 0 partout pour les calculs, la modale va tout écraser.
    const draftLog = {
        dateStr: new Date(actualStartMs).toISOString().split('T')[0],
        date: new Date(actualStartMs).toLocaleDateString('fr-FR'),
        startTime: new Date(actualStartMs).toLocaleTimeString('fr-FR', {hour:'2-digit', minute:'2-digit'}),
        endTime: new Date(endMs).toLocaleTimeString('fr-FR', {hour:'2-digit', minute:'2-digit'}),
        
        profileName: p.name,
        color: p.color,
        profileSnap: p,
        
        // Données fictives temporaires (seront recalculées par saveLogEdit)
        duration: 0, 
        overtime: 0,
        validatedOtMins: null,
        
        comment: comment,       // On passe le commentaire
        ignoreOT: !takeAccount  // On passe le choix de l'utilisateur
    };

    // 3. Injection du brouillon en position 0 (Le plus récent)
    // Cela permet à openEditLogModal(0) de lire ces données
    const targetKey = getStorageKey(draftLog.dateStr);
    const currentViewKey = getStorageKey(currentHistoryDate);
    
    // Gestion multi-mois (rare mais propre)
    if (targetKey !== currentViewKey) {
        // Si on change de mois, on force la vue sur le mois du log pour que l'édition marche
        currentHistoryDate = new Date(draftLog.dateStr);
        loadLogsForView();
    }
    
    logs.unshift(draftLog);
    saveLogsCurrentView(); // Sauvegarde temporaire

    // =========================================================
    // 4. LE TRAITEMENT EN ARRIÈRE-PLAN (La "Magie")
    // =========================================================
    
    const editModal = document.getElementById('edit-log-modal');
    
    // A. On cache visuellement la fenêtre, mais on l'active dans le DOM
    editModal.style.visibility = 'hidden'; 
    editModal.style.display = 'flex'; 

    // B. On ouvre la modale sur notre brouillon (Index 0)
    // -> openEditLogModal va lire Start/End et calculer l'Overtime brut théorique
    openEditLogModal(0);

    // C. On force les réglages spécifiques du Stop Timer
    // (Le switch "Compter les HS" et le commentaire)
    document.getElementById('edit-log-take-account').checked = takeAccount;
    document.getElementById('edit-log-comment').value = comment;

    // D. IMPORTANT : On lance le calcul du champ "HS Validées" (l'input time)
    // C'est cette fonction qui applique le palier (15min) et remplit l'input
    updateEditLogPreview(); 

    // E. On valide !
    // saveLogEdit va lire les inputs, recalculer la durée exacte (nuit, ignore early...) et sauvegarder proprement.
    saveLogEdit();

    // F. On restaure l'état normal de la modale (au cas où)
    editModal.style.visibility = 'visible';

    // =========================================================

    // 5. Nettoyage final (Session terminée)
    currentSession = null;
    pendingLogData = null;
    if (timerInterval) clearInterval(timerInterval);
    saveData(); // Sauvegarde l'état "plus de session active"

    // 6. Android
    if(typeof Android !== 'undefined' && Android.stopChrono) {
        Android.stopChrono();
    }

    // 7. Reset UI
    document.getElementById('ot-comment-modal').style.display = 'none';
    resetTimerUI();
    renderHistory();       // Affiche la belle ligne calculée
    checkAlreadyLogged();
    checkTodaySchedule();

    // 8. Go Historique
    const historyBtn = document.querySelector('.nav-item[onclick*="page-history"]');
    navTo('page-history', historyBtn);
}

    // --- GESTION AJOUT MANUEL LOG ---
    function openAddLogModal() {
        const today = new Date().toISOString().split('T')[0];
        document.getElementById('add-log-date').value = today;
        document.getElementById('add-log-start').value = "08:00";
        document.getElementById('add-log-end').value = "16:00";
        document.getElementById('add-log-comment').value = "";
        const select = document.getElementById('add-log-profile');
        select.innerHTML = '<option value="">Sélectionner...</option>';
        profiles.forEach(p => { select.innerHTML += `<option value="${p.id}">${p.name}</option>`; });
        document.getElementById('add-log-modal').style.display = 'flex';
    }

    function fillAddLogHours() {
        const id = document.getElementById('add-log-profile').value;
        if(!id) return;
        const p = profiles.find(x => x.id == id);
        if(p) {
            document.getElementById('add-log-start').value = p.start;
            document.getElementById('add-log-end').value = p.end;
        }
    }
function saveManualLog() {
    const dateVal = document.getElementById('add-log-date').value;
    const pid = document.getElementById('add-log-profile').value;
    const startVal = document.getElementById('add-log-start').value;
    const endVal = document.getElementById('add-log-end').value;
    const comment = document.getElementById('add-log-comment').value;

    if(!dateVal || !pid || !startVal || !endVal) return alert("Remplissez tous les champs obligatoires");

    const pBase = profiles.find(x => x.id == pid);
    const [y, m, d] = dateVal.split('-').map(Number);
    let dateObj = new Date(y, m-1, d); // Date affichée sur le calendrier

    const [h1, m1] = startVal.split(':').map(Number);
    const [h2, m2] = endVal.split(':').map(Number);

    // LOGIQUE : Si l'heure de début est mathématiquement après l'heure de fin (ex: 23:00 > 07:00)
    // On considère que le début était hier par rapport à la date de fin saisie.
    if (h1 > h2) {
        dateObj.setDate(dateObj.getDate() - 1);
    }

    const actualStartMs = new Date(dateObj).setHours(h1, m1, 0, 0);
    
    // La fin est toujours sur la date saisie (aujourd'hui par rapport à hier)
    let actualEndMs = new Date(y, m-1, d).setHours(h2, m2, 0, 0);

    // Calcul Durée Théorique
    const p = getProfileParams(pBase, new Date(y, m-1, d));
    const [phS, pmS] = p.start.split(':').map(Number);
    let theoStartMs = new Date(dateObj).setHours(phS, pmS, 0, 0);

    const totalDurationMs = actualEndMs - actualStartMs;
    let durationToSave = totalDurationMs;

    if (appSettings.ignoreEarlyStart && actualStartMs < theoStartMs) {
        durationToSave = Math.max(0, actualEndMs - theoStartMs);
    }

    const otMs = calculateOvertime(totalDurationMs, p, actualStartMs);

    const newLog = {
        dateStr: dateVal, // On garde la date de saisie pour l'historique
        date: new Date(y, m-1, d).toLocaleDateString('fr-FR'),
        startTime: startVal,
        endTime: endVal,
        duration: durationToSave,
        overtime: otMs,
        profileName: p.name,
        color: p.color,
        profileSnap: p,
        comment: comment,
        ignoreOT: false
    };

    const targetKey = getStorageKey(newLog.dateStr);
    if (targetKey === getStorageKey(currentHistoryDate)) logs.unshift(newLog);
    
    saveLogToStorage(newLog);
    renderHistory();
    document.getElementById('add-log-modal').style.display = 'none';
}


    // --- HISTORIQUE & EDITION ---
    function changeHistoryMonth(delta) {
        currentHistoryDate.setMonth(currentHistoryDate.getMonth() + delta);
        loadLogsForView();
        renderHistory();
    }

/*
 * Calcule toutes les métriques pour une entrée (Durée réelle, HS, Nuit, Pertes...)
 * CORRECTION : Suppression de la double déduction de l'avance.
 */
/**
 * Calcule toutes les métriques pour une entrée
 * CORRECTION : Si ignoreOT est true, on ne compte PAS les HS nuit en nuit standard.
 */
function calculateLogMetrics(log) {
    // Conversion Date
    let dLog = log.dateStr ? new Date(log.dateStr) : new Date(log.date.split('/').reverse().join('-'));
    
    // --- 1. GESTION DE L'AVANCE (IGNORE EARLY) ---
    const pSnap = log.profileSnap || profiles.find(pr => pr.name === log.profileName);
    let calcStartTime = log.startTime; 

    if (appSettings.ignoreEarlyStart && pSnap && pSnap.start) {
        const [hAct, mAct] = log.startTime.split(':').map(Number);
        const [hTheo, mTheo] = pSnap.start.split(':').map(Number);
        if (hAct < hTheo || (hAct === hTheo && mAct < mTheo)) {
            calcStartTime = pSnap.start; 
        }
    }

    // --- 2. Valeurs de base ---
    let rawDuration = log.duration;
    let rawOtMs = log.overtime;
    if(rawOtMs < 0 && appSettings.countNegative === false) rawOtMs = 0;
    
    // --- 3. Palier (Step) sur les HS ---
    const stepVal = Math.max(1, parseInt(appSettings.otStep) || 15);
    const stepMs = stepVal * 60000;
    const isOTEnabled = appSettings.countOvertime && !log.ignoreOT;
    
    let validOtMs = 0;
    let cutOtMs = 0; 

    if (rawOtMs > 0 && isOTEnabled) {
        if (log.validatedOtMins !== undefined && log.validatedOtMins !== null) {
            let limitMs = log.validatedOtMins * 60000;
            if (rawOtMs > limitMs) {
                validOtMs = limitMs;
                cutOtMs = rawOtMs - limitMs;
            } else {
                validOtMs = rawOtMs;
                cutOtMs = 0;
            }
        } else {
            // Arrondi à l'inférieur selon le palier (ex: 32min -> 30min, cut = 2min)
            validOtMs = Math.floor(rawOtMs / stepMs) * stepMs;
            cutOtMs = rawOtMs - validOtMs;
        }
    }

    // --- 4. Calcul Nuit ---
    let rawNightStandardMs = 0;
    let validNightOtMs = 0;
    let validEndStr = log.endTime; 

    if (typeof getNightDuration === 'function' && rawDuration > 0) {
        const endParts = log.endTime.split(':').map(Number);
        let dEnd = new Date(dLog); dEnd.setHours(endParts[0], endParts[1], 0, 0);
        const startParts = log.startTime.split(':').map(Number);
        
        if (endParts[0] < startParts[0] || (endParts[0] === startParts[0] && endParts[1] < startParts[1])) {
            dEnd.setDate(dEnd.getDate() + 1);
        }

        // Si HS activées : On recule la fin de l'arrondi (cutOtMs) pour calculer la nuit sur la période "validée"
        // Si HS désactivées : On recule de la totalité des HS pour ne compter que la nuit standard
        const timeToCutFromEnd = isOTEnabled ? cutOtMs : (rawOtMs > 0 ? rawOtMs : 0);
        
        const validEndMs = dEnd.getTime() - timeToCutFromEnd;
        validEndStr = new Date(validEndMs).toLocaleTimeString('fr-FR', {hour:'2-digit', minute:'2-digit'});

        // A. Part Nuit dans les HS validées
        if (validOtMs > 0) {
            const otStartMs = validEndMs - validOtMs;
            validNightOtMs = getNightDuration({
                startTime: new Date(otStartMs).toLocaleTimeString('fr-FR', {hour:'2-digit', minute:'2-digit'}),
                endTime: validEndStr, 
                dateStr: log.dateStr
            });
        }

        // B. Nuit Totale sur la période validée (HS incluses si activées)
        const totalNightValidDuration = getNightDuration({
            startTime: calcStartTime, 
            endTime: validEndStr,
            dateStr: log.dateStr
        });

        // C. Nuit Standard = Totale validée - Nuit des HS
        rawNightStandardMs = Math.max(0, totalNightValidDuration - validNightOtMs);
    }

    // --- 5. Coupe de la Nuit Standard (Optionnel selon besoin d'arrondi sur la nuit hors HS) ---
    let validNightStandardMs = Math.floor(rawNightStandardMs / stepMs) * stepMs;
    let cutNightMs = rawNightStandardMs - validNightStandardMs; 

    // --- 6. Totaux Finaux ---
    // La durée effective est la durée brute moins tout ce qui a été "coupé" par les arrondis
    // Si les HS sont désactivées, on retire aussi la totalité des HS
    let totalLostMs = cutOtMs + cutNightMs;
    let effectiveDuration = rawDuration - totalLostMs;
    
    if (!isOTEnabled && rawOtMs > 0) {
        effectiveDuration -= (rawOtMs - cutOtMs); // On retire le reste des HS non traitées par cutOtMs
    }

    // --- 7. Données visuelles ---
    const [hStart, mStart] = log.startTime.split(':').map(Number);
    const [hEnd, mEnd] = log.endTime.split(':').map(Number);
    let startM = hStart * 60 + mStart;
    let endM = hEnd * 60 + mEnd;
    if (endM <= startM) endM += 1440;
    const visualDurationMs = (endM - startM) * 60000;

    return {
        dLog,
        pSnap,
        effectiveDuration,
        visualDurationMs,
        validOtMs,
        validNightOtMs,
        validNightStandardMs,
        totalLostMs,
        surplusOtMs: cutOtMs, // surplusOtMs devient synonyme de cutOtMs pour l'UI
        isOTEnabled
    };
}
function createLogCardHTML(log, metrics, index) {
    const { dLog, pSnap, effectiveDuration, visualDurationMs, validOtMs, surplusOtMs, validNightOtMs, validNightStandardMs } = metrics;
    const todayStr = new Date().toISOString().split('T')[0];

    // Formatage de la date (ex: Jeu 1 Janv)
    const dateOptions = { weekday: 'short', day: 'numeric', month: 'short' };
    let displayDate = dLog.toLocaleDateString('fr-FR', dateOptions)
        .replace(/\./g, '') 
        .replace(/^\w/, c => c.toUpperCase());
    
    const displayP = pSnap || {name: "?", color: "#ccc", start: "--:--", end: "--:--"};
    const baseColor = log.color || displayP.color;
const accentColor = getAccentColor(baseColor); // <--- Ici
const bgColor = accentColor.replace('rgb', 'rgba').replace(')', ', 0.1)');
    // --- 1. LOGIQUE DES BOUTONS ---
    // Reprendre le chrono (uniquement si c'est aujourd'hui)
    const resumeBtn = (log.dateStr === todayStr && !currentSession) 
        ? `<button class="btn-icon-action" style="color:var(--success);" onclick="resumeLog(${index})"><i class="fas fa-play" style="font-size: 0.9rem;"></i></button>` 
        : "";

    // Ajouter une note (si pas de commentaire et présence de HS)
    const showAddNoteBtn = (!log.comment || log.comment.trim() === "") && (validOtMs > 0);
    const addNoteBtn = showAddNoteBtn
        ? `<button class="btn-icon-action" style="color:#f1c40f;" onclick="openQuickComment(${index})" title="Justifier les HS"><i class="fas fa-comment-medical"></i></button>`
        : "";

    // --- 2. LOGIQUE DES BADGES HS (Vert / Rouge) ---
// --- 2. LOGIQUE DES BADGES HS (Vert / Rouge) ---
    let badgesHS_HTML = "";
    
    // Calcul de la part HS Jour (Total validé moins la part de nuit dans ces HS)
    const validDayOtMs = validOtMs - validNightOtMs;

    if (validOtMs > 0) {
        // On affiche le badge vert SEULEMENT si la part de jour est supérieure à 0
        if (validDayOtMs > 0) {
            badgesHS_HTML += `<span class="overtime-badge ot-pos">+ ${msToTime(validDayOtMs)}</span>`;
        }
    }

    if (surplusOtMs > 0) {
        // Le surplus "coupé" par l'arrondi (en rouge)
        badgesHS_HTML += `
            <span class="overtime-badge" style="background:rgba(231, 76, 60, 0.2); color:#e74c3c; border:1px solid #e74c3c; margin-left:4px;">
                <i class="fas fa-cut"></i> ${msToTime(surplusOtMs)}
            </span>`;
    }

    // --- 3. GESTION DU COMMENTAIRE ---
    let commentHTML = "";
    if (log.comment && log.comment.trim() !== "") {
        commentHTML = `
        <div style="font-size: 0.8rem; color: #aaa; background: rgba(255,255,255,0.05); padding: 6px 10px; border-radius: 6px; margin-top: 8px; display: flex; align-items: center; gap: 8px; border-left: 2px solid var(--warning);">
            <i class="fas fa-comment-dots" style="font-size: 0.7rem; color: var(--warning);"></i>
            <span>${log.comment}</span>
        </div>`;
    }

    // --- 4. RENDU FINAL ---
    return `
<div class="card history-item" style="background-color: ${bgColor}; border-left: 5px solid ${accentColor}; padding: 12px; margin-bottom: 10px;">        <div class="history-item-top" style="display: flex; justify-content: space-between; gap: 10px;">
            <div style="flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px;">
                <div style="display: flex; align-items: baseline; gap: 6px;">
                    <strong style="font-size:0.9rem;">${displayDate}</strong>
                    <span style="font-size:0.8rem; opacity:0.8; color:${accentColor}; font-weight:bold;">${displayP.name}</span>
                </div>
                
   

                <div style="font-size:0.95rem; font-weight:bold; color:#fff;">
                    ${log.startTime} - ${log.endTime} <span style="font-weight:normal; font-size:0.8rem; color:#888;">(${msToTime(visualDurationMs)})</span>
                </div>
                     <div style="font-size:0.9rem; color:#888; margin-bottom:2px;">
                    Prévu : ${displayP.start} - ${displayP.end}
                </div>
                ${commentHTML}
            </div>

            <div style="text-align:right;">
                <div style="font-weight:bold; font-size:1.1rem; color:#fff;">${msToTime(effectiveDuration)}</div>
                
                <div style="display: flex; gap: 4px; justify-content: flex-end; margin-top: 4px;">
                    ${badgesHS_HTML} 
                </div>

                <div style="display: flex; gap: 6px; justify-content: flex-end; margin-top: 4px; align-items:center;">
                    ${validNightStandardMs > 0 ? `<span style="font-size:0.8rem; padding: 0 9px; color:#85c1e9;"><i class="fas fa-moon"></i> ${msToTime(validNightStandardMs)}</span>` : ''}
                    ${validNightOtMs > 0 ? `<span class="overtime-badge" style="color:white; background: #2c3e50; border:1px solid #85c1e9;"><i class="fas fa-moon" style="font-size:0.6rem;"></i> + ${msToTime(validNightOtMs)}</span>` : ''}
                </div>
            </div>
        </div>

        <div style="display: flex; align-items: center; gap: 8px; ">
            <div class="timeline-bar" style="flex: 1;">${generateTimelineHTML(log)}</div>
            <div class="history-actions" style="display: flex; flex-shrink: 0; border-radius: 4px; background: rgba(255, 255, 255, 0.05);">
                ${addNoteBtn} 
                ${resumeBtn}
                <button class="btn-icon-action btn-edit" onclick="openEditLogModal(${index})">
                    <i class="fas fa-pen"></i>
                </button>
            </div>
        </div>
    </div>`;
}

function renderHistory() {
    const list = document.getElementById('history-list');
    if (!list) return;
    list.innerHTML = "";
    
    // Configuration de la date affichée
    const monthNames = ["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"];
    const mIndex = currentHistoryDate.getMonth();
    const yIndex = currentHistoryDate.getFullYear();
    document.getElementById('hist-month-year').textContent = `${monthNames[mIndex]} ${yIndex}`;

    // Initialisation des totaux mensuels
    let mDuration = 0, mNightStandard = 0, mOtDay = 0, mOtNight = 0;
    
    // Filtrage par mois/année et tri chronologique inverse
    const filteredLogs = logs.map((log, idx) => ({...log, _originalIndex: idx}))
        .filter(log => {
            let d = log.dateStr ? new Date(log.dateStr) : new Date(log.date.split('/').reverse().join('-'));
            return d.getMonth() === mIndex && d.getFullYear() === yIndex;
        })
        .sort((a, b) => (b.dateStr ? new Date(b.dateStr) : 0) - (a.dateStr ? new Date(a.dateStr) : 0));

    // Initialisation des statistiques par semaine
    const weekStats = {};
    let lastWeek = null;

    // --- PREMIÈRE PASSE : CALCULS ---
    filteredLogs.forEach(log => {
        // Calcul des métriques via votre fonction de calcul
        const metrics = calculateLogMetrics(log);
        
        // Identification de la semaine
        const wn = getWeekNumber(metrics.dLog);
        if (!weekStats[wn]) {
            weekStats[wn] = { duration: 0, ot: 0, night: 0, nightOt: 0 };
        }
        
        // Accumulation des statistiques de la semaine
        weekStats[wn].duration += metrics.effectiveDuration;
        weekStats[wn].ot += metrics.validOtMs;
        weekStats[wn].night += metrics.validNightStandardMs;
        weekStats[wn].nightOt += metrics.validNightOtMs;

        // Accumulation des statistiques du mois
        mDuration += metrics.effectiveDuration;
        mNightStandard += metrics.validNightStandardMs;
        mOtNight += metrics.validNightOtMs;
        mOtDay += (metrics.validOtMs - metrics.validNightOtMs);

        // Sauvegarde temporaire des calculs pour la phase d'affichage
        log._metrics = metrics;
        log._weekNumber = wn;
    });

    // --- SECONDE PASSE : RENDU DU DOM ---
    filteredLogs.forEach(log => {
        const wn = log._weekNumber;
        
        // Insertion du bandeau de semaine si changement de semaine
        if (wn !== lastWeek) {
            const stats = weekStats[wn];
            const header = document.createElement('div');
            header.className = 'week-header';
            header.style.cssText = "display: flex; justify-content: space-between; align-items: center; background: #2a2a2a; color: #fff; padding: 10px 15px; font-weight: bold; border-radius: 6px; margin: 20px 0 10px 0; font-size: 0.8rem; border-left: 4px solid var(--primary);";
            
            // Calcul de la part HS Jour (Total HS - HS Nuit)
            const otDayOnly = stats.ot - stats.nightOt;

            header.innerHTML = `
                <span style="color:var(--primary)">S.${wn}</span>
                <div style="display:flex; gap:10px; align-items:center; font-weight: normal; font-size: 0.75rem;">
                    <span title="Temps de travail total"><i class="fas fa-briefcase"></i> ${msToTime(stats.duration)}</span>
                    <span title="Heures de nuit normales" style="color:#85c1e9"><i class="fas fa-moon"></i> ${msToTime(stats.night)}</span>
                    <span title="Heures supplémentaires jour" style="color:var(--success)">+${msToTime(otDayOnly)}</span>
                    <span title="Heures supplémentaires nuit" style="color:#84b89a"><i class="fas fa-moon"></i> +${msToTime(stats.nightOt)}</span>
                </div>`;
            list.appendChild(header);
            lastWeek = wn;
        }

        // Création de la carte de pointage
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = createLogCardHTML(log, log._metrics, log._originalIndex);
        list.appendChild(tempDiv.firstElementChild);
    });

    // --- MISE À JOUR DE L'INTERFACE DES STATS MENSUELLES ---
    if (typeof updateStatsUI === 'function') {
        updateStatsUI(mDuration, mNightStandard, mOtDay, mOtNight);
    } else {
        // Fallback manuel si updateStatsUI n'est pas définie
        const elDuration = document.getElementById('month-hours-total');
        if(elDuration) elDuration.textContent = msToTime(mDuration);
        const elNight = document.getElementById('month-night-total');
        if(elNight) elNight.textContent = msToTime(mNightStandard);
        const elOtDay = document.getElementById('month-ot-total');
        if(elOtDay) elOtDay.textContent = msToTime(mOtDay);
        const elOtNight = document.getElementById('month-night-ot-total');
        if(elOtNight) elOtNight.textContent = msToTime(mOtNight);
    }
}
// Petite fonction pour mettre à jour les carrés de stats en haut
function updateStatsUI(duration, night, otDay, otNight) {

    if(document.getElementById('month-hours-total')) document.getElementById('month-hours-total').textContent = msToTime(duration);
    if(document.getElementById('month-night-total')) document.getElementById('month-night-total').textContent = msToTime(night);
    if(document.getElementById('month-ot-total')) document.getElementById('month-ot-total').textContent = msToTime(otDay);
    if(document.getElementById('month-night-ot-total')) document.getElementById('month-night-ot-total').textContent = msToTime(otNight);
}

    function openQuickComment(index) {
        document.getElementById('quick-comment-index').value = index;
        document.getElementById('quick-comment-text').value = "";
        document.getElementById('quick-comment-modal').style.display = 'flex';
    }
function saveQuickComment() {
    const index = document.getElementById('quick-comment-index').value;
    const text = document.getElementById('quick-comment-text').value;
    
    if(logs[index]) {
        logs[index].comment = text; // Mise à jour de la donnée
        saveLogsAfterEdit();       // Sauvegarde dans localStorage
        renderHistory();           // RE-DESSINE l'historique pour voir le commentaire
    }
    document.getElementById('quick-comment-modal').style.display = 'none';
}
function openEditLogModal(index) {
    const log = logs[index];
    if (!log) return;
    
    document.getElementById('edit-log-index').value = index;
    document.getElementById('edit-log-date').value = log.dateStr;
    // ... Remplissage des autres champs (select profil, start, end, comment, etc.) ...
    const select = document.getElementById('edit-log-profile');
    select.innerHTML = "";
    profiles.forEach(p => {
        const isSelected = (p.name === log.profileName) ? 'selected' : '';
        select.innerHTML += `<option value="${p.id}" ${isSelected}>${p.name}</option>`;
    });

    document.getElementById('edit-log-start').value = log.startTime;
    document.getElementById('edit-log-end').value = log.endTime;
    document.getElementById('edit-log-comment').value = log.comment || "";
    document.getElementById('edit-log-take-account').checked = log.ignoreOT !== true;

    // --- LOGIQUE DE PRÉ-REMPLISSAGE DES HS VALIDÉES ---
    const inputOT = document.getElementById('edit-log-validated-ot');
    
    if (log.validatedOtMins !== undefined && log.validatedOtMins !== null) {
        // Cas A : Une valeur a déjà été saisie manuellement par le passé
        const h = Math.floor(log.validatedOtMins / 60).toString().padStart(2, '0');
        const m = (log.validatedOtMins % 60).toString().padStart(2, '0');
        inputOT.value = `${h}:${m}`;
    } else {
        // Cas B : Premier édit, on calcule le total théorique (Normal + Nuit)
        const metrics = calculateLogMetrics(log);
        
        // On additionne les HS jour et les HS nuit calculées
        // Note: rawOtMs dans calculateLogMetrics contient déjà le total brut
        const totalOtMins = Math.max(0, Math.floor(metrics.validOtMs / 60000));
        
        if (totalOtMins > 0) {
            const h = Math.floor(totalOtMins / 60).toString().padStart(2, '0');
            const m = (totalOtMins % 60).toString().padStart(2, '0');
            inputOT.value = `${h}:${m}`;
        } else {
            inputOT.value = "00:00";
        }
    }
    
    document.getElementById('edit-log-modal').style.display = 'flex';
}
function saveLogEdit() {
    const index = document.getElementById('edit-log-index').value;
    const oldLog = logs[index];
    const newDateStr = document.getElementById('edit-log-date').value;
    const newStart = document.getElementById('edit-log-start').value;
    const newEnd = document.getElementById('edit-log-end').value;
    const profileId = document.getElementById('edit-log-profile').value;

    if(!newDateStr) return alert("La date est obligatoire");

    const pBase = profiles.find(pr => pr.id == profileId);
    let logDate = new Date(newDateStr);
    
    // Gestion du passage de minuit
    const [h1, m1] = newStart.split(':').map(Number);
    const [h2, m2] = newEnd.split(':').map(Number);
    let startDate = new Date(logDate);
    if (h1 > h2) startDate.setDate(startDate.getDate() - 1);

    const actualStartMs = new Date(startDate).setHours(h1, m1, 0, 0);
    const actualEndMs = new Date(logDate).setHours(h2, m2, 0, 0);

    const p = getProfileParams(pBase, logDate);
    const [hS, mS] = p.start.split(':').map(Number);
    const theoStartMs = new Date(startDate).setHours(hS, mS, 0, 0);

    // Mise à jour de l'objet
    const updatedLog = {
        ...oldLog,
        dateStr: newDateStr,
        date: new Date(logDate).toLocaleDateString('fr-FR'),
        profileName: p.name,
        color: p.color,
        profileSnap: p,
        startTime: newStart,
        endTime: newEnd,
        comment: document.getElementById('edit-log-comment').value,
        duration: (actualEndMs - actualStartMs) - (appSettings.ignoreEarlyStart && actualStartMs < theoStartMs ? (theoStartMs - actualStartMs) : 0),
        overtime: calculateOvertime(actualEndMs - actualStartMs, p, actualStartMs),
        ignoreOT: !document.getElementById('edit-log-take-account').checked
    };

    const valOtTime = document.getElementById('edit-log-validated-ot').value;
    updatedLog.validatedOtMins = valOtTime ? (parseInt(valOtTime.split(':')[0]) * 60 + parseInt(valOtTime.split(':')[1])) : null;

    // LOGIQUE DE DÉPLACEMENT
    const oldKey = getStorageKey(oldLog.dateStr);
    const newKey = getStorageKey(newDateStr);

    if (oldKey === newKey) {
        // Même mois : on remplace dans le tableau actuel
        logs[index] = updatedLog;
        saveLogsCurrentView();
    } else {
        // Mois différent : on supprime de l'ancien mois et on ajoute au nouveau
        logs.splice(index, 1);
        saveLogsCurrentView(); // Sauvegarde l'ancien mois sans ce log
        saveLogToStorage(updatedLog); // Ajoute au nouveau mois (localStorage)
    }

    renderHistory();
    checkAlreadyLogged();
    document.getElementById('edit-log-modal').style.display = 'none';
}

    function deleteLog() {
        if(confirm("Supprimer ce pointage ?")) {
            const index = document.getElementById('edit-log-index').value;
            logs.splice(index, 1);
            saveLogsAfterEdit();
            renderHistory();
            checkAlreadyLogged();
            document.getElementById('edit-log-modal').style.display = 'none';
        }
    }

    // --- STORAGE & UTILS ---
function saveData() {
    localStorage.setItem('pt_profiles', JSON.stringify(profiles));
    // localStorage.setItem('pt_schedule', JSON.stringify(schedule)); // <--- COMMENTE OU SUPPRIME CETTE LIGNE
    localStorage.setItem('pt_settings', JSON.stringify(appSettings));
    if(currentSession) localStorage.setItem('pt_session', JSON.stringify(currentSession));
    else localStorage.removeItem('pt_session');
}

function loadData() {
    // Fonction magique qui répare les données mal formatées (texte vs objet)
    const safeLoad = (key, defaultValue) => {
        const raw = localStorage.getItem(key);
        if (!raw || raw === "undefined") return defaultValue;

        try {
            // 1. On transforme le texte du stockage en variable JS
            let parsed = JSON.parse(raw);

            // 2. LE FIX : Si le résultat est ENCORE du texte (ce qui est votre cas),
            // on demande à JS de le lire une seconde fois pour obtenir l'objet réel.
            if (typeof parsed === 'string') {
                try {
                    const secondParse = JSON.parse(parsed);
                    if (secondParse) parsed = secondParse;
                } catch (e) {
                    // Si ça échoue, c'était vraiment juste du texte
                }
            }
            return parsed;
        } catch (err) {
            console.error(`Erreur lecture ${key}:`, err);
            return defaultValue;
        }
    };

    // --- CHARGEMENT DES PROFILS ---
    const p = safeLoad('pt_profiles', []);
    profiles = Array.isArray(p) ? p : [];

    // --- CHARGEMENT DU PLANNING ---
    const s = safeLoad('pt_schedule', {});
    // On s'assure que c'est bien un objet et pas null
schedule = {};
    // --- CHARGEMENT DES REGLAGES ---
    const set = safeLoad('pt_settings', null);
    if (set && typeof set === 'object') {
        appSettings = set;
    }

    // --- CHARGEMENT SESSION ---
    const sess = safeLoad('pt_session', null);
    if (sess && typeof sess === 'object') {
        currentSession = sess;
    }

    // --- DEBUG : Vérification dans la console ---
    console.log("=== RAPPORT DE CHARGEMENT ===");
    console.log("Profils chargés :", profiles.length); // Doit être > 2
    console.log("Planning chargé (nombre de jours) :", Object.keys(schedule).length); // Doit être > 0
    console.log("Exemple profil 1:", profiles[0]);
    console.log("=============================");
}
    function toggleDay(dayIndex) {
        const circles = document.querySelectorAll('#new-p-days .day-circle');
        if(selectedDaysInForm.includes(dayIndex)) {
            selectedDaysInForm = selectedDaysInForm.filter(d => d !== dayIndex);
            circles[dayIndex].classList.remove('selected');
        } else {
            selectedDaysInForm.push(dayIndex);
            circles[dayIndex].classList.add('selected');
        }
    }

    function setDaysInForm(daysArray) {
        selectedDaysInForm = [...daysArray];
        const circles = document.querySelectorAll('#new-p-days .day-circle');
        circles.forEach((c, idx) => {
            if(selectedDaysInForm.includes(idx)) c.classList.add('selected');
            else c.classList.remove('selected');
        });
    }
    function handleProfileSave() {
        const id = document.getElementById('edit-id').value;
        if(id) updateProfile(parseInt(id));
        else createProfile();
    }
function createProfile() {
    const name = document.getElementById('new-p-name').value;
    if(!name) return alert("Le nom est obligatoire");
    const newP = {
        id: Date.now(), 
        name: name,
        start: document.getElementById('new-p-start').value,
        end: document.getElementById('new-p-end').value,
        pause: parseInt(document.getElementById('new-p-pause').value) || 0,
        color: document.getElementById('new-p-color').value,
        days: selectedDaysInForm,
        customSchedules: JSON.parse(JSON.stringify(tempCustomSchedules)) // Sauvegarde profonde
    };
    profiles.push(newP); 
    finishProfileEdit("Profil créé !");
}
    function loadProfileForEdit(id) {
        const p = profiles.find(x => x.id === id); if(!p) return;
        document.getElementById('form-title').textContent = "Modifier : " + p.name;
        document.getElementById('profile-form-card').classList.add('editing-mode');
        document.getElementById('current-color-preview').style.backgroundColor = p.color;
        document.getElementById('edit-id').value = p.id;
        document.getElementById('new-p-name').value = p.name;
        document.getElementById('new-p-start').value = p.start;
        document.getElementById('new-p-end').value = p.end;
        document.getElementById('new-p-pause').value = p.pause;
        document.getElementById('new-p-color').value = p.color;
        setDaysInForm(p.days || []);
        document.getElementById('btn-save-profile').textContent = "Mettre à jour";
        document.getElementById('btn-cancel-edit').style.display = "block";
        document.querySelector('.page.active').scrollTop = 0;
        tempCustomSchedules = p.customSchedules ? JSON.parse(JSON.stringify(p.customSchedules)) : {};
    renderCustomSchedulesList();
    }
    function updateProfile(id) {
const index = profiles.findIndex(p => p.id === id); if(index === -1) return;
        profiles[index].name = document.getElementById('new-p-name').value;
        profiles[index].start = document.getElementById('new-p-start').value;
        profiles[index].end = document.getElementById('new-p-end').value;
        profiles[index].pause = parseInt(document.getElementById('new-p-pause').value) || 0;
        profiles[index].color = document.getElementById('new-p-color').value;
profiles[index].days = selectedDaysInForm;
    profiles[index].customSchedules = JSON.parse(JSON.stringify(tempCustomSchedules)); // MAJ
    finishProfileEdit("Profil mis à jour !");
    }
    function finishProfileEdit(msg) { saveData(); renderSettingsList(); resetForm(); alert(msg); }
    function resetForm() {
        document.getElementById('new-p-color').value = "#3498db";
document.getElementById('current-color-preview').style.backgroundColor = "#3498db";
        document.getElementById('edit-id').value = ""; document.getElementById('new-p-name').value = "";
        document.getElementById('new-p-start').value = "08:00"; document.getElementById('new-p-end').value = "16:00";
        document.getElementById('new-p-pause').value = "30"; document.getElementById('new-p-color').value = "#3498db";
        selectedDaysInForm = []; document.querySelectorAll('#new-p-days .day-circle').forEach(c => c.classList.remove('selected'));
        document.getElementById('form-title').textContent = "Créer un profil"; document.getElementById('profile-form-card').classList.remove('editing-mode');
        document.getElementById('btn-save-profile').textContent = "Ajouter ce profil"; document.getElementById('btn-cancel-edit').style.display = "none";
        tempCustomSchedules = {};
    renderCustomSchedulesList();
    document.getElementById('custom-day-selector').style.display = 'none';
    }
function deleteProfile(id) {
    if (currentSession && currentSession.profileId === id) {
        alert("Impossible de supprimer ce profil car il est utilisé par le chronomètre actif !");
        return;
    }
    
    if(confirm("Supprimer ce profil ?")) { 
        profiles = profiles.filter(p => p.id !== id); 
        saveData(); 
        renderSettingsList(); 
    } 
}
function renderSettingsList() {
const list = document.getElementById('settings-profiles-list');
list.innerHTML = "";


profiles.forEach((p, index) => {
    const div = document.createElement('div');
    div.className = "profile-list-item";
    div.style.borderLeftColor = p.color;
    const daysMap = ["L","M","M","J","V","S","D"];
    let daysStr = (p.days || []).map(d => daysMap[d]).join(" ");

    div.innerHTML = `
        <div>
            <strong>${p.name}</strong> <small style="color:${p.color}">●</small><br>
            <small>${p.start} - ${p.end}</small><br>
            <small style="color:#777">${daysStr}</small>
        </div>
        <div class="profile-actions">
            <button class="btn-icon" style="color:var(--primary)" onclick="moveProfile(${index}, -1)" ${index === 0 ? 'disabled style="opacity:0.2"' : ''}>
                <i class="fas fa-arrow-up"></i>
            </button>
            <button class="btn-icon" style="color:var(--primary)" onclick="moveProfile(${index}, 1)" ${index === profiles.length - 1 ? 'disabled style="opacity:0.2"' : ''}>
                <i class="fas fa-arrow-down"></i>
            </button>

            <button class="btn-icon" style="color:#f1c40f" onclick="loadProfileForEdit(${p.id})">
                <i class="fas fa-edit"></i>
            </button>
            <button class="btn-icon" style="color:#e74c3c" onclick="deleteProfile(${p.id})">
                <i class="fas fa-trash"></i>
            </button>
        </div>`;
    list.appendChild(div);
});
}
function moveProfile(index, direction) {
const newIndex = index + direction;

// Vérifier si le déplacement est possible
if (newIndex < 0 || newIndex >= profiles.length) return;

// Échanger les positions dans le tableau
const temp = profiles[index];
profiles[index] = profiles[newIndex];
profiles[newIndex] = temp;

// Sauvegarder et rafraîchir l'affichage
saveData();
renderSettingsList();
}
    function msToTime(duration) {
        let minutes = Math.floor((duration / (1000 * 60)) % 60);
        let hours = Math.floor((duration / (1000 * 60 * 60)));
        return (hours + "h" + (minutes < 10 ? "0" : "") + minutes);
    }
    function calculateNightHours(startTime, endTime) {
    // Récupérer les réglages (valeurs par défaut si vide)
    const nStartStr = document.getElementById('settings-night-start').value || "21:00";
    const nEndStr = document.getElementById('settings-night-end').value || "06:00";

    // Convertir les heures de réglage en minutes depuis minuit
    const getMins = (str) => { const [h, m] = str.split(':').map(Number); return h * 60 + m; };
    const nightStart = getMins(nStartStr);
    const nightEnd = getMins(nEndStr);

    let start = new Date(startTime);
    let end = new Date(endTime);
    let totalNightMs = 0;

    // On boucle minute par minute (simple et robuste pour les chevauchements)
    // Pour optimiser, on pourrait utiliser des maths pures, mais ceci est plus sûr pour les dates.
    let current = new Date(start);
    
    while (current < end) {
        const h = current.getHours();
        const m = current.getMinutes();
        const currentMins = h * 60 + m;
        
        let isNight = false;
        if (nightStart > nightEnd) { // Ex: 21:00 à 06:00 (nuit traverse minuit)
            if (currentMins >= nightStart || currentMins < nightEnd) isNight = true;
        } else { // Ex: 00:00 à 05:00
            if (currentMins >= nightStart && currentMins < nightEnd) isNight = true;
        }

        if (isNight) totalNightMs += 60000; // Ajoute 1 minute
        current.setMinutes(current.getMinutes() + 1);
    }

    return totalNightMs;
}
// --- CALCUL JOURS FERIES (France) ---
function getJoursFeries(annee) {
    const list = [
        { d: new Date(annee, 0, 1), n: "Jour de l'an" },
        { d: new Date(annee, 4, 1), n: "Fête du Travail" },
        { d: new Date(annee, 4, 8), n: "Victoire 1945" },
        { d: new Date(annee, 6, 14), n: "Fête Nationale" },
        { d: new Date(annee, 7, 15), n: "Assomption" },
        { d: new Date(annee, 10, 1), n: "Toussaint" },
        { d: new Date(annee, 10, 11), n: "Armistice" },
        { d: new Date(annee, 11, 25), n: "Noël" }
    ];

    // Pâques et jours variables
    const G = annee % 19;
    const C = Math.floor(annee / 100);
    const H = (C - Math.floor(C / 4) - Math.floor((8 * C + 13) / 25) + 19 * G + 15) % 30;
    const I = H - Math.floor(H / 28) * (1 - Math.floor(H / 28) * Math.floor(29 / (H + 1)) * Math.floor((21 - G) / 11));
    const J_paques = (annee + Math.floor(annee / 4) + I + 2 - C + Math.floor(C / 4)) % 7;
    const L = I - J_paques;
    const MonthPaques = 3 + Math.floor((L + 40) / 44);
    const DayPaques = L + 28 - 31 * Math.floor(MonthPaques / 4);
    
    const P = new Date(annee, MonthPaques - 1, DayPaques);
    const LP = new Date(P.getTime() + 24 * 3600 * 1000);
    const Asc = new Date(P.getTime() + 39 * 24 * 3600 * 1000);
    const Pen = new Date(P.getTime() + 50 * 24 * 3600 * 1000);

    list.push({ d: LP, n: "Lundi de Pâques" });
    list.push({ d: Asc, n: "Ascension" });
    list.push({ d: Pen, n: "Pentecôte" });

    return list;
}
function analyzeSession(log) {
    // Récup réglages nuit
    const nStartStr = appSettings.nightStart || "21:00";
    const nEndStr = appSettings.nightEnd || "06:00";
    const [nsH, nsM] = nStartStr.split(':').map(Number);
    const [neH, neM] = nEndStr.split(':').map(Number);
    const nightStartMins = nsH * 60 + nsM;
    const nightEndMins = neH * 60 + neM;

    // Dates début/fin réelles
    let dStart = log.dateStr ? new Date(log.dateStr) : new Date();
    const [h1, m1] = log.startTime.split(':').map(Number);
    let startMs = new Date(dStart).setHours(h1, m1, 0, 0);
    let endMs = startMs + log.duration;

    // Profil théorique
    const p = log.profileSnap || profiles.find(pr => pr.name === log.profileName) || {start:"08:00", end:"16:00"};
    const [phS, pmS] = p.start.split(':').map(Number);
    let theoStartMs = new Date(dStart).setHours(phS, pmS, 0, 0);

    // Initialisation compteurs minutes
    let segs = { early: 0, day: 0, night: 0, otDay: 0, otNight: 0, ignored: 0 };
    
    // On parcourt minute par minute
    // C'est moins performant que les maths pures mais infaillible pour les cas complexes (nuit à cheval, HS nuit, etc.)
    let currentMs = startMs;
    // Durée totale à analyser (hors HS ignorées pour l'instant)
    // On considère que les HS ignorées sont à la fin
    
    // Est-ce qu'on ignore les HS ?
    const isOtDisabled = log.ignoreOT === true;
    const validDuration = log.duration; 

    for (let i = 0; i < (validDuration / 60000); i++) {
        let currentDate = new Date(currentMs);
        let cMins = currentDate.getHours() * 60 + currentDate.getMinutes();

        // Est-ce la nuit ?
        let isNight = false;
        if (nightStartMins > nightEndMins) { // Ex: 21h - 06h
            if (cMins >= nightStartMins || cMins < nightEndMins) isNight = true;
        } else { // Ex: 00h - 05h
            if (cMins >= nightStartMins && cMins < nightEndMins) isNight = true;
        }

        // Type de minute : Avance, Normal, HS
        // Logique simplifiée : 
        // 1. Avant l'heure théorique = Early (si activé)
        // 2. Pendant la durée théorique du profil = Normal
        // 3. Après = HS
        
        let type = 'normal';
        // Note: ceci est une approximation visuelle. 
        // Pour être exact il faudrait comparer currentMs à theoStartMs et theoEndMs
        
        // Simplification visuelle basée sur les totaux calculés précédemment
        // On ne peut pas facilement savoir si CETTE minute précise est une HS sans une logique complexe
        // On va plutôt compter combien de minutes de nuit on a au total
        if(isNight) segs.night++;
        else segs.day++;

        currentMs += 60000;
    }
    
    // Réconciliation avec les totaux calculés (log.overtime, etc.)
    // On sait combien on a d'HS (log.overtime).
    // On va arbitrairement dire que les HS sont à la fin.
    // Si la fin était la nuit, les HS sont de nuit.
    
    // Méthode simplifiée demandée pour l'affichage :
    // On va juste retourner le total Nuit calculé
    return segs.night * 60000;
}
function resumeLog(index) {
    if(!confirm("Voulez-vous reprendre ce chronomètre ? L'entrée actuelle sera supprimée de l'historique et le chrono reprendra.")) return;
    
    const log = logs[index];
    if(!log) return;

    // 1. Reconstruire la session
    const [h, m] = log.startTime.split(':').map(Number);
    const d = new Date(); // Aujourd'hui
    d.setHours(h, m, 0, 0);
    
    // Récupérer le profil
    const p = log.profileSnap || profiles.find(pr => pr.name === log.profileName);

    currentSession = {
        start: d.getTime(),
        profileId: p ? p.id : 0, // 0 si profil supprimé
        profileSnap: p
    };
    
    // 2. Supprimer le log de l'historique
    logs.splice(index, 1);
    saveLogsCurrentView(); // Sauvegarder la suppression
    saveData(); // Sauvegarder la session

    // 3. Relancer l'UI
    restoreTimerUI();
    navTo('page-chrono', document.querySelector('.nav-item')); // Rediriger
}
function generateTimelineHTML(log) {
    // 1. RECONSTRUCTION DES TIMESTAMPS REELS (Crucial pour la nuit)
    let dStart = log.dateStr ? new Date(log.dateStr) : new Date();
    const [h1, m1] = log.startTime.split(':').map(Number);
    const [h2, m2] = log.endTime.split(':').map(Number);
    
    // On détecte si c'est un shift qui a commencé "Hier"
    let startDate = new Date(dStart);
    if (h1 > h2) {
        startDate.setDate(startDate.getDate() - 1);
    }

    let currentMs = new Date(startDate).setHours(h1, m1, 0, 0);
    // On se base sur la durée brute calculée pour trouver la fin
    const [hStart, mStart] = log.startTime.split(':').map(Number);
    const [hEnd, mEnd] = log.endTime.split(':').map(Number);
    let startTotalMins = hStart * 60 + mStart;
    let endTotalMins = hEnd * 60 + mEnd;
    if (endTotalMins <= startTotalMins) endTotalMins += 1440; 
    
    const totalMins = endTotalMins - startTotalMins;
    const endMs = currentMs + (totalMins * 60000);

    // 2. RÉCUPÉRATION DU PROFIL THÉORIQUE ADAPTÉ
    const pSnap = log.profileSnap || profiles.find(pr => pr.name === log.profileName);
    const pParams = getProfileParams(pSnap, dStart);
    
    const [phS, pmS] = pParams.start.split(':').map(Number);
    const [phE, pmE] = pParams.end.split(':').map(Number);
    
    let theoStartMs = new Date(startDate).setHours(phS, pmS, 0, 0);
    let theoEndMs = new Date(startDate).setHours(phE, pmE, 0, 0);
    
    // Si le profil lui-même traverse minuit (ex: 21h-05h)
    if (theoEndMs <= theoStartMs) theoEndMs += 24 * 3600 * 1000;

    // 3. QUOTAS D'HEURES SUP VALIDÉES
const metrics = calculateLogMetrics(log);
    const validOtMins = metrics.validOtMs / 60000;
    const isOTDisabled = log.ignoreOT === true;
    
    let assignedGreenMins = 0;
    let rawSegments = [];
    let lastType = null;
    let currentSegMins = 0;

    for (let i = 0; i < totalMins; i++) {
        let type = 'blue';
        const timeCheck = currentMs + (i * 60000);

        // A. AVANT OU APRÈS L'HEURE PRÉVUE
        if (timeCheck < theoStartMs || timeCheck >= theoEndMs) {
            if (isOTDisabled) {
                type = 'red'; // Tout est rouge si désactivé
            } else if (timeCheck < theoStartMs && appSettings.ignoreEarlyStart) {
                type = 'gray'; // Gris si avance ignorée
            } else {
                // LOGIQUE DE DÉCOUPE
                if (assignedGreenMins < validOtMins) {
                    type = isNight(timeCheck) ? 'night-ot' : 'green';
                    assignedGreenMins++;
                } else {
                    type = 'red'; // <--- TOUT LE RESTE EST ROUGE (Le surplus)
                }
            }
        }
        // B. HEURES NORMALES
        else {
            type = isNight(timeCheck) ? 'night' : 'blue';
        }

        if (type === lastType) {
            currentSegMins++;
        } else {
            if (lastType) rawSegments.push({ type: lastType, mins: currentSegMins });
            lastType = type;
            currentSegMins = 1;
        }
    }
    if (lastType) rawSegments.push({ type: lastType, mins: currentSegMins });

    return renderSegmentsHTML(rawSegments, totalMins);
}

// Fonction utilitaire pour vérifier la nuit (basée sur tes réglages)
function isNight(ms) {
    const d = new Date(ms);
    const mins = d.getHours() * 60 + d.getMinutes();
    const [nsH, nsM] = (appSettings.nightStart || "21:00").split(':').map(Number);
    const [neH, neM] = (appSettings.nightEnd || "06:00").split(':').map(Number);
    const nsTotal = nsH * 60 + nsM;
    const neTotal = neH * 60 + neM;
    return (nsTotal > neTotal) ? (mins >= nsTotal || mins < neTotal) : (mins >= nsTotal && mins < neTotal);
}

// Fonction utilitaire pour le rendu propre des segments
function renderSegmentsHTML(segments, totalMins) {
    return segments.map(seg => {
        const pct = (seg.mins / totalMins) * 100;
        const colorClass = 't-' + seg.type;
        return `<div class="t-seg ${colorClass}" style="width:${pct}%" title="${seg.type} : ${seg.mins}min"></div>`;
    }).join('');
}
// --- GESTION DES HORAIRES SPÉCIFIQUES ---
let tempCustomSchedules = {}; // Stockage temporaire { 4: {start, end, pause}, ... }

function toggleCustomSelector() {
    const el = document.getElementById('custom-day-selector');
    el.style.display = (el.style.display === 'none') ? 'block' : 'none';
}

function addCustomDay(dayIndex) {
    if(tempCustomSchedules[dayIndex]) return alert("Ce jour a déjà une configuration spécifique.");
    
    // Valeurs par défaut = celles du formulaire principal
    const defStart = document.getElementById('new-p-start').value;
    const defEnd = document.getElementById('new-p-end').value;
    const defPause = document.getElementById('new-p-pause').value;

    tempCustomSchedules[dayIndex] = { start: defStart, end: defEnd, pause: defPause };
    renderCustomSchedulesList();
    document.getElementById('custom-day-selector').style.display = 'none';
}

function removeCustomDay(dayIndex) {
    delete tempCustomSchedules[dayIndex];
    renderCustomSchedulesList();
}

function updateCustomValue(dayIndex, field, value) {
    if(tempCustomSchedules[dayIndex]) {
        tempCustomSchedules[dayIndex][field] = value;
    }
}

function renderCustomSchedulesList() {
    const container = document.getElementById('custom-schedules-list');
    container.innerHTML = "";
    const dayNames = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];

    // On trie par index de jour (0 à 6)
    Object.keys(tempCustomSchedules).sort().forEach(idx => {
        const d = tempCustomSchedules[idx];
        const dayName = dayNames[idx];
        
        const div = document.createElement('div');
        div.className = "custom-row-item";
        div.innerHTML = `
            <div class="custom-row-header">
                <span>${dayName}</span>
                <button class="btn-mini-remove" onclick="removeCustomDay(${idx})"><i class="fas fa-times"></i></button>
            </div>
            <div class="custom-inputs">
                <div>
                    <label style="font-size:0.6rem;">Début</label>
                    <input type="time" value="${d.start}" onchange="updateCustomValue(${idx}, 'start', this.value)">
                </div>
                <div>
                    <label style="font-size:0.6rem;">Fin</label>
                    <input type="time" value="${d.end}" onchange="updateCustomValue(${idx}, 'end', this.value)">
                </div>
                <div>
                    <label style="font-size:0.6rem;">Pause</label>
                    <input type="number" value="${d.pause}" onchange="updateCustomValue(${idx}, 'pause', this.value)">
                </div>
            </div>
        `;
        container.appendChild(div);
    });
}
// Retourne les paramètres du profil (start, end, pause) adaptés au jour donné
function getProfileParams(profile, dateObj) {
    if (!profile) return null;
    
    // Attention: getDay() renvoie 0=Dimanche, 1=Lundi... 
    // Votre sélecteur utilise 0=Lundi...6=Dimanche
    let dayIndex = dateObj.getDay() - 1; 
    if(dayIndex === -1) dayIndex = 6; // Dimanche

    // Y a-t-il une exception pour ce jour ?
    if (profile.customSchedules && profile.customSchedules[dayIndex]) {
        return {
            name: profile.name,
            color: profile.color,
            start: profile.customSchedules[dayIndex].start,
            end: profile.customSchedules[dayIndex].end,
            pause: parseInt(profile.customSchedules[dayIndex].pause) || 0
        };
    }

    // Sinon retour standard
    return {
        name: profile.name,
        color: profile.color,
        start: profile.start,
        end: profile.end,
        pause: profile.pause
    };
}
function getNightDuration(log) {
    if (!log || !log.startTime || !log.endTime) return 0;

    // 1. Détermination de la date de début réelle
    let dRef = log.dateStr ? new Date(log.dateStr) : new Date();
    const [h1, m1] = log.startTime.split(':').map(Number);
    const [h2, m2] = log.endTime.split(':').map(Number);
    
    let startMs = new Date(dRef).setHours(h1, m1, 0, 0);
    let endMs = new Date(dRef).setHours(h2, m2, 0, 0);
    
    // Si l'heure de fin est inférieure à l'heure de début, on est sur le lendemain
    if (endMs <= startMs) {
        endMs += 24 * 3600 * 1000;
    }

    // 2. Réglages de la plage de nuit
    const nStartStr = appSettings.nightStart || "21:00";
    const nEndStr = appSettings.nightEnd || "06:00";
    const [nsH, nsM] = nStartStr.split(':').map(Number);
    const [neH, neM] = nEndStr.split(':').map(Number);
    const nsMins = nsH * 60 + nsM;
    const neMins = neH * 60 + neM;

    const isNightMinute = (ms) => {
        const d = new Date(ms);
        const mins = d.getHours() * 60 + d.getMinutes();
        return (nsMins > neMins) 
            ? (mins >= nsMins || mins < neMins) 
            : (mins >= nsMins && mins < neMins);
    };

    // 3. Parcours minute par minute pour une précision absolue
    let nightMs = 0;
    let checkMs = startMs;
    while (checkMs < endMs) {
        if (isNightMinute(checkMs)) nightMs += 60000;
        checkMs += 60000;
    }
    
    return nightMs;
}
// Ouvre la modal et génère la liste des profils
function openChangeProfileModal() {
    const listContainer = document.getElementById('profiles-selection-list');
    listContainer.innerHTML = "";

    // 1. Bouton Repos / Aucun
    const reposBtn = document.createElement('div');
    reposBtn.style.cssText = `
        padding: 15px;
        background: #2c2c2c;
        border-radius: 8px;
        border-left: 5px solid #7f8c8d;
        cursor: pointer;
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 10px;
    `;
    reposBtn.innerHTML = `
        <div>
            <strong style="color: #7f8c8d;"><i class="fas fa-umbrella-beach"></i> Repos / Aucun</strong><br>
            <small style="color:#666;">Effacer le profil du jour</small>
        </div>
        <i class="fas fa-chevron-right" style="opacity:0.3;"></i>
    `;
    // On passe null pour indiquer qu'on veut effacer le profil
    reposBtn.onclick = () => applyNewProfileToChrono(null);
    listContainer.appendChild(reposBtn);

    // 2. Liste des profils existants
    profiles.forEach(p => {
        const btn = document.createElement('div');
        btn.style.cssText = `
            padding: 15px;
            background: #2c2c2c;
            border-radius: 8px;
            border-left: 5px solid ${p.color};
            cursor: pointer;
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 8px;
        `;
        btn.innerHTML = `
            <div>
                <strong>${p.name}</strong><br>
                <small style="color:#aaa;">${p.start} - ${p.end}</small>
            </div>
            <i class="fas fa-chevron-right" style="opacity:0.3;"></i>
        `;
        btn.onclick = () => applyNewProfileToChrono(p.id);
        listContainer.appendChild(btn);
    });

    document.getElementById('change-profile-modal').style.display = 'flex';
}
// Récupère une liste unique des profils pour un jour donné (Logs + Planning)
function getDayProfiles(dateKey) {
    let profilesFound = [];

    // 1. Chercher dans les LOGS (Historique)
    // On doit charger les logs du mois concerné par la dateKey pour être sûr
    const d = new Date(dateKey);
    const key = getStorageKey(d); // Utilise votre fonction existante
    
    // Astuce: Si le mois affiché dans l'historique est le même, on utilise la variable globale 'logs'
    // Sinon on lit le localStorage (c'est rapide)
    let targetLogs = [];
    if (key === getStorageKey(currentHistoryDate)) {
        targetLogs = logs;
    } else {
        const raw = localStorage.getItem(key);
        targetLogs = raw ? JSON.parse(raw) : [];
    }

    // Filtrer les logs pour ce jour précis
    const dayLogs = targetLogs.filter(l => (l.dateStr === dateKey) || (l.date && l.date.split('/').reverse().join('-') === dateKey));
    
    dayLogs.forEach(l => {
        // On évite les doublons de nom/couleur
        if (!profilesFound.find(p => p.name === l.profileName && p.color === l.color)) {
            profilesFound.push({
                name: l.profileName,
                color: l.color || '#ccc',
                source: 'log', // C'est un pointage réel
                start: l.startTime,
                end: l.endTime
            });
        }
    });

    // 2. Chercher dans le PLANNING (Schedule)
    // On ajoute le planning SEULEMENT si on n'a pas encore ce profil (pour éviter doublon Log vs Planning)
    // OU si vous voulez afficher les deux. Ici, on fusionne si c'est le même ID/Nom.
    const schedData = schedule[dateKey];
    if (schedData && schedData.id) {
        const pBase = profiles.find(p => p.id === schedData.id);
        if (pBase) {
            // On vérifie si ce profil n'est pas déjà présent via un log
            const alreadyLogged = profilesFound.find(p => p.name === pBase.name);
            if (!alreadyLogged) {
                // On récupère les horaires spécifiques (customSchedules) via votre fonction
                const pParams = getProfileParams(pBase, new Date(dateKey));
                profilesFound.push({
                    name: pParams.name,
                    color: pParams.color,
                    source: 'plan', // C'est du prévisionnel
                    start: pParams.start,
                    end: pParams.end
                });
            }
        }
    }

    return { list: profilesFound, note: schedData ? schedData.note : "" };
}

// Remplacez votre fonction applyNewProfileToChrono par celle-ci
function applyNewProfileToChrono(profileId) {
    const todayKey = new Date().toISOString().split('T')[0];

    if (profileId === null) {
        // Supprimer du planning
        // (La ligne delete schedule... est inutile car saveScheduleEntry le fait déjà)
        saveScheduleEntry(todayKey, null); 
        
        tempSelectedProfileId = null; // <--- AJOUT : Pour garder l'interface cohérente

        // Si une session est en cours, on retire le profil
        if (currentSession) {
            currentSession.profileId = null;
            currentSession.profileSnap = null;
        }
    } else {
        const pBase = profiles.find(x => x.id === profileId);
        if (!pBase) return;

        const pSnapshot = getProfileParams(pBase, new Date());
        
        // On récupère la note si elle existe déjà
        const currentNote = (schedule[todayKey] && schedule[todayKey].note) ? schedule[todayKey].note : "";
        
        const dataToSave = { id: profileId, note: currentNote };
        
        saveScheduleEntry(todayKey, dataToSave); 

        tempSelectedProfileId = profileId; // <--- AJOUT : Pour garder l'interface cohérente

        if (currentSession) {
            currentSession.profileId = profileId;
            currentSession.profileSnap = pSnapshot;
        }
    }

    // On garde saveData() ici car il sauvegarde 'currentSession' (qui a été modifié juste au-dessus)
    // Mais il ne touchera plus au planning grâce à tes modifs précédentes.
    saveData(); 
    
    renderCalendar();
    checkTodaySchedule();
    document.getElementById('change-profile-modal').style.display = 'none';
}
function startNewSession(pid) {
    const today = new Date();
    const baseP = profiles.find(x => x.id === pid);
    const pSnapshot = getProfileParams(baseP, today);
    
    currentSession = { 
        start: Date.now(), 
        profileId: pid, 
        profileSnap: pSnapshot 
    };
    
    saveData();
    restoreTimerUI();
    tempSelectedProfileId = null;
    autoStartAfterProfileSelection = false; // On reset le flag
}

function updateEditLogPreview() {
    const index = document.getElementById('edit-log-index').value;
    const profileId = document.getElementById('edit-log-profile').value;
    const startVal = document.getElementById('edit-log-start').value;
    const endVal = document.getElementById('edit-log-end').value;
    const newDateStr = document.getElementById('edit-log-date').value; // Récupère la date de l'input
    
    const isOTEnabled = document.getElementById('edit-log-take-account').checked;
    const inputOT = document.getElementById('edit-log-validated-ot');

    // 1. Si les HS sont décochées, on force à 0 et on arrête
    if (!isOTEnabled) {
        inputOT.value = "00:00";
        return;
    }

    // 2. Sécurité : on vérifie que les champs nécessaires sont remplis
    if (!startVal || !endVal || !profileId || !newDateStr) return;

    // 3. Récupération du profil
    const pBase = profiles.find(pr => pr.id == profileId);
    if (!pBase) return;

    // 4. Gestion de la date et du passage à minuit
    let logDate = new Date(newDateStr);
    const [h1, m1] = startVal.split(':').map(Number);
    const [h2, m2] = endVal.split(':').map(Number);
    
    let startDate = new Date(logDate);
    // Si l'heure de début est supérieure à l'heure de fin, le début était la veille
    if (h1 > h2) {
        startDate.setDate(startDate.getDate() - 1);
    }

    const actualStartMs = new Date(startDate).setHours(h1, m1, 0, 0);
    const actualEndMs = new Date(logDate).setHours(h2, m2, 0, 0);

    // 5. Récupération des paramètres du profil pour CE jour (gère les horaires spécifiques)
    const pParams = getProfileParams(pBase, logDate);
    const totalDurationMs = actualEndMs - actualStartMs;
    
    // 6. Calcul de l'overtime brut
    const rawOtMs = calculateOvertime(totalDurationMs, pParams, actualStartMs);

    // 7. Application du palier d'arrondi (Step)
    const stepVal = Math.max(1, parseInt(appSettings.otStep) || 15);
    const stepMs = stepVal * 60000;
    
    // On arrondit à l'inférieur (ex: 28min avec palier 15 -> 15min)
    const validOtMs = rawOtMs > 0 ? Math.floor(rawOtMs / stepMs) * stepMs : 0;

    // 8. Mise à jour de l'affichage dans l'input time
    if (validOtMs > 0) {
        const totalMins = Math.floor(validOtMs / 60000);
        const h = Math.floor(totalMins / 60).toString().padStart(2, '0');
        const m = (totalMins % 60).toString().padStart(2, '0');
        inputOT.value = `${h}:${m}`;
    } else {
        inputOT.value = "00:00";
    }
}
function runDailyAutoExport() {
    // 1. VÉRIFICATION DU PARAMÈTRE : On ne fait rien si l'auto-backup est désactivé
    // On suppose ici que votre réglage est stocké sous 'settings-auto-backup'
    const isAutoBackupEnabled = localStorage.getItem('settings-auto-backup') === 'true';
    
    if (!isAutoBackupEnabled) {
        console.log("🚫 Sauvegarde auto désactivée dans les réglages.");
        return;
    }

    // 2. VÉRIFICATION DE LA DATE : Pas deux fois par jour
    const today = new Date().toISOString().split('T')[0];
    const lastExportDate = localStorage.getItem('sys_last_auto_export_date');

    if (lastExportDate === today) {
        console.log("📅 Sauvegarde auto déjà faite pour aujourd'hui.");
        return;
    }

    // 3. PRÉPARATION DES DONNÉES
    const data = {};
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key.startsWith('pt_')) {
            data[key] = localStorage.getItem(key);
        }
    }

    const jsonString = JSON.stringify(data, null, 2);
    
    // NOM FIXE : Pour permettre l'écrasement côté Android
    const fileName = "backup_auto_latest.json"; 

    console.log("📤 Envoi de la sauvegarde auto vers Android...");
    
    // Appel direct (sans vérification d'interface comme demandé)
    window.Android.saveFile(jsonString, fileName);

    // 4. MARQUAGE DU SUCCÈS
    localStorage.setItem('sys_last_auto_export_date', today);
}

function showOneTimeMessage(id, text) {
    const GLOBAL_KEY = 'pt_read_messages'; // Une seule clé pour tout

    // 1. Récupération de la liste actuelle
    let readList = [];
    try {
        const raw = localStorage.getItem(GLOBAL_KEY);
        if (raw) readList = JSON.parse(raw);
        // Sécurité : si ce n'est pas un tableau (ex: corruption), on repart à vide
        if (!Array.isArray(readList)) readList = [];
    } catch (e) {
        readList = [];
    }

    // 2. Vérification immédiate : Si l'ID est dans la liste, on arrête.
    if (readList.includes(id)) return;

    // 3. On attend 1.5 secondes avant d'afficher
    setTimeout(() => {
        
        // --- Création de la Div ---
        const popup = document.createElement('div');
        popup.id = 'temp-update-popup'; 
        
        popup.innerHTML = `
            <span style="margin-right: 15px; font-weight: 500;">${text}</span>
            <button id="btn-popup-ok" class="batch-btn">OK</button>
        `;

        document.body.appendChild(popup);

        // --- Animation d'entrée ---
        setTimeout(() => {
            popup.classList.add('visible');
        }, 10);

        // --- Fonction de fermeture et de SAUVEGARDE GROUPÉE ---
        const closeAndSave = () => {
            popup.classList.remove('visible'); // Lance l'animation de sortie

            // --- C'est ici que ça change : on ajoute l'ID au tableau existant ---
            try {
                // On relit le storage au cas où il aurait changé entre temps (rare mais prudent)
                const rawNow = localStorage.getItem(GLOBAL_KEY);
                let currentList = rawNow ? JSON.parse(rawNow) : [];
                if (!Array.isArray(currentList)) currentList = [];

                // Si l'ID n'y est pas encore, on l'ajoute
                if (!currentList.includes(id)) {
                    currentList.push(id);
                    // On sauvegarde le tableau complet converti en texte
                    localStorage.setItem(GLOBAL_KEY, JSON.stringify(currentList));
                }
            } catch (e) {
                console.error("Erreur sauvegarde message lu", e);
            }

            // On attend la fin de l'animation CSS (0.3s) avant de supprimer
            setTimeout(() => {
                if (document.body.contains(popup)) {
                    popup.remove();
                }
            }, 350);
        };

        // --- Auto-destruction (7s total : 5s visible + délais) ---
        const autoCloseTimer = setTimeout(closeAndSave, 7000);

        // --- Clic Bouton OK ---
        const btn = popup.querySelector('#btn-popup-ok');
        if (btn) {
            btn.onclick = () => {
                clearTimeout(autoCloseTimer);
                closeAndSave();
            };
        }

    }, 1500); 
}

function getSchedKey(dateStr) {
    // dateStr est sous forme "YYYY-MM-DD"
    const [y, m] = dateStr.split('-');
    return `pt_sched_${y}_${m}`;
}

function migrateOldSchedule() {
    const oldRaw = localStorage.getItem('pt_schedule');
    if (oldRaw) {
        try {
            const oldData = JSON.parse(oldRaw);
            // Si c'est vide ou pas un objet, on ignore
            if (Object.keys(oldData).length === 0) return;

            console.log("Migration du planning en cours...");
            const buckets = {};

            // On trie chaque jour dans son mois
            for (const [dateKey, val] of Object.entries(oldData)) {
                const key = getSchedKey(dateKey);
                if (!buckets[key]) buckets[key] = {};
                buckets[key][dateKey] = val;
            }

            // On sauvegarde chaque mois
            for (const [key, monthlyData] of Object.entries(buckets)) {
                localStorage.setItem(key, JSON.stringify(monthlyData));
            }

            // On supprime l'ancien fichier géant (Sécurité)
            localStorage.removeItem('pt_schedule');
            console.log("Migration planning terminée !");
        } catch (e) {
            console.error("Erreur migration planning", e);
        }
    }
}

// 3. Charger le planning du mois affiché (et fusionner avec la mémoire)
function loadScheduleForMonthView() {
    // On charge le mois en cours + le mois précédent + le mois suivant
    // (Pour gérer les cases vides du début/fin de calendrier)
    
    const d = new Date(currentPlanningDate);
    const monthsToLoad = [
        new Date(d.getFullYear(), d.getMonth() - 1, 1), // Mois d'avant
        new Date(d.getFullYear(), d.getMonth(), 1),     // Mois actuel
        new Date(d.getFullYear(), d.getMonth() + 1, 1)  // Mois d'après
    ];

    monthsToLoad.forEach(dateObj => {
        // Astuce pour avoir YYYY-MM-DD
        const dateKeyFake = dateObj.toISOString().split('T')[0]; 
        const key = getSchedKey(dateKeyFake);
        
        const raw = localStorage.getItem(key);
        if (raw) {
            const data = JSON.parse(raw);
            // On fusionne dans la variable globale schedule
            Object.assign(schedule, data);
        }
    });
}

function saveScheduleEntry(dateKey, val) {
    const key = getSchedKey(dateKey);
    
    // 1. Lire le fichier du mois
    let monthData = {};
    const raw = localStorage.getItem(key);
    if(raw) monthData = JSON.parse(raw);

    // 2. Modifier ou Supprimer
    if (val === null) {
        delete monthData[dateKey]; // Suppression dans le fichier
        delete schedule[dateKey];  // Suppression en mémoire
    } else {
        monthData[dateKey] = val;  // Ajout dans le fichier
        schedule[dateKey] = val;   // Ajout en mémoire
    }

    // 3. Sauvegarder le fichier
    localStorage.setItem(key, JSON.stringify(monthData));
}

// Sauvegarde un lot de jours en une seule opération (Optimisé pour les semaines à cheval sur 2 mois)
function saveBatchScheduleEntries(updates) {
    // updates est un objet : { "2024-01-31": {id:1}, "2024-02-01": {id:1} }
    
    const buckets = {};

    // 1. On trie les mises à jour par mois (Bucket sort)
    for (const [dateKey, val] of Object.entries(updates)) {
        const key = getSchedKey(dateKey); // ex: pt_sched_2024_01
        if (!buckets[key]) buckets[key] = {};
        buckets[key][dateKey] = val;

        // Mise à jour immédiate de la mémoire (pour l'affichage)
        if (val === null) delete schedule[dateKey];
        else schedule[dateKey] = val;
    }

    // 2. On traite chaque mois concerné une seule fois
    for (const [storageKey, changes] of Object.entries(buckets)) {
        let monthData = {};
        const raw = localStorage.getItem(storageKey);
        if (raw) monthData = JSON.parse(raw);

        // Appliquer les changements
        for (const [dKey, dVal] of Object.entries(changes)) {
            if (dVal === null) delete monthData[dKey];
            else monthData[dKey] = dVal;
        }

        localStorage.setItem(storageKey, JSON.stringify(monthData));
    }
}

// ============================================================
// MODULE STATISTIQUES (Refactorisé & Multi-Graphiques)
// ============================================================

function initStatisticsModule() {
    console.log("📊 Initialisation du module Statistiques...");

    createStatsPage();
    addStatsNavButton();

    // --- VARIABLES & FONCTIONS GLOBALES (Accessibles via onclick) ---
    window.currentStatsYear = new Date().getFullYear();

    window.changeStatsYear = function(delta) {
        window.currentStatsYear += delta;
        renderStatsView(); // Recalcule et redessine tout
    };

    // Fonction principale de rafraîchissement
    window.renderStatsView = function() {
        const year = window.currentStatsYear;
        document.getElementById('stats-year-display').textContent = year;

        // 1. CALCUL DES DONNÉES
        const stats = calculateYearlyStats(year);

        // 2. MISE À JOUR DES CARTES CHIFFRÉES
        updateStatsCards(stats);

        // 3. DESSIN DES GRAPHIQUES
        // Graphique 1 : HS (Rouge)
        drawGenericChart('hs-chart', stats.monthlyHS, {
            color1: "rgba(231, 76, 60, 0.4)", // Rouge transparent
            color2: "rgba(231, 76, 60, 0.9)", // Rouge vif
            title: "HS Validées"
        });

        // Graphique 2 : Heures Travaillées (Bleu)
        drawGenericChart('work-chart', stats.monthlyWork, {
            color1: "rgba(52, 152, 219, 0.4)", // Bleu transparent
            color2: "rgba(52, 152, 219, 0.9)", // Bleu vif
            title: "Heures Travaillées"
        });
    };
}


// --- SOUS-FONCTION 2 : CRÉATION HTML ---
function createStatsPage() {
    if (document.getElementById('page-stats')) return;
    const page = document.createElement('div');
    page.id = 'page-stats';
    page.className = 'page';
    page.style.paddingBottom = "80px"; 
    
    page.innerHTML = `
        <header>
            <h1>Statistiques</h1>
       
        
        <!-- Navigation Année -->
        <div class="calendar-header" style="text-align:center;">
            <button class="calendar-nav-btn" onclick="changeStatsYear(-1)"><i class="fas fa-chevron-left"></i></button>
            <span id="stats-year-display" style="font-weight:bold; margin:0 15px; font-size:1.1rem;">2024</span>
            <button class="calendar-nav-btn" onclick="changeStatsYear(1)"><i class="fas fa-chevron-right"></i></button>
        </div>
 </header>
        <!-- Cartes Résumé -->
        <div class="stat-card-grid">
            <div class="stat-card" style="border-color: #e74c3c;">
                <div class="stat-val" id="stat-total-hs">0h00</div>
                <div class="stat-label">HS Validées</div>
            </div>
            <div class="stat-card" style="border-color: #3498db;">
                <div class="stat-val" id="stat-total-hours">0h00</div>
                <div class="stat-label">Heures Totales</div>
            </div>
            <div class="stat-card" style="border-color: #8e44ad;">
                <div class="stat-val" id="stat-avg-hours">0h00</div>
                <div class="stat-label">Moyenne / Jour</div>
            </div>
            <div class="stat-card" style="border-color: #f1c40f;">
                <div class="stat-val" id="stat-days-count">0</div>
                <div class="stat-label">Jours Travaillés</div>
            </div>
        </div>

        <!-- Graphique 1 : Heures Sup -->
        <div class="chart-wrapper">
            <div class="chart-title"><i class="fas fa-clock" style="color:#e74c3c"></i> Évolution Heures Sup.</div>
            <div class="canvas-container">
                <canvas id="hs-chart" class="stat-canvas"></canvas>
            </div>
        </div>

        <!-- Graphique 2 : Heures Travaillées -->
        <div class="chart-wrapper">
            <div class="chart-title"><i class="fas fa-briefcase" style="color:#3498db"></i> Évolution Travail</div>
            <div class="canvas-container">
                <canvas id="work-chart" class="stat-canvas"></canvas>
            </div>
        </div>
    `;
    
    document.body.insertBefore(page, document.querySelector('.bottom-nav'));
}

// --- SOUS-FONCTION 3 : BOUTON NAV ---
function addStatsNavButton() {
    const navContainer = document.querySelector('.bottom-nav');
    if (navContainer && !document.getElementById('nav-btn-stats')) {
        const btn = document.createElement('button');
        btn.id = 'nav-btn-stats';
        btn.className = 'nav-item';
        btn.onclick = function() { 
            navTo('page-stats', this); 
            renderStatsView(); 
        };
        btn.innerHTML = `<i class="fas fa-chart-bar"></i><span>Stats</span>`;
        
        const lastItem = navContainer.lastElementChild;
        if (lastItem) navContainer.insertBefore(btn, lastItem);
        else navContainer.appendChild(btn);
    }
}

// --- SOUS-FONCTION 4 : LOGIQUE DE CALCUL ---
function calculateYearlyStats(year) {
    const monthlyHS = Array(12).fill(0);   // HS par mois
    const monthlyWork = Array(12).fill(0); // Travail par mois
    
    let totalHSMins = 0;
    let totalWorkMins = 0;
    let daysWorked = 0;

    for (let m = 0; m < 12; m++) {
        const mStr = (m + 1).toString().padStart(2, '0');
        const storageKey = `pt_logs_${year}_${mStr}`;
        const raw = localStorage.getItem(storageKey);
        
        if (raw) {
            try {
                const logs = JSON.parse(raw);
                logs.forEach(l => {
                    // A. Calcul HS
                    let hs = 0;
                    if (l.validatedOtMins !== undefined && l.validatedOtMins !== null) {
                        hs = l.validatedOtMins;
                    } else if (l.overtime > 0 && l.ignoreOT !== true) {
                        const step = (typeof appSettings !== 'undefined' && appSettings.otStep) || 15;
                        hs = Math.floor((l.overtime / 60000) / step) * step;
                    }
                    if (hs > 0) {
                        monthlyHS[m] += hs;
                        totalHSMins += hs;
                    }

                    // B. Calcul Travail Effectif
                    let work = 0;
                    if (typeof calculateLogMetrics === 'function') {
                        const mets = calculateLogMetrics(l);
                        work = (mets.effectiveDuration / 60000);
                    } else {
                        work = (l.duration / 60000); // Fallback
                    }
                    if(work > 0) {
                        monthlyWork[m] += work;
                        totalWorkMins += work;
                        daysWorked++;
                    }
                });
            } catch(e) { console.error("Err json stats", e); }
        }
    }

    return { monthlyHS, monthlyWork, totalHSMins, totalWorkMins, daysWorked };
}

// --- SOUS-FONCTION 5 : MISE A JOUR UI ---
function updateStatsCards(stats) {
    const formatMins = (m) => {
        const h = Math.floor(m / 60);
        const mn = Math.round(m % 60);
        return `${h}h${mn < 10 ? '0' : ''}${mn}`;
    };

    document.getElementById('stat-total-hs').textContent = formatMins(stats.totalHSMins);
    document.getElementById('stat-total-hours').textContent = formatMins(stats.totalWorkMins);
    document.getElementById('stat-days-count').textContent = stats.daysWorked;
    
    const avg = stats.daysWorked > 0 ? Math.floor(stats.totalWorkMins / stats.daysWorked) : 0;
    document.getElementById('stat-avg-hours').textContent = formatMins(avg);
}

// --- SOUS-FONCTION 6 : DESSIN GÉNÉRIQUE (Reusable) ---
function drawGenericChart(canvasId, dataArr, styleOptions) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    
    // Récupération conteneur parent
    const parent = canvas.parentElement;
    
    // Ajustement haute résolution (Retina)
    const dpr = window.devicePixelRatio || 1;
    const rect = parent.getBoundingClientRect();
    
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    
    // Dimensions logiques
    const width = rect.width;
    const height = rect.height;
    const padding = { top: 20, bottom: 20, left: 35, right: 10 };

    ctx.clearRect(0, 0, width, height);

    // Echelle Y
    const maxVal = Math.max(Math.max(...dataArr), 60); // Min 1h pour éviter graphe plat
    const ceiling = Math.ceil(maxVal / 60) * 60; // Arrondi à l'heure sup

    // --- GRILLE ---
    ctx.strokeStyle = "rgba(255,255,255,0.05)";
    ctx.lineWidth = 1;
    ctx.fillStyle = "#666";
    ctx.font = "10px sans-serif";
    ctx.textAlign = "right";
    
    const lines = 4;
    for(let i=0; i<=lines; i++) {
        const y = height - padding.bottom - (i * (height - padding.top - padding.bottom) / lines);
        const valMins = Math.round((i * maxVal) / lines);
        
        ctx.fillText(Math.floor(valMins/60) + "h", padding.left - 5, y + 3);
        
        ctx.beginPath();
        ctx.moveTo(padding.left, y);
        ctx.lineTo(width - padding.right, y);
        ctx.stroke();
    }

    // --- BARRES ---
    const monthNames = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];
    const barWidth = (width - padding.left - padding.right) / 12 * 0.5;
    const gap = (width - padding.left - padding.right) / 12;

    dataArr.forEach((val, i) => {
        if(val > 0) {
            const barHeight = (val / maxVal) * (height - padding.top - padding.bottom);
            const x = padding.left + (i * gap) + (gap - barWidth)/2;
            const y = height - padding.bottom - barHeight;

            // Dégradé paramétrable
            const grad = ctx.createLinearGradient(x, height - padding.bottom, x, y);
            grad.addColorStop(0, styleOptions.color1);
            grad.addColorStop(1, styleOptions.color2);
            
            ctx.fillStyle = grad;
            ctx.fillRect(x, y, barWidth, barHeight);

            // Valeur au survol ou statique (optionnel, ici statique si espace suffisant)
            if(barHeight > 14) {
                ctx.fillStyle = "#fff";
                ctx.textAlign = "center";
                ctx.font = "9px sans-serif";
                ctx.fillText(Math.round(val/60), x + barWidth/2, y - 4);
            }
        }
        
        // Labels mois
        ctx.fillStyle = "#888";
        ctx.textAlign = "center";
        ctx.font = "9px sans-serif";
        const xLbl = padding.left + (i * gap) + (gap / 2);
        ctx.fillText(monthNames[i], xLbl, height - padding.bottom + 12);
    });
}