/**
 * rust-try.js — Invitation à essayer la version Rust de MasterPaint (/rust-app/).
 *  - bouton « Essayer la version Rust » en haut à droite de la barre rapide ;
 *  - petite fenêtre de présentation à la première visite (masquable définitivement).
 * La version Rust propose en retour un bouton « Version web classique » vers /.
 */
(function () {
    'use strict';

    // URL relative au dossier de l'application : fonctionne à la racine de masterpaint.fr
    // comme dans un sous-dossier (http://localhost/MasterPaint/).
    const APP_BASE = (document.currentScript && document.currentScript.src)
        ? document.currentScript.src.replace(/js\/app\/rust-try\.js.*$/, '')
        : document.baseURI;
    const RUST_URL = new URL('rust-app/', APP_BASE).href;
    const SEEN_KEY = 'illu_rust_try_seen';

    function goRust() {
        window.location.href = RUST_URL;
    }

    function injectStyles() {
        if (document.getElementById('illu-rust-try-styles')) return;
        const st = document.createElement('style');
        st.id = 'illu-rust-try-styles';
        st.textContent = `
            /* #id + !important : la règle générique des boutons de theme-win10-flat.css
               (body:not(...) button:not(...)) imposait z-index: 1, et la barre d'onglets
               recouvrait alors le bouton et recevait ses clics. */
            #illu-rust-try-btn.illu-rust-try-btn {
                position: fixed !important; top: 28px; right: 8px; z-index: 4950 !important;
                display: inline-flex; align-items: center; gap: 6px;
                height: 22px; padding: 0 10px;
                font: 11px "Segoe UI", sans-serif; color: #1a1a1a;
                background: transparent; border: 1px solid #cdcdcd; cursor: pointer;
            }
            .illu-rust-try-btn:hover { background: color-mix(in srgb, var(--mp-accent, #0d7a7a) 14%, #fff); border-color: var(--mp-accent, #0d7a7a); }
            .illu-rust-try-btn .tag { font-size: 9px; padding: 0 4px; border: 1px solid #d97706; color: #b45309; background: #f59e0b30; border-radius: 3px; }
            body.theme-dark .illu-rust-try-btn { color: #f3f3f3; border-color: #454545; }
            .illu-rust-try-pop {
                position: fixed; right: 16px; bottom: 40px; z-index: 1300; width: 320px;
                background: #f0f0f0; border: 1px solid #cdcdcd; border-radius: 8px;
                box-shadow: 0 4px 18px rgba(0,0,0,.25); font: 12px "Segoe UI", sans-serif; color: #000;
            }
            .illu-rust-try-pop header { padding: 6px 10px; background: #f3f3f3; border-radius: 8px 8px 0 0; display: flex; justify-content: space-between; align-items: center; }
            .illu-rust-try-pop header button { width: 17px; height: 17px; border: 0; background: #c75050; color: #fff; cursor: pointer; line-height: 17px; padding: 0; }
            .illu-rust-try-pop header button:hover { background: #e04343; }
            .illu-rust-try-pop .body { padding: 10px; line-height: 1.45; }
            .illu-rust-try-pop .actions { display: flex; gap: 8px; justify-content: flex-end; padding: 0 10px 10px; }
            .illu-rust-try-pop .actions button { height: 22px; padding: 0 10px; font: 11px "Segoe UI", sans-serif; background: #fdfdfd; border: 1px solid #d0d0d0; cursor: pointer; }
            .illu-rust-try-pop .actions button.primary { border: 2px solid var(--mp-accent, #0d7a7a); }
            .illu-rust-try-pop .actions button:hover { border-color: var(--mp-accent, #0d7a7a); }
            body.theme-dark .illu-rust-try-pop { background: #2b2b2b; color: #f3f3f3; border-color: #454545; }
            body.theme-dark .illu-rust-try-pop header { background: #202020; }
            body.theme-dark .illu-rust-try-pop .actions button { background: #333; color: #f3f3f3; border-color: #555; }
        `;
        document.head.appendChild(st);
    }

    function addButton() {
        if (document.querySelector('.illu-rust-try-btn')) return;
        const b = document.createElement('button');
        b.type = 'button';
        b.id = 'illu-rust-try-btn';
        b.className = 'illu-rust-try-btn';
        b.title = 'Ouvrir la nouvelle interface écrite en Rust (plus rapide)';
        b.innerHTML = '<i class="fa-solid fa-rocket" aria-hidden="true"></i> Essayer la version Rust <span class="tag">bêta</span>';
        b.addEventListener('click', goRust);
        document.body.appendChild(b);
    }

    function showPopup() {
        let seen = false;
        try {
            seen = localStorage.getItem(SEEN_KEY) === '1';
        } catch (e) { /* stockage indisponible */ }
        if (seen) return;
        const pop = document.createElement('div');
        pop.className = 'illu-rust-try-pop';
        pop.setAttribute('role', 'dialog');
        pop.innerHTML = `
            <header><span>Nouveau : MasterPaint en Rust</span><button type="button" aria-label="Fermer">✕</button></header>
            <div class="body">Une nouvelle version de MasterPaint, écrite en Rust, est en cours de transfert :
                même disposition Paint.NET, outils et effets plus fluides. Certaines fonctions sont encore
                marquées « à venir ». Vous pouvez revenir ici à tout moment.</div>
            <div class="actions">
                <button type="button" data-a="never">Ne plus afficher</button>
                <button type="button" data-a="later">Plus tard</button>
                <button type="button" class="primary" data-a="try">Essayer</button>
            </div>`;
        const close = (never) => {
            if (never) {
                try {
                    localStorage.setItem(SEEN_KEY, '1');
                } catch (e) { /* stockage indisponible */ }
            }
            pop.remove();
        };
        pop.querySelector('header button').addEventListener('click', () => close(false));
        pop.querySelectorAll('.actions button').forEach((btn) => {
            btn.addEventListener('click', () => {
                const a = btn.dataset.a;
                if (a === 'try') {
                    close(true);
                    goRust();
                } else {
                    close(a === 'never');
                }
            });
        });
        document.body.appendChild(pop);
    }

    function init() {
        // pas dans l'application de bureau Tauri ni dans un cadre intégré
        if (window.__TAURI_INTERNALS__ || window.top !== window.self) return;
        injectStyles();
        addButton();
        setTimeout(showPopup, 2500);
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();
