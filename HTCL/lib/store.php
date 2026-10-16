<?php
/**
 * HTCL — stockage des événements dans un simple fichier texte.
 *
 * Format : `data/events.jsonl`, un objet JSON compact par ligne, encodage UTF-8.
 * C'est lisible dans n'importe quel éditeur, réparable à la main, copiable par
 * FTP, et il n'y a aucune base de données à administrer.
 *
 *   {"uid":"a1b2","source":"pc","rule":"Erreur","label":"Erreur 404",
 *    "zone":"600x160+100+100","started_at":1790195427.5,"ended_at":null,...}
 *
 * Écriture : toujours en ajout en fin de fichier (une seule ligne, verrou
 * exclusif) — c'est l'opération la moins coûteuse et la plus sûre qui soit.
 * Un événement est écrit deux fois : à son apparition, puis à sa disparition.
 * Les lignes partageant un même `uid` sont fusionnées à la lecture, la plus
 * récente l'emportant champ par champ. Le fichier est donc un journal, pas un
 * état : rien n'est jamais réécrit en place, donc rien ne peut être corrompu
 * par deux écritures simultanées.
 *
 * Compactage : quand le journal dépasse `max_bytes`, il est réécrit fusionné,
 * élagué (rétention, plafond de lignes), de façon atomique (fichier temporaire
 * puis renommage). Ce qui sort part dans `data/archive-AAAA-MM.jsonl`, jamais
 * relu par l'application : rien n'est perdu.
 */

require_once __DIR__ . '/boot.php';

const STORE_MAX_BYTES  = 2097152;   // 2 Mio ≈ 10 000 événements avant compactage
const STORE_MAX_EVENTS = 20000;     // plafond après compactage, les plus récents gardés

function store_path(): string {
    $path = (string)cfg('store', __DIR__ . '/../data/events.jsonl');
    $dir  = dirname($path);
    if (!is_dir($dir)) @mkdir($dir, 0775, true);
    return $path;
}

/**
 * Normalise un événement reçu. Lève InvalidArgumentException si inexploitable.
 */
function store_normalize(array $e): array {
    $uid = trim((string)($e['uid'] ?? ''));
    if ($uid === '' || strlen($uid) > 64 || !preg_match('/^[A-Za-z0-9_.-]+$/', $uid)) {
        throw new InvalidArgumentException('uid manquant ou invalide');
    }
    $started = isset($e['started_at']) ? (float)$e['started_at'] : 0.0;
    if ($started <= 0) {
        throw new InvalidArgumentException('started_at manquant');
    }
    $ended = (isset($e['ended_at']) && $e['ended_at'] !== null) ? (float)$e['ended_at'] : null;
    if ($ended !== null && $ended < $started) $ended = $started;

    return [
        'uid'         => $uid,
        'source'      => mb_substr((string)($e['source']  ?? 'inconnu'), 0, 64),
        'project'     => mb_substr((string)($e['project'] ?? 'défaut'), 0, 64),
        'rule'        => mb_substr((string)($e['rule']   ?? 'sans-nom'), 0, 64),
        'label'       => mb_substr((string)($e['label']  ?? ''), 0, 2000),
        'zone'        => mb_substr((string)($e['zone']   ?? ''), 0, 32),
        'started_at'  => round($started, 3),
        'ended_at'    => $ended !== null ? round($ended, 3) : null,
        'duration_ms' => $ended !== null ? (int)round(($ended - $started) * 1000) : null,
        'meta'        => (isset($e['meta']) && is_array($e['meta'])) ? $e['meta'] : [],
        'updated_at'  => round(microtime(true), 3),
    ];
}

/** Sérialise une ligne du journal. */
function store_encode(array $r): string {
    if (empty($r['meta'])) $r['meta'] = new stdClass();   // {} plutôt que [] dans le fichier
    return json_encode($r, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . "\n";
}

/**
 * Ajoute un lot d'événements en une seule écriture.
 *
 * @param array $events  événements bruts
 * @return array{stored:int,errors:string[]}
 */
function store_events(array $events): array {
    $lines  = '';
    $stored = 0;
    $errors = [];

    foreach ($events as $i => $e) {
        if (!is_array($e)) { $errors[] = "#$i : format invalide"; continue; }
        try {
            $lines .= store_encode(store_normalize($e));
            $stored++;
        } catch (InvalidArgumentException $ex) {
            $errors[] = "#$i : " . $ex->getMessage();
        }
    }

    if ($lines !== '') {
        $path = store_path();
        if (file_put_contents($path, $lines, FILE_APPEND | LOCK_EX) === false) {
            throw new RuntimeException("écriture impossible dans $path (droits du dossier data/ ?)");
        }
        if (@filesize($path) > STORE_MAX_BYTES) {
            store_compact();
        }
    }
    return ['stored' => $stored, 'errors' => $errors];
}

/** Ajoute un événement seul. */
function store_event(array $e): array {
    return store_events([$e]);
}

/**
 * Relit le journal et fusionne les lignes par uid.
 *
 * @return array<string,array>  uid => événement, dans l'ordre d'apparition
 */
function store_read(): array {
    $path = store_path();
    if (!is_file($path)) return [];

    $fh = @fopen($path, 'rb');
    if (!$fh) return [];
    @flock($fh, LOCK_SH);

    $out = [];
    while (($line = fgets($fh)) !== false) {
        $line = trim($line);
        if ($line === '' || $line[0] !== '{') continue;
        $r = json_decode($line, true);
        if (!is_array($r) || empty($r['uid'])) continue;   // ligne abîmée : ignorée

        $uid = $r['uid'];
        if (!isset($out[$uid])) {
            $out[$uid] = $r;
            continue;
        }
        // Fusion : la ligne la plus récente complète la précédente sans l'effacer.
        $prev = $out[$uid];
        foreach (['ended_at', 'duration_ms'] as $k) {
            if (($r[$k] ?? null) !== null) $prev[$k] = $r[$k];
        }
        foreach (['label', 'rule', 'source', 'project', 'zone'] as $k) {
            if (!empty($r[$k])) $prev[$k] = $r[$k];
        }
        if (!empty($r['meta'])) $prev['meta'] = $r['meta'];
        $prev['updated_at'] = $r['updated_at'] ?? $prev['updated_at'] ?? null;
        $out[$uid] = $prev;
    }
    @flock($fh, LOCK_UN);
    fclose($fh);
    return $out;
}

/**
 * Réécrit le journal fusionné et élagué. Les événements sortis sont archivés.
 *
 * @param callable|null $keep  filtre supplémentaire : fn(array $e): bool
 * @return int  nombre d'événements retirés du journal actif
 */
function store_compact(?callable $keep = null): int {
    $path = store_path();
    $all  = store_read();
    if (!$all) return 0;

    $days   = (int)cfg('retention_days', 0);
    $limit  = $days > 0 ? microtime(true) - $days * 86400 : null;

    $kept = [];
    $out  = [];
    foreach ($all as $e) {
        $ok = ($limit === null || (float)$e['started_at'] >= $limit)
              && ($keep === null || $keep($e));
        if ($ok) $kept[] = $e; else $out[] = $e;
    }

    usort($kept, static fn($a, $b) => $a['started_at'] <=> $b['started_at']);
    if (count($kept) > STORE_MAX_EVENTS) {
        $excess = array_splice($kept, 0, count($kept) - STORE_MAX_EVENTS);
        $out = array_merge($out, $excess);
    }
    if (!$out) {
        // Rien à retirer : inutile de réécrire, sauf si la fusion a fait maigrir le fichier.
        if (count($all) === count($kept) && @filesize($path) <= STORE_MAX_BYTES) return 0;
    }

    // Archivage de ce qui sort, avant toute réécriture.
    if ($out) {
        $archive = dirname($path) . '/archive-' . date('Y-m') . '.jsonl';
        $buf = '';
        foreach ($out as $e) $buf .= store_encode($e);
        @file_put_contents($archive, $buf, FILE_APPEND | LOCK_EX);
    }

    $buf = '';
    foreach ($kept as $e) $buf .= store_encode($e);

    $tmp = $path . '.tmp' . getmypid();
    if (@file_put_contents($tmp, $buf, LOCK_EX) === false) return 0;
    @rename($tmp, $path);       // atomique : aucun lecteur ne voit de fichier à moitié écrit
    return count($out);
}

/** Liste filtrée, la plus récente d'abord. */
function list_events(array $f = []): array {
    $rows = array_values(store_read());

    $rule    = $f['rule']    ?? null;
    $source  = $f['source']  ?? null;
    $project = $f['project'] ?? null;
    $since   = !empty($f['since']) ? (float)$f['since'] : null;
    $until  = !empty($f['until']) ? (float)$f['until'] : null;
    $open   = !empty($f['open']);
    $q      = isset($f['q']) ? mb_strtolower(trim((string)$f['q'])) : '';

    $rows = array_filter($rows, static function ($e) use ($rule, $source, $project, $since, $until, $open, $q) {
        if ($rule    && $e['rule']    !== $rule)    return false;
        if ($source  && $e['source']  !== $source)  return false;
        if ($project && ($e['project'] ?? 'défaut') !== $project) return false;
        if ($since !== null && (float)$e['started_at'] < $since) return false;
        if ($until !== null && (float)$e['started_at'] > $until) return false;
        if ($open && ($e['ended_at'] ?? null) !== null) return false;
        if ($q !== '' && mb_strpos(mb_strtolower($e['label'] . ' ' . $e['rule']), $q) === false) return false;
        return true;
    });

    usort($rows, static fn($a, $b) => $b['started_at'] <=> $a['started_at']);

    $offset = max(0, (int)($f['offset'] ?? 0));
    $limit  = max(1, min(2000, (int)($f['limit'] ?? 200)));
    $rows   = array_slice($rows, $offset, $limit);

    foreach ($rows as &$r) {
        $r['started_at']  = (float)$r['started_at'];
        $r['ended_at']    = isset($r['ended_at']) && $r['ended_at'] !== null ? (float)$r['ended_at'] : null;
        $r['duration_ms'] = isset($r['duration_ms']) && $r['duration_ms'] !== null ? (int)$r['duration_ms'] : null;
        $r['meta']        = !empty($r['meta']) ? $r['meta'] : new stdClass();
        unset($r['updated_at']);
    }
    return $rows;
}

/** Agrégats du tableau de bord. */
function stats(?float $dayStart = null): array {
    $all = store_read();
    $day = $dayStart ?? (float)strtotime('today midnight');

    $todayCount = 0; $todayMs = 0; $open = 0;
    $byRule = []; $byProject = []; $sources = []; $rules = []; $projects = [];
    $buckets = array_fill(0, 24, 0);
    $since24 = microtime(true) - 24 * 3600;

    foreach ($all as $e) {
        $start = (float)$e['started_at'];
        $ms    = isset($e['duration_ms']) && $e['duration_ms'] !== null ? (int)$e['duration_ms'] : 0;
        $proj = $e['project'] ?? 'défaut';
        $sources[$e['source']] = true;
        $rules[$e['rule']] = true;
        $projects[$proj] = true;
        if (($e['ended_at'] ?? null) === null) $open++;
        if ($start >= $since24) $buckets[(int)date('G', (int)$start)]++;
        if ($start < $day) continue;

        $todayCount++;
        $todayMs += $ms;
        $r = $byRule[$e['rule']] ?? ['rule' => $e['rule'], 'count' => 0, 'total_ms' => 0, 'last_at' => 0.0];
        $r['count']++;
        $r['total_ms'] += $ms;
        $r['last_at'] = max($r['last_at'], $start);
        $byRule[$e['rule']] = $r;

        $p = $byProject[$proj] ?? ['project' => $proj, 'count' => 0, 'total_ms' => 0, 'last_at' => 0.0];
        $p['count']++;
        $p['total_ms'] += $ms;
        $p['last_at'] = max($p['last_at'], $start);
        $byProject[$proj] = $p;
    }

    foreach ($byRule as &$r) {
        $r['avg_ms'] = $r['count'] ? (int)round($r['total_ms'] / $r['count']) : 0;
    }
    unset($r);
    $byTime = static fn($a, $b) => [$b['total_ms'], $b['count']] <=> [$a['total_ms'], $a['count']];
    usort($byRule, $byTime);
    usort($byProject, $byTime);

    ksort($sources); ksort($rules); ksort($projects);
    return [
        'total_events' => count($all),
        'today_count'  => $todayCount,
        'today_ms'     => $todayMs,
        'open_count'   => $open,
        'by_rule'      => array_slice(array_values($byRule), 0, 12),
        'by_project'   => array_slice(array_values($byProject), 0, 12),
        'by_hour'      => $buckets,
        'sources'      => array_keys($sources),
        'rules'        => array_keys($rules),
        'projects'     => array_keys($projects),
    ];
}

/** Supprime des événements. Sans filtre : tout. @return int nombre supprimé */
function purge_events(array $f = []): int {
    $rule    = $f['rule']    ?? null;
    $source  = $f['source']  ?? null;
    $project = $f['project'] ?? null;
    $before  = !empty($f['before']) ? (float)$f['before'] : null;

    if ($rule === null && $source === null && $project === null && $before === null) {
        $path = store_path();
        $n = count(store_read());
        @file_put_contents($path, '', LOCK_EX);
        return $n;
    }
    // On garde ce qui ne correspond PAS au filtre ; le reste part aux archives.
    return store_compact(static function (array $e) use ($rule, $source, $project, $before) {
        $match = ($rule    === null || $e['rule']   === $rule)
              && ($source  === null || $e['source'] === $source)
              && ($project === null || ($e['project'] ?? 'défaut') === $project)
              && ($before  === null || (float)$e['started_at'] < $before);
        return !$match;
    });
}

/** Purge d'ancienneté, déclenchée de temps en temps depuis l'ingestion. */
function apply_retention(): void {
    if ((int)cfg('retention_days', 0) > 0) store_compact();
}
