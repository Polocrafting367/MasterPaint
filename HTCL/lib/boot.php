<?php
/**
 * HTCL — amorçage commun : config, timezone, helpers JSON.
 * Tout point d'entrée (index.php, api.php) commence par require de ce fichier.
 */

define('HTCL', '2.0');

mb_internal_encoding('UTF-8');

// XAMPP sort les flottants avec toutes leurs décimales (1790196736.3759999275...),
// ce qui triple le poids du journal et le rend illisible. -1 = plus courte
// écriture qui retombe exactement sur le même nombre.
ini_set('serialize_precision', '-1');

/** Configuration (chargée une seule fois). */
function cfg(?string $key = null, $default = null) {
    static $cfg = null;
    if ($cfg === null) {
        $cfg = require __DIR__ . '/config.php';
        date_default_timezone_set($cfg['timezone'] ?? 'Europe/Paris');
    }
    if ($key === null) return $cfg;
    return $cfg[$key] ?? $default;
}

/** Réponse JSON + fin de script. */
function json_out($data, int $code = 200): void {
    http_response_code($code);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PARTIAL_OUTPUT_ON_ERROR);
    exit;
}

/** Erreur JSON normalisée. */
function json_err(string $message, int $code = 400): void {
    json_out(['ok' => false, 'error' => $message], $code);
}

/** Corps de requête décodé en JSON (tableau vide si absent/invalide). */
function json_body(): array {
    $raw = file_get_contents('php://input') ?: '';
    if ($raw === '') return [];
    $data = json_decode($raw, true);
    return is_array($data) ? $data : [];
}

/** Échappement HTML. */
function h(?string $s): string {
    return htmlspecialchars((string)$s, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}
