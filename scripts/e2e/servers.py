"""The servers the E2E run needs: the backend stack in Docker Compose, the Nuxt frontend on the host."""

import json
import os
import re
import subprocess
import sys
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from config import (  # pylint: disable=import-error,wrong-import-position
    COMPOSE_FILE,
    FRONT_DIR,
    FRONT_PORT,
    GATEWAY_PORT,
    HEALTH_TIMEOUT,
    KEYCLOAK_ADMIN,
    KEYCLOAK_ADMIN_PASSWORD,
    KEYCLOAK_PORT,
    ROOT,
    SERVICES,
    log,
    worker_log_dir,
)

ANSI_ESCAPE = re.compile(r"\x1b\[[0-9;]*[mKHFABCDJG]")
KEYCLOAK_REALM = "lantern"
KEYCLOAK_CLIENT = "lantern-public"


def localhost_url(port: int, path: str = "") -> str:
    return f"http://localhost:{port}{path}"


def compose(*args: str) -> list[str]:
    return ["docker", "compose", "-f", COMPOSE_FILE, *args]


def service_rows() -> list[dict]:
    """Return the `docker compose ps` rows of SERVICES (Service, State, Health...)."""
    # check=True: a compose file that does not load fails now, its error on stderr, not after the timeout.
    out = subprocess.run(
        compose("ps", "--all", "--format", "json", *SERVICES),
        cwd=str(ROOT),
        stdout=subprocess.PIPE,
        text=True,
        check=True,
    ).stdout
    # One JSON object per line; older compose versions print a single JSON array.
    return [r for line in out.splitlines() if line.strip() for r in _as_list(json.loads(line))]


def _as_list(value) -> list:
    return value if isinstance(value, list) else [value]


def wait_for_http(url: str, label: str, timeout: int = HEALTH_TIMEOUT) -> None:
    """Poll url until HTTP response received (any status code = server is up)."""
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            urllib.request.urlopen(url, timeout=2)
            log(f"{label} ready at {url}")
            return
        except urllib.error.HTTPError:
            # Any HTTP error means the server responded — it's up
            log(f"{label} ready at {url}")
            return
        except Exception:
            time.sleep(0.5)
    msg = f"{label} at {url} did not become ready within {timeout}s"
    raise TimeoutError(msg)


def pipe_output(
    stream,
    prefix: str,
    quiet: bool = False,
    log_file: Path | None = None,
) -> None:
    """Read lines from a subprocess stream, print with prefix, and write to log file."""
    try:
        fh = log_file.open("w", encoding="utf-8") if log_file else None
        try:
            for line in iter(stream.readline, b""):
                decoded = line.decode(errors="replace").rstrip()
                if not quiet:
                    print(f"{prefix} {decoded}")
                if fh:
                    fh.write(ANSI_ESCAPE.sub("", decoded) + "\n")
        finally:
            if fh:
                fh.close()
    except Exception:
        pass


def start_backend() -> None:
    """Launch the compose stack detached and return: it boots while CI sets up the frontend."""
    log(f"Starting backend stack — {' '.join(SERVICES)}")
    log_dir = worker_log_dir(0)
    log_dir.mkdir(parents=True, exist_ok=True)
    # Straight to the file, in its own session: compose outlives the
    # `backends` step that starts it, and a pipe would break when that step exits.
    with (log_dir / "backend.log").open("w", encoding="utf-8") as log_file:
        # --wait: the compose healthchecks are the readiness signal.
        subprocess.Popen(
            compose(
                "up", "-d", "--no-build", "--wait", "--wait-timeout", str(HEALTH_TIMEOUT), *SERVICES
            ),
            cwd=str(ROOT),
            stdout=log_file,
            stderr=subprocess.STDOUT,
            start_new_session=True,
        )


def wait_for_backend(timeout: int = HEALTH_TIMEOUT) -> None:
    """Poll until every service is healthy.

    Not a second `up --wait`: while the first one still pulls or creates containers,
    a second one races it for the container names and both fail.
    """
    log("Waiting for the backend stack to be healthy...")
    deadline = time.time() + timeout
    while True:
        rows = service_rows()
        healthy = {r["Service"] for r in rows if r.get("Health") == "healthy"}
        pending = [s for s in SERVICES if s not in healthy]
        if not pending:
            break
        failed = [r["Service"] for r in rows if r.get("State") in ("exited", "dead")]
        if failed:
            msg = f"backend stopped: {', '.join(failed)}\n{backend_log_tail()}"
            raise RuntimeError(msg)
        if time.time() >= deadline:
            msg = f"not healthy within {timeout}s: {', '.join(pending)}\n{backend_log_tail()}"
            raise TimeoutError(msg)
        time.sleep(3)
    log("Backend stack healthy")


def backend_log_tail(lines: int = 20) -> str:
    """The end of backend.log, where `compose up` reports why the stack did not come up."""
    log_file = worker_log_dir(0) / "backend.log"
    try:
        tail = log_file.read_text(encoding="utf-8", errors="replace").splitlines()[-lines:]
    except OSError:
        return f"(no {log_file})"
    return f"last lines of {log_file}:\n" + "\n".join(tail)


def keycloak_request(path: str, token: str | None = None, data=None, method: str | None = None):
    """Call Keycloak on localhost; a dict body is sent as JSON, a str body as a form."""
    headers = {}
    body = None
    if isinstance(data, dict):
        body = json.dumps(data).encode()
        headers["Content-Type"] = "application/json"
    elif isinstance(data, str):
        body = data.encode()
        headers["Content-Type"] = "application/x-www-form-urlencoded"
    if token:
        headers["Authorization"] = f"Bearer {token}"
    req = urllib.request.Request(
        localhost_url(KEYCLOAK_PORT, path), data=body, headers=headers, method=method
    )
    with urllib.request.urlopen(req, timeout=10) as resp:
        raw = resp.read()
    return json.loads(raw) if raw else None


def enable_password_grant(timeout: int = HEALTH_TIMEOUT) -> None:
    """Switch directAccessGrantsEnabled on for lantern-public, so Cypress can log in by password.

    Runtime only: the realm JSON keeps it off for every other stack.
    """
    form = urllib.parse.urlencode(
        {
            "grant_type": "password",
            "client_id": "admin-cli",
            "username": KEYCLOAK_ADMIN,
            "password": KEYCLOAK_ADMIN_PASSWORD,
        }
    )
    deadline = time.time() + timeout
    while True:
        try:
            token = keycloak_request("/realms/master/protocol/openid-connect/token", data=form)[
                "access_token"
            ]
            clients_path = f"/admin/realms/{KEYCLOAK_REALM}/clients"
            client = keycloak_request(f"{clients_path}?clientId={KEYCLOAK_CLIENT}", token)[0]
            client["directAccessGrantsEnabled"] = True
            keycloak_request(f"{clients_path}/{client['id']}", token, client, "PUT")
            log(f"Password grant enabled on {KEYCLOAK_CLIENT}")
            return
        except (urllib.error.URLError, OSError, IndexError) as exc:
            if time.time() >= deadline:
                msg = f"could not enable the password grant within {timeout}s: {exc}"
                raise TimeoutError(msg) from exc
            time.sleep(2)


def start_frontend() -> None:
    """Serve the Nuxt build from the e2e-build job (`npm run build` locally)."""
    env = {
        **os.environ,
        "PORT": str(FRONT_PORT),
        "NUXT_PUBLIC_API_GATEWAY_URL": localhost_url(GATEWAY_PORT),
        "NUXT_PUBLIC_KEYCLOAK_URL": localhost_url(KEYCLOAK_PORT),
    }
    log(f"Starting frontend — PORT={FRONT_PORT}  GATEWAY={GATEWAY_PORT}  KEYCLOAK={KEYCLOAK_PORT}")
    log_dir = worker_log_dir(0)
    log_dir.mkdir(parents=True, exist_ok=True)
    proc = subprocess.Popen(
        ["node", ".output/server/index.mjs"],
        cwd=str(FRONT_DIR),
        env=env,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
    )
    threading.Thread(
        target=pipe_output,
        args=(proc.stdout, f"[front:{FRONT_PORT}]", True),
        kwargs={"log_file": log_dir / "frontend.log"},
        daemon=True,
    ).start()


def wait_for_servers() -> None:
    # app.baseURL is /game/ (nuxt.config.ts): /healthz itself only redirects there.
    wait_for_http(localhost_url(FRONT_PORT, "/game/healthz"), "Frontend")
