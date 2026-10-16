<?php
/**
 * HTCL — API HTTP.
 *
 *   POST ?action=ingest   (token)            réception des événements de l'agent
 *   GET  ?action=ping     (token ou session) test de vie + vérification du token
 *   GET  ?action=list     (session ou token) événements filtrés
 *   GET  ?action=stats    (session ou token) agrégats du tableau de bord
 *   GET  ?action=export   (session)          export CSV
 *   POST ?action=purge    (session + csrf)   suppression
 */

require_once __DIR__ . '/lib/store.php';
require_once __DIR__ . '/lib/auth.php';

$action = (string)($_GET['action'] ?? $_POST['action'] ?? 'ping');
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

try {
    switch ($action) {

        case 'ping':
            require_session_or_token();
            json_out([
                'ok'     => true,
                'app'    => 'HTCL',
                'time'   => microtime(true),
                'tz'     => cfg('timezone'),
                'as'     => is_logged() ? 'session' : 'agent',
            ]);

        case 'ingest': {
            require_token();
            if ($method !== 'POST') json_err('POST attendu', 405);

            $body = json_body();
            if (!$body) json_err('corps JSON vide ou illisible');

            $events = $body['events'] ?? null;
            if ($events === null && isset($body['uid'])) $events = [$body]; // événement seul
            if (!is_array($events) || !$events) json_err('aucun événement');
            if (count($events) > 500) json_err('lot trop gros (max 500)');

            // Valeurs communes au lot, que chaque événement peut redéfinir.
            $defaults = [
                'source'  => (string)($body['source']  ?? ''),
                'project' => (string)($body['project'] ?? ''),
            ];
            foreach ($events as &$e) {
                if (!is_array($e)) continue;
                foreach ($defaults as $k => $v) {
                    if ($v !== '' && empty($e[$k])) $e[$k] = $v;
                }
            }
            unset($e);

            $res = store_events($events);      // une seule écriture pour tout le lot
            if (random_int(1, 50) === 1) apply_retention();

            json_out([
                'ok'     => $res['errors'] === [],
                'stored' => $res['stored'],
                'errors' => $res['errors'],
                'time'   => microtime(true),
            ], $res['errors'] && $res['stored'] === 0 ? 400 : 200);
        }

        case 'list':
            require_session_or_token();
            json_out([
                'ok'     => true,
                'events' => list_events([
                    'rule'    => $_GET['rule']    ?? null,
                    'source'  => $_GET['source']  ?? null,
                    'project' => $_GET['project'] ?? null,
                    'q'      => $_GET['q']      ?? null,
                    'since'  => $_GET['since']  ?? null,
                    'until'  => $_GET['until']  ?? null,
                    'open'   => !empty($_GET['open']),
                    'limit'  => $_GET['limit']  ?? 200,
                    'offset' => $_GET['offset'] ?? 0,
                ]),
                'now'    => microtime(true),
            ]);

        case 'stats': {
            require_session_or_token();
            $since = isset($_GET['since']) ? (float)$_GET['since'] : null;
            json_out(['ok' => true, 'stats' => stats($since), 'now' => microtime(true)]);
        }

        case 'export': {
            require_session();
            $rows = list_events([
                'rule'    => $_GET['rule']    ?? null,
                'source'  => $_GET['source']  ?? null,
                'project' => $_GET['project'] ?? null,
                'q'       => $_GET['q']       ?? null,
                'since'   => $_GET['since']   ?? null,
                'limit'   => 2000,
            ]);
            header('Content-Type: text/csv; charset=utf-8');
            header('Content-Disposition: attachment; filename="htcl-' . date('Y-m-d_His') . '.csv"');
            $out = fopen('php://output', 'w');
            fwrite($out, "\xEF\xBB\xBF"); // BOM : Excel ouvre l'UTF-8 correctement
            fputcsv($out, ['uid', 'source', 'projet', 'règle', 'texte', 'zone',
                           'début', 'fin', 'durée (s)'], ';');
            foreach ($rows as $r) {
                fputcsv($out, [
                    $r['uid'], $r['source'], $r['project'] ?? 'défaut',
                    $r['rule'], $r['label'], $r['zone'],
                    date('Y-m-d H:i:s', (int)$r['started_at']),
                    $r['ended_at'] ? date('Y-m-d H:i:s', (int)$r['ended_at']) : '',
                    $r['duration_ms'] !== null ? number_format($r['duration_ms'] / 1000, 3, ',', '') : '',
                ], ';');
            }
            fclose($out);
            exit;
        }

        case 'purge': {
            require_session();
            if ($method !== 'POST') json_err('POST attendu', 405);
            $body = json_body() ?: $_POST;
            if (!csrf_check($body['csrf'] ?? null)) json_err('jeton CSRF invalide', 403);
            $deleted = purge_events([
                'rule'    => $body['rule']    ?? null,
                'source'  => $body['source']  ?? null,
                'project' => $body['project'] ?? null,
                'before'  => $body['before']  ?? null,
            ]);
            json_out(['ok' => true, 'deleted' => $deleted]);
        }

        default:
            json_err('action inconnue : ' . $action, 404);
    }
} catch (Throwable $e) {
    json_err('erreur serveur : ' . $e->getMessage(), 500);
}
