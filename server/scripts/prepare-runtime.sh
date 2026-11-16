#!/usr/bin/env bash
set -euo pipefail
umask 077

cd -- "$(dirname -- "$0")/.."
lan_ip=${1:?Server IPv4 required}
revision=1ca3e7700939ea40120cb51a777f8681ba5e84ae
packet_version=20211103
[[ $lan_ip =~ ^([0-9]{1,3}\.){3}[0-9]{1,3}$ ]] || { echo "Expected a local IPv4 address." >&2; exit 1; }
IFS=. read -r -a octets <<< "$lan_ip"
for octet in "${octets[@]}"; do
  (( 10#$octet <= 255 )) || { echo "Invalid IPv4 address." >&2; exit 1; }
done
[[ $revision =~ ^[a-f0-9]{40}$ ]]
[[ $packet_version =~ ^[0-9]{8}$ ]]
[[ ! -e .env && ! -e runtime && ! -e secrets ]]

upstream=https://github.com/rathena/rathena.git
source_dir=$(mktemp -d)
trap 'rm -rf -- "$source_dir"' EXIT
git -C "$source_dir" init -q
git -C "$source_dir" fetch -q --depth=1 "$upstream" "$revision"
git -C "$source_dir" checkout -q --detach FETCH_HEAD
[[ $(git -C "$source_dir" rev-parse HEAD) == "$revision" ]]

docker pull mariadb:11.4
mariadb_image=$(docker image inspect --format '{{index .RepoDigests 0}}' mariadb:11.4)
[[ $mariadb_image == mariadb@sha256:* ]]
rathena_image="ragnarok/rathena:prere-${packet_version}-${revision:0:12}"

install -d -m 0700 runtime secrets
install -d -m 0750 -g 10001 runtime/rathena-import
install -d -m 0755 runtime/db-init
db_password=$(openssl rand -hex 24)
server_password=$(openssl rand -hex 10)
printf '%s\n' "$db_password" > secrets/db_password
openssl rand -hex 24 > secrets/db_root_password

for template in "$source_dir"/conf/import-tmpl/*; do
  install -m 0640 -g 10001 "$template" runtime/rathena-import/
done
{
  for server in login_server ipban_db char_server map_server web_server log_db; do
    printf '%s_ip: db\n%s_id: rathena\n%s_pw: %s\n%s_db: ragnarok\n' \
      "$server" "$server" "$server" "$db_password" "$server"
  done
} >> runtime/rathena-import/inter_conf.txt

cat >> runtime/rathena-import/char_conf.txt <<EOF
userid: roserver
passwd: $server_password
login_ip: login
char_ip: $lan_ip
server_name: RO Pre-Renewal
EOF
cat >> runtime/rathena-import/map_conf.txt <<EOF
userid: roserver
passwd: $server_password
char_ip: char
map_ip: $lan_ip
EOF
printf 'new_account: no\n' >> runtime/rathena-import/login_conf.txt
for file in progression-morroc.txt hold-to-sprint.txt city-crystals.txt; do
  install -m 0640 -g 10001 "import/$file" "runtime/rathena-import/$file"
  printf 'npc: conf/import/%s\n' "$file" >> runtime/rathena-import/map_conf.txt
done
cat import/gameplay.conf >> runtime/rathena-import/battle_conf.txt

install -m 0644 "$source_dir/sql-files/main.sql" runtime/db-init/10-main.sql
install -m 0644 "$source_dir/sql-files/web.sql" runtime/db-init/20-web.sql
install -m 0644 "$source_dir/sql-files/roulette_default_data.sql" runtime/db-init/30-roulette.sql
install -m 0644 "$source_dir/sql-files/logs.sql" runtime/db-init/40-logs.sql
printf "UPDATE login SET userid='roserver', user_pass='%s' WHERE account_id=1 AND sex='S';\n" \
  "$server_password" > runtime/db-init/50-server-account.sql
chmod 0644 runtime/db-init/50-server-account.sql

cat > .env <<EOF
RO_LAN_IP=$lan_ip
RATHENA_IMAGE=$rathena_image
MARIADB_IMAGE=$mariadb_image
RATHENA_REV=$revision
PACKETVER=$packet_version
EOF
