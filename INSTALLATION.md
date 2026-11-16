# Installation auf dem eigenen Rechner

## 1. Linux-Server vorbereiten

Benötigt werden Docker mit Compose, Git und OpenSSL. Entpacke den Quellcode in ein eigenes Verzeichnis. Verwende eine frische Installation und eine IPv4-Adresse, auf der Docker am Server binden kann. Für Tests auf dem Server selbst geht `127.0.0.1`. Im LAN findest du die Adresse des Servers mit `ip -4 -brief address`.

```bash
cd server
read -rp "Eigene Server-IPv4: " SERVER_IP
sudo bash scripts/prepare-runtime.sh "$SERVER_IP"
sudo docker build -f docker/Dockerfile \
  --build-arg RATHENA_REV=1ca3e7700939ea40120cb51a777f8681ba5e84ae \
  --build-arg PACKETVER=20211103 \
  -t ragnarok/rathena:prere-20211103-1ca3e7700939 .
sudo docker compose --env-file .env -f docker/compose.yaml up -d
sudo docker compose --env-file .env -f docker/compose.yaml logs -f login char map
```

Der erste Schritt erzeugt lokal neue Datenbank- und Serverpasswörter. Das interne Datenbanknetz hat keinen veröffentlichten Datenbankport. Die Spielports sind **6900**, **6121** und **5121** über TCP. Teste zuerst lokal oder im LAN. Für entfernte Mitspieler brauchst du eine dafür eingerichtete Verbindung und passende Firewallregeln.

### Spielaccount anlegen

Die selbstständige Registrierung ist standardmäßig aus. Für einen privaten Test lässt sie sich per `new_account: yes` in `runtime/rathena-import/login_conf.txt` aktivieren. Ändere die vorhandene Zeile und starte den Login-Dienst neu.

```bash
sudo docker compose --env-file .env -f docker/compose.yaml restart login
```

Melde dich für die Registrierung im Client mit deinem neuen Spielernamen plus `_M` oder `_F` und einem eigenen Passwort an. Spätere Logins verwenden den Namen ohne Suffix. Setze nach der Registrierung `new_account: no` und starte den Login-Dienst erneut. Bewahre die erzeugten Geheimnisse außerhalb eines öffentlichen Repositories auf.

### Bestehende Server-IP ändern

1. Trage in `server/.env` die neue Adresse bei `RO_LAN_IP` ein.
2. Ändere in `server/runtime/rathena-import/char_conf.txt` die Einstellung `char_ip` und in `map_conf.txt` die Einstellung `map_ip` auf dieselbe neue IPv4. Die internen Namen `login`, `char` und `db` im Docker-Netz bleiben als Dienstnamen eingetragen.
3. Führe `sudo docker compose --env-file .env -f docker/compose.yaml up -d --force-recreate login char map` aus `server/` aus. Dadurch werden Bindeadressen und angekündigte Adressen übernommen.
4. Übergib die neue Adresse beim Client-Start ebenfalls als `-ServerHost`.

## 2. Windows-Client vorbereiten

Benötigt werden Git, Node.js ab Version 22 und PowerShell. Aus dem Paketordner ausführen.

```powershell
.\client\prepare-client.ps1
```

Das Skript lädt die dokumentierte Revision von roBrowserLegacy, kopiert die Änderungen und installiert die Client-Abhängigkeiten. Lege einen kompatiblen, rechtmäßig bezogenen Satz Spieldaten in `client/assets/`. Die gepflegte Installation erwartete dort `data.grf` sowie passende Zusatzordner wie `SystemEN`, `System`, `data` und `BGM`. Inhalt und Struktur hängen von deiner Client-Quelle ab. Das freie Quellcodepaket enthält keine GRFs.

```powershell
$serverHost = Read-Host 'Server-IP oder Hostname'
.\client\start-client.ps1 -ServerHost $serverHost
```

Für den lokalen Server kannst du ohne Argument starten. Für LAN-Verbindungen gib die IPv4 des Linux-Servers ein. Das Skript setzt `RO_SERVER_HOST` für den Start und legt das Profil lokal an. Die Adresse lässt sich bei jedem Start ändern. Die Packet-Version **20211103** muss auf beiden Seiten zusammenpassen.

Der optionale Patcher wird erst mit einer eigenen `update-config.json` neben `patcher.mjs` aktiv. Sie enthält `{"url":"https://example.invalid/ro-update/"}` als Muster. Betreibe einen eigenen Update-Endpunkt mit vollständigem Manifest und SHA-256 je Datei. Das Quellcodepaket ist für den Start ohne eigenen Patchserver vorbereitet.

## 3. Funktionsprüfung

Prüfe den Login, die Charaktererstellung, einen Kartenwechsel und danach erneut den Login. Teste vor einer Weitergabe auch Crafting, Stadtteleport und Refine. Bewahre bei Serveränderungen einen Datenbank-Dump auf und prüfe den Restore in einer separaten Instanz. Die Blanko-Installation befindet sich auf dem dokumentierten Quellstand. Ein kompletter Neubau mit einem separaten Satz Spielassets ist Teil der Abnahme.
