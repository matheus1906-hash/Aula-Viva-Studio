import os, sys, tempfile
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
os.environ.setdefault("AULAVIVA_DATA_DIR", tempfile.mkdtemp(prefix="aulaviva-test-"))
os.environ["AULAVIVA_NO_KEYRING"] = "1"
