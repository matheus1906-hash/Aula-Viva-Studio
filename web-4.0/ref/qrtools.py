"""Gerador de QR codes (PNG e SVG) sem dependências extras."""

from __future__ import annotations

import io
from html import escape

from PIL import Image, ImageDraw

LEVELS = {"L": "Baixa (7%)", "M": "Média (15%)", "Q": "Alta (25%)", "H": "Máxima (30%) - use com logo"}
MAX_QR_TEXT = 1200


def qr_matrix(text: str, level: str = "M") -> list[list[bool]]:
    from reportlab.graphics.barcode.qr import QrCodeWidget

    text = (text or "").strip()
    if not text:
        raise ValueError("Digite o conteúdo do QR code.")
    if len(text) > MAX_QR_TEXT:
        raise ValueError(f"Conteúdo muito longo para um QR code legível (máx. {MAX_QR_TEXT} caracteres).")
    w = QrCodeWidget(text, barLevel=level if level in LEVELS else "M")
    w.qr.make()
    return [[bool(c) for c in row] for row in w.qr.modules]


def _hex(c: str, default: str) -> tuple[int, int, int]:
    c = (c or default).lstrip("#")
    try:
        return tuple(int(c[i:i + 2], 16) for i in (0, 2, 4))  # type: ignore[return-value]
    except ValueError:
        return _hex(default, "#000000")


def render_png(text: str, size: int = 800, fg: str = "#111827", bg: str = "#FFFFFF", level: str = "M",
               logo: bytes | None = None, border: int = 4) -> bytes:
    matrix = qr_matrix(text, "H" if logo else level)
    n = len(matrix) + border * 2
    size = max(120, min(int(size), 3000))
    box = max(1, size // n)
    img = Image.new("RGB", (n * box, n * box), _hex(bg, "#FFFFFF"))
    d = ImageDraw.Draw(img)
    color = _hex(fg, "#111827")
    for r, row in enumerate(matrix):
        for c, dark in enumerate(row):
            if dark:
                x, y = (c + border) * box, (r + border) * box
                d.rectangle([x, y, x + box - 1, y + box - 1], fill=color)
    if logo:
        try:
            with Image.open(io.BytesIO(logo)) as lg:
                lg = lg.convert("RGBA")
                side = int(img.width * 0.22)
                lg.thumbnail((side, side))
                pad = max(4, side // 10)
                bx = (img.width - lg.width) // 2
                by = (img.height - lg.height) // 2
                d.rounded_rectangle([bx - pad, by - pad, bx + lg.width + pad, by + lg.height + pad], radius=pad, fill=_hex(bg, "#FFFFFF"))
                img.paste(lg, (bx, by), lg)
        except Exception as exc:
            raise ValueError("Não foi possível usar essa imagem como logo.") from exc
    if img.width != size:
        img = img.resize((size, size), Image.Resampling.NEAREST)
    out = io.BytesIO()
    img.save(out, "PNG", optimize=True)
    return out.getvalue()


def render_svg(text: str, fg: str = "#111827", bg: str = "#FFFFFF", level: str = "M", border: int = 4) -> str:
    matrix = qr_matrix(text, level)
    n = len(matrix) + border * 2
    parts = []
    for r, row in enumerate(matrix):
        c = 0
        while c < len(row):
            if row[c]:
                start = c
                while c < len(row) and row[c]:
                    c += 1
                parts.append(f"M{start + border},{r + border}h{c - start}v1h-{c - start}z")
            else:
                c += 1
    fg_s, bg_s = "#%02x%02x%02x" % _hex(fg, "#111827"), "#%02x%02x%02x" % _hex(bg, "#FFFFFF")
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {n} {n}" shape-rendering="crispEdges">'
            f'<title>{escape(text[:80])}</title><rect width="{n}" height="{n}" fill="{bg_s}"/>'
            f'<path fill="{fg_s}" d="{"".join(parts)}"/></svg>')


def wifi_payload(ssid: str, password: str, security: str = "WPA") -> str:
    def esc(v: str) -> str:
        return "".join("\\" + ch if ch in '\\;,:"' else ch for ch in v)

    sec = security if security in ("WPA", "WEP", "nopass") else "WPA"
    return f"WIFI:T:{sec};S:{esc(ssid)};P:{esc(password) if sec != 'nopass' else ''};;"
