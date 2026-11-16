# Optional account website

The website provides an access-controlled portal, game account registration, and registration status. After login, it can also show the player roster and an optional source-code download. The database and registration queue start empty. A worker on the game server processes registrations, so the website does not need direct access to the game database.

## Setup

1. Install PHP 8.1 or later with PDO SQLite and Sodium. Enable HTTPS and set the document root to `website/public/`. Set `RO_PORTAL_PRIVATE` in PHP's environment to a new directory outside the document root. The supplied Apache `.htaccess` sets the entry point and forwards the Authorization header. Configure equivalent forwarding if you use Nginx or PHP-FPM.
2. Generate the portal login and fresh local keys with your own domain.

   ```bash
   php initialize.php /srv/ro-portal-private https://portal.example.invalid
   ```

   Setup prints the newly generated portal password once. PHP needs to read `settings.php` and write to the SQLite directory. The separate worker config contains the private key and belongs on your game server. Transfer it using your own administrative connection.
3. Import the [database schema](worker/rathena-bridge.sql) into rAthena. Create the `ro_registration` database account with a new password. Grant `SELECT (userid)` and `INSERT (userid, user_pass, sex)` on `ragnarok.login`, `SELECT, INSERT` on `ragnarok.portal_jobs`, and `SELECT` on `ragnarok.portal_roster`. Restrict access to your server network and enter the database password in the worker config.
4. Install Python 3, PyMySQL, and libsodium on the Linux game server. The provided systemd units expect the service user `ragnarok-portal`, the script at `/usr/local/lib/ragnarok-portal/worker.py`, and its config at `/etc/ragnarok-portal/config.json`. The service user needs read access to the config. If your Compose names differ, update the container and network names in the service. Without systemd, run `worker.py` periodically with your config. Remove `database_host_file` and set `database.host` directly in that case.
5. Copy the service and timer units into your systemd directory. Run `systemctl daemon-reload`, then `systemctl enable --now portal-worker.timer`. Check portal login and account provisioning using a fresh test account.

You can optionally place a source-code archive you have the right to distribute at `client-source.zip` in the private portal directory. Its companion `client-source.sha256` contains the hexadecimal SHA-256 checksum. The portal serves the archive after login.
