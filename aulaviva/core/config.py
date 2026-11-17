"""Caminhos, preferências e limites globais do aplicativo."""

from __future__ import annotations

import json
import os
import stat
import sys
from dataclasses import asdict, dataclass, field
from pathlib import Path

from platformdirs import user_config_dir, user_data_dir, user_log_dir

from aulaviva import APP_ID, ORG_NAME

# Limites de segurança (aplicados em toda a aplicação)
MAX_IMAGE_BYTES = 12 * 1024 * 1024        # 12 MB por imagem
MAX_IMAGE_PIXELS = 40_000_000             # proteção contra "decompression bomb"
MAX_ATTACHMENT_BYTES = 15 * 1024 * 1024   # 15 MB por anexo (Word, Excel...)
MAX_BLOCKS_PER_PROJECT = 600
MAX_TEXT_LEN = 20_000
MAX_URL_LEN = 2048
IDLE_LOCK_MINUTES_DEFAULT = 15


def _secure_dir(path: Path) -> Path:
    path.mkdir(parents=True, exist_ok=True)
    if os.name != "nt":
        try:
            os.chmod(path, stat.S_IRWXU)  # 0700: apenas o próprio usuário
        except OSError:
            pass
    return path


def data_dir() -> Path:
    override = os.environ.get("AULAVIVA_DATA_DIR")
    base = Path(override) if override else Path(user_data_dir(APP_ID, ORG_NAME))
    return _secure_dir(base)


def config_dir() -> Path:
    override = os.environ.get("AULAVIVA_DATA_DIR")
    base = Path(override) / "config" if override else Path(user_config_dir(APP_ID, ORG_NAME))
    return _secure_dir(base)


def log_dir() -> Path:
    override = os.environ.get("AULAVIVA_DATA_DIR")
    base = Path(override) / "logs" if override else Path(user_log_dir(APP_ID, ORG_NAME))
    return _secure_dir(base)


def resource_path(relative: str) -> Path:
    """Resolve arquivos empacotados (funciona também dentro do PyInstaller)."""
    base = Path(getattr(sys, "_MEIPASS", Path(__file__).resolve().parent.parent.parent))
    return base / relative


@dataclass
class Preferences:
    first_run_done: bool = False
    reduce_motion: bool = False
    idle_lock_minutes: int = IDLE_LOCK_MINUTES_DEFAULT
    ai_provider: str = ""          # demo | ollama | gemini | claude ("" = automático)
    ai_model: str = "claude-opus-5-5"
    ai_effort: str = "medium"
    gemini_model: str = "gemini-2.5-flash"
    ollama_model: str = "qwen2.5:7b"
    ollama_url: str = "http://127.0.0.1:11434"
    last_email_hint: str = ""          # nunca armazenamos senha; só o e-mail opcionalmente
    remember_email: bool = False
    extra: dict = field(default_factory=dict)

    @classmethod
    def load(cls) -> "Preferences":
        path = config_dir() / "preferences.json"
        try:
            raw = json.loads(path.read_text(encoding="utf-8"))
            known = {k: v for k, v in raw.items() if k in cls.__dataclass_fields__}
            prefs = cls(**known)
        except (OSError, ValueError, TypeError):
            prefs = cls()
        prefs.idle_lock_minutes = max(1, min(int(prefs.idle_lock_minutes), 240))
        if prefs.ai_effort not in {"low", "medium", "high"}:
            prefs.ai_effort = "medium"
        return prefs

    def save(self) -> None:
        path = config_dir() / "preferences.json"
        tmp = path.with_suffix(".tmp")
        tmp.write_text(json.dumps(asdict(self), ensure_ascii=False, indent=2), encoding="utf-8")
        if os.name != "nt":
            os.chmod(tmp, stat.S_IRUSR | stat.S_IWUSR)
        os.replace(tmp, path)
