"""Guarda o token de "Manter conectado" neste computador.

O token é criptografado (AES-256-GCM) com a chave mestra do app, que fica no cofre
do sistema (Gerenciador de Credenciais do Windows / DPAPI, ou Secret Service no Linux).
Copiar o arquivo para outro computador não serve para nada: sem a chave mestra ele
não abre, e no banco existe só o HMAC do token.
"""

from __future__ import annotations

import os

from aulaviva.core.config import config_dir
from aulaviva.core.security import Crypto, SecurityError

_CTX = "session.remember"


def _path():
    return config_dir() / "session.dat"


def save(token: str, crypto: Crypto) -> None:
    path = _path()
    tmp = path.with_suffix(".tmp")
    tmp.write_text(crypto.encrypt(token, _CTX), encoding="utf-8")
    if os.name != "nt":
        os.chmod(tmp, 0o600)
    os.replace(tmp, path)


def load(crypto: Crypto) -> str | None:
    try:
        return crypto.decrypt(_path().read_text(encoding="utf-8").strip(), _CTX)
    except (OSError, SecurityError, ValueError):
        return None


def clear() -> None:
    try:
        _path().unlink(missing_ok=True)
    except OSError:
        pass
