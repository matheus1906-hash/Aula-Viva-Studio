import io

import pytest
from PIL import Image

from aulaviva.core import linktools as lt
from aulaviva.core.qrtools import qr_matrix, render_png, render_svg, wifi_payload
from aulaviva.core.security import SecurityError


def test_qr_png_svg_and_logo():
    png = render_png("https://example.com", 400, "#2F6FED")
    im = Image.open(io.BytesIO(png))
    assert im.size == (400, 400)
    logo = io.BytesIO(); Image.new("RGB", (50, 50), "red").save(logo, "PNG")
    assert render_png("https://example.com", 300, logo=logo.getvalue()).startswith(b"\x89PNG")
    svg = render_svg("Olá <turma>")
    assert svg.startswith("<svg") and "<turma>" not in svg
    assert len(qr_matrix("abc")) >= 21
    with pytest.raises(ValueError):
        qr_matrix("")
    assert wifi_payload("Escola;1", "a:b").startswith(r"WIFI:T:WPA;S:Escola\;1;P:a\:b")


def test_links():
    assert lt.clean_url("https://site.com/p?a=1&utm_source=x&fbclid=y") == "https://site.com/p?a=1"
    assert lt.whatsapp_link("(11) 98765-4321", "Olá turma") == "https://wa.me/5511987654321?text=Ol%C3%A1%20turma"
    assert lt.email_link("prof@escola.com", "Aula", "Oi") == "mailto:prof@escola.com?subject=Aula&body=Oi"
    assert lt.youtube_link("https://youtu.be/dQw4w9WgXcQ?si=abc", "1:30") == "https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=90s"
    assert lt.youtube_link("https://www.youtube.com/shorts/dQw4w9WgXcQ") == "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
    assert lt.drive_link("https://drive.google.com/file/d/1AbCdEfGhIjK/view?usp=sharing", "download") == \
        "https://drive.google.com/uc?export=download&id=1AbCdEfGhIjK"
    assert lt.gdocs_link("https://docs.google.com/document/d/1AbCdEfGhIjKl/edit", "copy").endswith("/document/d/1AbCdEfGhIjKl/copy")
    assert lt.gdocs_link("https://docs.google.com/spreadsheets/d/1AbCdEfGhIjKl/edit", "docx").endswith("format=xlsx")
    assert lt.maps_link("Museu do Ipiranga").startswith("https://www.google.com/maps/search/?api=1&query=Museu")
    for bad in (lambda: lt.clean_url("javascript:alert(1)"), lambda: lt.youtube_link("https://vimeo.com/1"),
                lambda: lt.whatsapp_link("123", ""), lambda: lt.gdocs_link("https://evil.com/document/d/1AbCdEfGhIjKl")):
        with pytest.raises(SecurityError):
            bad()
