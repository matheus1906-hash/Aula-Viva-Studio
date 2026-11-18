"""Modelo de documento (apostila) e armazenamento criptografado de projetos."""

from __future__ import annotations

import base64
import copy
import io
import json
import time
import uuid
from dataclasses import dataclass
from pathlib import Path

from PIL import Image

from aulaviva.core.config import MAX_ATTACHMENT_BYTES, MAX_BLOCKS_PER_PROJECT, MAX_IMAGE_BYTES, MAX_IMAGE_PIXELS
from aulaviva.core.database import Database
from aulaviva.core.security import SecurityError, clean_text, safe_filename, validate_url

Image.MAX_IMAGE_PIXELS = MAX_IMAGE_PIXELS

# Catálogo de blocos: tipo -> (rótulo, ícone, valores padrão)
BLOCK_TYPES: dict[str, tuple[str, str, dict]] = {
    "heading":   ("Título de seção", "H", {"text": "Nova seção", "level": 1}),
    "paragraph": ("Texto", "¶", {"text": "Escreva aqui. Use **negrito** e *itálico*."}),
    "bullets":   ("Lista", "•", {"items": ["Primeiro item", "Segundo item"]}),
    "callout":   ("Destaque", "!", {"style": "dica", "title": "Dica", "text": "Uma observação importante."}),
    "image":     ("Imagem", "▣", {"data": "", "caption": "", "width": 80}),
    "qrcode":    ("QR Code", "▦", {"url": "", "caption": "Aponte a câmera do celular", "size": 34}),
    "link":      ("Link / botão", "↗", {"label": "Acesse o material", "url": "", "description": ""}),
    "word":      ("Documento Word/Office", "W", {"label": "Lista de exercícios (Word)", "mode": "link", "url": "", "filename": "", "data": ""}),
    "video":     ("Vídeo", "▶", {"title": "Videoaula", "url": "", "mode": "link", "media": "", "filename": "", "info": ""}),
    "open_question":   ("Pergunta aberta", "?", {"prompt": "Explique com suas palavras...", "lines": 4, "answer": ""}),
    "choice_question": ("Múltipla escolha", "◉", {"prompt": "Qual alternativa está correta?", "options": ["Alternativa A", "Alternativa B", "Alternativa C", "Alternativa D"], "correct": 0}),
    "true_false":      ("Verdadeiro ou falso", "V/F", {"statements": ["Afirmação 1", "Afirmação 2"], "answers": [True, False]}),
    "table":     ("Tabela", "▤", {"rows": [["Coluna 1", "Coluna 2"], ["valor", "valor"]]}),
    "divider":   ("Separador", "—", {}),
    "page_break": ("Quebra de página", "⤓", {}),
}

CALLOUT_STYLES = {
    "dica": ("Dica", "#2E9E6B"),
    "atencao": ("Atenção", "#E0912F"),
    "importante": ("Importante", "#D64545"),
    "curiosidade": ("Curiosidade", "#6C5CE7"),
    "definicao": ("Definição", "#2F80ED"),
}

OFFICE_EXT = {".docx", ".doc", ".odt", ".xlsx", ".pptx", ".pdf", ".txt"}
_MAGIC = {
    b"PK\x03\x04": {".docx", ".xlsx", ".pptx", ".odt"},
    b"\xd0\xcf\x11\xe0": {".doc"},
    b"%PDF": {".pdf"},
}

THEMES = {
    "Azul escolar": "#2F6FED",
    "Verde caderno": "#1F9D6B",
    "Laranja giz": "#E2762B",
    "Roxo ciência": "#7B4FD6",
    "Vermelho lousa": "#C9433A",
    "Grafite": "#3B4252",
}


def new_block(kind: str) -> dict:
    if kind not in BLOCK_TYPES:
        raise ValueError(kind)
    block = copy.deepcopy(BLOCK_TYPES[kind][2])
    block["type"] = kind
    block["id"] = uuid.uuid4().hex[:12]
    return block


def new_document(title: str = "Nova apostila", author: str = "", school: str = "") -> dict:
    return {
        "version": 1,
        "meta": {
            "title": title, "subtitle": "", "author": author, "school": school,
            "subject": "", "level": "", "theme": "Azul escolar",
            "cover": True, "toc": True, "page_numbers": True, "answer_key": True,
            "student_fields": True, "footer": "",
            "protect": False, "owner_password": "", "allow_print": True, "allow_copy": True,
        },
        "blocks": [new_block("heading"), new_block("paragraph")],
    }


def load_image_safely(path: Path, max_side: int = 1800) -> str:
    """Valida, reduz e reencoda uma imagem (remove metadados/EXIF)."""
    if path.stat().st_size > MAX_IMAGE_BYTES:
        raise SecurityError("Imagem muito grande (máx. 12 MB).")
    try:
        with Image.open(path) as im:
            if im.format not in {"PNG", "JPEG", "GIF", "BMP", "WEBP"}:
                raise SecurityError("Formato de imagem não suportado.")
            im.load()
            im = im.convert("RGBA") if im.mode in ("P", "LA", "RGBA") else im.convert("RGB")
            im.thumbnail((max_side, max_side))
            out = io.BytesIO()
            if im.mode == "RGBA":
                im.save(out, "PNG", optimize=True)
            else:
                im.save(out, "JPEG", quality=88, optimize=True)
    except Image.DecompressionBombError as exc:
        raise SecurityError("Imagem com dimensões perigosas foi bloqueada.") from exc
    except SecurityError:
        raise
    except Exception as exc:
        raise SecurityError("Não foi possível ler a imagem.") from exc
    return base64.b64encode(out.getvalue()).decode()


def load_attachment_safely(path: Path) -> tuple[str, str]:
    ext = path.suffix.lower()
    if ext not in OFFICE_EXT:
        raise SecurityError("Tipo de arquivo não permitido. Use Word, Excel, PowerPoint, ODT, PDF ou TXT.")
    size = path.stat().st_size
    if size > MAX_ATTACHMENT_BYTES:
        raise SecurityError("Arquivo muito grande (máx. 15 MB).")
    data = path.read_bytes()
    if ext != ".txt":
        if not any(data.startswith(m) and ext in exts for m, exts in _MAGIC.items()):
            raise SecurityError("O conteúdo do arquivo não corresponde à extensão.")
        if ext in {".docx", ".xlsx", ".pptx"} and b"vbaProject.bin" in data:
            raise SecurityError("Arquivos com macros não são permitidos.")
    return safe_filename(path.name), base64.b64encode(data).decode()


def sanitize_document(doc: dict) -> dict:
    """Normaliza e valida um documento vindo do editor, da IA ou de arquivo."""
    if not isinstance(doc, dict):
        raise SecurityError("Documento inválido.")
    base = new_document()
    meta = base["meta"]
    src_meta = doc.get("meta", {}) if isinstance(doc.get("meta"), dict) else {}
    for key, default in meta.items():
        val = src_meta.get(key, default)
        if isinstance(default, bool):
            meta[key] = bool(val)
        else:
            meta[key] = clean_text(str(val), 200, multiline=False)
    if meta["theme"] not in THEMES:
        meta["theme"] = "Azul escolar"
    blocks = []
    for raw in (doc.get("blocks") or [])[:MAX_BLOCKS_PER_PROJECT]:
        if not isinstance(raw, dict) or raw.get("type") not in BLOCK_TYPES:
            continue
        b = new_block(raw["type"])
        b["id"] = clean_text(str(raw.get("id") or b["id"]), 32, False)
        for key, default in BLOCK_TYPES[raw["type"]][2].items():
            val = raw.get(key, default)
            if isinstance(default, bool):
                b[key] = bool(val)
            elif isinstance(default, int):
                try:
                    b[key] = max(-1 if key == "correct" else 0, min(int(val), 400))
                except (TypeError, ValueError):
                    b[key] = default
            elif isinstance(default, list):
                val = val if isinstance(val, list) else default
                if key == "rows":
                    b[key] = [[clean_text(str(c), 500) for c in row[:8]] for row in val[:60] if isinstance(row, list)]
                elif key == "answers":
                    b[key] = [bool(x) for x in val[:30]]
                else:
                    b[key] = [clean_text(str(x), 1000) for x in val[:30]]
            elif key == "data":
                b[key] = str(val) if isinstance(val, str) and len(val) < MAX_ATTACHMENT_BYTES * 2 else ""
            else:
                b[key] = clean_text(str(val), 20_000 if key in ("text", "answer") else 500, multiline=key in ("text", "answer", "description", "prompt"))
        blocks.append(b)
    base["blocks"] = blocks
    return base


def block_url_problem(block: dict) -> str | None:
    """Retorna a mensagem de erro se o link do bloco for inseguro/inválido."""
    if block["type"] == "video" and block.get("mode") == "embed":
        if not (block.get("url") or "").strip():
            return None  # vídeo anexado: o link é opcional
        try:
            validate_url(block.get("url", ""))
        except SecurityError as exc:
            return str(exc)
        return None
    if block["type"] in {"qrcode", "link", "video"} or (block["type"] == "word" and block.get("mode") == "link"):
        try:
            validate_url(block.get("url", ""))
        except SecurityError as exc:
            return str(exc)
    return None


@dataclass
class ProjectInfo:
    id: int
    title: str
    kind: str
    created_at: float
    updated_at: float
    blocks: int = 0


class ProjectStore:
    def __init__(self, db: Database):
        self.db = db
        self.c = db.crypto

    def _ctx(self, uid: int, field: str) -> str:
        return f"projects.{field}.u{uid}"  # dados amarrados ao dono (AAD)

    def create(self, uid: int, doc: dict, kind: str = "apostila") -> int:
        doc = sanitize_document(doc)
        now = time.time()
        with self.db.transaction() as cur:
            cur.execute(
                "INSERT INTO projects(user_id,title_enc,content_enc,kind,created_at,updated_at) VALUES (?,?,?,?,?,?)",
                (uid, self.c.encrypt(doc["meta"]["title"], self._ctx(uid, "title")),
                 self.c.encrypt(json.dumps(doc, ensure_ascii=False), self._ctx(uid, "content")), kind, now, now),
            )
            pid = cur.lastrowid
        self.db.audit("project_created", uid, {"project": pid})
        return pid

    def save(self, uid: int, pid: int, doc: dict) -> None:
        doc = sanitize_document(doc)
        with self.db.transaction() as cur:
            cur.execute(
                "UPDATE projects SET title_enc=?, content_enc=?, updated_at=? WHERE id=? AND user_id=?",
                (self.c.encrypt(doc["meta"]["title"], self._ctx(uid, "title")),
                 self.c.encrypt(json.dumps(doc, ensure_ascii=False), self._ctx(uid, "content")), time.time(), pid, uid),
            )
            if cur.rowcount != 1:
                raise SecurityError("Projeto não encontrado.")

    def load(self, uid: int, pid: int) -> dict:
        row = self.db.query_one("SELECT content_enc FROM projects WHERE id=? AND user_id=?", (pid, uid))
        if not row:
            raise SecurityError("Projeto não encontrado.")
        return sanitize_document(json.loads(self.c.decrypt(row["content_enc"], self._ctx(uid, "content"))))

    def list(self, uid: int) -> list[ProjectInfo]:
        rows = self.db.query("SELECT id,title_enc,kind,created_at,updated_at FROM projects WHERE user_id=? ORDER BY updated_at DESC", (uid,))
        return [ProjectInfo(r["id"], self.c.decrypt(r["title_enc"], self._ctx(uid, "title")) or "", r["kind"], r["created_at"], r["updated_at"]) for r in rows]

    def duplicate(self, uid: int, pid: int) -> int:
        doc = self.load(uid, pid)
        doc["meta"]["title"] = (doc["meta"]["title"] + " (cópia)")[:200]
        return self.create(uid, doc)

    def delete(self, uid: int, pid: int) -> None:
        with self.db.transaction() as cur:
            cur.execute("DELETE FROM projects WHERE id=? AND user_id=?", (pid, uid))
        self.db.audit("project_deleted", uid, {"project": pid})
        self.cleanup_media(uid)

    def cleanup_media(self, uid: int) -> None:
        """Remove vídeos que não pertencem a nenhum material restante."""
        from aulaviva.core.media import MediaStore, media_ids

        store = MediaStore(self.c, uid)
        if not store.dir.is_dir():
            return
        used: set[str] = set()
        try:
            for info in self.list(uid):
                used |= media_ids(self.load(uid, info.id))
        except Exception:
            return  # na dúvida, não apaga nada
        store.garbage_collect(used)


# Modelos prontos para começar rápido
def template_documents() -> dict[str, dict]:
    def build(title, subtitle, blocks):
        d = new_document(title)
        d["meta"]["subtitle"] = subtitle
        d["blocks"] = []
        for kind, values in blocks:
            b = new_block(kind)
            b.update(values)
            d["blocks"].append(b)
        return d

    prova_meta = {"cover": False, "toc": False, "student_fields": True, "answer_key": True, "theme": "Grafite"}
    docs = {
        "Apostila em branco": new_document(),
        "Apostila de conteúdo": build("Apostila de Conteúdo", "Material de apoio ao estudante", [
            ("heading", {"text": "Introdução"}),
            ("paragraph", {"text": "Apresente o tema da aula e os **objetivos de aprendizagem**."}),
            ("callout", {"style": "definicao", "title": "Conceito-chave", "text": "Defina aqui o conceito principal."}),
            ("heading", {"text": "Desenvolvimento"}),
            ("bullets", {"items": ["Ponto 1", "Ponto 2", "Ponto 3"]}),
            ("video", {"title": "Videoaula complementar", "url": "https://www.youtube.com/"}),
            ("heading", {"text": "Exercícios"}),
            ("choice_question", {}),
            ("open_question", {}),
        ]),
        "Lista de exercícios": build("Lista de Exercícios", "Pratique o que aprendeu", [
            ("callout", {"style": "atencao", "title": "Instruções", "text": "Leia com atenção antes de responder."}),
            ("choice_question", {}), ("choice_question", {}), ("true_false", {}), ("open_question", {}),
        ]),
        "Avaliação / Prova": build("Avaliação", "", [
            ("callout", {"style": "atencao", "title": "Instruções", "text": "Leia com atenção. Responda no próprio PDF ou à caneta."}),
            ("choice_question", {}), ("choice_question", {}), ("true_false", {}), ("open_question", {"lines": 6}),
        ]),
        "Roteiro de aula com QR codes": build("Roteiro de Aula", "Atividades interativas", [
            ("heading", {"text": "Antes da aula"}),
            ("qrcode", {"url": "", "caption": "Escaneie para ver o material prévio"}),
            ("heading", {"text": "Durante a aula"}),
            ("link", {"label": "Abrir atividade online", "url": ""}),
            ("heading", {"text": "Depois da aula"}),
            ("word", {"label": "Baixar lista de exercícios (Word)"}),
        ]),
    }
    docs["Avaliação / Prova"]["meta"].update(prova_meta)
    docs["Lista de exercícios"]["meta"].update(cover=False, toc=False)
    return docs


# Tipos de material oferecidos no assistente "Criar novo material"
MATERIAL_KINDS = {
    "apostila": ("Apostila", "📘", "Conteúdo organizado em seções, com capa, sumário, destaques e atividades."),
    "lista": ("Lista de exercícios", "📝", "Questões de múltipla escolha, V/F e abertas, com gabarito automático."),
    "prova": ("Avaliação / Prova", "🧾", "Cabeçalho com nome e turma, instruções, questões e versão com gabarito."),
    "roteiro": ("Roteiro com QR codes", "▦", "Ligue o papel a vídeos, simuladores e formulários online."),
    "branco": ("Em branco", "＋", "Comece do zero e monte do seu jeito."),
}


def document_for_kind(kind: str, title: str, subject: str = "", level: str = "", author: str = "", school: str = "") -> dict:
    """Cria um documento já configurado para o tipo de material escolhido."""
    if kind == "apostila":
        d = template_documents()["Apostila de conteúdo"]
    elif kind == "roteiro":
        d = template_documents()["Roteiro de aula com QR codes"]
    elif kind in ("lista", "prova"):
        d = new_document()
        d["blocks"] = []
        b = new_block("callout")
        b["style"], b["title"] = "atencao", "Instruções"
        b["text"] = ("Leia com atenção. Responda no próprio PDF ou à caneta. Boa prova!" if kind == "prova"
                     else "Resolva as questões abaixo. Você pode responder diretamente neste PDF.")
        d["blocks"].append(b)
        d["meta"].update(cover=False, toc=False, student_fields=True, answer_key=True)
        if kind == "prova":
            d["meta"]["theme"] = "Grafite"
    else:
        d = new_document()
    d["meta"].update(title=title or MATERIAL_KINDS.get(kind, ("Novo material",))[0], subject=subject, level=level,
                     author=author, school=school)
    if kind != "apostila":
        d["meta"]["subtitle"] = ""
    return d
