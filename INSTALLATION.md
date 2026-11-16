# Installation

## Linux server

Install Docker with Compose, Git, and OpenSSL. Use a fresh directory and an IPv4 address the server can bind to. For testing on the server itself, use `127.0.0.1`. To find the server's LAN address, run `ip -4 -brief address`.

```bash
cd server
read -rp "Server IPv4: " SERVER_IP
sudo bash scripts/prepare-runtime.sh "$SERVER_IP"
sudo docker build -f docker/Dockerfile \
  --build-arg RATHENA_REV=1ca3e7700939ea40120cb51a777f8681ba5e84ae \
  --build-arg PACKETVER=20211103 \
  -t ragnarok/rathena:prere-20211103-1ca3e7700939 .
sudo docker compose --env-file .env -f docker/compose.yaml up -d
sudo docker compose --env-file .env -f docker/compose.yaml logs -f login char map
```

Setup generates new database and server passwords locally. MariaDB stays on the internal Docker network. The TCP game ports are **6900**, **6121**, and **5121**. Test on your machine or LAN first. Remote players need a suitable network connection and firewall rules.

### Create a game account

Self-registration is off by default. For a private test, change the existing `new_account` setting to `yes` in `runtime/rathena-import/login_conf.txt`, then restart the login service.

```bash
sudo docker compose --env-file .env -f docker/compose.yaml restart login
```

To register, log in using a new username with the `_M` or `_F` suffix and a password of your choice. Use the username without the suffix for subsequent logins. Set `new_account: no` and restart the login service after registration. Keep generated secrets outside public repositories. The [optional account website](website/) offers invitation-based registration.

### Change the server IP

1. Update `RO_LAN_IP` in `server/.env`.
2. Update `char_ip` in `server/runtime/rathena-import/char_conf.txt` and `map_ip` in `map_conf.txt` to the new IPv4 address. Leave `login`, `char`, and `db` as internal Docker service names.
3. From `server/`, run `sudo docker compose --env-file .env -f docker/compose.yaml up -d --force-recreate login char map`.
4. Pass the new address to the client with `-ServerHost`.

## Windows client

Install Git, Node.js 22 or later, and PowerShell. From the package directory, run:

```powershell
.\client\prepare-client.ps1
```

Setup fetches the pinned roBrowserLegacy revision, applies the overlay, and installs dependencies. Put compatible game assets from a source you have the right to use into `client/assets/`. The original installation expected `data.grf` and compatible folders such as `SystemEN`, `System`, `data`, and `BGM`. The exact contents depend on your source. This package ships no GRFs.

```powershell
$serverHost = Read-Host 'Server IP or hostname'
.\client\start-client.ps1 -ServerHost $serverHost
```

Omit the argument for a local server. For LAN play, enter the Linux server's IPv4 address. The start script sets `RO_SERVER_HOST` and creates a local profile. Both sides must use packet version **20211103**.

The optional patcher activates when you create `update-config.json` next to `patcher.mjs`. For example, use `{"url":"https://example.invalid/ro-update/"}` with your own update URL. Serve a full manifest with SHA-256 for each file. The client also runs without a patch endpoint.

## Verify the installation

Test login, character creation, a map transition, and a second login. Before distributing a build, test crafting, City Crystals, and refinement. Before server upgrades, make a database backup and test restoring it in a separate instance. A full clean build and gameplay test with a separate asset set is still pending for this source package.
