import os
import sys
from pathlib import Path

# scripts/e2e/config.py -> scripts/e2e -> scripts -> repo root
ROOT = Path(__file__).resolve().parents[2]
RESULTS_DIR = ROOT / "cypress" / "results"

# Fixed: Keycloak's redirect URIs, the CORS origins and the JWT issuer all name these ports.
FRONT_PORT = 3000
GATEWAY_PORT = 8088
KEYCLOAK_PORT = 8081
# Left to Cypress, two workers launched together can draw the same CDP port and drive one browser.
BASE_CDP_PORT = 9310
# Covers a cold stack: Keycloak and the .NET services each have a 60s start period.
HEALTH_TIMEOUT = 240

COMPOSE_FILE = "compose.backend.dev.yaml"
# Never leaderboard: out of scope for the E2E suite (docs/e2e/stack.md).
SERVICES = ("traefik", "keycloak", "postgres", "rabbitmq", "player", "combat", "dungeon", "reward")

# Same defaults as compose.backend.yaml.
KEYCLOAK_ADMIN = os.environ.get("KEYCLOAK_ADMIN", "admin")
KEYCLOAK_ADMIN_PASSWORD = os.environ.get("KEYCLOAK_ADMIN_PASSWORD", "admin")


def worker_log_dir(worker: int) -> Path:
    return RESULTS_DIR / "workers" / f"worker-{worker}"


def log(msg: str) -> None:
    """Logs to stderr: stdout carries the matrix JSON CI pipes into $GITHUB_OUTPUT."""
    print(f"[e2e-parallel] {msg}", flush=True, file=sys.stderr)
