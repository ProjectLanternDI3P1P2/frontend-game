#!/usr/bin/env python3
"""Spec discovery, weighting and distribution for the Cypress E2E suite.

CI calls this for the matrix; e2e_parallel.py imports resolve_spec_lanes to
split the lanes it is handed.

Specs are balanced across `runners * workers` lanes rather than across runners:
a runner is done when its slowest worker is done, so the lane — one worker's
share — is the unit worth balancing.

    python3 scripts/e2e/spec_planner.py --runners 2 --workers 1  # matrix JSON, as CI consumes it
"""

import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from config import (  # pylint: disable=import-error,wrong-import-position
    ROOT,
    log,
)

# Mirrors specPattern in cypress.config.ts.
SPEC_GLOB = "*.cy.ts"
E2E_DIR = ROOT / "cypress" / "e2e"

# Separates the per-worker lanes inside one runner's --spec value. A runner is
# only a machine: the unit that actually runs specs is a worker, so the planner
# balances lanes, not runners, and hands each runner its lanes already split.
LANE_SEPARATOR = "|"


def get_spec_files() -> list[Path]:
    """Return Cypress spec files sorted by path."""
    return sorted(E2E_DIR.rglob(SPEC_GLOB))


def count_tests(spec: Path) -> int:
    """Estimate test weight by counting it( calls in the spec file."""
    return max(1, spec.read_text(encoding="utf-8").count("  it("))


def distribute_specs(specs: list[Path], n_buckets: int) -> list[list[Path]]:
    """Greedy bin-packing: assign heaviest specs first to the lightest bucket."""
    weighted = sorted(((s, count_tests(s)) for s in specs), key=lambda x: x[1], reverse=True)
    buckets: list[list[Path]] = [[] for _ in range(n_buckets)]
    totals = [0] * n_buckets
    for spec, w in weighted:
        i = min(range(n_buckets), key=lambda i: totals[i])
        buckets[i].append(spec)
        totals[i] += w
    log(f"Spec distribution (estimated tests per lane): {totals}")
    return buckets


def resolve_spec_lanes(raw_specs: str) -> list[list[Path]]:
    """Split a --spec value into the per-worker lanes the planner laid out.

    A value without LANE_SEPARATOR is a single lane.
    """
    return [
        sorted(resolve_spec_paths(part)) for part in raw_specs.split(LANE_SEPARATOR) if part.strip()
    ]


def resolve_spec_paths(raw_specs: str) -> list[Path]:
    """Spec paths relative to ROOT, as the planner prints them."""
    paths = [ROOT / raw.strip() for raw in raw_specs.split(",") if raw.strip()]
    missing = [str(p) for p in paths if not p.is_file()]
    if missing:
        sys.exit(f"spec not found: {', '.join(missing)}")
    return paths


def _lane_weight(lane: list[Path]) -> int:
    return sum(count_tests(s) for s in lane)


def _group_lanes(lanes: list[list[Path]], runners: int, workers: int) -> list[list[list[Path]]]:
    """Deal the lanes to the runners snake-wise, heaviest first.

    Balancing lanes is what matters — a runner's duration is the slowest of its
    workers, not their sum — but dealing back and forth keeps runner totals level
    too, so no machine is left holding every heavy lane.
    """
    ordered = sorted(lanes, key=_lane_weight, reverse=True)
    grouped: list[list[list[Path]]] = [[] for _ in range(runners)]
    for turn in range(workers):
        chunk = ordered[turn * runners : (turn + 1) * runners]
        if turn % 2:
            chunk = list(reversed(chunk))
        for runner_index, lane in enumerate(chunk):
            grouped[runner_index].append(lane)
    return grouped


def _relative(spec: Path) -> str:
    return str(spec.relative_to(ROOT)).replace("\\", "/")


def build_matrix(runners: int, workers: int = 1) -> list[dict]:
    """Return the GitHub Actions matrix entries, one per non-empty runner.

    Specs are balanced across `runners * workers` lanes, not across runners: a
    runner waits for its slowest worker, so a lane is the real unit of work.
    Each entry is {"runner": "N", "specs": "lane1specs|lane2specs"} with paths
    relative to ROOT (forward-slash, cross-platform), lanes separated by
    LANE_SEPARATOR so e2e_parallel hands each worker the lane planned for it.
    """
    lanes = distribute_specs(get_spec_files(), runners * workers)
    return [
        {
            "runner": str(i),
            "specs": LANE_SEPARATOR.join(
                ",".join(_relative(s) for s in lane) for lane in runner_lanes if lane
            ),
        }
        for i, runner_lanes in enumerate(_group_lanes(lanes, runners, workers))
        if any(runner_lanes)
    ]


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--runners",
        type=int,
        default=2,
        metavar="N",
        help="Number of CI runners to distribute specs across (default: 2).",
    )
    parser.add_argument(
        "--workers",
        type=int,
        default=1,
        metavar="N",
        help="Workers per runner (default: 1). Specs are balanced across runners * workers lanes.",
    )
    args = parser.parse_args()
    print(json.dumps(build_matrix(args.runners, args.workers)))


if __name__ == "__main__":
    main()
