"""Store the SPHEREx image list of every star the interface offers, so opening one never waits on IRSA.

The 3D neighbourhood and the search suggestions name about two hundred objects. For each, this resolves the name
exactly as the API will, finds the covering images through IRSA (TAP, or SIA when TAP is down), and stores the list in
cache/index, which ships with the API. IRSA was down for hours on 15 November 2026, so the script keeps retrying the
ones that fail until every list is stored or the time runs out.

    .venv\\Scripts\\python scripts/index_targets.py --minutes 120
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from app import discovery  # noqa: E402
from app.resolve import ResolveError, position_at, resolve_name  # noqa: E402
from app.view import REFERENCE_MJD  # noqa: E402

FRONTEND_DATA = ROOT.parent / "src" / "data"


def queries() -> list[str]:
    names: list[str] = []
    for star in json.loads((FRONTEND_DATA / "neighbourhood.json").read_text(encoding="utf-8")):
        names.append(star["name"] if star.get("target") else star["id"])
    suggestions = (FRONTEND_DATA / "suggestions.ts").read_text(encoding="utf-8")
    names += re.findall(r'\{ name: "([^"]+)"', suggestions)
    seen: set[str] = set()
    return [n for n in names if not (n in seen or seen.add(n))]


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--minutes", type=float, default=120)
    args = parser.parse_args()
    deadline = time.time() + args.minutes * 60

    pending = queries()
    print(f"{len(pending)} objects to index", flush=True)
    unresolved: list[str] = []
    done = 0
    while pending and time.time() < deadline:
        failed = []
        for name in pending:
            try:
                target = resolve_name(name)
            except ResolveError as error:
                unresolved.append(f"{name}: {error}")
                continue
            centre = position_at(target, REFERENCE_MJD)
            try:
                records, via = discovery.find_images(centre.ra.deg, centre.dec.deg)
            except discovery.DiscoveryError as error:
                failed.append(name)
                print(f"  waiting on IRSA for {name}: {str(error)[:90]}", flush=True)
                continue
            done += 1
            print(f"  {done:3d} {name}: {len(records)} images ({via})", flush=True)
        pending = failed
        if pending:
            print(f"{len(pending)} still waiting on IRSA; retrying in 60 s", flush=True)
            time.sleep(60)

    print(f"stored {done}; {len(pending)} not reached; {len(unresolved)} names SIMBAD could not resolve")
    for line in unresolved:
        print("  unresolved:", line)
    return 0 if not pending else 1


if __name__ == "__main__":
    sys.exit(main())
