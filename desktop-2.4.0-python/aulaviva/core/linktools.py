"""Gerador de links úteis para professores (sem serviços externos de encurtamento)."""

from __future__ import annotations

import re
from urllib.parse import parse_qsl, quote, urlencode, urlsplit, urlunsplit

from aulaviva.core.security import SecurityError, is_valid_email, only_digits, validate_url

_TRACKING = re.compile(r"^(utm_\w+|fbclid|gclid|dclid|msclkid|igshid|mc_eid|mc_cid|si|ref_src|_hsenc|_hsmi|yclid)$", re.I)

LINK_TYPES = {
    "clean": "Limpar link (remover rastreadores)",
    "whatsapp": "WhatsApp com mensagem pronta",
    "email": "E-mail com assunto e texto",
    "youtube": "YouTube começando em um minuto",
    "drive": "Google Drive: visualizar ou baixar arquivo",
    "gdocs": "Google Docs/Planilhas/Apresentações: cópia ou PDF",
    "maps": "Google Maps (local da atividade)",
}


def clean_url(url: str) -> str:
    url = validate_url(url)
    parts = urlsplit(url)
    if parts.scheme == "mailto":
        return url
    query = [(k, v) for k, v in parse_qsl(parts.query, keep_blank_values=True) if not _TRACKING.match(k)]
    return urlunsplit((parts.scheme, parts.netloc, parts.path, urlencode(query), parts.fragment))


def whatsapp_link(phone: str, message: str) -> str:
    digits = only_digits(phone)
    if digits and len(digits) in (10, 11):
        digits = "55" + digits
    if digits and not 12 <= len(digits) <= 15:
        raise SecurityError("Telefone inválido. Use DDD + número (ou deixe em branco para escolher o contato).")
    if not message.strip() and not digits:
        raise SecurityError("Informe a mensagem ou o telefone.")
    base = f"https://wa.me/{digits}" if digits else "https://wa.me/"
    return base + ("?text=" + quote(message.strip()[:2000]) if message.strip() else "")


def email_link(to: str, subject: str, body: str) -> str:
    to = to.strip()
    if to and not all(is_valid_email(x) for x in to.split(",")):
        raise SecurityError("E-mail do destinatário inválido.")
    q = {k: v for k, v in (("subject", subject.strip()[:300]), ("body", body.strip()[:2000])) if v}
    return f"mailto:{to}" + ("?" + urlencode(q, quote_via=quote) if q else "")


def _youtube_id(url: str) -> str:
    parts = urlsplit(validate_url(url))
    host = (parts.hostname or "").lower()
    vid = ""
    if host.endswith("youtu.be"):
        vid = parts.path.strip("/").split("/")[0]
    elif "youtube" in host:
        q = dict(parse_qsl(parts.query))
        vid = q.get("v", "")
        m = re.match(r"^/(?:shorts|embed|live)/([\w-]{6,})", parts.path)
        if not vid and m:
            vid = m.group(1)
    if not re.fullmatch(r"[\w-]{6,20}", vid or ""):
        raise SecurityError("Não reconheci um vídeo do YouTube nesse link.")
    return vid


def youtube_link(url: str, start: str = "") -> str:
    vid = _youtube_id(url)
    secs = 0
    if start.strip():
        nums = [int(x) for x in re.findall(r"\d+", start)][-3:]
        if not nums:
            raise SecurityError("Tempo inválido. Use minutos:segundos, ex.: 2:30.")
        for n in nums:
            secs = secs * 60 + n
    return f"https://www.youtube.com/watch?v={vid}" + (f"&t={secs}s" if secs else "")


def _drive_id(url: str) -> str:
    parts = urlsplit(validate_url(url))
    m = re.search(r"/d/([\w-]{10,})", parts.path)
    fid = m.group(1) if m else dict(parse_qsl(parts.query)).get("id", "")
    if not re.fullmatch(r"[\w-]{10,}", fid or ""):
        raise SecurityError("Não reconheci um arquivo do Google Drive nesse link.")
    return fid


def drive_link(url: str, mode: str = "view") -> str:
    fid = _drive_id(url)
    if mode == "download":
        return f"https://drive.google.com/uc?export=download&id={fid}"
    return f"https://drive.google.com/file/d/{fid}/view"


def gdocs_link(url: str, mode: str = "copy") -> str:
    parts = urlsplit(validate_url(url))
    m = re.match(r"^/(document|spreadsheets|presentation|forms)/d/([\w-]{10,})", parts.path)
    if not m or not (parts.hostname or "").endswith("docs.google.com"):
        raise SecurityError("Use um link do Google Docs, Planilhas, Apresentações ou Formulários.")
    kind, fid = m.groups()
    base = f"https://docs.google.com/{kind}/d/{fid}"
    if mode == "copy" and kind != "forms":
        return base + "/copy"
    if mode in ("pdf", "docx") and kind != "forms":
        fmt = "xlsx" if mode == "docx" and kind == "spreadsheets" else ("pptx" if mode == "docx" and kind == "presentation" else mode)
        return base + f"/export?format={fmt}"
    return base + ("/viewform" if kind == "forms" else "/preview")


def maps_link(query: str) -> str:
    q = query.strip()
    if len(q) < 3:
        raise SecurityError("Informe o endereço ou o nome do local.")
    return "https://www.google.com/maps/search/?api=1&query=" + quote(q[:300])
