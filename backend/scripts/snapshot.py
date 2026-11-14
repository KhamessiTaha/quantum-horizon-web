"""Freeze the demo targets into static files the frontend can serve without a backend.

Every response the viewer asks for on the five challenge targets, on all six detectors, is saved under
`public/snapshot/` together with the images it references. The frontend reads these first, so the demo keeps working
when no backend is running. Nothing here is computed: each file is exactly what the API returned.

    .venv\\Scripts\\python scripts/snapshot.py --api https://quantum-horizon-api.fly.dev
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import urllib.parse
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

TARGETS = ["Barnard's Star", "Epsilon Indi B", "WISE 0855−0714", "RW Aurigae", "R Draconis"]
DETECTORS = ["D1", "D2", "D3", "D4", "D5", "D6"]
FOV = "0.06"
IMAGE_PREFIX = "/api/images/"


def slug(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")


def key(endpoint: str, target: str, det: str, extra: str = "") -> str:
    parts = [endpoint, slug(target), det.lower(), FOV.replace(".", "p")]
    if extra:
        parts.append(extra)
    return "__".join(parts)


class Snapshot:
    def __init__(self, api: str, out: Path) -> None:
        self.api = api.rstrip("/")
        self.out = out
        self.images: set[str] = set()
        self.keys: list[str] = []
        self.failed: list[str] = []

    def fetch(self, path: str, params: dict[str, str], timeout: float = 90, attempts: int = 4) -> bytes:
        url = f"{self.api}{path}?{urllib.parse.urlencode(params)}" if params else f"{self.api}{path}"
        for attempt in range(attempts):
            try:
                with urllib.request.urlopen(url, timeout=timeout) as response:
                    return response.read()
            except urllib.error.HTTPError:
                raise
            except Exception:
                if attempt == attempts - 1:
                    raise
        raise RuntimeError("unreachable")

    def rewrite(self, value):
        if isinstance(value, dict):
            return {k: self.rewrite(v) for k, v in value.items()}
        if isinstance(value, list):
            return [self.rewrite(v) for v in value]
        if isinstance(value, str) and value.startswith(IMAGE_PREFIX):
            name = value[len(IMAGE_PREFIX):]
            self.images.add(name)
            return f"/snapshot/images/{name}"
        return value

    def save(self, name: str, path: str, params: dict[str, str]) -> dict | None:
        try:
            data = json.loads(self.fetch(path, params))
        except Exception as error:
            self.failed.append(f"{name}: {error}")
            print(f"  failed {name}: {error}", flush=True)
            return None
        (self.out / f"{name}.json").write_text(json.dumps(self.rewrite(data), separators=(",", ":")), encoding="utf-8")
        self.keys.append(name)
        return data

    def target(self, target: str, det: str) -> None:
        base = {"target": target, "det": det, "fov": FOV}
        frames = self.save(key("frames", target, det), "/api/frames", base)
        if frames is None:
            return
        for endpoint in ("spectrum", "lightcurve", "catalog", "movers"):
            self.save(key(endpoint, target, det), f"/api/{endpoint}", base)
        count = len(frames.get("passes", []))
        for a in range(1, count + 1):
            for b in range(a + 1, count + 1):
                self.save(key("difference", target, det, f"{a}-{b}"), "/api/difference", {**base, "a": str(a), "b": str(b)})
        print(f"  {target} {det}: {count} passes", flush=True)

    def download_images(self) -> None:
        folder = self.out / "images"
        folder.mkdir(parents=True, exist_ok=True)

        def one(name: str) -> None:
            try:
                (folder / name).write_bytes(self.fetch(f"{IMAGE_PREFIX}{name}", {}))
            except Exception as error:
                self.failed.append(f"image {name}: {error}")

        with ThreadPoolExecutor(max_workers=6) as pool:
            list(pool.map(one, sorted(self.images)))


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--api", default="http://localhost:8000")
    parser.add_argument("--out", default=str(Path(__file__).resolve().parents[2] / "public" / "snapshot"))
    args = parser.parse_args()

    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    snap = Snapshot(args.api, out)
    snap.save("flags", "/api/flags", {})

    jobs = [(t, d) for t in TARGETS for d in DETECTORS]
    with ThreadPoolExecutor(max_workers=3) as pool:
        list(pool.map(lambda job: snap.target(*job), jobs))

    snap.download_images()
    (out / "index.json").write_text(json.dumps(sorted(snap.keys)), encoding="utf-8")
    print(f"saved {len(snap.keys)} responses and {len(snap.images)} images to {out}")
    if snap.failed:
        print(f"{len(snap.failed)} failed:")
        for line in snap.failed:
            print(f"  {line}")
    return 1 if snap.failed else 0


if __name__ == "__main__":
    sys.exit(main())
