import os, sys, tempfile
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
os.environ.setdefault("AULAVIVA_DATA_DIR", tempfile.mkdtemp(prefix="aulaviva-test-"))
os.environ["AULAVIVA_NO_KEYRING"] = "1"

import pytest


@pytest.fixture(autouse=True)
def _clear_key_cache():
    from aulaviva.core import ai
    ai._KEY_CACHE.clear()
    yield
    ai._KEY_CACHE.clear()
