<?php
// English Sprint: API. L'app è pubblica e gratuita: chiunque fa le lezioni senza account.
//   GET  ?r=session         -> { logged: bool, ai: {used, max} }  chi ha l'account del portale /apps/ sincronizza i progressi
//   GET  ?r=progress        -> { data: {...} | null }    progressi salvati (solo con il login del portale)
//   POST ?r=progress        -> { ok: true }              salva i progressi (JSON intero, max 3 MB; solo con il login)
//   POST ?r=ai              -> correzioni e tutor con Groq (gratis): kind = writing | translation | speaking | chat | explain
// Chi non ha l'account tiene i progressi nel browser. Le chiamate AI hanno dei tetti (quota gratuita di Groq):
//   senza account: ENG_AI_IP_DAY al giorno e ENG_AI_IP_MIN al minuto per indirizzo IP, ENG_AI_GUEST_DAY al giorno in tutto;
//   con l'account del portale: 400 al giorno (come prima).
// Tabelle nel DB del sito (si creano da sole): eng_progress, eng_ai_log (per utente), eng_ai_limit (per IP, solo l'impronta).
// Chiave Groq: private/english-sprint.php ('groq_key'), se manca quella di private/bollette-chiare.php.
declare(strict_types=1);

require __DIR__ . '/../../portal/lib.php';
require __DIR__ . '/../lib/ai.php';

const ENG_AI_USER_DAY = 400;   // con l'account del portale
const ENG_AI_IP_DAY = 30;      // senza account, per IP e giorno
const ENG_AI_IP_MIN = 6;       // senza account, per IP e minuto
const ENG_AI_GUEST_DAY = 300;  // senza account, tutti insieme al giorno

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Robots-Tag: noindex, nofollow');

function out($data, int $code = 200): void
{
    http_response_code($code);
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

$route = (string) ($_GET['r'] ?? '');
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

if ($method === 'POST' && ($_SERVER['HTTP_X_REQUESTED_WITH'] ?? '') !== 'english-sprint') {
    out(['error' => 'Richiesta non valida'], 400); // protezione semplice contro i POST da altri siti
}

function body(): array
{
    $raw = file_get_contents('php://input', false, null, 0, 3 * 1024 * 1024 + 1);
    if ($raw === false || strlen($raw) > 3 * 1024 * 1024) out(['error' => 'Dati troppo grandi'], 413);
    $d = json_decode($raw, true);
    if (!is_array($d)) out(['error' => 'JSON non valido'], 400);
    return $d;
}

function db(): PDO
{
    static $ready = false;
    $db = portal_db();
    if (!$ready) {
        $db->exec("CREATE TABLE IF NOT EXISTS eng_progress (
            fk_user INT NOT NULL PRIMARY KEY,
            data MEDIUMTEXT NOT NULL,
            updated_at DATETIME NOT NULL
        ) DEFAULT CHARSET=utf8mb4");
        $db->exec("CREATE TABLE IF NOT EXISTS eng_ai_log (
            fk_user INT NOT NULL,
            day DATE NOT NULL,
            calls INT NOT NULL DEFAULT 0,
            PRIMARY KEY (fk_user, day)
        ) DEFAULT CHARSET=utf8mb4");
        $db->exec("CREATE TABLE IF NOT EXISTS eng_ai_limit (
            k CHAR(16) NOT NULL,
            bucket VARCHAR(16) NOT NULL,
            calls INT NOT NULL DEFAULT 0,
            day DATE NOT NULL,
            PRIMARY KEY (k, bucket),
            KEY day (day)
        ) DEFAULT CHARSET=utf8mb4");
        $ready = true;
    }
    return $db;
}

function current_user(): ?array
{
    try {
        return portal_current_user();
    } catch (Throwable $e) {
        error_log('english-sprint: ' . $e->getMessage());
        return null;
    }
}

// impronta dell'IP (cambia ogni giorno): nel DB non resta l'indirizzo vero
function ip_key(): string
{
    return substr(hash('sha256', ($_SERVER['REMOTE_ADDR'] ?? '') . '|' . date('Y-m-d') . '|english-sprint'), 0, 16);
}

// conta una chiamata nel secchio (k, bucket) e restituisce il totale
function bump(PDO $db, string $k, string $bucket): int
{
    $db->prepare('INSERT INTO eng_ai_limit (k, bucket, calls, day) VALUES (?, ?, 1, CURDATE()) ON DUPLICATE KEY UPDATE calls = calls + 1')->execute([$k, $bucket]);
    $st = $db->prepare('SELECT calls FROM eng_ai_limit WHERE k = ? AND bucket = ?');
    $st->execute([$k, $bucket]);
    return (int) $st->fetchColumn();
}

function used_today(PDO $db, string $k): int
{
    $st = $db->prepare('SELECT calls FROM eng_ai_limit WHERE k = ? AND bucket = ?');
    $st->execute([$k, 'd' . date('Ymd')]);
    return (int) $st->fetchColumn();
}

$user = current_user();

try {
    if ($route === 'session' && $method === 'GET') {
        if ($user) {
            $st = db()->prepare('SELECT calls FROM eng_ai_log WHERE fk_user = ? AND day = CURDATE()');
            $st->execute([(int) $user['id']]);
            out(['logged' => true, 'ai' => ['used' => (int) $st->fetchColumn(), 'max' => ENG_AI_USER_DAY]]);
        }
        out(['logged' => false, 'ai' => ['used' => used_today(db(), ip_key()), 'max' => ENG_AI_IP_DAY]]);
    }

    if ($route === 'progress') {
        if (!$user) out(['error' => 'Accesso richiesto'], 401);
        $uid = (int) $user['id'];
        if ($method === 'GET') {
            $st = db()->prepare('SELECT data FROM eng_progress WHERE fk_user = ?');
            $st->execute([$uid]);
            $row = $st->fetch();
            out(['data' => $row ? json_decode($row['data'], true) : null]);
        }
        if ($method === 'POST') {
            $d = body();
            if (($d['version'] ?? null) !== 1) out(['error' => 'Formato non valido'], 400);
            $json = json_encode($d, JSON_UNESCAPED_UNICODE);
            $st = db()->prepare('INSERT INTO eng_progress (fk_user, data, updated_at) VALUES (?, ?, NOW())
                ON DUPLICATE KEY UPDATE data = VALUES(data), updated_at = NOW()');
            $st->execute([$uid, $json]);
            out(['ok' => true]);
        }
    }

    if ($route === 'ai' && $method === 'POST') {
        $d = body();
        $kind = (string) ($d['kind'] ?? '');
        if (!in_array($kind, ['writing', 'translation', 'speaking', 'chat', 'explain'], true)) out(['error' => 'Richiesta non valida'], 400);
        $db = db();
        if ($user) {
            $uid = (int) $user['id'];
            $db->prepare('INSERT INTO eng_ai_log (fk_user, day, calls) VALUES (?, CURDATE(), 1) ON DUPLICATE KEY UPDATE calls = calls + 1')->execute([$uid]);
            $st = $db->prepare('SELECT calls FROM eng_ai_log WHERE fk_user = ? AND day = CURDATE()');
            $st->execute([$uid]);
            if ((int) $st->fetchColumn() > ENG_AI_USER_DAY) out(['error' => 'Limite giornaliero delle correzioni AI raggiunto: riprova domani.', 'limit' => 'day'], 429);
            $guest = false;
        } else {
            if (mt_rand(1, 50) === 1) $db->exec('DELETE FROM eng_ai_limit WHERE day < CURDATE() - INTERVAL 2 DAY');
            $k = ip_key();
            if (bump($db, $k, 'm' . date('YmdHi')) > ENG_AI_IP_MIN) {
                out(['error' => 'Troppe richieste in un minuto: aspetta qualche secondo e riprova.', 'limit' => 'minute'], 429);
            }
            if (bump($db, $k, 'd' . date('Ymd')) > ENG_AI_IP_DAY) {
                out(['error' => 'Per oggi le correzioni AI gratuite sono finite (' . ENG_AI_IP_DAY . ' al giorno). Tornano domani: intanto lezioni, ripasso e audio funzionano come sempre.', 'limit' => 'day'], 429);
            }
            if (bump($db, 'tutti', 'd' . date('Ymd')) > ENG_AI_GUEST_DAY) {
                out(['error' => 'Oggi le correzioni AI gratuite sono state usate tutte da chi studia con English Sprint. Tornano domani: intanto lezioni, ripasso e audio funzionano come sempre.', 'limit' => 'all'], 429);
            }
            $guest = true;
        }
        $res = eng_ai($kind, $d, $guest);
        if ($res === '429') out(['error' => 'Il servizio AI è occupato: riprova tra un minuto.', 'limit' => 'busy'], 429);
        if ($res === null) out(['error' => 'La correzione AI non ha risposto: riprova.'], 502);
        out($res);
    }

    out(['error' => 'Percorso sconosciuto'], 404);
} catch (Throwable $e) {
    error_log('english-sprint: ' . $e->getMessage());
    out(['error' => 'Errore del server'], 500);
}
