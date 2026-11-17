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


def _http_error(code, payload):
    import io
    import json
    import urllib.error
    return urllib.error.HTTPError("u", code, "x", {}, io.BytesIO(json.dumps(payload).encode()))


def test_gemini_model_choice_and_errors(monkeypatch):
    assert ai.gemini_best_model(["gemini-2.0-flash", "gemini-3-flash", "gemini-3-pro", "gemini-3-flash-preview"]) == "gemini-3-flash"
    assert ai.gemini_best_model(["gemini-2.5-pro"]) == "gemini-2.5-pro"
    assert ai.gemini_best_model([]) is None
    disabled = {"error": {"code": 403, "message": "Generative Language API has not been used in project 1 before or it is disabled.",
                          "details": [{"reason": "SERVICE_DISABLED", "metadata": {"activationUrl": "https://console.developers.google.com/x"}}]}}
    assert "não está ativada" in str(ai._gemini_error(_http_error(403, disabled), "m"))
    quota0 = {"error": {"code": 429, "message": "Quota exceeded ... limit: 0"}}
    assert "não inclui" in str(ai._gemini_error(_http_error(429, quota0), "gemini-2.5-pro"))


def test_gemini_rediscovers_retired_model_and_ignores_thoughts(monkeypatch):
    b = ai._GeminiBackend("AIza" + "x" * 35, "gemini-velho")
    calls = []

    def fake_call(payload):
        calls.append(b.model)
        if b.model == "gemini-velho":
            raise _http_error(404, {"error": {"code": 404, "message": "not found"}})
        return {"candidates": [{"finishReason": "STOP", "content": {"parts": [
            {"text": "pensando...", "thought": True}, {"text": '{"text": "ok"}'}]}}]}

    monkeypatch.setattr(b, "_call", fake_call)
    monkeypatch.setattr(ai, "gemini_list_models", lambda key: ["gemini-3-flash", "gemini-3-pro"])

    from pydantic import BaseModel

    class T(BaseModel):
        text: str

    assert b.parse("x", T, 100).text == "ok"
    assert calls == ["gemini-velho", "gemini-3-flash"] and b.switched_to == "gemini-3-flash"


def test_key_paste_tolerance(tmp_path, monkeypatch):
    monkeypatch.setattr(ai, "config_dir", lambda: tmp_path)
    monkeypatch.setenv("AULAVIVA_NO_KEYRING", "1")
    c = Crypto(secrets.token_bytes(32))
    ai.save_api_key('  "AIza' + "y" * 35 + '"\n', c, "gemini")
    assert ai.load_api_key(c, "gemini") == "AIza" + "y" * 35
