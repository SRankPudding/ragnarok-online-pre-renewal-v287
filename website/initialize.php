<?php
declare(strict_types=1);

if (PHP_SAPI !== 'cli' || $argc !== 3) {
    exit("Usage: php initialize.php /absolute/private/directory https://your-domain.example\n");
}
$directory = $argv[1];
$endpoint = parse_url($argv[2]);
if (
    !str_starts_with($directory, '/') || file_exists($directory)
    || ($endpoint['scheme'] ?? '') !== 'https' || empty($endpoint['host'])
    || array_diff(array_keys($endpoint), ['scheme', 'host', 'port'])
) {
    exit("Use a new absolute private directory and an HTTPS origin.\n");
}
umask(0077);
if (!mkdir($directory, 0700, true)) {
    exit("Could not create the private directory.\n");
}
$publicRoot = realpath(__DIR__ . '/public');
$private = realpath($directory);
if (!$private || !$publicRoot || str_starts_with($private . '/', $publicRoot . '/')) {
    rmdir($directory);
    exit("The configuration directory must be outside the web root.\n");
}

$accessPassword = bin2hex(random_bytes(16));
$token = bin2hex(random_bytes(32));
$keypair = sodium_crypto_box_keypair();
$publicKey = base64_encode(sodium_crypto_box_publickey($keypair));
$settings = [
    'portal_username' => 'portal',
    'portal_password_hash' => password_hash($accessPassword, PASSWORD_DEFAULT),
    'attempt_key' => bin2hex(random_bytes(32)),
    'bridge_token_hash' => hash('sha256', $token),
    'box_public_key' => $publicKey,
];
$worker = [
    'endpoint' => rtrim($argv[2], '/'),
    'bridge_token' => $token,
    'box_public_key' => $publicKey,
    'box_secret_key' => base64_encode(sodium_crypto_box_secretkey($keypair)),
    'database_host_file' => '/run/ragnarok-portal/database-host',
    'database' => ['user' => 'ro_registration', 'password' => '', 'database' => 'ragnarok'],
];
$workerPath = $private . '.worker.json';
$handle = @fopen($workerPath, 'x');
if ($handle === false) {
    exit("Worker configuration already exists. Choose another directory.\n");
}
fwrite($handle, json_encode($worker, JSON_PRETTY_PRINT | JSON_THROW_ON_ERROR) . "\n");
fclose($handle);
file_put_contents($private . '/settings.php', "<?php\nreturn " . var_export($settings, true) . ";\n");
$db = new PDO('sqlite:' . $private . '/portal.sqlite');
$db->exec(file_get_contents(__DIR__ . '/schema.sql'));
echo "Portal login: portal\nGenerated password: $accessPassword\n";
echo "Private website directory: $private\nWorker configuration: $workerPath\n";
