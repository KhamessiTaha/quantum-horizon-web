"""Write which offered stars already have their SPHEREx image list stored, for the interface to show as ready.

A star is ready when its list is in cache/index, which ships with the API: it opens without asking IRSA. Run after
scripts/index_targets.py, from backend/:

    .venv\\Scripts\\python scripts/ready_list.py
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from app import cache, discovery  # noqa: E402
from app.resolve import ResolveError, position_at, resolve_name  # noqa: E402
from app.view import REFERENCE_MJD  # noqa: E402
from scripts.index_targets import FRONTEND_DATA, queries  # noqa: E402


def main() -> int:
    ready: list[str] = []
    for name in queries():
        try:
            target = resolve_name(name)
        except ResolveError:
            continue
        centre = position_at(target, REFERENCE_MJD)
        if cache.read_json("index", discovery._index_name(centre.ra.deg, centre.dec.deg)):
            ready.append(name)
    out = FRONTEND_DATA / "ready.json"
    out.write_text(json.dumps(sorted(ready), ensure_ascii=False, indent=0), encoding="utf-8")
    print(f"{len(ready)} of {len(queries())} offered stars are ready; wrote {out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
