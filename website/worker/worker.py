"""Provision a queued RO Community account from inside the Ragnarok network."""
import base64
import ctypes
import ctypes.util
import json
import re
import sys
from urllib.error import HTTPError
from urllib.request import HTTPRedirectHandler, Request, build_opener

import pymysql

from urllib.parse import urlsplit


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def request(config, action, payload):
    req = Request(
        config["endpoint"].rstrip("/") + "/?bridge=" + action,
        data=json.dumps(payload).encode(),
        headers={
            "Authorization": "Bearer " + config["bridge_token"],
            "Content-Type": "application/json",
        },
    )
    with build_opener(NoRedirect()).open(req, timeout=10) as response:
        return json.loads(response.read(4096))


def unpack(config, job):
    if not re.fullmatch("[a-f0-9]{32}", job["id"]) or not re.fullmatch("[a-z0-9_]{4,23}", job["username"]):
        raise ValueError("Invalid registration")
    box = base64.b64decode(job["password_box"], validate=True)
    public = base64.b64decode(config["box_public_key"], validate=True)
    secret = base64.b64decode(config["box_secret_key"], validate=True)
    if not 60 <= len(box) <= 71 or len(public) != 32 or len(secret) != 32:
        raise ValueError("Invalid registration encryption")
    lib = ctypes.CDLL(ctypes.util.find_library("sodium"))
    lib.sodium_init()
    decrypt = lib.crypto_box_seal_open
    decrypt.argtypes = [
        ctypes.c_void_p, ctypes.c_char_p, ctypes.c_ulonglong,
        ctypes.c_char_p, ctypes.c_char_p,
    ]
    plain = ctypes.create_string_buffer(len(box) - 48)
    if decrypt(plain, box, len(box), public, secret) != 0 or not re.fullmatch(rb"[!-~]{12,23}", plain.raw):
        raise ValueError("Invalid registration password")
    return plain.raw.decode("ascii")


def provision(config, job, password):
    with pymysql.connect(**config["database"], connect_timeout=5, read_timeout=5, write_timeout=5) as db:
        with db.cursor() as cursor:
            cursor.execute("SELECT GET_LOCK('ro_community_registration', 5)")
            if cursor.fetchone()[0] != 1:
                raise TimeoutError("Registration lock busy")
            try:
                cursor.execute("SELECT status FROM portal_jobs WHERE id=%s", (job["id"],))
                previous = cursor.fetchone()
                if previous:
                    return previous[0]
                cursor.execute("SELECT 1 FROM login WHERE userid=%s LIMIT 1", (job["username"],))
                status = "taken"
                if not cursor.fetchone():
                    cursor.execute(
                        "INSERT INTO login (userid, user_pass, sex) VALUES (%s, %s, 'M')",
                        (job["username"], password),
                    )
                    status = "created"
                cursor.execute("INSERT INTO portal_jobs (id, status) VALUES (%s, %s)", (job["id"], status))
                db.commit()
                return status
            finally:
                cursor.execute("DO RELEASE_LOCK('ro_community_registration')")


def publish_roster(config):
    with pymysql.connect(**config["database"], connect_timeout=5, read_timeout=5, write_timeout=5) as db:
        with db.cursor() as cursor:
            cursor.execute("SELECT username, online FROM portal_roster ORDER BY username")
            players = [{"username": username, "online": bool(online)} for username, online in cursor]
    request(config, "roster", players)


def main():
    with open(sys.argv[1], encoding="utf-8") as config_file:
        config = json.load(config_file)
    endpoint = urlsplit(config["endpoint"])
    if endpoint.scheme != "https" or not endpoint.hostname or endpoint.username or endpoint.password or endpoint.query or endpoint.fragment:
        raise ValueError("A clean HTTPS portal endpoint is required")
    if "database_host_file" in config:
        with open(config["database_host_file"], encoding="ascii") as host_file:
            config["database"]["host"] = host_file.read().strip()
    job = request(config, "next", {})["job"]
    while job is not None:
        status = provision(config, job, unpack(config, job))
        request(config, "finish", {"id": job["id"], "status": status})
        job = request(config, "next", {})["job"]
    publish_roster(config)


if __name__ == "__main__":
    try:
        main()
    except HTTPError as error:
        sys.exit(f"Registration endpoint returned HTTP {error.code}")
    except Exception as error:
        sys.exit(f"Registration worker failed: {type(error).__name__}")
