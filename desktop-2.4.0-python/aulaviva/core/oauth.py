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
import re
import secrets
import threading
import urllib.error
import urllib.parse
import urllib.request
import webbrowser
from dataclasses import dataclass
from http.server import BaseHTTPRequestHandler, HTTPServer

import jwt

from aulaviva.core.config import config_dir, resource_path


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
    """Ordem: variáveis de ambiente > pasta de configuração do usuário > arquivo embutido no instalador.

    O arquivo embutido (aulaviva/assets/oauth_providers.json) é gerado no build a partir de segredos
    e NUNCA vai para o Git (.gitignore). Em apps de computador o Google não trata o client_secret como
    confidencial; a segurança do fluxo vem do PKCE, do state/nonce e da validação do ID Token.
    """
    env = provider.upper()
    cid, secret = os.environ.get(f"AULAVIVA_{env}_CLIENT_ID"), os.environ.get(f"AULAVIVA_{env}_CLIENT_SECRET")
    if cid:
        return cid, secret
    for path in (config_dir() / "oauth_providers.json", resource_path("aulaviva/assets/oauth_providers.json")):
        try:
            entry = json.loads(path.read_text(encoding="utf-8")).get(provider, {})
        except (OSError, ValueError, AttributeError):
            continue
        if isinstance(entry, dict) and entry.get("client_id"):
            return str(entry["client_id"]), (str(entry["client_secret"]) if entry.get("client_secret") else None)
    return None, None


_GOOGLE_ID_RE = re.compile(r"^\d{6,20}-[a-z0-9]{10,64}\.apps\.googleusercontent\.com$")
_SECRET_RE = re.compile(r"^[A-Za-z0-9_\-]{10,100}$")


def validate_credentials(provider: str, client_id: str, client_secret: str) -> tuple[str, str]:
    client_id, client_secret = client_id.strip(), client_secret.strip()
    if provider == "google" and not _GOOGLE_ID_RE.match(client_id):
        raise OAuthError("ID do cliente inválido. Ele termina com .apps.googleusercontent.com.")
    if client_secret and not _SECRET_RE.match(client_secret):
        raise OAuthError("Chave secreta do cliente inválida (copie a chave completa, que começa com GOCSPX-).")
    if provider == "google" and not client_secret:
        raise OAuthError("Informe também a chave secreta do cliente (começa com GOCSPX-).")
    return client_id, client_secret


def check_credentials(provider: str, client_id: str, client_secret: str) -> str:
    """Confere com o Google se o par ID/chave existe e combina (usa um código falso: 'invalid_grant' = OK)."""
    client_id, client_secret = validate_credentials(provider, client_id, client_secret)
    if provider != "google":
        return "Formato válido."
    data = {"grant_type": "authorization_code", "code": "4/teste-aulaviva", "redirect_uri": "http://127.0.0.1:53682/",
            "client_id": client_id, "client_secret": client_secret, "code_verifier": "a" * 50}
    try:
        _post_form(PROVIDERS["google"].token_url, data)
    except urllib.error.HTTPError as exc:
        body = exc.read(2000).decode("utf-8", "replace")
        if "invalid_grant" in body:
            return "Credenciais confirmadas pelo Google."
        if "invalid_client" in body or "unauthorized_client" in body:
            raise OAuthError("O Google não reconheceu esse ID/chave. Confira se copiou do mesmo cliente OAuth "
                             "(tipo 'App para computador').") from exc
        raise OAuthError(f"O Google respondeu de forma inesperada ({exc.code}).") from exc
    except (urllib.error.URLError, TimeoutError) as exc:
        raise OAuthError("Sem conexão com o Google para conferir as credenciais.") from exc
    return "Credenciais confirmadas pelo Google."


def save_credentials(provider: str, client_id: str, client_secret: str) -> None:
    """Salva as credenciais na pasta de configuração do usuário (não vão para o Git nem para o instalador)."""
    client_id, client_secret = validate_credentials(provider, client_id, client_secret)
    path = config_dir() / "oauth_providers.json"
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        if not isinstance(data, dict):
            data = {}
    except (OSError, ValueError):
        data = {}
    data[provider] = {"client_id": client_id, "client_secret": client_secret}
    tmp = path.with_suffix(".tmp")
    tmp.write_text(json.dumps(data, indent=2), encoding="utf-8")
    if os.name != "nt":
        os.chmod(tmp, 0o600)
    os.replace(tmp, path)


def clear_credentials(provider: str) -> None:
    path = config_dir() / "oauth_providers.json"
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        data.pop(provider, None)
        path.write_text(json.dumps(data, indent=2), encoding="utf-8")
    except (OSError, ValueError, AttributeError):
        pass


def is_configured(provider: str) -> bool:
    return bool(_credentials(provider)[0])


def _b64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()


class _CallbackHandler(BaseHTTPRequestHandler):
    result: dict = {}
    expected_path = "/"

    def do_GET(self):  # noqa: N802
        parsed = urllib.parse.urlsplit(self.path)
        params = dict(urllib.parse.parse_qsl(parsed.query))
        if parsed.path != self.expected_path or not ({"code", "error"} & params.keys()):
            self.send_response(404)  # ex.: /favicon.ico
            self.end_headers()
            return
        type(self).result.update(params)
        ok = "code" in params
        title = "Pronto! Login concluído." if ok else "Login não concluído"
        msg = ("Você já pode fechar esta aba e voltar ao AulaViva Studio." if ok else
               "O login foi cancelado ou recusado. Volte ao AulaViva Studio para tentar novamente.")
        body = (
            "<!doctype html><meta charset='utf-8'><title>AulaViva Studio</title>"
            "<body style='font-family:Segoe UI,sans-serif;background:#F4F6FB;color:#111827;display:grid;place-items:center;height:100vh;margin:0'>"
            "<div style='text-align:center;background:#fff;padding:40px 56px;border-radius:18px;box-shadow:0 10px 30px rgba(0,0,0,.08)'>"
            f"<h2 style='color:{'#15803D' if ok else '#DC2626'}'>{title}</h2><p>{msg}</p></div>"
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
    redirect_uri = f"http://127.0.0.1:{server.server_port}/"  # loopback aceito por apps "Computador" no Google
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
