"""Importação de documentos do professor (Word, PowerPoint, PDF, Canva, ODT, texto...).

O conteúdo vira blocos editáveis (títulos, textos, listas, tabelas, imagens e até questões)
ou serve de BASE para a IA criar uma apostila, lista, prova ou roteiro.

Segurança:
- XML lido com defusedxml (sem entidades externas / "billion laughs");
- proteção contra "zip bomb" (tamanho descompactado e taxa de compressão);
- limites de tamanho de arquivo, de páginas, de texto e de blocos;
- imagens reprocessadas (EXIF removido) com o mesmo validador do editor;
- conversão de .doc/.ppt antigos só via LibreOffice local, sem shell e com tempo limite.
"""

from __future__ import annotations

import base64
import io
import os
import re
import shutil
import subprocess
import tempfile
import zipfile
from dataclasses import dataclass, field
from pathlib import Path, PurePosixPath

from defusedxml import ElementTree as SafeET

from aulaviva.core.projects import new_block, sanitize_document
from aulaviva.core.quicklist import _NUM_RE, _OPT_RE, _TF_STRICT_RE, parse_questions
from aulaviva.core.security import SecurityError, clean_text

MAX_FILE_BYTES = 60 * 1024 * 1024
MAX_UNZIPPED = 400 * 1024 * 1024
MAX_RATIO = 120
MAX_PDF_PAGES = 400
MAX_BLOCKS = 500
MAX_IMAGES = 40

SUPPORTED = {
    ".docx": "Word", ".doc": "Word 97-2003", ".pptx": "PowerPoint", ".ppt": "PowerPoint 97-2003",
    ".odt": "LibreOffice Writer", ".odp": "LibreOffice Impress", ".pdf": "PDF (inclusive do Canva)",
    ".txt": "Texto", ".md": "Markdown", ".rtf": "Rich Text", ".png": "Imagem", ".jpg": "Imagem", ".jpeg": "Imagem",
    ".srt": "Legenda de vídeo", ".vtt": "Legenda de vídeo",
    **{e: "Vídeo" for e in (".mp4", ".m4v", ".mov", ".webm", ".mkv", ".avi", ".wmv", ".mpg", ".mpeg", ".3gp")},
}
FILE_FILTER = ("Documentos e vídeos (*.docx *.doc *.pptx *.ppt *.odt *.odp *.pdf *.txt *.md *.rtf *.png *.jpg *.jpeg "
               "*.srt *.vtt *.mp4 *.m4v *.mov *.webm *.mkv *.avi *.wmv *.mpg *.mpeg *.3gp);;"
               "Vídeos (*.mp4 *.m4v *.mov *.webm *.mkv *.avi *.wmv *.mpg *.mpeg *.3gp);;Legendas (*.srt *.vtt)")

W = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"
A = "{http://schemas.openxmlformats.org/drawingml/2006/main}"
P = "{http://schemas.openxmlformats.org/presentationml/2006/main}"
R = "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}"
PR = "{http://schemas.openxmlformats.org/package/2006/relationships}"
TXT = "{urn:oasis:names:tc:opendocument:xmlns:text:1.0}"
TBL = "{urn:oasis:names:tc:opendocument:xmlns:table:1.0}"
DRAW = "{urn:oasis:names:tc:opendocument:xmlns:drawing:1.0}"
XLINK = "{http://www.w3.org/1999/xlink}"


class ImportError_(Exception):
    """Erro de importação com mensagem amigável."""


@dataclass
class ImportResult:
    title: str
    blocks: list[dict]
    source: str
    warnings: list[str] = field(default_factory=list)
    video_path: str = ""        # vídeo a anexar (guardado criptografado pelo app depois da leitura)

    def summary(self) -> str:
        from collections import Counter

        names = {"heading": "título(s)", "paragraph": "texto(s)", "bullets": "lista(s)", "table": "tabela(s)",
                 "image": "imagem(ns)", "choice_question": "questão(ões) de múltipla escolha",
                 "true_false": "questão(ões) V/F", "open_question": "pergunta(s) aberta(s)", "callout": "destaque(s)",
                 "video": "vídeo(s)"}
        c = Counter(b["type"] for b in self.blocks)
        return ", ".join(f"{n} {names.get(t, t)}" for t, n in c.most_common()) or "nenhum conteúdo encontrado"

    def as_text(self, limit: int = 60_000) -> str:
        """Texto simples (com marcações leves) para enviar à IA como base."""
        out: list[str] = []
        for b in self.blocks:
            t = b["type"]
            if t == "heading":
                out.append(("# " if b.get("level", 1) <= 1 else "## ") + b["text"])
            elif t in ("paragraph", "callout"):
                out.append(b.get("text", ""))
            elif t == "bullets":
                out.extend("- " + x for x in b["items"])
            elif t == "table":
                out.extend(" | ".join(r) for r in b["rows"])
            elif t == "choice_question":
                out.append("Questão: " + b["prompt"])
                out.extend(f"{chr(97 + i)}) {o}" for i, o in enumerate(b["options"]))
            elif t == "true_false":
                out.extend("(V/F) " + s for s in b["statements"])
            elif t == "open_question":
                out.append("Questão: " + b["prompt"])
            elif t == "video":
                out.append("Vídeo: " + b.get("title", ""))
        text = "\n".join(x for x in out if x.strip())
        return text[:limit]


# --------------------------------------------------------------------------- utilidades
def _check_zip(zf: zipfile.ZipFile) -> None:
    total = 0
    for info in zf.infolist():
        total += info.file_size
        if info.compress_size and info.file_size / max(info.compress_size, 1) > MAX_RATIO and info.file_size > 5_000_000:
            raise ImportError_("Arquivo compactado suspeito (taxa de compressão anormal) foi bloqueado.")
    if total > MAX_UNZIPPED:
        raise ImportError_("O documento é grande demais para importar.")


def _xml(zf: zipfile.ZipFile, name: str):
    try:
        data = zf.read(name)
    except KeyError:
        return None
    return SafeET.fromstring(data)


def _rels(zf: zipfile.ZipFile, part: str) -> dict[str, str]:
    p = PurePosixPath(part)
    root = _xml(zf, str(p.parent / "_rels" / (p.name + ".rels")))
    out = {}
    if root is None:
        return out
    for rel in root.iter(f"{PR}Relationship"):
        target = rel.get("Target", "")
        if rel.get("TargetMode") == "External":
            continue
        out[rel.get("Id")] = str((p.parent / target).as_posix()) if not target.startswith("/") else target.lstrip("/")
    return out


def _norm(path: str) -> str:
    parts: list[str] = []
    for seg in path.split("/"):
        if seg == "..":
            if parts:
                parts.pop()
        elif seg and seg != ".":
            parts.append(seg)
    return "/".join(parts)


def _image_block(data: bytes, caption: str = "") -> dict | None:
    from PIL import Image

    from aulaviva.core.config import MAX_IMAGE_BYTES

    if len(data) > MAX_IMAGE_BYTES:
        return None
    try:
        with Image.open(io.BytesIO(data)) as im:
            if im.format not in {"PNG", "JPEG", "GIF", "BMP", "WEBP"}:
                return None
            im.load()
            if im.width < 40 or im.height < 40:  # ícones/marcadores decorativos
                return None
            im = im.convert("RGBA") if im.mode in ("P", "LA", "RGBA") else im.convert("RGB")
            im.thumbnail((1600, 1600))
            out = io.BytesIO()
            im.save(out, "PNG" if im.mode == "RGBA" else "JPEG", **({"optimize": True} if im.mode == "RGBA" else {"quality": 85}))
    except Exception:
        return None
    b = new_block("image")
    b["data"] = base64.b64encode(out.getvalue()).decode()
    b["caption"] = caption
    b["width"] = 70
    return b


_BULLET_RE = re.compile(r"^\s*(?:[-•▪●◦*–]|\d{1,2}[.)])\s+(.+)$")


def text_to_blocks(lines: list[str]) -> list[dict]:
    """Converte linhas de texto em blocos: questões (formato da lista rápida), listas e parágrafos."""
    blocks: list[dict] = []
    para: list[str] = []
    bullets: list[str] = []

    def flush_para():
        if para:
            text = " ".join(para).strip()
            if text:
                b = new_block("paragraph")
                b["text"] = text
                blocks.append(b)
            para.clear()

    def flush_bullets():
        if bullets:
            b = new_block("bullets")
            b["items"] = bullets[:30]
            blocks.append(b)
            bullets.clear()

    i, n = 0, len(lines)
    while i < n:
        line = lines[i].rstrip()
        if not line.strip():
            flush_para()
            flush_bullets()
            i += 1
            continue
        if line.lstrip().startswith("#"):
            flush_para()
            flush_bullets()
            b = new_block("heading")
            b["text"] = line.lstrip("#").strip()[:200]
            b["level"] = 2 if line.lstrip().startswith("##") else 1
            blocks.append(b)
            i += 1
            continue
        if _NUM_RE.match(line):
            # possível questão: olha as próximas linhas por alternativas ou V/F
            j = i + 1
            while j < n and lines[j].strip() and not _NUM_RE.match(lines[j]) and not (
                    _OPT_RE.match(lines[j]) or _TF_STRICT_RE.match(lines[j])):
                j += 1
            k = j
            opts = 0
            while k < n and lines[k].strip() and (_OPT_RE.match(lines[k]) or _TF_STRICT_RE.match(lines[k])
                                                   or lines[k].lower().lstrip().startswith(("resposta:", "gabarito:"))):
                opts += 1
                k += 1
            if opts >= 2:
                flush_para()
                flush_bullets()
                blocks.extend(parse_questions("\n".join(lines[i:k])))
                i = k
                continue
        m = _BULLET_RE.match(line)
        if m and not _NUM_RE.match(line) or (m and len(line) < 140 and bullets):
            flush_para()
            bullets.append(m.group(1).strip()[:1000])
            i += 1
            continue
        flush_bullets()
        para.append(line.strip())
        if re.search(r"[.!?:;]$", line.strip()):
            flush_para()
        i += 1
    flush_para()
    flush_bullets()
    return blocks


def _title_from(path: Path) -> str:
    return clean_text(re.sub(r"[_-]+", " ", path.stem), 200, False).strip() or "Material importado"


# --------------------------------------------------------------------------- formatos
def _import_docx(path: Path) -> ImportResult:
    with zipfile.ZipFile(path) as zf:
        _check_zip(zf)
        if any(n.lower().endswith("vbaproject.bin") for n in zf.namelist()):
            raise ImportError_("Documentos com macros não são importados por segurança.")
        styles = {}
        st = _xml(zf, "word/styles.xml")
        if st is not None:
            for s in st.iter(f"{W}style"):
                name = s.find(f"{W}name")
                styles[s.get(f"{W}styleId")] = (name.get(f"{W}val") if name is not None else "").lower()
        doc = _xml(zf, "word/document.xml")
        if doc is None:
            raise ImportError_("Arquivo Word inválido.")
        rels = _rels(zf, "word/document.xml")
        body = doc.find(f"{W}body")
        blocks: list[dict] = []
        lines: list[str] = []
        title = ""
        images = 0

        def flush():
            if lines:
                blocks.extend(text_to_blocks(lines))
                lines.clear()

        for el in list(body) if body is not None else []:
            if len(blocks) > MAX_BLOCKS:
                break
            if el.tag == f"{W}tbl":
                flush()
                rows = []
                for tr in el.iter(f"{W}tr"):
                    cells = ["".join(t.text or "" for t in tc.iter(f"{W}t")).strip() for tc in tr.findall(f"{W}tc")]
                    if any(cells):
                        rows.append(cells[:8])
                if rows:
                    b = new_block("table")
                    b["rows"] = rows[:60]
                    blocks.append(b)
                continue
            if el.tag != f"{W}p":
                continue
            ppr = el.find(f"{W}pPr")
            style = ""
            is_list = False
            level = None
            if ppr is not None:
                ps = ppr.find(f"{W}pStyle")
                style = styles.get(ps.get(f"{W}val"), ps.get(f"{W}val", "").lower()) if ps is not None else ""
                is_list = ppr.find(f"{W}numPr") is not None or any(k in style for k in ("list", "lista", "marcador"))
                ol = ppr.find(f"{W}outlineLvl")
                if ol is not None and ol.get(f"{W}val", "9").isdigit() and int(ol.get(f"{W}val")) < 3:
                    level = int(ol.get(f"{W}val")) + 1
            parts, all_bold, has_text = [], True, False
            for node in el.iter():
                if node.tag == f"{W}r":
                    rpr = node.find(f"{W}rPr")
                    bold = rpr is not None and rpr.find(f"{W}b") is not None and rpr.find(f"{W}b").get(f"{W}val", "1") not in ("0", "false")
                    txt = "".join((t.text or "") if t.tag == f"{W}t" else ("\t" if t.tag == f"{W}tab" else "\n" if t.tag == f"{W}br" else "")
                                  for t in node)
                    if txt.strip():
                        has_text = True
                        all_bold &= bold
                    parts.append(txt)
                elif node.tag == f"{A}blip" and images < MAX_IMAGES:
                    target = rels.get(node.get(f"{R}embed"))
                    if target:
                        try:
                            ib = _image_block(zf.read(_norm(target)))
                        except KeyError:
                            ib = None
                        if ib:
                            flush()
                            blocks.append(ib)
                            images += 1
            text = clean_text("".join(parts), 5000).replace("\t", " ")
            if not has_text:
                lines.append("")
                continue
            if "title" in style or "título" == style.strip():
                title = title or text[:200]
                continue
            hm = re.search(r"(heading|título|titulo)\s*(\d)", style)
            if hm or level:
                flush()
                b = new_block("heading")
                b["text"] = text[:200]
                b["level"] = 1 if (int(hm.group(2)) if hm else level) <= 1 else 2
                blocks.append(b)
                continue
            if all_bold and len(text) < 90 and not text.endswith((".", "?", ":")) and not _NUM_RE.match(text):
                flush()
                b = new_block("heading")
                b["text"], b["level"] = text, 2
                blocks.append(b)
                continue
            lines.append(("- " + text) if is_list and not _NUM_RE.match(text) and not _OPT_RE.match(text) else text)
        flush()
    return ImportResult(title or _title_from(path), blocks, path.name)


def _import_pptx(path: Path) -> ImportResult:
    with zipfile.ZipFile(path) as zf:
        _check_zip(zf)
        if any(n.lower().endswith("vbaproject.bin") for n in zf.namelist()):
            raise ImportError_("Apresentações com macros não são importadas por segurança.")
        pres = _xml(zf, "ppt/presentation.xml")
        prels = _rels(zf, "ppt/presentation.xml")
        order = []
        if pres is not None:
            for sid in pres.iter(f"{P}sldId"):
                t = prels.get(sid.get(f"{R}id"))
                if t:
                    order.append(_norm(t))
        if not order:
            order = sorted((n for n in zf.namelist() if re.match(r"ppt/slides/slide\d+\.xml$", n)),
                           key=lambda n: int(re.search(r"(\d+)", n.rsplit("/", 1)[1]).group(1)))
        blocks: list[dict] = []
        title = ""
        images = 0
        for num, part in enumerate(order, 1):
            root = _xml(zf, part)
            if root is None:
                continue
            rels = _rels(zf, part)
            slide_title, items = "", []
            for sp in root.iter(f"{P}sp"):
                ph = sp.find(f".//{P}ph")
                is_title = ph is not None and ph.get("type") in ("title", "ctrTitle")
                paras = []
                for ap in sp.iter(f"{A}p"):
                    t = clean_text("".join(x.text or "" for x in ap.iter(f"{A}t")), 2000)
                    if t:
                        paras.append(t)
                if is_title and paras and not slide_title:
                    slide_title = " ".join(paras)[:200]
                else:
                    items.extend(paras)
            if num == 1 and slide_title:
                title = slide_title
            h = new_block("heading")
            h["text"] = slide_title or f"Slide {num}"
            blocks.append(h)
            if items:
                q = text_to_blocks(items) if any(_OPT_RE.match(x) for x in items) else []
                if q and any(b["type"].endswith("question") for b in q):
                    blocks.extend(q)
                elif len(items) == 1 and len(items[0]) > 120:
                    b = new_block("paragraph")
                    b["text"] = items[0]
                    blocks.append(b)
                else:
                    b = new_block("bullets")
                    b["items"] = items[:30]
                    blocks.append(b)
            for blip in root.iter(f"{A}blip"):
                if images >= MAX_IMAGES:
                    break
                t = rels.get(blip.get(f"{R}embed"))
                if t:
                    try:
                        ib = _image_block(zf.read(_norm(t)))
                    except KeyError:
                        ib = None
                    if ib:
                        blocks.append(ib)
                        images += 1
            if len(blocks) > MAX_BLOCKS:
                break
    return ImportResult(title or _title_from(path), blocks, path.name)


def _import_odf(path: Path) -> ImportResult:
    with zipfile.ZipFile(path) as zf:
        _check_zip(zf)
        root = _xml(zf, "content.xml")
        if root is None:
            raise ImportError_("Arquivo do LibreOffice inválido.")
        blocks: list[dict] = []
        lines: list[str] = []
        images = 0

        def text_of(el) -> str:
            return clean_text("".join(el.itertext()), 5000)

        def flush():
            if lines:
                blocks.extend(text_to_blocks(lines))
                lines.clear()

        def walk(el):
            nonlocal images
            for ch in el:
                if len(blocks) > MAX_BLOCKS:
                    return
                if ch.tag == f"{TXT}h":
                    flush()
                    b = new_block("heading")
                    b["text"] = text_of(ch)[:200] or "Seção"
                    b["level"] = 1 if ch.get(f"{TXT}outline-level", "1") == "1" else 2
                    blocks.append(b)
                elif ch.tag == f"{TXT}p":
                    for img in ch.iter(f"{DRAW}image"):
                        href = img.get(f"{XLINK}href", "")
                        if href and images < MAX_IMAGES and not href.startswith(("http", "/")):
                            try:
                                ib = _image_block(zf.read(_norm(href)))
                            except KeyError:
                                ib = None
                            if ib:
                                flush()
                                blocks.append(ib)
                                images += 1
                    lines.append(text_of(ch))
                elif ch.tag == f"{TXT}list":
                    for item in ch.iter(f"{TXT}list-item"):
                        t = text_of(item)
                        if t:
                            lines.append("- " + t)
                    lines.append("")
                elif ch.tag == f"{TBL}table":
                    flush()
                    rows = [[text_of(c) for c in r.findall(f"{TBL}table-cell")][:8] for r in ch.iter(f"{TBL}table-row")]
                    rows = [r for r in rows if any(r)]
                    if rows:
                        b = new_block("table")
                        b["rows"] = rows[:60]
                        blocks.append(b)
                elif ch.tag == f"{DRAW}page":  # apresentações (odp)
                    flush()
                    h = new_block("heading")
                    h["text"] = ch.get(f"{DRAW}name", "Slide")
                    blocks.append(h)
                    walk(ch)
                    flush()
                else:
                    walk(ch)

        walk(root)
        flush()
    return ImportResult(_title_from(path), blocks, path.name)


def _import_pdf(path: Path) -> ImportResult:
    from pypdf import PdfReader

    try:
        reader = PdfReader(str(path))
        if reader.is_encrypted and not reader.decrypt(""):
            raise ImportError_("O PDF está protegido por senha. Remova a proteção e tente de novo.")
    except ImportError_:
        raise
    except Exception as exc:
        raise ImportError_("Não foi possível ler este PDF.") from exc
    lines: list[str] = []
    warnings = []
    for i, page in enumerate(reader.pages):
        if i >= MAX_PDF_PAGES:
            warnings.append(f"Apenas as primeiras {MAX_PDF_PAGES} páginas foram importadas.")
            break
        try:
            text = page.extract_text() or ""
        except Exception:
            text = ""
        lines.extend(clean_text(ln, 2000) for ln in text.splitlines())
        lines.append("")
    if not any(ln.strip() for ln in lines):
        raise ImportError_("Este PDF não tem texto selecionável (parece ser imagem escaneada). "
                           "Use um PDF com texto ou exporte novamente do Canva/Word.")
    title = ""
    meta = reader.metadata
    if meta and meta.title:
        title = clean_text(str(meta.title), 200, False)
    return ImportResult(title or _title_from(path), text_to_blocks(lines), path.name, warnings)


def _decode_text(raw: bytes) -> str:
    for enc in ("utf-8-sig", "utf-16"):
        try:
            if enc == "utf-16" and not raw.startswith((b"\xff\xfe", b"\xfe\xff")):
                continue
            return raw.decode(enc)
        except UnicodeDecodeError:
            continue
    return raw.decode("cp1252", errors="replace")


def _import_text(path: Path) -> ImportResult:
    text = _decode_text(path.read_bytes())
    return ImportResult(_title_from(path), text_to_blocks([clean_text(x, 5000) for x in text.splitlines()]), path.name)


def rtf_to_text(rtf: str) -> str:
    """Conversão simples de RTF para texto (sem dependências)."""
    out, stack, skip, i = [], [], False, 0
    destinations = {"fonttbl", "colortbl", "stylesheet", "info", "pict", "header", "footer", "object", "themedata",
                    "datastore", "latentstyles", "listtable", "listoverridetable", "rsidtbl", "generator", "xmlnstbl"}
    n = len(rtf)
    while i < n:
        ch = rtf[i]
        if ch == "{":
            stack.append(skip)
            i += 1
        elif ch == "}":
            skip = stack.pop() if stack else False
            i += 1
        elif ch == "\\":
            m = re.match(r"\\([a-zA-Z]+)(-?\d+)? ?|\\'([0-9a-fA-F]{2})|\\(.)", rtf[i:])
            if not m:
                i += 1
                continue
            word, arg, hexv, sym = m.groups()
            i += m.end()
            if skip:
                continue
            if hexv:
                out.append(bytes([int(hexv, 16)]).decode("cp1252", errors="replace"))
            elif sym:
                if sym == "*":
                    skip = True
                elif sym in "\\{}":
                    out.append(sym)
            elif word in destinations:
                skip = True
            elif word in ("par", "line", "sect", "page"):
                out.append("\n")
            elif word == "tab":
                out.append("\t")
            elif word == "u" and arg:
                out.append(chr(int(arg) % 65536))
                if i < n and rtf[i] == "?":
                    i += 1
        else:
            if not skip and ch not in "\r\n":
                out.append(ch)
            i += 1
    return "".join(out)


def _import_rtf(path: Path) -> ImportResult:
    text = rtf_to_text(path.read_bytes().decode("latin-1"))
    return ImportResult(_title_from(path), text_to_blocks([clean_text(x, 5000) for x in text.splitlines()]), path.name)


def find_soffice() -> str | None:
    for name in ("soffice", "libreoffice"):
        found = shutil.which(name)
        if found:
            return found
    for cand in (r"C:\Program Files\LibreOffice\program\soffice.exe", r"C:\Program Files (x86)\LibreOffice\program\soffice.exe"):
        if os.path.exists(cand):
            return cand
    return None


def _convert_legacy(path: Path, target: str) -> Path:
    soffice = find_soffice()
    if not soffice:
        kind = "Word" if target == "docx" else "PowerPoint"
        raise ImportError_(f"Arquivos {path.suffix} antigos precisam ser convertidos: abra no {kind} e use "
                           f"'Salvar como' > .{target}, ou instale o LibreOffice (gratuito) para converter automaticamente.")
    out_dir = Path(tempfile.mkdtemp(prefix="aulaviva-conv-"))
    try:
        subprocess.run([soffice, "--headless", "--norestore", "--convert-to", target, "--outdir", str(out_dir), str(path)],
                       check=True, timeout=120, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        result = next(out_dir.glob(f"*.{target}"), None)
        if not result:
            raise ImportError_("O LibreOffice não conseguiu converter o arquivo.")
        final = Path(tempfile.mkdtemp(prefix="aulaviva-imp-")) / (path.stem + "." + target)
        shutil.move(str(result), final)
        return final
    except subprocess.TimeoutExpired as exc:
        raise ImportError_("A conversão demorou demais e foi cancelada.") from exc
    except subprocess.CalledProcessError as exc:
        raise ImportError_("O LibreOffice não conseguiu converter o arquivo.") from exc
    finally:
        shutil.rmtree(out_dir, ignore_errors=True)


def _import_image(path: Path) -> ImportResult:
    b = _image_block(path.read_bytes(), caption=_title_from(path))
    if not b:
        raise ImportError_("Imagem inválida ou muito pequena.")
    b["width"] = 90
    return ImportResult(_title_from(path), [b], path.name)


_CUE_TIME = re.compile(r"^\s*(?:\d{1,2}:)?\d{1,2}:\d{2}[.,]\d{1,3}\s*-->")


def subtitles_to_text(raw: str) -> str:
    """Converte legendas SRT/VTT em texto corrido (a fala do vídeo), sem tempos nem marcações."""
    out: list[str] = []
    last = ""
    for line in raw.splitlines():
        t = line.strip()
        if not t or t.isdigit() or t.upper().startswith(("WEBVTT", "NOTE", "STYLE", "REGION", "KIND:", "LANGUAGE:")) \
                or _CUE_TIME.match(t):
            if out and out[-1] != "":
                out.append("")
            continue
        t = re.sub(r"<[^>]{1,40}>", "", t)          # <i>, <c.cor>, <00:00:01.000>
        t = re.sub(r"\{\\[^}]{0,40}\}", "", t)      # {\an8}
        t = clean_text(t, 1000)
        if t and t != last:                         # legendas "roladas" repetem a linha anterior
            out.append(t)
            last = t
    # junta as falas em parágrafos de tamanho razoável
    paras, cur = [], []
    for t in out:
        if t == "":
            continue
        cur.append(t)
        if sum(len(x) for x in cur) > 600 and t.endswith((".", "!", "?")):
            paras.append(" ".join(cur))
            cur = []
    if cur:
        paras.append(" ".join(cur))
    return "\n\n".join(paras)


def _import_subtitles(path: Path) -> ImportResult:
    text = subtitles_to_text(_decode_text(path.read_bytes()))
    blocks = [{"type": "heading", "text": "Transcrição do vídeo", "level": 1}]
    blocks += [{"type": "paragraph", "text": p} for p in text.split("\n\n") if p.strip()]
    return ImportResult(_title_from(path), blocks, path.name)


def _import_video(path: Path) -> ImportResult:
    """Vídeo do computador: vira um bloco 'vídeo anexado'. Se houver legenda com o mesmo nome, a fala vira texto."""
    from aulaviva.core.media import check_video, human_size

    try:
        name, size = check_video(path)
    except SecurityError as exc:
        raise ImportError_(str(exc)) from exc
    title = _title_from(path)
    blocks: list[dict] = [{"type": "video", "mode": "embed", "title": title[:60], "filename": name, "info": human_size(size)}]
    res = ImportResult(title, blocks, path.name, video_path=str(path))
    for ext in (".srt", ".vtt", ".pt-BR.srt", ".pt.srt", ".pt-BR.vtt", ".pt.vtt"):
        side = path.with_name(path.stem + ext)
        if side.is_file() and side.stat().st_size < 5 * 1024 * 1024:
            sub = _import_subtitles(side)
            blocks.extend(sub.blocks)
            res.warnings.append(f"Legenda encontrada ({side.name}): a fala do vídeo foi transcrita como texto.")
            break
    else:
        res.warnings.append("Dica: se você tiver a legenda do vídeo (.srt ou .vtt) com o mesmo nome na mesma pasta, "
                            "a fala vira texto e a IA pode criar o material a partir dela.")
    return res


def import_file(path: str | Path) -> ImportResult:
    """Lê o arquivo e devolve blocos editáveis já validados."""
    path = Path(path)
    ext = path.suffix.lower()
    if ext in (".canva", ".key", ".pages", ".numbers"):
        raise ImportError_("Esse formato não pode ser lido diretamente. No Canva use Compartilhar > Baixar > PDF (ou PowerPoint); "
                           "no Keynote/Pages exporte como PowerPoint/Word ou PDF.")
    if ext not in SUPPORTED:
        raise ImportError_("Tipo de arquivo não suportado. Use Word, PowerPoint, PDF, ODT/ODP, TXT, RTF, imagem, vídeo ou legenda.")
    try:
        size = path.stat().st_size
    except OSError as exc:
        raise ImportError_("Não foi possível abrir o arquivo.") from exc
    if SUPPORTED[ext] == "Vídeo":
        res = _import_video(path)
        res.blocks = sanitize_document({"blocks": res.blocks})["blocks"]
        return res
    if size > MAX_FILE_BYTES:
        raise ImportError_("Arquivo muito grande (máx. 60 MB).")
    try:
        if ext in (".doc", ".ppt"):
            converted = _convert_legacy(path, "docx" if ext == ".doc" else "pptx")
            try:
                res = _import_docx(converted) if ext == ".doc" else _import_pptx(converted)
            finally:
                shutil.rmtree(converted.parent, ignore_errors=True)
            res.source, res.title = path.name, res.title if res.title != _title_from(converted) else _title_from(path)
        elif ext == ".docx":
            res = _import_docx(path)
        elif ext == ".pptx":
            res = _import_pptx(path)
        elif ext in (".odt", ".odp"):
            res = _import_odf(path)
        elif ext == ".pdf":
            res = _import_pdf(path)
        elif ext in (".txt", ".md"):
            res = _import_text(path)
        elif ext == ".rtf":
            res = _import_rtf(path)
        elif ext in (".srt", ".vtt"):
            res = _import_subtitles(path)
        else:
            res = _import_image(path)
    except (ImportError_, SecurityError):
        raise
    except zipfile.BadZipFile as exc:
        raise ImportError_("O arquivo está corrompido ou não é do formato indicado pela extensão.") from exc
    except Exception as exc:
        raise ImportError_(f"Não foi possível ler o arquivo ({type(exc).__name__}).") from exc
    doc = sanitize_document({"blocks": res.blocks[:MAX_BLOCKS]})
    res.blocks = doc["blocks"]
    if not res.blocks:
        raise ImportError_("Não encontrei conteúdo para importar nesse arquivo.")
    if len(res.blocks) >= MAX_BLOCKS:
        res.warnings.append(f"O documento é muito longo: foram importados os primeiros {MAX_BLOCKS} blocos.")
    return res
