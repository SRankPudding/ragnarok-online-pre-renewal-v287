<?php
declare(strict_types=1);

$privateDirectory = getenv('RO_PORTAL_PRIVATE');
if (!is_string($privateDirectory) || !is_dir($privateDirectory) || !is_readable($privateDirectory . '/settings.php')) {
    http_response_code(503);
    exit('Portal setup required.');
}
define('PORTAL_PRIVATE', $privateDirectory);
$settings = require PORTAL_PRIVATE . '/settings.php';

header('Cache-Control: no-store');
header('X-Robots-Tag: noindex, nofollow');
header('X-Content-Type-Options: nosniff');
header('Referrer-Policy: no-referrer');
header("Content-Security-Policy: default-src 'none'; style-src 'self'; script-src 'self'; connect-src 'self'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'");

function stop(int $status, string $message): never
{
    http_response_code($status);
    header('Content-Type: text/plain; charset=utf-8');
    exit($message);
}

function database(string $file): PDO
{
    $db = new PDO('sqlite:' . PORTAL_PRIVATE . '/' . $file, options: [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]);
    $db->exec('PRAGMA busy_timeout=5000');
    return $db;
}

function jsonResponse(mixed $data): never
{
    header('Content-Type: application/json; charset=utf-8');
    exit(json_encode($data, JSON_THROW_ON_ERROR));
}

function roster(): array
{
    $file = PORTAL_PRIVATE . '/roster.json';
    if (!is_readable($file)) return ['available' => false, 'players' => []];
    $snapshot = json_decode(file_get_contents($file), true);
    $fresh = is_array($snapshot) && time() - ($snapshot['updated'] ?? 0) < 75;
    return ['available' => $fresh, 'players' => $snapshot['players'] ?? []];
}

function registrationStatus(string $id): array
{
    if ($id === '') return ['status' => '', 'message' => ''];
    $query = database('portal.sqlite')->prepare('SELECT username, status FROM jobs WHERE id=?');
    $query->execute([$id]);
    $job = $query->fetch();
    if (!$job) return ['status' => '', 'message' => ''];
    return ['status' => $job['status'], 'message' => match ($job['status']) {
        'created' => 'Registrierung erfolgreich. Dein Spielkonto „' . $job['username'] . '“ ist bereit.',
        'taken' => 'Dieser Spielname ist auf dem Spielserver bereits vergeben.',
        'expired' => 'Der Spielserver hat die Anfrage nicht rechtzeitig abgeholt. Bitte versuche es erneut.',
        default => 'Deine Anfrage wartet auf den Spielserver.',
    }];
}

function downloadClient(string $path): never
{
    $file = is_readable($path) ? fopen($path, 'rb') : false;
    if ($file === false) stop(404, 'Der Client-Download ist noch nicht verfügbar.');
    session_write_close();
    $size = fstat($file)['size'];
    $start = 0;
    $end = $size - 1;
    $range = $_SERVER['HTTP_RANGE'] ?? '';
    if ($range !== '') {
        if (!preg_match('/\Abytes=(\d*)-(\d*)\z/', $range, $parts) || ($parts[1] === '' && $parts[2] === '')) {
            header("Content-Range: bytes */$size");
            stop(416, 'Ungültiger Downloadbereich.');
        }
        if ($parts[1] === '') {
            $start = max(0, $size - (int)$parts[2]);
        } else {
            $start = (int)$parts[1];
            if ($parts[2] !== '') $end = min($end, (int)$parts[2]);
        }
        if ($start > $end) {
            header("Content-Range: bytes */$size");
            stop(416, 'Ungültiger Downloadbereich.');
        }
        http_response_code(206);
        header("Content-Range: bytes $start-$end/$size");
    }
    header('Content-Type: application/zip');
    header('Content-Disposition: attachment; filename="Ragnarok Online - Pre-Renewal client source.zip"');
    header('Accept-Ranges: bytes');
    $remaining = $end - $start + 1;
    header("Content-Length: $remaining");
    if ($_SERVER['REQUEST_METHOD'] === 'HEAD') exit;
    set_time_limit(0);
    while (ob_get_level() > 0 && ob_end_clean()) {}
    fseek($file, $start);
    while ($remaining > 0 && !feof($file) && !connection_aborted()) {
        $chunk = fread($file, min($remaining, 1024 * 1024));
        if ($chunk === false || $chunk === '') break;
        echo $chunk;
        $remaining -= strlen($chunk);
        flush();
    }
    fclose($file);
    exit;
}

function bridge(array $settings, string $action): never
{
    $auth = $_SERVER['HTTP_AUTHORIZATION'] ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '';
    $token = str_starts_with($auth, 'Bearer ') ? substr($auth, 7) : '';
    if ($_SERVER['REQUEST_METHOD'] !== 'POST' || !hash_equals($settings['bridge_token_hash'], hash('sha256', $token))) {
        stop(403, 'Zugriff verweigert.');
    }
    if ($action === 'roster') {
        $players = json_decode(file_get_contents('php://input', length: 100000), true);
        if (!is_array($players) || !array_is_list($players) || count($players) > 1000) stop(400, 'Ungültige Spielerliste.');
        foreach ($players as &$player) {
            if (!is_array($player) || !is_string($player['username'] ?? null) ||
                strlen($player['username']) > 96 || !is_bool($player['online'] ?? null)) {
                stop(400, 'Ungültiger Spielereintrag.');
            }
            $player = ['username' => $player['username'], 'online' => $player['online']];
        }
        unset($player);
        $snapshot = json_encode(['updated' => time(), 'players' => $players], JSON_THROW_ON_ERROR);
        $temp = tempnam(PORTAL_PRIVATE, 'roster-');
        if ($temp === false || file_put_contents($temp, $snapshot) === false ||
            !rename($temp, PORTAL_PRIVATE . '/roster.json')) stop(500, 'Spielerliste konnte nicht gespeichert werden.');
        jsonResponse(['ok' => true]);
    }
    $db = database('portal.sqlite');
    if ($action === 'next') {
        $db->exec("UPDATE jobs SET status='expired', password_box=NULL WHERE status='pending' AND created_at < unixepoch() - 1800");
        $job = $db->query("SELECT id, username, password_box FROM jobs WHERE status='pending' ORDER BY created_at, id LIMIT 1")->fetch();
        jsonResponse(['job' => $job ?: null]);
    }
    if ($action !== 'finish') {
        stop(404, 'Unbekannte Aktion.');
    }
    $body = json_decode(file_get_contents('php://input', length: 2048), true);
    $id = is_array($body) ? ($body['id'] ?? null) : null;
    $status = is_array($body) ? ($body['status'] ?? null) : null;
    if (!is_string($id) || !preg_match('/\A[a-f0-9]{32}\z/', $id) || !in_array($status, ['created', 'taken'], true)) {
        stop(400, 'Ungültiges Ergebnis.');
    }
    $finish = $db->prepare("UPDATE jobs SET status=?, password_box=NULL WHERE id=? AND status='pending'");
    $finish->execute([$status, $id]);
    jsonResponse(['ok' => true]);
}

function reserveLoginAttempt(PDO $db, string $key): bool
{
    $db->exec('BEGIN IMMEDIATE');
    try {
        $db->exec('DELETE FROM login_attempts WHERE attempted_at < unixepoch() - 900');
        $query = $db->prepare('SELECT COUNT(*) FROM login_attempts WHERE ip_hash=?');
        $query->execute([$key]);
        if ((int)$query->fetchColumn() >= 8 || (int)$db->query('SELECT COUNT(*) FROM login_attempts')->fetchColumn() >= 60) {
            $db->exec('ROLLBACK');
            return false;
        }
        $db->prepare('INSERT INTO login_attempts VALUES (?, unixepoch())')->execute([$key]);
        $db->exec('COMMIT');
        return true;
    } catch (Throwable $error) {
        $db->exec('ROLLBACK');
        throw $error;
    }
}

function registerAccount(PDO $db, array $settings, string $username, string $password): string
{
    $db->exec('BEGIN IMMEDIATE');
    try {
        if ((int)$db->query('SELECT COUNT(*) FROM jobs WHERE created_at > unixepoch() - 3600')->fetchColumn() >= 10) {
            $db->exec('COMMIT');
            return 'limit';
        }
        $existing = $db->prepare("SELECT 1 FROM jobs WHERE username=? AND status IN ('pending','created')");
        $existing->execute([$username]);
        if ($existing->fetchColumn()) {
            $db->exec('COMMIT');
            return 'taken';
        }
        $id = bin2hex(random_bytes(16));
        $publicKey = base64_decode($settings['box_public_key'], true);
        $box = base64_encode(sodium_crypto_box_seal($password, $publicKey));
        $query = $db->prepare("INSERT INTO jobs VALUES (?, ?, ?, unixepoch(), 'pending')");
        $query->execute([$id, $username, $box]);
        $db->exec('COMMIT');
        return $id;
    } catch (Throwable $error) {
        $db->exec('ROLLBACK');
        throw $error;
    }
}

if (strtolower($_SERVER['HTTPS'] ?? '') !== 'on' && ($_SERVER['SERVER_PORT'] ?? '') != 443) {
    stop(400, 'HTTPS required.');
}
if (isset($_GET['bridge'])) {
    bridge($settings, is_string($_GET['bridge']) ? $_GET['bridge'] : '');
}

$ip = $_SERVER['REMOTE_ADDR'] ?? '';

ini_set('session.use_strict_mode', '1');
ini_set('session.use_only_cookies', '1');
session_name('__Host-ROCommunity');
session_set_cookie_params(['path' => '/', 'secure' => true, 'httponly' => true, 'samesite' => 'Strict']);
session_start();
if (isset($_SESSION['access_until']) && $_SESSION['access_until'] < time()) {
    $_SESSION = [];
}
$_SESSION['csrf'] ??= bin2hex(random_bytes(32));
$signedIn = isset($_SESSION['access_until']);
$message = '';
$downloadPath = PORTAL_PRIVATE . '/client-source.zip';
$registration = ['status' => '', 'message' => ''];

if (isset($_GET['download']) || isset($_GET['status'])) {
    if (!$signedIn) stop(403, 'Bitte zuerst anmelden.');
    if (!in_array($_SERVER['REQUEST_METHOD'], ['GET', 'HEAD'], true)) stop(405, 'Methode nicht erlaubt.');
    if (isset($_GET['download'])) downloadClient($downloadPath);
    jsonResponse(['registration' => registrationStatus($_SESSION['last_job'] ?? ''), 'roster' => roster()]);
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $csrf = $_POST['csrf'] ?? null;
    if (!is_string($csrf) || !hash_equals($_SESSION['csrf'], $csrf)) {
        stop(403, 'Sitzung ungültig. Bitte lade die Seite neu.');
    }
    $action = $_POST['action'] ?? null;
    $name = is_string($_POST['username'] ?? null) ? trim($_POST['username']) : '';
    $password = is_string($_POST['password'] ?? null) ? $_POST['password'] : '';
    if ($action === 'login' && !$signedIn) {
        $db = database('portal.sqlite');
        $key = hash_hmac('sha256', $ip, $settings['attempt_key']);
        if (!reserveLoginAttempt($db, $key)) {
            http_response_code(429);
            $message = 'Zu viele Anmeldeversuche. Versuche es in 15 Minuten erneut.';
        } else {
            $validPassword = strlen($password) <= 128 && password_verify($password, $settings['portal_password_hash']);
            if ($validPassword && hash_equals($settings['portal_username'], $name)) {
                session_regenerate_id(true);
                $_SESSION = ['access_until' => time() + 7200, 'csrf' => bin2hex(random_bytes(32))];
                $db->prepare('DELETE FROM login_attempts WHERE ip_hash=?')->execute([$key]);
                header('Location: /', true, 303);
                exit;
            }
            $message = 'Benutzername oder Passwort stimmt nicht.';
        }
    } elseif ($action === 'logout' && $signedIn) {
        $_SESSION = [];
        session_regenerate_id(true);
        header('Location: /', true, 303);
        exit;
    } elseif ($action === 'register' && $signedIn) {
        if (!preg_match('/\A[a-zA-Z0-9_]{4,23}\z/', $name) || !preg_match('/\A[!-~]{12,23}\z/', $password)) {
            $message = 'Prüfe Spielnamen und Passwort anhand der Vorgaben unter den Feldern.';
        } else {
            $result = registerAccount(database('portal.sqlite'), $settings, strtolower($name), $password);
            if ($result === 'limit') {
                http_response_code(429);
                $message = 'In den letzten 60 Minuten wurden bereits zehn Anfragen angenommen. Versuche es später erneut.';
            } elseif ($result === 'taken') {
                $message = 'Dieser Spielname ist bereits reserviert. Wähle bitte einen anderen.';
            } else {
                $_SESSION['last_job'] = $result;
                header('Location: /', true, 303);
                exit;
            }
        }
    } else {
        stop(400, 'Ungültige Anfrage.');
    }
}

if ($signedIn && $message === '' && isset($_SESSION['last_job'])) {
    $registration = registrationStatus($_SESSION['last_job']);
    $message = $registration['message'];
}

function escape(string $text): string
{
    return htmlspecialchars($text, ENT_QUOTES, 'UTF-8');
}
?>
<!doctype html>
<html lang="de">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title><?= $signedIn ? 'Ragnarok Online – Pre-Renewal | RO Community' : 'Privater Zugang | RO Community' ?></title>
  <link rel="stylesheet" href="/portal.css?v=4">
  <?php if ($signedIn): ?><script src="/portal.js?v=1" defer></script><?php endif; ?>
</head>
<body>
  <main<?= $signedIn ? ' class="signed-in"' : '' ?>>
    <div class="portal-card registration">
      <p class="brand">RO Community</p>
      <div class="crest" aria-hidden="true">✦</div>
      <h1><?= $signedIn ? 'Ragnarok Online' : 'Privater Zugang' ?></h1>
      <p class="intro"><?= $signedIn ? 'Erstelle dein Spielkonto für unsere Pre-Renewal-Welt.' : 'Melde dich mit deinem Portalzugang an.' ?></p>
      <p class="notice" id="registration-notice" role="status" data-status="<?= escape($registration['status']) ?>" <?= $message === '' ? 'hidden' : '' ?>><?= escape($message) ?></p>
      <form method="post">
        <input type="hidden" name="csrf" value="<?= escape($_SESSION['csrf']) ?>">
        <input type="hidden" name="action" value="<?= $signedIn ? 'register' : 'login' ?>">
        <label for="username"><?= $signedIn ? 'Spielname' : 'Benutzername' ?></label>
        <input id="username" name="username" required autocomplete="username" maxlength="<?= $signedIn ? 23 : 64 ?>" <?= $signedIn ? 'minlength="4" pattern="[A-Za-z0-9_]+" aria-describedby="name-help"' : '' ?>>
        <?php if ($signedIn): ?><small id="name-help">4–23 Zeichen. Buchstaben, Zahlen und Unterstrich.</small><?php endif; ?>
        <label for="password"><?= $signedIn ? 'Spielpasswort' : 'Passwort' ?></label>
        <input id="password" name="password" type="password" required autocomplete="<?= $signedIn ? 'new-password' : 'current-password' ?>" maxlength="<?= $signedIn ? 23 : 128 ?>" <?= $signedIn ? 'minlength="12" aria-describedby="password-help"' : '' ?>>
        <?php if ($signedIn): ?><small id="password-help">12–23 Zeichen ohne Leerzeichen oder Umlaute.</small><?php endif; ?>
        <button><?= $signedIn ? 'Spielkonto erstellen' : 'Anmelden' ?></button>
      </form>
    </div>
    <?php if ($signedIn): ?>
      <section class="portal-card community">
        <h2>Windows-Client</h2>
        <?php if (is_readable($downloadPath)): ?>
          <a class="download" href="/?download=1">Client-Quellcode herunterladen</a>
          <small>Quellcode-ZIP · <?= number_format(filesize($downloadPath) / 1e9, 1, ',', '.') ?> GB</small>
          <?php if (is_readable(PORTAL_PRIVATE . '/client-source.sha256')): ?>
            <details class="checksum"><summary>SHA-256-Prüfsumme</summary>
              <code><?= escape(trim(file_get_contents(PORTAL_PRIVATE . '/client-source.sha256'))) ?></code>
            </details>
          <?php endif; ?>
        <?php else: ?>
          <p>Der Download wird vorbereitet.</p>
        <?php endif; ?>
        <h2>Spieler</h2>
        <p id="online-count" role="status">Onlinestatus wird geladen …</p>
        <ul id="players"></ul>
        <form method="post" class="logout">
          <input type="hidden" name="csrf" value="<?= escape($_SESSION['csrf']) ?>">
          <button name="action" value="logout">Abmelden</button>
        </form>
      </section>
    <?php endif; ?>
  </main>
</body>
</html>
