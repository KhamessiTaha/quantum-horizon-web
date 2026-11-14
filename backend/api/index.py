"""Vercel entry point.

Vercel functions can only write to /tmp, so the committed cache is copied there on a cold start and astropy is given
/tmp as its home. Locally and on Fly this file is unused; run `uvicorn app.main:app` as before.
"""

import os
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RUNTIME_CACHE = Path("/tmp/qh-cache")

os.environ["HOME"] = "/tmp"
os.environ.setdefault("QH_CACHE_DIR", str(RUNTIME_CACHE))
if not RUNTIME_CACHE.exists():
    shutil.copytree(ROOT / "cache", RUNTIME_CACHE, dirs_exist_ok=True)

sys.path.insert(0, str(ROOT))

from app.main import app  # noqa: E402,F401
