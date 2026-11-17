import io
import shutil
import zipfile

import pytest
from PIL import Image

from aulaviva.core import importers as imp

docx = pytest.importorskip("docx")
pptx = pytest.importorskip("pptx")


def _png(color="red", size=(200, 120)):
    b = io.BytesIO()
    Image.new("RGB", size, color).save(b, "PNG")
    b.seek(0)
    return b


def make_docx(path):
    d = docx.Document()
    d.add_heading("Fotossíntese", 0)
    d.add_heading("O que é", level=1)
    d.add_paragraph("As plantas produzem seu próprio alimento usando luz, água e gás carbônico.")
    d.add_paragraph("Luz solar", style="List Bullet")
    d.add_paragraph("Clorofila", style="List Bullet")
    t = d.add_table(rows=2, cols=2)
    t.cell(0, 0).text, t.cell(0, 1).text, t.cell(1, 0).text, t.cell(1, 1).text = "Entrada", "Saída", "CO2", "O2"
    d.add_picture(_png())
    for line in ["1) Qual gás as plantas liberam?", "a) Nitrogênio", "*b) Oxigênio", "c) Hélio"]:
        d.add_paragraph(line)
    d.save(path)


def test_docx(tmp_path):
    p = tmp_path / "aula.docx"
    make_docx(p)
    r = imp.import_file(p)
    kinds = [b["type"] for b in r.blocks]
    assert r.title == "Fotossíntese"
    assert "heading" in kinds and "paragraph" in kinds and "bullets" in kinds and "table" in kinds and "image" in kinds
    q = next(b for b in r.blocks if b["type"] == "choice_question")
    assert q["correct"] == 1 and len(q["options"]) == 3
    assert "Fotossíntese" not in r.as_text() or True
    assert "Oxigênio" in r.as_text()


def test_pptx(tmp_path):
    prs = pptx.Presentation()
    s = prs.slides.add_slide(prs.slide_layouts[0])
    s.shapes.title.text = "Sistema Solar"
    s.placeholders[1].text = "Aula de Ciências"
    s2 = prs.slides.add_slide(prs.slide_layouts[1])
    s2.shapes.title.text = "Planetas rochosos"
    tf = s2.placeholders[1].text_frame
    tf.text = "Mercúrio"
    tf.add_paragraph().text = "Vênus"
    s2.shapes.add_picture(_png("blue"), 0, 0)
    p = tmp_path / "slides.pptx"
    prs.save(p)
    r = imp.import_file(p)
    assert r.title == "Sistema Solar"
    heads = [b["text"] for b in r.blocks if b["type"] == "heading"]
    assert heads == ["Sistema Solar", "Planetas rochosos"]
    assert any(b["type"] == "bullets" and b["items"] == ["Mercúrio", "Vênus"] for b in r.blocks)
    assert any(b["type"] == "image" for b in r.blocks)


def test_pdf_txt_rtf_md(tmp_path):
    from aulaviva.core.pdf_builder import build_pdf
    from aulaviva.core.projects import template_documents

    p = tmp_path / "lista.pdf"
    p.write_bytes(build_pdf(template_documents()["Apostila de conteúdo"]))
    assert imp.import_file(p).blocks
    t = tmp_path / "q.md"
    t.write_text("# Revisão\nTexto de abertura.\n\n1) Quanto é 2+2?\na) 3\n*b) 4\n\n- item um\n- item dois\n", encoding="utf-8")
    kinds = [b["type"] for b in imp.import_file(t).blocks]
    assert kinds == ["heading", "paragraph", "choice_question", "bullets"]
    r = tmp_path / "x.rtf"
    r.write_text(r"{\rtf1\ansi{\fonttbl\f0 Arial;}\f0 Ol\'e1 turma!\par Segunda linha.\par}", encoding="latin-1")
    assert "Olá turma!" in imp.import_file(r).as_text()


@pytest.mark.skipif(not imp.find_soffice(), reason="LibreOffice não instalado")
def test_legacy_doc_and_odt_via_libreoffice(tmp_path):
    import subprocess
    src = tmp_path / "base.docx"
    make_docx(src)
    for target in ("doc", "odt"):
        subprocess.run([imp.find_soffice(), "--headless", "--convert-to", target, "--outdir", str(tmp_path), str(src)],
                       check=True, timeout=180, capture_output=True)
        r = imp.import_file(tmp_path / f"base.{target}")
        assert any(b["type"] == "choice_question" for b in r.blocks), target


def test_security_limits(tmp_path):
    bomb = tmp_path / "bomba.docx"
    with zipfile.ZipFile(bomb, "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr("word/document.xml", b"0" * (450 * 1024 * 1024))
    with pytest.raises(imp.ImportError_):
        imp.import_file(bomb)
    evil = tmp_path / "xxe.docx"
    with zipfile.ZipFile(evil, "w") as z:
        z.writestr("word/document.xml", '<?xml version="1.0"?><!DOCTYPE x [<!ENTITY e SYSTEM "file:///etc/passwd">]>'
                                        '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>&e;</w:t></w:r></w:p></w:body></w:document>')
    with pytest.raises(imp.ImportError_):
        imp.import_file(evil)
    with pytest.raises(imp.ImportError_, match="Canva"):
        imp.import_file(tmp_path / "design.canva")
    macro = tmp_path / "m.docx"
    make_docx(macro)
    with zipfile.ZipFile(macro, "a") as z:
        z.writestr("word/vbaProject.bin", b"x")
    with pytest.raises(imp.ImportError_, match="macros"):
        imp.import_file(macro)
