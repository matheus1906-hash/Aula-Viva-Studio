"""Arquivos de vídeo dos materiais, guardados criptografados fora do banco de dados.

Vídeos são grandes demais para ir junto do documento (que é salvo a cada alteração).
Cada vídeo vira um arquivo AES-256-GCM em <dados>/media/u<id>/<id>.bin, amarrado ao dono
(AAD), e o bloco do documento guarda só a referência.
"""

from __future__ import annotations

import os
import re
import secrets
import shutil
from pathlib import Path

from aulaviva.core.config import data_dir
from aulaviva.core.security import Crypto, SecurityError, safe_filename

MAX_VIDEO_BYTES = 100 * 1024 * 1024   # 100 MB: o PDF final fica com esse tamanho a mais
VIDEO_EXT = {".mp4", ".m4v", ".mov", ".webm", ".mkv", ".avi", ".wmv", ".mpg", ".mpeg", ".3gp"}
VIDEO_FILTER = "Vídeos (*.mp4 *.m4v *.mov *.webm *.mkv *.avi *.wmv *.mpg *.mpeg *.3gp)"
_ID_RE = re.compile(r"^[0-9a-f]{24}$")


def human_size(n: int) -> str:
    return f"{n / 1024 / 1024:.1f} MB".replace(".", ",") if n >= 1024 * 1024 else f"{max(1, n // 1024)} KB"


def _looks_like_video(head: bytes, ext: str) -> bool:
    if ext in (".mp4", ".m4v", ".mov", ".3gp"):
        return head[4:8] in (b"ftyp", b"moov", b"mdat", b"wide", b"free", b"skip")
    if ext in (".webm", ".mkv"):
        return head.startswith(b"\x1a\x45\xdf\xa3")
    if ext == ".avi":
        return head.startswith(b"RIFF") and head[8:12] == b"AVI "
    if ext == ".wmv":
        return head.startswith(b"\x30\x26\xb2\x75\x8e\x66\xcf\x11")
    if ext in (".mpg", ".mpeg"):
        return head.startswith((b"\x00\x00\x01\xba", b"\x00\x00\x01\xb3"))
    return False


def check_video(path: Path) -> tuple[str, int]:
    """Valida extensão, tamanho e assinatura do arquivo. Retorna (nome seguro, tamanho)."""
    path = Path(path)
    ext = path.suffix.lower()
    if ext not in VIDEO_EXT:
        raise SecurityError("Formato de vídeo não suportado. Use MP4, MOV, WEBM, MKV, AVI, WMV ou MPG.")
    try:
        size = path.stat().st_size
        with path.open("rb") as fh:
            head = fh.read(16)
    except OSError as exc:
        raise SecurityError("Não foi possível abrir o vídeo.") from exc
    if size > MAX_VIDEO_BYTES:
        raise SecurityError(f"Vídeo muito grande ({human_size(size)}). O limite é 100 MB: comprima o vídeo ou "
                            "publique no YouTube/Drive e use a opção de link (QR code).")
    if size < 1024 or not _looks_like_video(head, ext):
        raise SecurityError("O conteúdo do arquivo não parece ser um vídeo válido.")
    return safe_filename(path.name, "video" + ext), size


class MediaStore:
    def __init__(self, crypto: Crypto, uid: int):
        self.c, self.uid = crypto, uid
        self.dir = data_dir() / "media" / f"u{int(uid)}"

    def _ctx(self, media_id: str) -> str:
        return f"media.u{self.uid}.{media_id}"

    def _path(self, media_id: str) -> Path:
        if not _ID_RE.match(media_id or ""):
            raise SecurityError("Referência de vídeo inválida.")
        return self.dir / f"{media_id}.bin"

    def put(self, path: str | Path) -> dict:
        """Guarda o vídeo criptografado. Retorna os campos para o bloco (media, filename, info)."""
        name, size = check_video(Path(path))
        data = Path(path).read_bytes()
        media_id = secrets.token_hex(12)
        self.dir.mkdir(parents=True, exist_ok=True)
        target = self._path(media_id)
        tmp = target.with_suffix(".part")
        tmp.write_bytes(self.c.encrypt_raw(data, self._ctx(media_id)))
        if os.name != "nt":
            os.chmod(tmp, 0o600)
        os.replace(tmp, target)
        return {"media": media_id, "filename": name, "info": human_size(size)}

    def exists(self, media_id: str) -> bool:
        try:
            return self._path(media_id).is_file()
        except SecurityError:
            return False

    def get(self, media_id: str) -> bytes:
        try:
            blob = self._path(media_id).read_bytes()
        except OSError as exc:
            raise SecurityError("O arquivo de vídeo não foi encontrado neste computador.") from exc
        return self.c.decrypt_raw(blob, self._ctx(media_id))

    def collect(self, documents: list[dict]) -> dict[str, bytes]:
        """Vídeos usados pelos documentos (para anexar ao PDF)."""
        out: dict[str, bytes] = {}
        for doc in documents:
            for b in doc.get("blocks", []):
                mid = b.get("media") if b.get("type") == "video" and b.get("mode") == "embed" else None
                if mid and mid not in out and self.exists(mid):
                    out[mid] = self.get(mid)
        return out

    def garbage_collect(self, used: set[str]) -> int:
        """Apaga vídeos que nenhum material usa mais."""
        removed = 0
        if not self.dir.is_dir():
            return 0
        for f in self.dir.glob("*.bin"):
            if f.stem not in used:
                f.unlink(missing_ok=True)
                removed += 1
        return removed

    def delete_all(self) -> None:
        shutil.rmtree(self.dir, ignore_errors=True)


def media_ids(doc: dict) -> set[str]:
    return {b.get("media") for b in doc.get("blocks", []) if b.get("type") == "video" and b.get("media")}


def attach_imported_video(result, store: MediaStore) -> None:
    """Depois de importar um vídeo, guarda o arquivo (criptografado) e liga o bloco a ele. Rodar fora da interface."""
    path = getattr(result, "video_path", "")
    if not path:
        return
    fields = None
    for b in result.blocks:
        if b.get("type") == "video" and b.get("mode") == "embed" and not b.get("media"):
            fields = fields or store.put(path)
            b.update(fields)
