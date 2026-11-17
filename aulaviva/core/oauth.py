"""Login com provedores externos (Google/Gmail, Microsoft/Outlook, gov.br).

Implementa OAuth 2.0 + OpenID Connect para aplicativos nativos (RFC 8252):
- PKCE S256, `state` e `nonce` aleatórios;
- redirecionamento para 127.0.0.1 em porta aleatória (sem servidor externo);
- validação da assinatura do ID Token (JWKS do provedor), emissor,
  audiência, expiração e nonce;
- somente HTTPS com verificação de certificado.

Cada provedor precisa de um "client_id" registrado pela instituição/equipe
(arquivo oauth_providers.json na pasta de configuração ou variáveis de
ambiente AULAVIVA_<PROVEDOR>_CLIENT_ID / _CLIENT_SECRET).
"""

from __future__ import annotations

import base64
import hashlib
import json
import os
import secrets
import threading
import urllib.parse
import urllib.request
import webbrowser
from dataclasses import dataclass
from http.server import BaseHTTPRequestHandler, HTTPServer

import jwt

from aulaviva.core.config import config_dir


@dataclass(frozen=True)
class Provider:
    key: str
    label: str
    authorize_url: str
    token_url: str
    jwks_url: str
    issuers: tuple[str, ...]
    scopes: str
    extra_params: tuple[tuple[str, str], ...] = ()


PROVIDERS: dict[str, Provider] = {
    "google": Provider(
        "google", "Google / Gmail",
        "https://accounts.google.com/o/oauth2/v2/auth", "https://oauth2.googleapis.com/token",
        "https://www.googleapis.com/oauth2/v3/certs", ("https://accounts.google.com", "accounts.google.com"),
        "openid email profile", (("prompt", "select_account"),),
    ),
    "microsoft": Provider(
        "microsoft", "Microsoft / Outlook",
        "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
        "https://login.microsoftonline.com/common/oauth2/v2.0/token",
        "https://login.microsoftonline.com/common/discovery/v2.0/keys", (),  # emissor por tenant: validado abaixo
        "openid email profile", (("prompt", "select_account"),),
    ),
    "govbr": Provider(
        "govbr", "gov.br",
        "https://sso.acesso.gov.br/authorize", "https://sso.acesso.gov.br/token",
        "https://sso.acesso.gov.br/jwk", ("https://sso.acesso.gov.br/",),
        "openid email profile govbr_confiabilidades",
    ),
}


class OAuthError(Exception):
    pass


@dataclass
class OAuthResult:
    provider: str
    subject: str
    email: str
    email_verified: bool
    name: str
    cpf: str | None = None


def _credentials(provider: str) -> tuple[str | None, str | None]:
    env = provider.upper()
    cid, secret = os.environ.get(f"AULAVIVA_{env}_CLIENT_ID"), os.environ.get(f"AULAVIVA_{env}_CLIENT_SECRET")
    if not cid:
        try:
            cfg = json.loads((config_dir() / "oauth_providers.json").read_text(encoding="utf-8"))
            entry = cfg.get(provider, {})
            cid, secret = entry.get("client_id"), entry.get("client_secret")
        except (OSError, ValueError):
            pass
    return cid, secret


def is_configured(provider: str) -> bool:
    return bool(_credentials(provider)[0])


def _b64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()


class _CallbackHandler(BaseHTTPRequestHandler):
    result: dict = {}
    expected_path = "/callback"

    def do_GET(self):  # noqa: N802
        parsed = urllib.parse.urlsplit(self.path)
        if parsed.path != self.expected_path:
            self.send_response(404)
            self.end_headers()
            return
        params = dict(urllib.parse.parse_qsl(parsed.query))
        type(self).result.update(params)
        body = (
            "<!doctype html><meta charset='utf-8'><title>AulaViva Studio</title>"
            "<body style='font-family:sans-serif;background:#111827;color:#fff;display:grid;place-items:center;height:100vh'>"
            "<div style='text-align:center'><h2>Pronto!</h2><p>Você já pode fechar esta aba e voltar ao AulaViva Studio.</p></div>"
        ).encode()
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Security-Policy", "default-src 'none'; style-src 'unsafe-inline'")
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, *args):  # silencioso: não registrar códigos em logs
        pass


def _post_form(url: str, data: dict) -> dict:
    req = urllib.request.Request(url, data=urllib.parse.urlencode(data).encode(), method="POST",
                                 headers={"Content-Type": "application/x-www-form-urlencoded", "Accept": "application/json"})
    if not url.startswith("https://"):
        raise OAuthError("Conexão insegura recusada.")
    with urllib.request.urlopen(req, timeout=20) as resp:  # noqa: S310 - URL fixa HTTPS
        return json.loads(resp.read(1_000_000))


def sign_in(provider_key: str, timeout: int = 180, cancel_event: threading.Event | None = None) -> OAuthResult:
    """Executa o fluxo completo (bloqueante; rode em thread separada)."""
    provider = PROVIDERS.get(provider_key)
    if not provider:
        raise OAuthError("Provedor desconhecido.")
    client_id, client_secret = _credentials(provider_key)
    if not client_id:
        raise OAuthError(
            f"O login com {provider.label} ainda não foi configurado neste computador. "
            "Peça ao responsável técnico para registrar o aplicativo e informar o client_id "
            "(veja docs/OAUTH.md). Enquanto isso, use e-mail e senha."
        )

    verifier = _b64url(secrets.token_bytes(48))
    challenge = _b64url(hashlib.sha256(verifier.encode()).digest())
    state, nonce = secrets.token_urlsafe(32), secrets.token_urlsafe(32)

    handler = type("Handler", (_CallbackHandler,), {"result": {}})
    server = HTTPServer(("127.0.0.1", 0), handler)
    server.timeout = 1
    redirect_uri = f"http://127.0.0.1:{server.server_port}/callback"
    params = {
        "client_id": client_id, "response_type": "code", "redirect_uri": redirect_uri, "scope": provider.scopes,
        "state": state, "nonce": nonce, "code_challenge": challenge, "code_challenge_method": "S256",
        **dict(provider.extra_params),
    }
    webbrowser.open(provider.authorize_url + "?" + urllib.parse.urlencode(params))
    try:
        waited = 0
        while not handler.result and waited < timeout:
            if cancel_event and cancel_event.is_set():
                raise OAuthError("Login cancelado.")
            server.handle_request()
            waited += 1
    finally:
        server.server_close()

    res = handler.result
    if not res:
        raise OAuthError("Tempo esgotado aguardando o login no navegador.")
    if not secrets.compare_digest(res.get("state", ""), state):
        raise OAuthError("Resposta de login inválida (state). Tente novamente.")
    if "error" in res:
        raise OAuthError("O login foi recusado ou cancelado no navegador.")
    code = res.get("code")
    if not code:
        raise OAuthError("Resposta de login incompleta.")

    form = {"grant_type": "authorization_code", "code": code, "redirect_uri": redirect_uri,
            "client_id": client_id, "code_verifier": verifier}
    if client_secret:
        form["client_secret"] = client_secret
    try:
        tokens = _post_form(provider.token_url, form)
    except Exception as exc:
        raise OAuthError("Falha ao concluir o login com o provedor.") from exc
    id_token = tokens.get("id_token")
    if not id_token:
        raise OAuthError("O provedor não retornou identidade (id_token).")

    claims = _validate_id_token(provider, id_token, client_id, nonce)
    email = claims.get("email") or claims.get("preferred_username") or ""
    verified = bool(claims.get("email_verified", provider_key in ("microsoft", "govbr") and bool(email)))
    cpf = claims.get("sub") if provider_key == "govbr" else None  # no gov.br o "sub" é o CPF
    return OAuthResult(provider_key, str(claims["sub"]), email, verified, claims.get("name", ""), cpf)


def _validate_id_token(provider: Provider, token: str, client_id: str, nonce: str) -> dict:
    try:
        signing_key = jwt.PyJWKClient(provider.jwks_url, cache_keys=True, timeout=15).get_signing_key_from_jwt(token)
        claims = jwt.decode(
            token, signing_key.key, algorithms=["RS256", "ES256"], audience=client_id,
            options={"require": ["exp", "iat", "sub", "aud", "iss"], "verify_iss": False}, leeway=60,
        )
    except jwt.PyJWTError as exc:
        raise OAuthError("Identidade retornada pelo provedor não pôde ser verificada.") from exc
    iss = claims.get("iss", "")
    if provider.key == "microsoft":
        tid = claims.get("tid", "")
        if iss != f"https://login.microsoftonline.com/{tid}/v2.0":
            raise OAuthError("Emissor do token inválido.")
    elif iss not in provider.issuers:
        raise OAuthError("Emissor do token inválido.")
    if not secrets.compare_digest(str(claims.get("nonce", "")), nonce):
        raise OAuthError("Token de identidade reutilizado ou inválido (nonce).")
    return claims
