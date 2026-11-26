import io
import pytest
from pypdf import PdfReader
from aulaviva.core.ai import AIBlock, convert_blocks
from aulaviva.core.pdf_builder import build_pdf
from aulaviva.core.projects import new_block, template_documents
from aulaviva.core.security import SecurityError


def test_full_template_builds_with_forms_and_no_js():
    for name, doc in template_documents().items():
        for b in doc["blocks"]:
            if "url" in b:
                b["url"] = "https://example.com"
        pdf = build_pdf(doc)
        assert pdf.startswith(b"%PDF")
        assert b"/JavaScript" not in pdf and b"/JS " not in pdf


def test_unsafe_link_blocks_export():
    doc = template_documents()["Apostila em branco"]
    b = new_block("link"); b["url"] = "javascript:alert(1)"
    doc["blocks"].append(b)
    with pytest.raises(SecurityError):
        build_pdf(doc)
    assert build_pdf(doc, preview=True).startswith(b"%PDF")  # preview mostra aviso


def test_protection_and_fields():
    doc = template_documents()["Lista de exercícios"]
    doc["meta"].update(protect=True, owner_password="profe123")
    r = PdfReader(io.BytesIO(build_pdf(doc)))
    assert r.is_encrypted
    assert any(k.startswith("q1_") for k in r.get_fields())


def test_ai_blocks_drop_unsafe_links():
    blocks = convert_blocks([AIBlock(type="link", text="x", url="javascript:alert(1)"),
                             AIBlock(type="video", text="v", url="http://insecure.com"),
                             AIBlock(type="choice_question", text="?", items=["a", "b"], correct_index=1),
                             AIBlock(type="qrcode", text="ok", url="https://www.ibge.gov.br")])
    assert [b["type"] for b in blocks] == ["choice_question", "qrcode"]
    assert blocks[0]["correct"] == 1


def test_robust_markup_and_long_blocks():
    from aulaviva.core.projects import new_document
    doc = new_document()
    doc["blocks"] = []
    for txt in ("**a *b** c* <b> & </i>", "*a* **b** ***c*** 5*3*2", "π ≈ 3,14 ✓ 😀"):
        b = new_block("paragraph"); b["text"] = txt; doc["blocks"].append(b)
    c = new_block("callout"); c["text"] = "linha longa\n" * 300; doc["blocks"].append(c)
    t = new_block("table"); t["rows"] = [["x"], ["texto " * 3000]]; doc["blocks"].append(t)
    assert build_pdf(doc).startswith(b"%PDF")


def test_incomplete_blocks_are_skipped_and_reported():
    from aulaviva.core.pdf_builder import incomplete_blocks
    doc = template_documents()["Roteiro de aula com QR codes"]
    assert len(incomplete_blocks(doc)) == 3
    assert build_pdf(doc, skip_incomplete=True).startswith(b"%PDF")


def test_student_and_teacher_versions():
    doc = template_documents()["Lista de exercícios"]
    student = PdfReader(io.BytesIO(build_pdf(doc, answer_key=False)))
    teacher = PdfReader(io.BytesIO(build_pdf(doc, answer_key=True)))
    text = lambda r: "".join(p.extract_text() for p in r.pages)
    assert "Gabarito" not in text(student) and "Gabarito" in text(teacher)


def test_subsection_without_section_does_not_crash():
    from aulaviva.core.projects import new_document
    doc = new_document()
    h = new_block("heading"); h["level"] = 2; h["text"] = "Subseção sozinha"
    doc["blocks"] = [h, new_block("paragraph")]
    assert build_pdf(doc).startswith(b"%PDF")


def test_all_samples_export():
    from aulaviva.core.samples import SAMPLES, sample_document
    from aulaviva.core.pdf_builder import incomplete_blocks
    for key in SAMPLES:
        d = sample_document(key)
        assert not incomplete_blocks(d), key
        assert build_pdf(d).startswith(b"%PDF")
