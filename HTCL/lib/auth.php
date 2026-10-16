<?php
/**
 * HTCL — authentification.
 *
 * Deux portes distinctes :
 *  - la page web : session PHP ouverte par le couple identifiant/mot de passe ;
 *  - l'agent Linux : en-tête `X-HTCL-Token` (ou champ `token`), sans session.
 */

require_once __DIR__ . '/boot.php';

function session_boot(): void {
    if (session_status() === PHP_SESSION_ACTIVE) return;
    session_name(cfg('session_name', 'htcl_sid'));
    session_set_cookie_params([
        'lifetime' => 0,
        'path'     => '/',
        'httponly' => true,
        'samesite' => 'Lax',
        'secure'   => !empty($_SERVER['HTTPS']),
    ]);
    session_start();
}

function is_logged(): bool {
    session_boot();
    return !empty($_SESSION['htcl_user']);
}

/** Vérifie le couple identifiant/mot de passe et ouvre la session. */
function login(string $user, string $pass): bool {
    session_boot();
    $okUser = hash_equals((string)cfg('user'), $user);
    $okPass = hash_equals((string)cfg('pass'), $pass);
    if (!$okUser || !$okPass) {
        usleep(400000); // petit frein contre le bourrinage
        return false;
    }
    session_regenerate_id(true);
    $_SESSION['htcl_user'] = $user;
    $_SESSION['htcl_csrf'] = bin2hex(random_bytes(16));
    $_SESSION['htcl_since'] = time();
    return true;
}

function logout(): void {
    session_boot();
    $_SESSION = [];
    if (ini_get('session.use_cookies')) {
        $p = session_get_cookie_params();
        setcookie(session_name(), '', time() - 42000, $p['path'], $p['domain'], $p['secure'], $p['httponly']);
    }
    session_destroy();
}

function csrf_token(): string {
    session_boot();
    if (empty($_SESSION['htcl_csrf'])) $_SESSION['htcl_csrf'] = bin2hex(random_bytes(16));
    return $_SESSION['htcl_csrf'];
}

function csrf_check(?string $given): bool {
    session_boot();
    return !empty($_SESSION['htcl_csrf']) && is_string($given)
        && hash_equals($_SESSION['htcl_csrf'], $given);
}

/** Token de l'agent, cherché dans l'en-tête puis dans le corps/query. */
function given_token(): string {
    $h = $_SERVER['HTTP_X_HTCL_TOKEN'] ?? '';
    if ($h === '' && !empty($_SERVER['HTTP_AUTHORIZATION'])
        && preg_match('/Bearer\s+(\S+)/i', $_SERVER['HTTP_AUTHORIZATION'], $m)) {
        $h = $m[1];
    }
    if ($h === '') $h = (string)($_REQUEST['token'] ?? '');
    return trim($h);
}

function token_ok(): bool {
    $t = given_token();
    return $t !== '' && hash_equals((string)cfg('token'), $t);
}

/** Accès machine : réservé à l'agent. */
function require_token(): void {
    if (!token_ok()) json_err('token invalide', 401);
}

/** Accès lecture : navigateur connecté ou agent porteur du token. */
function require_session_or_token(): void {
    if (!is_logged() && !token_ok()) json_err('non authentifié', 401);
}

function require_session(): void {
    if (!is_logged()) json_err('non authentifié', 401);
}
