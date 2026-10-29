/**
 * illu-svg-menubar.js — Menus SVG injectés dans la menubar en mode SVG
 * Menus : Objet, Chemin (Pathfinder), Texte
 * Se cache/montre via CSS [data-svg-only-menu] + body.illu-svg-mode-active
 */
'use strict';
(function (global) {
    let _injected = false;

    function inject() {
        if (_injected) return;
        _injected = true;
        const menubar = document.querySelector('.illu-menubar-root');
        if (!menubar) return;

        // ─── Menu Objet ───────────────────────────────────────────────────────
        const liObject = document.createElement('li');
        liObject.id = 'menu-svg-object';
        liObject.setAttribute('role', 'menuitem');
        liObject.setAttribute('aria-haspopup', 'true');
        liObject.setAttribute('data-svg-only-menu', '');
        liObject.innerHTML = `<span>Objet</span>
        <ul role="menu">
            <li role="menuitem" class="menu-row-icon" onclick="EditorManager.groupActiveVectorSelection&&EditorManager.groupActiveVectorSelection()">
                <span class="menu-icon"><i class="fa-solid fa-object-group"></i></span>Grouper (Ctrl+G)
            </li>
            <li role="menuitem" class="menu-row-icon" onclick="EditorManager.ungroupActiveVectorSelection&&EditorManager.ungroupActiveVectorSelection()">
                <span class="menu-icon"><i class="fa-solid fa-object-ungroup"></i></span>Dégrouper (Ctrl+Shift+G)
            </li>
            <li role="menuitem" class="divider"></li>
            <li role="menuitem" class="menu-row-icon" onclick="EditorManager.moveSelectedVectorElement&&EditorManager.moveSelectedVectorElement('front')">
                <span class="menu-icon"><i class="fa-solid fa-angles-up"></i></span>Premier plan
            </li>
            <li role="menuitem" class="menu-row-icon" onclick="EditorManager.moveSelectedVectorElement&&EditorManager.moveSelectedVectorElement(1)">
                <span class="menu-icon"><i class="fa-solid fa-angle-up"></i></span>Avancer
            </li>
            <li role="menuitem" class="menu-row-icon" onclick="EditorManager.moveSelectedVectorElement&&EditorManager.moveSelectedVectorElement(-1)">
                <span class="menu-icon"><i class="fa-solid fa-angle-down"></i></span>Reculer
            </li>
            <li role="menuitem" class="menu-row-icon" onclick="EditorManager.moveSelectedVectorElement&&EditorManager.moveSelectedVectorElement('back')">
                <span class="menu-icon"><i class="fa-solid fa-angles-down"></i></span>Arrière-plan
            </li>
            <li role="menuitem" class="divider"></li>
            <li role="menuitem" class="menu-row-icon" onclick="EditorManager.duplicateActiveVectorSelection&&EditorManager.duplicateActiveVectorSelection()">
                <span class="menu-icon"><i class="fa-solid fa-clone"></i></span>Dupliquer (Ctrl+D)
            </li>
            <li role="menuitem" class="menu-row-icon" onclick="EditorManager.deleteActiveVectorSelection&&EditorManager.deleteActiveVectorSelection()">
                <span class="menu-icon"><i class="fa-solid fa-trash"></i></span>Supprimer
            </li>
            <li role="menuitem" class="divider"></li>
            <li role="menuitem" class="menu-row-icon" onclick="window.illuSvgObjectsPanel&&window.illuSvgObjectsPanel.toggle()">
                <span class="menu-icon"><i class="fa-solid fa-list"></i></span>Panneau Objets
            </li>
        </ul>`;

        // ─── Menu Chemin (Pathfinder) ─────────────────────────────────────────
        const liPath = document.createElement('li');
        liPath.id = 'menu-svg-path';
        liPath.setAttribute('role', 'menuitem');
        liPath.setAttribute('aria-haspopup', 'true');
        liPath.setAttribute('data-svg-only-menu', '');
        liPath.innerHTML = `<span>Chemin</span>
        <ul role="menu">
            <li role="menuitem" class="menu-row-icon" onclick="window.illuBooleanOps&&window.illuBooleanOps.apply('union')">
                <span class="menu-icon"><i class="fa-solid fa-plus"></i></span>Unir (Ctrl+Shift+F)
            </li>
            <li role="menuitem" class="menu-row-icon" onclick="window.illuBooleanOps&&window.illuBooleanOps.apply('subtract')">
                <span class="menu-icon"><i class="fa-solid fa-minus"></i></span>Soustraire (Ctrl+Shift+--)
            </li>
            <li role="menuitem" class="menu-row-icon" onclick="window.illuBooleanOps&&window.illuBooleanOps.apply('intersect')">
                <span class="menu-icon"><i class="fa-solid fa-circle-half-stroke"></i></span>Intersecter (Ctrl+Shift+I)
            </li>
            <li role="menuitem" class="menu-row-icon" onclick="window.illuBooleanOps&&window.illuBooleanOps.apply('exclude')">
                <span class="menu-icon"><i class="fa-solid fa-x"></i></span>Exclure / XOR (Ctrl+Shift+X)
            </li>
            <li role="menuitem" class="divider"></li>
            <li role="menuitem" class="menu-row-icon" onclick="window.illuSvgAlign&&window.illuSvgAlign.flipH()">
                <span class="menu-icon"><i class="fa-solid fa-left-right"></i></span>Réfléchir horizontalement
            </li>
            <li role="menuitem" class="menu-row-icon" onclick="window.illuSvgAlign&&window.illuSvgAlign.flipV()">
                <span class="menu-icon"><i class="fa-solid fa-up-down"></i></span>Réfléchir verticalement
            </li>
            <li role="menuitem" class="divider"></li>
            <li role="menuitem" class="menu-row-icon" onclick="window.illuSvgAlign&&window.illuSvgAlign.alignLeft()">
                <span class="menu-icon"><i class="fa-solid fa-align-left"></i></span>Aligner à gauche
            </li>
            <li role="menuitem" class="menu-row-icon" onclick="window.illuSvgAlign&&window.illuSvgAlign.alignCenterH()">
                <span class="menu-icon"><i class="fa-solid fa-align-center"></i></span>Centrer horizontalement
            </li>
            <li role="menuitem" class="menu-row-icon" onclick="window.illuSvgAlign&&window.illuSvgAlign.alignRight()">
                <span class="menu-icon"><i class="fa-solid fa-align-right"></i></span>Aligner à droite
            </li>
            <li role="menuitem" class="menu-row-icon" onclick="window.illuSvgAlign&&window.illuSvgAlign.alignTop()">
                <span class="menu-icon"><i class="fa-solid fa-arrow-up"></i></span>Aligner en haut
            </li>
            <li role="menuitem" class="menu-row-icon" onclick="window.illuSvgAlign&&window.illuSvgAlign.alignCenterV()">
                <span class="menu-icon"><i class="fa-solid fa-arrows-up-down"></i></span>Centrer verticalement
            </li>
            <li role="menuitem" class="menu-row-icon" onclick="window.illuSvgAlign&&window.illuSvgAlign.alignBottom()">
                <span class="menu-icon"><i class="fa-solid fa-arrow-down"></i></span>Aligner en bas
            </li>
            <li role="menuitem" class="divider"></li>
            <li role="menuitem" class="menu-row-icon" onclick="window.illuSvgAlign&&window.illuSvgAlign.distributeH()">
                <span class="menu-icon"><i class="fa-solid fa-distribute-column"></i></span>Distribuer horizontalement
            </li>
            <li role="menuitem" class="menu-row-icon" onclick="window.illuSvgAlign&&window.illuSvgAlign.distributeV()">
                <span class="menu-icon"><i class="fa-solid fa-distribute-spacing-vertical"></i></span>Distribuer verticalement
            </li>
            <li role="menuitem" class="divider"></li>
            <li role="menuitem" class="menu-row-icon" onclick="window.illuSvgAlign&&window.illuSvgAlign.addGuide('h',100)">
                <span class="menu-icon"><i class="fa-solid fa-ruler-horizontal"></i></span>Ajouter guide horizontal
            </li>
            <li role="menuitem" class="menu-row-icon" onclick="window.illuSvgAlign&&window.illuSvgAlign.addGuide('v',100)">
                <span class="menu-icon"><i class="fa-solid fa-ruler-vertical"></i></span>Ajouter guide vertical
            </li>
            <li role="menuitem" class="menu-row-icon" onclick="window.illuSvgAlign&&window.illuSvgAlign.clearGuides()">
                <span class="menu-icon"><i class="fa-solid fa-xmark"></i></span>Effacer les guides
            </li>
        </ul>`;

        // ─── Menu Texte ───────────────────────────────────────────────────────
        const liText = document.createElement('li');
        liText.id = 'menu-svg-text';
        liText.setAttribute('role', 'menuitem');
        liText.setAttribute('aria-haspopup', 'true');
        liText.setAttribute('data-svg-only-menu', '');
        liText.innerHTML = `<span>Texte</span>
        <ul role="menu">
            <li role="menuitem" class="menu-row-icon" onclick="window.illuSvgText&&window.illuSvgText.applyTypo('fontWeight','bold')">
                <span class="menu-icon"><b>G</b></span>Gras
            </li>
            <li role="menuitem" class="menu-row-icon" onclick="window.illuSvgText&&window.illuSvgText.applyTypo('fontStyle','italic')">
                <span class="menu-icon"><i>I</i></span>Italique
            </li>
            <li role="menuitem" class="divider"></li>
            <li role="menuitem" class="menu-row-icon" onclick="window.illuSvgText&&window.illuSvgText.applyTypo('textAnchor','start')">
                <span class="menu-icon"><i class="fa-solid fa-align-left"></i></span>Aligner à gauche
            </li>
            <li role="menuitem" class="menu-row-icon" onclick="window.illuSvgText&&window.illuSvgText.applyTypo('textAnchor','middle')">
                <span class="menu-icon"><i class="fa-solid fa-align-center"></i></span>Centrer
            </li>
            <li role="menuitem" class="menu-row-icon" onclick="window.illuSvgText&&window.illuSvgText.applyTypo('textAnchor','end')">
                <span class="menu-icon"><i class="fa-solid fa-align-right"></i></span>Aligner à droite
            </li>
            <li role="menuitem" class="divider"></li>
            <li role="menuitem" class="menu-row-icon" onclick="window.illuSvgText&&window.illuSvgText.attachTextToPath(EditorManager.activeVectorSelection.find(e=>e.tagName==='text'),EditorManager.activeVectorSelection.find(e=>e.tagName==='path'))">
                <span class="menu-icon"><i class="fa-solid fa-bezier-curve"></i></span>Texte sur chemin
            </li>
        </ul>`;

        // ─── Menu Affichage (SVG) ─────────────────────────────────────────────
        const liView = document.createElement('li');
        liView.id = 'menu-svg-view';
        liView.setAttribute('role', 'menuitem');
        liView.setAttribute('aria-haspopup', 'true');
        liView.setAttribute('data-svg-only-menu', '');
        liView.innerHTML = `<span>Affichage SVG</span>
        <ul role="menu">
            <li role="menuitem" class="menu-row-icon" onclick="window.illuSvgObjectsPanel&&window.illuSvgObjectsPanel.toggle()">
                <span class="menu-icon"><i class="fa-solid fa-layer-group"></i></span>Panneau Objets
            </li>
            <li role="menuitem" class="menu-row-icon" onclick="window.illuSvgAlign&&window.illuSvgAlign.addGuide('h',200)">
                <span class="menu-icon"><i class="fa-solid fa-ruler-horizontal"></i></span>Ajouter guide H
            </li>
            <li role="menuitem" class="menu-row-icon" onclick="window.illuSvgAlign&&window.illuSvgAlign.addGuide('v',200)">
                <span class="menu-icon"><i class="fa-solid fa-ruler-vertical"></i></span>Ajouter guide V
            </li>
            <li role="menuitem" class="divider"></li>
            <li role="menuitem" class="menu-row-icon" onclick="window.illuSvgColors&&window.illuSvgColors.startEyedropper()">
                <span class="menu-icon"><i class="fa-solid fa-eye-dropper"></i></span>Pipette vectorielle
            </li>
        </ul>`;

        // Insérer avant le dernier item de la menubar
        const items = menubar.querySelectorAll(':scope > li');
        const lastItem = items[items.length - 1];
        menubar.insertBefore(liObject, lastItem);
        menubar.insertBefore(liPath, lastItem);
        menubar.insertBefore(liText, lastItem);
        menubar.insertBefore(liView, lastItem);
    }

    // ─── Marquer les menus bitmap (pixel-only) pour masquage CSS ────────────
    function markBitmapMenus() {
        const menubar = document.querySelector('.illu-menubar-root');
        if (!menubar) return;
        // En mode SVG, on garde : Fichier (utile), Fenêtre (palettes, règles…)
        // On masque : Édition, Image, Calques, Ajustements, Effets (bitmap)
        const items = menubar.querySelectorAll(':scope > li');
        items.forEach(li => {
            const isSvgOnly = li.hasAttribute('data-svg-only-menu');
            const isPixelOnly = li.hasAttribute('data-pixel-only-menu');
            const isFile = li.id && li.id.startsWith('menu-file');
            // Ne pas toucher aux menus SVG-only ni à Fichier
            if (isSvgOnly || isFile) return;
            if (!isPixelOnly) {
                const span = li.querySelector(':scope > span');
                const text = span ? span.textContent.trim().toLowerCase() : '';
                if (text === 'édition' || text === 'edition' || text === 'image' ||
                    text === 'calques' || text === 'layers' || text === 'ajustements' ||
                    text === 'adjustments' || text === 'effets' || text === 'effects') {
                    li.setAttribute('data-pixel-only-menu', '');
                }
            }
        });
    }

    // ─── Menu Effets SVG (placeholder) ────────────────────────────────────────
    function injectSvgEffectsMenu() {
        const menubar = document.querySelector('.illu-menubar-root');
        if (!menubar) return;
        if (document.getElementById('menu-svg-effects')) return;

        const liEffects = document.createElement('li');
        liEffects.id = 'menu-svg-effects';
        liEffects.setAttribute('role', 'menuitem');
        liEffects.setAttribute('aria-haspopup', 'true');
        liEffects.setAttribute('data-svg-only-menu', '');
        liEffects.innerHTML = `<span>Effets SVG</span>
        <ul role="menu">
            <li role="menuitem" class="menu-row-icon" style="opacity:0.6;cursor:default;pointer-events:none;">
                <span class="menu-icon"><i class="fa-solid fa-wand-magic-sparkles"></i></span>Effets sur les formes SVG — à venir
            </li>
        </ul>`;

        const items = menubar.querySelectorAll(':scope > li');
        const lastItem = items[items.length - 1];
        menubar.insertBefore(liEffects, lastItem);
    }

    function eject() {
        // Les menus sont contrôlés par CSS [data-svg-only-menu], pas besoin de retrait DOM
    }

    global.illuSvgMenubar = { inject, eject, markBitmapMenus, injectSvgEffectsMenu };
})(window);
