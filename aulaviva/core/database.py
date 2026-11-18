"""Banco de dados local (SQLite) com dados pessoais criptografados.

Todas as consultas usam parâmetros (sem concatenação de SQL). Campos com
dados pessoais (nome, CPF, telefone, e-mail...) são gravados criptografados
com AES-256-GCM; buscas usam índices cegos HMAC.
"""

from __future__ import annotations

import json
import os
import sqlite3
import stat
import threading
import time
from contextlib import contextmanager
from pathlib import Path
from typing import Any, Iterator

from aulaviva.core.config import data_dir
from aulaviva.core.security import Crypto

SCHEMA_VERSION = 2

_SCHEMA = """
CREATE TABLE IF NOT EXISTS users (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    email_idx       TEXT NOT NULL UNIQUE,
    email_enc       TEXT NOT NULL,
    password_hash   TEXT,
    auth_provider   TEXT NOT NULL DEFAULT 'local',
    profile_complete INTEGER NOT NULL DEFAULT 0,
    is_active       INTEGER NOT NULL DEFAULT 1,
    failed_attempts INTEGER NOT NULL DEFAULT 0,
    locked_until    REAL NOT NULL DEFAULT 0,
    terms_accepted_at REAL,
    created_at      REAL NOT NULL,
    updated_at      REAL NOT NULL,
    last_login_at   REAL
);

CREATE TABLE IF NOT EXISTS profiles (
    user_id          INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    full_name_enc    TEXT NOT NULL,
    social_name_enc  TEXT,
    cpf_idx          TEXT UNIQUE,
    cpf_enc          TEXT,
    birth_date_enc   TEXT NOT NULL,
    phone_enc        TEXT NOT NULL,
    institution_enc  TEXT NOT NULL,
    school_network   TEXT NOT NULL,
    role             TEXT NOT NULL,
    education_levels TEXT NOT NULL,
    subjects_enc     TEXT NOT NULL,
    city_enc         TEXT NOT NULL,
    state            TEXT NOT NULL,
    registration_enc TEXT,
    updated_at       REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS oauth_identities (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider    TEXT NOT NULL,
    subject_idx TEXT NOT NULL,
    created_at  REAL NOT NULL,
    UNIQUE(provider, subject_idx)
);

CREATE TABLE IF NOT EXISTS recovery_codes (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    code_hash TEXT NOT NULL,
    used_at   REAL
);

CREATE TABLE IF NOT EXISTS projects (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title_enc   TEXT NOT NULL,
    content_enc TEXT NOT NULL,
    kind        TEXT NOT NULL DEFAULT 'apostila',
    created_at  REAL NOT NULL,
    updated_at  REAL NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_projects_user ON projects(user_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS audit_log (
    id      INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    event   TEXT NOT NULL,
    detail  TEXT,
    ts      REAL NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_log(user_id, ts DESC);
"""

# v2: sessões "manter conectado" (só o HMAC do token fica no banco)
_SCHEMA_V2 = """
CREATE TABLE IF NOT EXISTS sessions (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_idx   TEXT NOT NULL UNIQUE,
    created_at  REAL NOT NULL,
    expires_at  REAL NOT NULL,
    last_used_at REAL NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
"""


class Database:
    def __init__(self, path: Path | None = None, crypto: Crypto | None = None):
        self.path = path or (data_dir() / "aulaviva.db")
        self.crypto = crypto or Crypto()
        self._lock = threading.RLock()
        new_file = not self.path.exists()
        self._conn = sqlite3.connect(self.path, check_same_thread=False, isolation_level=None)
        self._conn.row_factory = sqlite3.Row
        if new_file and os.name != "nt":
            os.chmod(self.path, stat.S_IRUSR | stat.S_IWUSR)
        for pragma in (
            "PRAGMA foreign_keys = ON",
            "PRAGMA journal_mode = WAL",
            "PRAGMA synchronous = NORMAL",
            "PRAGMA secure_delete = ON",      # sobrescreve dados apagados
            "PRAGMA trusted_schema = OFF",
            "PRAGMA temp_store = MEMORY",
            "PRAGMA cache_size = -16000",     # 16 MB de cache de páginas
            "PRAGMA busy_timeout = 4000",
        ):
            self._conn.execute(pragma)
        self._migrate()

    def _migrate(self) -> None:
        with self._lock:
            version = self._conn.execute("PRAGMA user_version").fetchone()[0]
            if version < 1:
                # executescript gerencia a própria transação
                self._conn.executescript("BEGIN;" + _SCHEMA + _SCHEMA_V2 + f"PRAGMA user_version = {SCHEMA_VERSION}; COMMIT;")
            elif version < 2:
                self._conn.executescript("BEGIN;" + _SCHEMA_V2 + "PRAGMA user_version = 2; COMMIT;")

    @contextmanager
    def transaction(self) -> Iterator[sqlite3.Cursor]:
        with self._lock:
            cur = self._conn.cursor()
            cur.execute("BEGIN IMMEDIATE")
            try:
                yield cur
                cur.execute("COMMIT")
            except BaseException:
                cur.execute("ROLLBACK")
                raise
            finally:
                cur.close()

    def query(self, sql: str, params: tuple = ()) -> list[sqlite3.Row]:
        with self._lock:
            return self._conn.execute(sql, params).fetchall()

    def query_one(self, sql: str, params: tuple = ()) -> sqlite3.Row | None:
        with self._lock:
            return self._conn.execute(sql, params).fetchone()

    def audit(self, event: str, user_id: int | None = None, detail: dict[str, Any] | None = None) -> None:
        """Registra eventos de segurança. Nunca grave dados pessoais aqui."""
        with self.transaction() as cur:
            cur.execute(
                "INSERT INTO audit_log(user_id, event, detail, ts) VALUES (?,?,?,?)",
                (user_id, event[:64], json.dumps(detail or {})[:1000], time.time()),
            )

    def close(self) -> None:
        with self._lock:
            try:
                self._conn.execute("PRAGMA wal_checkpoint(TRUNCATE)")
            finally:
                self._conn.close()
