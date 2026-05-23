/**
 * Contact/Report Problem module for MasterPaint
 * Integrates a Win98-style modal linked to /contact_save.php
 */

var currentAppTitle = "MasterPaint";
const ILLU_GITHUB_PROJECT_URL = 'https://github.com/Polocrafting367/MasterPaint';

/**
 * Opens the contact modal, creating it if it doesn't exist.
 * @param {string} titre - Title of the app for the report.
 */
function openContactModal(titre) {
    if (titre) currentAppTitle = titre;
    
    let modal = document.getElementById('contact-modal');
    
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'contact-modal';
        modal.style.display = 'none';
        modal.style.position = 'fixed';
        modal.style.inset = '0';
        modal.style.zIndex = '5000';
        modal.style.alignItems = 'center';
        modal.style.justifyContent = 'center';
        modal.style.padding = '16px';
        modal.style.background = 'rgba(0,0,0,0.3)';
        
        // MasterPaint structure (Win98 Style)
        modal.innerHTML = `
            <div class="window" style="width: 400px; max-width: 95vw; box-shadow: 2px 2px 20px rgba(0,0,0,0.5);">
                <div class="title-bar">
                    <div class="title-bar-text"><i class="fa-solid fa-paper-plane"></i> <span data-i18n="contact.title">Signaler un problème</span></div>
                    <div class="title-bar-controls">
                        <button type="button" aria-label="Close" onclick="closeContactModal()" class="title-bar-close-btn"></button>
                    </div>
                </div>
                <div class="window-body" style="padding: 15px; display: flex; flex-direction: column; gap: 12px;">
                    <div class="field-row-stacked" style="display: flex; flex-direction: column; gap: 4px;">
                        <label data-i18n="contact.type">Objet :</label>
                        <select id="contact-type" style="width:100%;">
                            <option value="bug" data-i18n="contact.typeBug">🐛 Bug / Erreur</option>
                            <option value="idee" data-i18n="contact.typeIdea">💡 Idée / Amélioration</option>
                            <option value="remarque" data-i18n="contact.typeNote">📝 Remarque</option>
                            <option value="autre" data-i18n="contact.typeOther">📂 Autre</option>
                        </select>
                    </div>

                    <div class="field-row-stacked" style="display: flex; flex-direction: column; gap: 4px;">
                        <label data-i18n="contact.message">Message :</label>
                        <textarea id="contact-message" rows="6" style="width:100%; resize: vertical;" data-i18n-placeholder="contact.messagePlaceholder" placeholder="Décrivez votre problème..."></textarea>
                    </div>

                    <div class="field-row-stacked" style="display: flex; flex-direction: column; gap: 4px;">
                        <label data-i18n="contact.info">Contact (Optionnel) :</label>
                        <input type="text" id="contact-info" style="width:100%;" data-i18n-placeholder="contact.infoPlaceholder" placeholder="NOM / Email">
                    </div>

                    <div style="display:flex; gap:10px; margin-top: 10px; justify-content: space-between; align-items: center; flex-wrap: wrap;">
                        <a href="${ILLU_GITHUB_PROJECT_URL}" target="_blank" rel="noopener noreferrer"
                            class="settings-github-link settings-github-link--compact"
                            data-i18n-title="common.githubProject">
                            <i class="fa-brands fa-github" aria-hidden="true"></i>
                            <span data-i18n="common.githubProject">Projet sur GitHub</span>
                        </a>
                        <div style="display:flex; gap:10px; margin-left: auto;">
                        <button type="button" onclick="closeContactModal()" data-i18n="contact.cancel">Annuler</button>
                        <button type="button" id="contact-send-btn" onclick="sendContactData()" class="btn-primary" style="min-width: 80px;" data-i18n="contact.send">Envoyer</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        
        // Initial translation
        if (window.IlluI18n) window.IlluI18n.apply(modal);
    }

    // Reset fields
    document.getElementById('contact-type').value = 'bug';
    document.getElementById('contact-message').value = '';
    document.getElementById('contact-info').value = '';

    modal.style.display = 'flex';
}

/**
 * Closes the contact modal.
 */
function closeContactModal() {
    const modal = document.getElementById('contact-modal');
    if (modal) modal.style.display = 'none';
}

/**
 * Sends the contact data to the server.
 */
async function sendContactData() {
    const type = document.getElementById('contact-type').value;
    const message = document.getElementById('contact-message').value;
    const contact = document.getElementById('contact-info').value;

    const t = (key, params) => (window.IlluI18n ? window.IlluI18n.t(key, params) : key);

    if (!message.trim()) {
        alert(t('contact.emptyMessage'));
        return;
    }

    const btn = document.getElementById('contact-send-btn'); 
    const originalText = t('contact.send');
    
    if(btn) {
        btn.textContent = t('contact.sending');
        btn.disabled = true;
        btn.style.opacity = "0.7";
    }

    // Device ID from tracker
    const deviceId = localStorage.getItem('app_device_id') || 'Inconnu';

    const payload = {
        appTitle: currentAppTitle,
        type: type,
        message: message,
        contact: contact,
        deviceId: deviceId,
        timestamp: Date.now(),
        userAgent: navigator.userAgent
    };

    try {
        const response = await fetch('/contact_save.php', { 
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) throw new Error("Erreur réseau");

        const result = await response.json();

        if (result.success) {
            alert(t('contact.success'));
            closeContactModal();
        } else {
            alert(t('contact.error', { msg: result.message || "Erreur inconnue" }));
        }
    } catch (e) {
        console.error("Erreur Fetch:", e);
        alert(t('contact.errorNetwork'));
    } finally {
        if(btn) {
            btn.textContent = originalText;
            btn.disabled = false;
            btn.style.opacity = "1";
        }
    }
}
