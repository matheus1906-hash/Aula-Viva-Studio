import threading
import urllib.parse
import urllib.request

import pytest

from aulaviva.core import oauth


def _fake_browser(state_override=None):
    def open_url(url):
        q = dict(urllib.parse.parse_qsl(urllib.parse.urlsplit(url).query))
        assert q["code_challenge_method"] == "S256" and q["redirect_uri"].endswith("/")
        cb = q["redirect_uri"] + "?" + urllib.parse.urlencode({"code": "abc", "state": state_override or q["state"]})

        def hit():
            urllib.request.build_opener(urllib.request.ProxyHandler({})).open(cb, timeout=5).read()

        threading.Thread(target=hit, daemon=True).start()
        open_url.nonce = q["nonce"]
        return True
    return open_url


def test_google_flow_end_to_end(monkeypatch):
    monkeypatch.setenv("AULAVIVA_GOOGLE_CLIENT_ID", "id.apps.googleusercontent.com")
    monkeypatch.setenv("AULAVIVA_GOOGLE_CLIENT_SECRET", "segredo")
    browser = _fake_browser()
    monkeypatch.setattr(oauth.webbrowser, "open", browser)
    sent = {}
    monkeypatch.setattr(oauth, "_post_form", lambda url, data: (sent.update(data), {"id_token": "tok"})[1])
    monkeypatch.setattr(oauth, "_validate_id_token", lambda prov, tok, cid, nonce: {
        "sub": "123", "email": "prof@gmail.com", "email_verified": True, "name": "Ana"})
    res = oauth.sign_in("google", timeout=10)
    assert res.email == "prof@gmail.com" and res.email_verified
    assert sent["code"] == "abc" and sent["client_secret"] == "segredo" and len(sent["code_verifier"]) >= 43


def test_state_mismatch_is_rejected(monkeypatch):
    monkeypatch.setenv("AULAVIVA_GOOGLE_CLIENT_ID", "id")
    monkeypatch.setattr(oauth.webbrowser, "open", _fake_browser(state_override="atacante"))
    with pytest.raises(oauth.OAuthError, match="state"):
        oauth.sign_in("google", timeout=10)
