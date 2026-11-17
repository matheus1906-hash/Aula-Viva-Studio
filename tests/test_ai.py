import secrets

import pytest

from aulaviva.core import ai
from aulaviva.core.config import Preferences
from aulaviva.core.pdf_builder import build_pdf
from aulaviva.core.security import Crypto, SecurityError


def test_demo_assistant_generates_valid_documents():
    a = ai.Assistant("demo")
    doc = a.generate_apostila("Frações", "Matemática", "6º ano", 3, 4)
    assert doc["blocks"][0]["type"] == "callout" and "demonstração" in doc["blocks"][0]["text"]
    assert build_pdf(doc).startswith(b"%PDF")
    assert len(a.generate_exercises("frações", "6º ano", 5, "Misturados")) == 5
    assert "demonstração" in a.improve_text("Texto", "simplificar")


def test_key_validation_and_storage(tmp_path, monkeypatch):
    monkeypatch.setattr(ai, "config_dir", lambda: tmp_path)
    monkeypatch.setenv("AULAVIVA_NO_KEYRING", "1")  # nunca tocar no cofre real do usuário
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    c = Crypto(secrets.token_bytes(32))
    with pytest.raises(SecurityError):
        ai.save_api_key("abc", c, "claude")
    with pytest.raises(SecurityError):
        ai.save_api_key("chave com espaço", c, "gemini")
    ai.save_api_key("AIza" + "x" * 35, c, "gemini")
    assert ai.load_api_key(c, "gemini") == "AIza" + "x" * 35
    assert "AIza" not in (tmp_path / "ai-gemini.key").read_text()  # criptografada
    ai.delete_api_key("gemini")
    assert not (tmp_path / "ai-gemini.key").exists()


def test_provider_selection_and_errors(monkeypatch):
    c = Crypto(secrets.token_bytes(32))
    monkeypatch.setattr(ai, "load_api_key", lambda crypto, provider="claude": None)
    prefs = Preferences()
    assert ai.effective_provider(prefs, c) == "demo"
    prefs.ai_provider = "gemini"
    with pytest.raises(ai.AIError, match="Gemini"):
        ai.make_assistant(prefs, c)
    with pytest.raises(ai.AIError):
        ai._OllamaBackend("file:///etc/passwd", "x")


def test_extract_json_tolerates_fences():
    assert ai._extract_json('```json\n{"a": 1}\n```') == '{"a": 1}'
    assert ai._extract_json('Claro! {"a": 1} Espero ter ajudado') == '{"a": 1}'
