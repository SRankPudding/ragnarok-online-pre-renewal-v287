# Optionale Account-Website

Die Website stellt einen geschützten Zugang, Spielkonto-Erstellung und den Status der Registrierung bereit. Nach der Portal-Anmeldung kann sie die Spielerliste und einen bereitgestellten Quellcode-Download anzeigen. Standardmäßig sind Datenbank und Warteschlange leer. Auf der Website kommen keine direkten Datenbankzugänge zum Spielserver zum Einsatz.

## Webroot und Zugang einrichten

1. Installiere PHP 8.1 oder neuer mit PDO SQLite und Sodium. Konfiguriere HTTPS und setze den Dokumentenstamm auf `website/public/`. `RO_PORTAL_PRIVATE` muss in der PHP-Umgebung auf dein Verzeichnis außerhalb des Webroots zeigen. Die Apache-Datei `.htaccess` setzt die Startseite und reicht den Authorization-Header weiter. Bei Nginx oder PHP-FPM muss der Header ebenfalls an PHP gelangen.
2. Erzeuge das Portal-Konto und die lokalen Schlüssel außerhalb des Webroots. Verwende deine eigene Domain.

   ```bash
   php initialize.php /srv/ro-portal-private https://portal.example.invalid
   ```

   Das Skript zeigt das neu erzeugte Portalpasswort einmal im Terminal an. PHP braucht lesenden Zugriff auf `settings.php` und Schreibzugriff auf das SQLite-Verzeichnis. Die separate Worker-Konfiguration enthält den privaten Schlüssel und gehört auf den Spielserver. Übertrage sie nur über deinen eigenen administrativen Zugang.
3. Spiele das [Schemaskript](worker/rathena-bridge.sql) in deine eigene rAthena-Datenbank ein. Lege dort ein separates Konto `ro_registration` mit einem frisch erzeugten Passwort an. Gewähre nur `SELECT (userid)` und `INSERT (userid, user_pass, sex)` auf `ragnarok.login`, `SELECT, INSERT` auf `ragnarok.portal_jobs` sowie `SELECT` auf `ragnarok.portal_roster`. Erlaube den Zugriff nur aus dem eigenen Servernetz. Trage das neu erzeugte Datenbankpasswort in der Worker-Konfiguration ein.
4. Installiere auf dem Linux-Spielserver Python 3, PyMySQL und libsodium. Die mitgelieferten Systemd-Dateien erwarten den eigenen Linux-Dienstbenutzer `ragnarok-portal`, das Skript unter `/usr/local/lib/ragnarok-portal/worker.py` und die Konfiguration unter `/etc/ragnarok-portal/config.json`. Der Dienstbenutzer braucht Lesezugriff auf die Worker-Konfiguration. Bei anderen Compose-Namen passe Container und Netzwerk im Dienst an. Ohne Systemd kannst du `worker.py` mit deiner Konfiguration periodisch ausführen und `database.host` darin selbst setzen. Entferne dazu `database_host_file`.
5. Kopiere die Service- und Timerdatei in dein Systemd-Verzeichnis, führe `systemctl daemon-reload` und dann `systemctl enable --now portal-worker.timer` aus. Teste mit einem neu angelegten Testaccount, dass die Anmeldung und die Weitergabe der Registrierung funktionieren.

Optional kannst du eine zulässige ZIP mit Client-Quellcode als `client-source.zip` im privaten Portalverzeichnis bereitstellen. Die passende Datei `client-source.sha256` enthält die SHA-256 in Hex. Das Portal liefert sie nur nach Anmeldung aus.
