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


def test_pasted_key_cleanup():
    assert ai._validate_key("groq", "  Bearer gsk_abc12345678 \n") == "gsk_abc12345678"
    assert ai._validate_key("groq", 'GROQ_API_KEY="gsk_abc12345678"') == "gsk_abc12345678"
    assert ai._validate_key("openrouter", "sk-or-v1-abcdef123456") == "sk-or-v1-abcdef123456"


def test_openrouter_lists_only_free_models_and_best_choice(monkeypatch):
    data = {"data": [
        {"id": "openai/gpt-4o", "pricing": {"prompt": "0.000005", "completion": "0.00001"}},
        {"id": "meta-llama/llama-3.3-70b-instruct:free", "pricing": {"prompt": "0", "completion": "0"}},
        {"id": "qwen/qwen3-coder:free", "pricing": {"prompt": "0", "completion": "0"}},
        {"id": "openai/whisper-1:free", "pricing": {"prompt": "0", "completion": "0"}},
    ]}
    seen = {}

    def fake(url, payload, headers, timeout, direct=False, retries=2):
        seen["url"], seen["h"] = url, headers
        return data

    monkeypatch.setattr(ai, "_request", fake)
    names = ai.list_models("openrouter", "sk-or-v1-x")
    assert "openai/gpt-4o" not in names and "openai/whisper-1:free" not in names
    assert names[0] == "openrouter/free" and "meta-llama/llama-3.3-70b-instruct:free" in names
    assert seen["url"].endswith("/models") and seen["h"]["Authorization"] == "Bearer sk-or-v1-x"
    assert ai.best_model("groq", ["llama-3.1-8b-instant", "llama-3.3-70b-versatile"]) == "llama-3.3-70b-versatile"
    assert ai.best_model("cerebras", ["qwen-3-32b", "llama3.1-8b"]) == "qwen-3-32b"


def test_compat_backend_switches_model_when_retired(monkeypatch):
    calls = []

    def fake_http(url, payload, headers, timeout, direct=False):
        calls.append(payload["model"])
        if payload["model"] == "velho-modelo":
            raise _http_error(400, {"error": {"message": "The model `velho-modelo` has been decommissioned"}})
        return {"choices": [{"message": {"content": '<think>pensando {x}</think>{"ok": true, "mensagem": "oi"}'},
                             "finish_reason": "stop"}]}

    monkeypatch.setattr(ai, "_http_json", fake_http)
    monkeypatch.setattr(ai, "list_models", lambda p, k, b="": ["llama-3.3-70b-versatile", "velho-modelo"])
    a = ai.Assistant("groq", "gsk_123456789", "velho-modelo")
    assert "Conexão funcionando" in a.test_connection()
    assert calls[-1] == "llama-3.3-70b-versatile" and a.backend.switched_to == "llama-3.3-70b-versatile"


def test_compat_backend_reasoning_params_and_auth_error(monkeypatch):
    seen = {}

    def fake_http(url, payload, headers, timeout, direct=False):
        seen.update(payload)
        raise _http_error(401, {"error": {"message": "Invalid API Key"}})

    monkeypatch.setattr(ai, "_http_json", fake_http)
    a = ai.Assistant("openai", "sk-123456789", "gpt-5-mini")
    with pytest.raises(ai.AIError, match="inválida"):
        a.test_connection()
    assert "max_completion_tokens" in seen and "temperature" not in seen


def test_request_sends_user_agent_and_retries(monkeypatch):
    import urllib.request
    attempts = []

    class Resp:
        def __enter__(self):
            return self

        def __exit__(self, *a):
            return False

        def read(self, n=-1):
            return b'{"ok": 1}'

    class Opener:
        def open(self, req, timeout=0):
            attempts.append(req.get_header("User-agent"))
            if len(attempts) == 1:
                raise _http_error(503, {"error": {"message": "overloaded"}})
            return Resp()

    monkeypatch.setattr(ai, "_opener", lambda direct=False: Opener())
    monkeypatch.setattr("time.sleep", lambda s: None)
    assert ai._request("https://api.groq.com/openai/v1/models", None, {}, 5) == {"ok": 1}
    assert len(attempts) == 2 and attempts[0].startswith("AulaVivaStudio/")


def test_auto_provider_uses_first_saved_free_key(monkeypatch):
    c = Crypto(secrets.token_bytes(32))
    monkeypatch.setattr(ai, "load_api_key", lambda crypto, provider="claude": "gsk_x" if provider == "groq" else None)
    assert ai.effective_provider(Preferences(), c) == "groq"
