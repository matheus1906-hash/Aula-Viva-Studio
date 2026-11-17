"""Primitivas de segurança do AulaViva Studio.

- Senhas: Argon2id (argon2-cffi) com parâmetros fortes e rehash automático.
- Dados pessoais em repouso: AES-256-GCM com chaves derivadas por HKDF.
- Buscas por e-mail/CPF sem expor o dado: índice cego HMAC-SHA256.
- Chave-mestra guardada no cofre do sistema operacional (Windows Credential
  Manager / Secret Service no Linux). Fallback: arquivo 0600 (Linux) ou
  protegido via DPAPI (Windows).
- Validação rigorosa de entradas (e-mail, CPF, telefone, URLs, textos).
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import logging
import os
import re
import secrets
import stat
import string
import unicodedata
from datetime import date
from pathlib import Path
from urllib.parse import urlsplit

from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError, VerifyMismatchError
from cryptography.exceptions import InvalidTag
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.hkdf import HKDF

from aulaviva import APP_ID
from aulaviva.core.config import MAX_TEXT_LEN, MAX_URL_LEN, data_dir

log = logging.getLogger(__name__)


class SecurityError(Exception):
    """Erro de segurança com mensagem segura para exibir ao usuário."""


# ---------------------------------------------------------------------------
# Senhas
# ---------------------------------------------------------------------------

_hasher = PasswordHasher(time_cost=3, memory_cost=64 * 1024, parallelism=2, hash_len=32, salt_len=16)
# Hash "isca" usado quando o e-mail não existe: mantém o tempo de resposta
# igual e impede descobrir quais contas existem (enumeração de usuários).
_DUMMY_HASH: str | None = None


def _dummy_hash() -> str:
    global _DUMMY_HASH
    if _DUMMY_HASH is None:  # calculado sob demanda: não atrasa a abertura do app
        _DUMMY_HASH = _hasher.hash(secrets.token_urlsafe(24))
    return _DUMMY_HASH

_COMMON_PASSWORDS = {
    "123456", "12345678", "123456789", "1234567890", "password", "senha", "senha123",
    "qwerty", "abc123", "111111", "123123", "admin", "iloveyou", "brasil", "professor",
    "escola", "mudar123", "senha@123", "password1", "qwerty123", "000000", "654321",
}


def hash_password(password: str) -> str:
    return _hasher.hash(password)


def verify_password(stored_hash: str | None, password: str) -> bool:
    try:
        return _hasher.verify(stored_hash or _dummy_hash(), password) and stored_hash is not None
    except (VerifyMismatchError, VerificationError, InvalidHashError):
        return False


def password_needs_rehash(stored_hash: str) -> bool:
    try:
        return _hasher.check_needs_rehash(stored_hash)
    except InvalidHashError:
        return True


def password_problems(password: str, personal: list[str] | None = None) -> list[str]:
    """Lista os requisitos não atendidos (vazia = senha aceita)."""
    problems: list[str] = []
    if len(password) < 10:
        problems.append("Use pelo menos 10 caracteres.")
    if len(password) > 256:
        problems.append("Use no máximo 256 caracteres.")
    if not re.search(r"[a-z]", password):
        problems.append("Inclua uma letra minúscula.")
    if not re.search(r"[A-Z]", password):
        problems.append("Inclua uma letra maiúscula.")
    if not re.search(r"\d", password):
        problems.append("Inclua um número.")
    if not re.search(r"[^\w\s]|_", password):
        problems.append("Inclua um símbolo (ex.: ! @ # $ %).")
    low = password.lower()
    if low in _COMMON_PASSWORDS or re.fullmatch(r"(.)\1{5,}", password):
        problems.append("Essa senha é muito comum.")
    for item in personal or []:
        item = (item or "").strip().lower()
        for piece in re.split(r"[\s@._-]+", item):
            if len(piece) >= 4 and piece in low:
                problems.append("Não use seu nome, e-mail ou dados pessoais na senha.")
                return problems
    return problems


def password_score(password: str) -> int:
    """Pontuação 0..4 para o medidor visual de força."""
    if not password:
        return 0
    classes = sum(bool(re.search(p, password)) for p in (r"[a-z]", r"[A-Z]", r"\d", r"[^\w\s]|_"))
    score = 0
    if len(password) >= 10:
        score += 1
    if len(password) >= 14:
        score += 1
    score += max(0, classes - 2)
    if password.lower() in _COMMON_PASSWORDS:
        score = 0
    return max(0, min(score, 4))


def generate_recovery_codes(n: int = 8) -> list[str]:
    alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"  # sem caracteres ambíguos
    codes = []
    for _ in range(n):
        raw = "".join(secrets.choice(alphabet) for _ in range(10))
        codes.append(f"{raw[:5]}-{raw[5:]}")
    return codes


def normalize_recovery_code(code: str) -> str:
    return re.sub(r"[^A-Z0-9]", "", code.upper())


# ---------------------------------------------------------------------------
# Chave-mestra e criptografia de campos
# ---------------------------------------------------------------------------

_KEYRING_SERVICE = APP_ID
_KEYRING_USER = "master-key-v1"


def _dpapi(data: bytes, protect: bool) -> bytes:
    """Protege bytes com a DPAPI do Windows (atrelada à conta do usuário)."""
    import ctypes
    from ctypes import wintypes

    class BLOB(ctypes.Structure):
        _fields_ = [("cbData", wintypes.DWORD), ("pbData", ctypes.POINTER(ctypes.c_char))]

    crypt32 = ctypes.WinDLL("crypt32", use_last_error=True)  # type: ignore[attr-defined]
    kernel32 = ctypes.WinDLL("kernel32", use_last_error=True)  # type: ignore[attr-defined]
    fn = crypt32.CryptProtectData if protect else crypt32.CryptUnprotectData
    fn.argtypes = [ctypes.POINTER(BLOB), ctypes.c_void_p, ctypes.c_void_p, ctypes.c_void_p, ctypes.c_void_p,
                   wintypes.DWORD, ctypes.POINTER(BLOB)]
    fn.restype = wintypes.BOOL
    kernel32.LocalFree.argtypes = [ctypes.c_void_p]
    kernel32.LocalFree.restype = ctypes.c_void_p
    buf = ctypes.create_string_buffer(data, len(data))
    blob_in = BLOB(len(data), ctypes.cast(buf, ctypes.POINTER(ctypes.c_char)))
    blob_out = BLOB()
    if not fn(ctypes.byref(blob_in), None, None, None, None, 0x01, ctypes.byref(blob_out)):  # 0x01 = sem interface
        raise SecurityError("Falha ao acessar a proteção de dados do Windows.")
    try:
        return ctypes.string_at(blob_out.pbData, blob_out.cbData)
    finally:
        kernel32.LocalFree(ctypes.cast(blob_out.pbData, ctypes.c_void_p))


def _keyfile() -> Path:
    return data_dir() / ".masterkey"


def _load_or_create_master_key() -> bytes:
    use_keyring = os.environ.get("AULAVIVA_NO_KEYRING") != "1"
    if use_keyring:
        try:
            import keyring

            stored = keyring.get_password(_KEYRING_SERVICE, _KEYRING_USER)
            if stored:
                return base64.b64decode(stored)
            if not _keyfile().exists():
                key = secrets.token_bytes(32)
                keyring.set_password(_KEYRING_SERVICE, _KEYRING_USER, base64.b64encode(key).decode())
                if keyring.get_password(_KEYRING_SERVICE, _KEYRING_USER):
                    return key
        except Exception as exc:  # cofre indisponível: usa o fallback seguro
            log.info("Cofre do sistema indisponível (%s); usando arquivo protegido.", type(exc).__name__)

    path = _keyfile()
    if path.exists():
        raw = path.read_bytes()
        if os.name == "nt":
            raw = _dpapi(raw, protect=False)
        if len(raw) != 32:
            raise SecurityError("Arquivo de chave corrompido.")
        return raw
    key = secrets.token_bytes(32)
    payload = _dpapi(key, protect=True) if os.name == "nt" else key
    fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, stat.S_IRUSR | stat.S_IWUSR)
    with os.fdopen(fd, "wb") as fh:
        fh.write(payload)
    return key


class Crypto:
    """Criptografia autenticada de campos e índices cegos."""

    VERSION = "v1"

    def __init__(self, master_key: bytes | None = None):
        master = master_key or _load_or_create_master_key()
        self._enc = AESGCM(self._derive(master, b"aulaviva/field-encryption"))
        self._idx_key = self._derive(master, b"aulaviva/blind-index")

    @staticmethod
    def _derive(master: bytes, info: bytes) -> bytes:
        return HKDF(algorithm=hashes.SHA256(), length=32, salt=b"aulaviva-hkdf-salt-v1", info=info).derive(master)

    def encrypt(self, plaintext: str | bytes | None, context: str) -> str | None:
        if plaintext is None:
            return None
        data = plaintext.encode("utf-8") if isinstance(plaintext, str) else plaintext
        nonce = secrets.token_bytes(12)
        ct = self._enc.encrypt(nonce, data, context.encode())
        return f"{self.VERSION}:" + base64.urlsafe_b64encode(nonce + ct).decode()

    def decrypt_bytes(self, token: str | None, context: str) -> bytes | None:
        if token is None:
            return None
        try:
            version, payload = token.split(":", 1)
            if version != self.VERSION:
                raise SecurityError("Versão de criptografia desconhecida.")
            raw = base64.urlsafe_b64decode(payload)
            return self._enc.decrypt(raw[:12], raw[12:], context.encode())
        except (ValueError, InvalidTag) as exc:
            raise SecurityError("Dado protegido inválido ou adulterado.") from exc

    def decrypt(self, token: str | None, context: str) -> str | None:
        raw = self.decrypt_bytes(token, context)
        return None if raw is None else raw.decode("utf-8")

    def blind_index(self, value: str, kind: str) -> str:
        norm = unicodedata.normalize("NFKC", value).strip().lower()
        return hmac.new(self._idx_key, f"{kind}:{norm}".encode(), hashlib.sha256).hexdigest()


def constant_time_equals(a: str, b: str) -> bool:
    return hmac.compare_digest(a.encode(), b.encode())


# ---------------------------------------------------------------------------
# Validação de entradas
# ---------------------------------------------------------------------------

_EMAIL_RE = re.compile(r"^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]{1,64}@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+$")
_CONTROL_RE = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f​-‏‪-‮⁦-⁩]")

BR_STATES = [
    "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA",
    "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO",
]


def clean_text(value: str | None, max_len: int = MAX_TEXT_LEN, multiline: bool = True) -> str:
    """Remove caracteres de controle/bidi invisíveis e limita o tamanho."""
    value = unicodedata.normalize("NFC", value or "")
    value = _CONTROL_RE.sub("", value)
    if not multiline:
        value = " ".join(value.split())
    return value.strip()[:max_len]


def normalize_email(email: str) -> str:
    return clean_text(email, 254, multiline=False).lower()


def is_valid_email(email: str) -> bool:
    email = normalize_email(email)
    return len(email) <= 254 and bool(_EMAIL_RE.match(email))


def only_digits(value: str) -> str:
    return "".join(ch for ch in value or "" if ch in string.digits)


def is_valid_cpf(cpf: str) -> bool:
    digits = only_digits(cpf)
    if len(digits) != 11 or digits == digits[0] * 11:
        return False
    for size in (9, 10):
        total = sum(int(d) * w for d, w in zip(digits[:size], range(size + 1, 1, -1)))
        check = (total * 10) % 11 % 10
        if check != int(digits[size]):
            return False
    return True


def format_cpf(cpf: str) -> str:
    d = only_digits(cpf)
    return f"{d[:3]}.{d[3:6]}.{d[6:9]}-{d[9:]}" if len(d) == 11 else cpf


def is_valid_phone_br(phone: str) -> bool:
    d = only_digits(phone)
    if d.startswith("55") and len(d) in (12, 13):
        d = d[2:]
    if len(d) not in (10, 11) or d[0] == "0":
        return False
    return len(d) == 10 or d[2] == "9"


def is_valid_full_name(name: str) -> bool:
    name = clean_text(name, 120, multiline=False)
    parts = [p for p in name.split(" ") if p]
    return len(parts) >= 2 and all(re.fullmatch(r"[^\W\d_]+(?:['’-][^\W\d_]+)*\.?", p) for p in parts)


def is_valid_birth_date(value: date, min_age: int = 18, max_age: int = 100) -> bool:
    today = date.today()
    age = today.year - value.year - ((today.month, today.day) < (value.month, value.day))
    return min_age <= age <= max_age


_ALLOWED_SCHEMES = {"https", "http", "mailto"}


def validate_url(url: str, allow_http: bool = True) -> str:
    """Valida um link a ser incluído no PDF. Lança SecurityError se inseguro.

    Bloqueia javascript:, file:, data: e similares, credenciais embutidas,
    caracteres de controle e endereços malformados.
    """
    url = (url or "").strip()
    if not url:
        raise SecurityError("Informe um endereço (URL).")
    if len(url) > MAX_URL_LEN:
        raise SecurityError("Endereço muito longo.")
    if _CONTROL_RE.search(url) or any(ch.isspace() for ch in url):
        raise SecurityError("O endereço contém caracteres inválidos.")
    if "://" not in url and not url.lower().startswith("mailto:"):
        url = "https://" + url
    parts = urlsplit(url)
    scheme = parts.scheme.lower()
    if scheme not in _ALLOWED_SCHEMES or (scheme == "http" and not allow_http):
        raise SecurityError("Somente links https://, http:// ou mailto: são permitidos.")
    if scheme == "mailto":
        if not is_valid_email(parts.path):
            raise SecurityError("E-mail do link inválido.")
        return url
    if parts.username or parts.password:
        raise SecurityError("Links com usuário/senha embutidos não são permitidos.")
    host = parts.hostname or ""
    if not host or "." not in host and host != "localhost":
        raise SecurityError("Endereço sem domínio válido.")
    if not re.fullmatch(r"[A-Za-z0-9.-]+|\[[0-9A-Fa-f:.]+\]", host):
        raise SecurityError("Domínio com caracteres não permitidos.")
    return url


def safe_filename(name: str, default: str = "arquivo") -> str:
    name = clean_text(name, 120, multiline=False)
    name = re.sub(r'[<>:"/\\|?*]', "_", name).strip(" .")
    reserved = {"CON", "PRN", "AUX", "NUL", *(f"COM{i}" for i in range(1, 10)), *(f"LPT{i}" for i in range(1, 10))}
    if not name or name.split(".")[0].upper() in reserved:
        name = default
    return name
