import io
import secrets
import time
from pathlib import Path

import pytest
from pypdf import PdfReader

from aulaviva.core import session_store
from aulaviva.core.auth import AuthError, AuthService
from aulaviva.core.database import Database
from aulaviva.core.importers import import_file, subtitles_to_text
from aulaviva.core.media import MediaStore, attach_imported_video, check_video
from aulaviva.core.pdf_builder import build_pdf, incomplete_blocks
from aulaviva.core.projects import ProjectStore, new_block, new_document
from aulaviva.core.security import Crypto, SecurityError
from tests.test_auth_projects import profile


@pytest.fixture
def svc(tmp_path: Path):
    db = Database(tmp_path / "t.db", Crypto(secrets.token_bytes(32)))
    yield AuthService(db), db
    db.close()


def test_remember_me_token_rotation_expiry_and_revocation(svc):
    auth, db = svc
    user, _ = auth.register("ana@escola.com", "Giz&Lousa-2026x", profile(), True)
    token = auth.create_session(user.id)
    assert token not in str([tuple(r) for r in db.query("SELECT * FROM sessions")])  # só o HMAC fica no banco
    u2, new = auth.resume_session(token)
    assert u2.id == user.id and new != token
    with pytest.raises(AuthError):
        auth.resume_session(token)  # token antigo deixa de valer (rotação)
    u3, newer = auth.resume_session(new)
    auth.end_session(newer)
    with pytest.raises(AuthError):
        auth.resume_session(newer)
    t = auth.create_session(user.id)
    auth.change_password(user.id, "Giz&Lousa-2026x", "Outra&Senha-2027y")
    with pytest.raises(AuthError):
        auth.resume_session(t)  # trocar a senha desconecta os computadores
    t = auth.create_session(user.id)
    with db.transaction() as cur:
        cur.execute("UPDATE sessions SET expires_at=?", (time.time() - 1,))
    with pytest.raises(AuthError, match="expirou"):
        auth.resume_session(t)


def test_session_store_is_encrypted(tmp_path, monkeypatch):
    monkeypatch.setattr(session_store, "config_dir", lambda: tmp_path)
    c = Crypto(secrets.token_bytes(32))
    session_store.save("tok-123", c)
    assert "tok-123" not in (tmp_path / "session.dat").read_text()
    assert session_store.load(c) == "tok-123"
    assert session_store.load(Crypto(secrets.token_bytes(32))) is None  # outra chave mestra: inútil
    session_store.clear()
    assert session_store.load(c) is None


def test_migration_from_v1_adds_sessions(tmp_path):
    import sqlite3
    path = tmp_path / "old.db"
    db = Database(path, Crypto(secrets.token_bytes(32)))
    db.close()
    con = sqlite3.connect(path)
    con.execute("DROP TABLE sessions")
    con.execute("PRAGMA user_version = 1")
    con.commit()
    con.close()
    db = Database(path, Crypto(secrets.token_bytes(32)))
    assert db.query_one("PRAGMA user_version")[0] == 2
    assert db.query("SELECT * FROM sessions") == []
    db.close()


def _fake_mp4(path: Path, size: int = 50_000) -> Path:
    path.write_bytes(b"\x00\x00\x00\x18ftypmp42" + b"\x00" * 8 + secrets.token_bytes(size))
    return path


def test_video_store_and_pdf_attachment(tmp_path, monkeypatch):
    monkeypatch.setattr("aulaviva.core.media.data_dir", lambda: tmp_path)
    c = Crypto(secrets.token_bytes(32))
    store = MediaStore(c, 7)
    video = _fake_mp4(tmp_path / "Aula de frações.mp4")
    fields = store.put(video)
    stored = store.dir / f"{fields['media']}.bin"
    assert stored.exists() and video.read_bytes()[20:2000] not in stored.read_bytes()  # criptografado
    assert store.get(fields["media"]) == video.read_bytes()
    with pytest.raises(SecurityError):
        MediaStore(c, 8).get(fields["media"])  # amarrado ao dono

    doc = new_document("Vídeo")
    b = new_block("video")
    b.update(fields, mode="embed", title="Frações")
    doc["blocks"] = [b]
    assert incomplete_blocks(doc) == []
    pdf = build_pdf(doc, media=store.collect([doc]))
    reader = PdfReader(io.BytesIO(pdf))
    assert "Aula de frações.mp4" in reader.attachments
    assert reader.attachments["Aula de frações.mp4"][0] == video.read_bytes()
    assert build_pdf(doc, preview=True).startswith(b"%PDF")
    empty = new_block("video")
    empty["mode"] = "embed"
    assert incomplete_blocks({"blocks": [empty]})

    store.garbage_collect(set())
    assert not stored.exists()


def test_video_validation(tmp_path):
    bad = tmp_path / "x.mp4"
    bad.write_bytes(b"MZ" + b"\x00" * 5000)  # executável disfarçado
    with pytest.raises(SecurityError):
        check_video(bad)
    with pytest.raises(SecurityError):
        check_video(tmp_path / "x.exe")


def test_import_video_with_subtitles(tmp_path, monkeypatch):
    monkeypatch.setattr("aulaviva.core.media.data_dir", lambda: tmp_path)
    video = _fake_mp4(tmp_path / "fotossintese.mp4")
    (tmp_path / "fotossintese.srt").write_text(
        "1\n00:00:01,000 --> 00:00:03,000\n<i>Olá, turma!</i>\n\n2\n00:00:03,500 --> 00:00:06,000\n"
        "Hoje vamos estudar a fotossíntese.\n", encoding="utf-8")
    res = import_file(video)
    assert res.video_path and res.blocks[0]["type"] == "video" and res.blocks[0]["mode"] == "embed"
    assert "fotossíntese" in res.as_text()
    attach_imported_video(res, MediaStore(Crypto(secrets.token_bytes(32)), 1))
    assert res.blocks[0]["media"]


def test_subtitles_to_text():
    vtt = "WEBVTT\n\n00:00.000 --> 00:02.000\nPrimeira fala.\n\n00:02.000 --> 00:04.000\nPrimeira fala.\nSegunda <c.yellow>fala</c>.\n"
    assert subtitles_to_text(vtt) == "Primeira fala. Segunda fala."


def test_project_delete_cleans_orphan_videos(tmp_path, monkeypatch, svc):
    monkeypatch.setattr("aulaviva.core.media.data_dir", lambda: tmp_path)
    auth, db = svc
    user, _ = auth.register("v@escola.com", "Giz&Lousa-2026x", profile(), True)
    store = MediaStore(db.crypto, user.id)
    fields = store.put(_fake_mp4(tmp_path / "a.mp4"))
    ps = ProjectStore(db)
    doc = new_document("A")
    b = new_block("video")
    b.update(fields, mode="embed")
    doc["blocks"] = [b]
    p1 = ps.create(user.id, doc)
    p2 = ps.duplicate(user.id, p1)
    ps.delete(user.id, p1)
    assert store.exists(fields["media"])  # a cópia ainda usa o vídeo
    ps.delete(user.id, p2)
    assert not store.exists(fields["media"])
