import secrets
import pytest
from aulaviva.core import security as s


def test_password_hash_roundtrip():
    h = s.hash_password("Correta#Senha9")
    assert h.startswith("$argon2id$")
    assert s.verify_password(h, "Correta#Senha9")
    assert not s.verify_password(h, "errada")
    assert not s.verify_password(None, "qualquer")


def test_password_policy():
    assert s.password_problems("curta")
    assert s.password_problems("Maria.Silva2024!", ["Maria Silva"])  # contém nome
    assert not s.password_problems("Giz&Lousa-2026x")


def test_cpf():
    assert s.is_valid_cpf("529.982.247-25")
    assert not s.is_valid_cpf("111.111.111-11")
    assert not s.is_valid_cpf("529.982.247-24")


def test_phone_email_name():
    assert s.is_valid_phone_br("(11) 98765-4321")
    assert not s.is_valid_phone_br("(11) 8765-432")
    assert s.is_valid_email("prof@escola.sp.gov.br")
    assert not s.is_valid_email("prof@@x")
    assert s.is_valid_full_name("Ana Clara D'Ávila")
    assert not s.is_valid_full_name("Ana")
    assert not s.is_valid_full_name("Ana <script>")


@pytest.mark.parametrize("bad", ["javascript:alert(1)", "file:///etc/passwd", "data:text/html,x", "https://user:pw@x.com",
                                 "https://exa mple.com", "https://", "ftp://x.com", "https://x.com/‮"])
def test_url_rejects(bad):
    with pytest.raises(s.SecurityError):
        s.validate_url(bad)


def test_url_accepts():
    assert s.validate_url("www.youtube.com/watch?v=1") == "https://www.youtube.com/watch?v=1"
    assert s.validate_url("mailto:prof@escola.com")


def test_crypto_aead_and_context():
    c = s.Crypto(secrets.token_bytes(32))
    tok = c.encrypt("dado sensível", "ctx.a")
    assert "sensível" not in tok
    assert c.decrypt(tok, "ctx.a") == "dado sensível"
    with pytest.raises(s.SecurityError):
        c.decrypt(tok, "ctx.b")  # contexto diferente
    tampered = tok[:-4] + ("AAAA" if not tok.endswith("AAAA") else "BBBB")
    with pytest.raises(s.SecurityError):
        c.decrypt(tampered, "ctx.a")
    assert c.blind_index("A@B.com ", "email") == c.blind_index("a@b.com", "email")


def test_clean_text_removes_bidi_and_control():
    assert s.clean_text("ab‮cd\x00e") == "abcde"
    assert s.safe_filename("../../CON") != "CON"
