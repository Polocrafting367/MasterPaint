<?php
/**
 * HTCL — page unique : formulaire de connexion, puis tableau de bord.
 * Les données sont ensuite chargées en fetch() sur api.php.
 */

require_once __DIR__ . '/lib/auth.php';
session_boot();

$error = '';

if (($_SERVER['REQUEST_METHOD'] ?? '') === 'POST' && ($_POST['do'] ?? '') === 'login') {
    if (login((string)($_POST['user'] ?? ''), (string)($_POST['pass'] ?? ''))) {
        header('Location: ' . strtok($_SERVER['REQUEST_URI'], '?'));
        exit;
    }
    $error = 'Identifiant ou mot de passe incorrect.';
}

if (isset($_GET['logout'])) {
    if (csrf_check($_GET['csrf'] ?? null)) logout();
    header('Location: ' . strtok($_SERVER['REQUEST_URI'], '?'));
    exit;
}

$title = (string)cfg('title');
?>
<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#f0efec" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#1f1f1d" media="(prefers-color-scheme: dark)">
<meta name="mobile-web-app-capable" content="yes">
<meta name="robots" content="noindex, nofollow">
<title><?= h($title) ?></title>
<link rel="stylesheet" href="assets/app.css?v=1">
</head>
<body class="<?= is_logged() ? 'app' : 'gate' ?>">

<?php if (!is_logged()): ?>

  <main class="login">
    <form method="post" autocomplete="off">
      <h1>HTCL</h1>
      <p class="sub">Historique des textes captés à l'écran</p>
      <?php if ($error): ?><p class="err"><?= h($error) ?></p><?php endif; ?>
      <input type="hidden" name="do" value="login">
      <label>Identifiant
        <input name="user" required autofocus autocapitalize="off" spellcheck="false">
      </label>
      <label>Mot de passe
        <input name="pass" type="password" required>
      </label>
      <button type="submit">Entrer</button>
    </form>
  </main>

<?php else: ?>

  <header class="topbar">
    <div class="brand"><span class="dot" id="pulse"></span> HTCL</div>
    <details class="filterbox" id="filterbox" open>
      <summary>Filtres <span id="filter-summary"></span></summary>
      <div class="filters">
        <select id="f-project"><option value="">Tous les projets</option></select>
        <select id="f-source"><option value="">Toutes les sources</option></select>
        <select id="f-rule"><option value="">Toutes les règles</option></select>
        <select id="f-range">
          <option value="today">Aujourd'hui</option>
          <option value="3600">Dernière heure</option>
          <option value="86400">24 h</option>
          <option value="604800">7 jours</option>
          <option value="0">Tout</option>
        </select>
        <input id="f-q" type="search" placeholder="Rechercher un texte…" spellcheck="false">
      </div>
    </details>
    <div class="actions">
      <label class="auto"><input type="checkbox" id="f-auto" checked> auto</label>
      <a class="btn" id="export" href="api.php?action=export">CSV</a>
      <button class="btn danger" id="purge">Vider</button>
      <a class="btn" href="?logout=1&amp;csrf=<?= h(csrf_token()) ?>">Quitter</a>
    </div>
  </header>

  <main class="wrap">
    <section class="kpis" id="kpis"></section>

    <section class="panel" id="live-panel" hidden>
      <h2>Affichages en cours</h2>
      <div id="live" class="live"></div>
    </section>

    <div class="grid">
      <section class="panel">
        <h2>Temps d'affichage par projet <span class="hint" id="proj-scope"></span></h2>
        <div id="by-project" class="bars"></div>
      </section>
      <section class="panel">
        <h2>Temps d'affichage par règle <span class="hint" id="rules-scope"></span></h2>
        <div id="by-rule" class="bars"></div>
      </section>
      <section class="panel">
        <h2>Événements par heure <span class="hint">24 dernières heures</span></h2>
        <div id="by-hour" class="hours"></div>
      </section>
    </div>

    <section class="panel">
      <h2>Historique <span class="hint" id="count"></span></h2>
      <div class="table-wrap">
        <table id="events">
          <thead>
            <tr>
              <th>Début</th><th>Fin</th><th class="num">Durée</th>
              <th>Projet</th><th>Règle</th><th>Texte reconnu</th><th>Source</th>
            </tr>
          </thead>
          <tbody></tbody>
        </table>
      </div>
      <p class="empty" id="empty" hidden>Aucun événement pour ce filtre.</p>
    </section>
  </main>

  <div class="statusbar" id="statusbar">chargement…</div>

  <div id="tip" class="tip" hidden></div>

  <script>window.HTCL = { csrf: <?= json_encode(csrf_token()) ?> };</script>
  <script src="assets/app.js?v=1"></script>

<?php endif; ?>
</body>
</html>
