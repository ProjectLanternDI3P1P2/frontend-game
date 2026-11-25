#!/usr/bin/env python3
"""
E2E parallel test runner for the game client (.github/workflows/ci.yml).

Two steps, so the backend stack boots while CI sets up the frontend:
    python3 scripts/e2e/e2e_parallel.py backends --spec "<lanes from spec_planner.py>"
    python3 scripts/e2e/e2e_parallel.py tests    --spec "<same lanes>"

One runner holds one stack: the compose services (gateway on 8088, Keycloak on 8081) and the
Nuxt build on 3000. Ports are fixed by the realm and the JWT issuer, so every lane shares them;
each lane N only gets its own Cypress instance.
"""

import argparse
import os
import shutil
import subprocess
import sys
import threading
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from config import (  # pylint: disable=import-error,wrong-import-position
    BASE_CDP_PORT,
    ROOT,
    FRONT_PORT,
    GATEWAY_PORT,
    KEYCLOAK_PORT,
    log,
    worker_log_dir,
)
from servers import (  # pylint: disable=import-error,wrong-import-position
    enable_password_grant,
    localhost_url,
    pipe_output,
    start_backend,
    start_frontend,
    wait_for_backend,
    wait_for_servers,
)
from spec_planner import (  # pylint: disable=import-error,wrong-import-position
    resolve_spec_lanes,
)


def run_cypress(worker: int, specs: list[Path]) -> int:
    """Run a Cypress instance for this worker on the given spec files."""
    screenshots_path = f"cypress/results/screenshots/screenshots-{worker}"

    log_dir = worker_log_dir(worker)
    log_dir.mkdir(parents=True, exist_ok=True)
    cypress_log = log_dir / "cypress.log"

    # xvfb-run exists on the Linux runners only; a local Windows or macOS run has a display.
    xvfb = ["xvfb-run", "-a"] if sys.platform == "linux" else []
    cmd = [
        *xvfb,
        # which() resolves npx.cmd on Windows.
        shutil.which("npx") or "npx",
        "cypress",
        "run",
        "--browser",
        "chrome",
        "--spec",
        ",".join(str(s) for s in specs),
        "--config",
        # app.baseURL is /game/: specs visit app routes ("/auth"), not "/game/auth".
        f"baseUrl={localhost_url(FRONT_PORT, '/game')},screenshotsFolder={screenshots_path}",
        "--env",
        f"gatewayUrl={localhost_url(GATEWAY_PORT)},keycloakUrl={localhost_url(KEYCLOAK_PORT)}",
    ]
    log(f"Worker {worker}: launching Cypress ({len(specs)} spec(s))...")

    env = {**os.environ, "CYPRESS_REMOTE_DEBUGGING_PORT": str(BASE_CDP_PORT + worker)}
    proc = subprocess.Popen(
        cmd,
        cwd=str(ROOT),
        env=env,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
    )
    output_thread = threading.Thread(
        target=pipe_output,
        args=(proc.stdout, f"[W{worker}|cypress]"),
        kwargs={"log_file": cypress_log},
    )
    output_thread.start()
    proc.wait()
    output_thread.join(timeout=5)
    log(f"Worker {worker}: Cypress finished with exit code {proc.returncode}")

    if proc.returncode != 0:
        log(f"Worker {worker}: full logs → cypress/results/workers/worker-{worker}/")

    return proc.returncode


def run_tests(lanes: list[list[Path]]) -> int:
    """Wait for the stack, open the password grant, start the frontend, run one Cypress per lane."""
    workers = len(lanes)
    start_time = time.time()
    wait_for_backend()
    enable_password_grant()
    start_frontend()
    wait_for_servers()

    log("All servers ready. Launching Cypress workers...")
    for i, lane in enumerate(lanes):
        log(f"Worker {i} lane: {[str(s.relative_to(ROOT)) for s in lane]}")
    results: list[int] = [0] * workers

    def cypress_worker(worker: int) -> None:
        results[worker] = run_cypress(worker, lanes[worker])

    threads = [threading.Thread(target=cypress_worker, args=(i,)) for i in range(workers)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()

    elapsed = time.time() - start_time
    minutes, seconds = divmod(int(elapsed), 60)
    duration_str = f"{minutes}m{seconds:02d}s" if minutes else f"{seconds}s"

    exit_code = max(results)
    log(
        f"Done in {duration_str}. {'All tests passed.' if exit_code == 0 else f'{sum(1 for r in results if r != 0)} worker(s) had failures.'}"
    )
    return exit_code


def main() -> None:
    parser = argparse.ArgumentParser(description="Run the game client E2E tests in parallel.")
    parser.add_argument("step", choices=("backends", "tests"))
    parser.add_argument(
        "--spec",
        required=True,
        metavar="LANES",
        help=(
            "One runner's lanes from spec_planner.py: specs comma-separated, lanes "
            "separated by '|'. Each lane gets its own Cypress worker."
        ),
    )
    args = parser.parse_args()

    lanes = resolve_spec_lanes(args.spec)
    log(f"{args.step}: {len(lanes)} worker(s)")
    if args.step == "backends":
        start_backend()
    else:
        sys.exit(run_tests(lanes))


if __name__ == "__main__":
    main()
