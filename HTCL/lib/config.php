<?php
/**
 * HTCL — Configuration.
 *
 * Identifiant / mot de passe / token sont en clair ici : c'est assumé.
 * Ce fichier n'est jamais servi par le web (voir HTCL/.htaccess + le test
 * ci-dessous), mais il reste lisible par quiconque a un accès FTP/SSH.
 */

if (!defined('HTCL')) { http_response_code(403); exit('403'); }

return [
    // --- Accès à la page web (formulaire de connexion) ---
    'user'  => 'polo',
    'pass'  => 'masterpaint',

    // --- Clé utilisée par l'agent Linux pour envoyer ses événements ---
    // Doit être recopiée dans agent/htcl.json (champ "token").
    'token' => 'f48419cf001d4ed977d946811a047e0aeb2ff6d2',

    // --- Divers ---
    'title'          => 'HTCL — Historique des affichages écran',
    'timezone'       => 'Europe/Paris',
    'store'          => __DIR__ . '/../data/events.jsonl',
    'retention_days' => 90,     // 0 = ne jamais purger automatiquement
    'session_name'   => 'htcl_sid',
];
