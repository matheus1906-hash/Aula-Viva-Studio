import secrets
from pathlib import Path
import pytest
from aulaviva.core.auth import AuthError, AuthService, Profile
from aulaviva.core.database import Database
from aulaviva.core.projects import ProjectStore, new_document, template_documents
from aulaviva.core.security import Crypto


@pytest.fixture
def svc(tmp_path: Path):
    db = Database(tmp_path / "t.db", Crypto(secrets.token_bytes(32)))
    yield AuthService(db), db
    db.close()


def profile(cpf="52998224725"):
    return Profile(full_name="Ana Souza", cpf=cpf, birth_date="1985-04-10", phone="11987654321",
                   institution="EE Machado de Assis", school_network="Pública estadual", role="Professor(a)",
                   education_levels=["Ensino Médio"], subjects="Biologia", city="Campinas", state="SP")


def test_register_login_and_encryption_at_rest(svc, tmp_path):
    auth, db = svc
    user, codes = auth.register("Ana@Escola.com", "Giz&Lousa-2026x", profile(), True)
    assert len(codes) == 8 and user.profile.full_name == "Ana Souza"
    raw = (tmp_path / "t.db").read_bytes()
    assert b"Ana Souza" not in raw and b"52998224725" not in raw and b"ana@escola.com" not in raw
    assert auth.login("ana@escola.com", "Giz&Lousa-2026x").id == user.id
    with pytest.raises(AuthError):
        auth.register("outra@escola.com", "Giz&Lousa-2026x", profile(), True)  # CPF duplicado


def test_lockout(svc):
    auth, _ = svc
    auth.register("b@escola.com", "Giz&Lousa-2026x", profile(), True)
    for _ in range(5):
        with pytest.raises(AuthError):
            auth.login("b@escola.com", "errada")
    with pytest.raises(AuthError, match="Muitas tentativas"):
        auth.login("b@escola.com", "Giz&Lousa-2026x")


def test_unknown_email_generic_message(svc):
    auth, _ = svc
    with pytest.raises(AuthError, match="E-mail ou senha incorretos"):
        auth.login("naoexiste@x.com", "qualquer")


def test_recovery_code_reset(svc):
    auth, _ = svc
    _, codes = auth.register("c@escola.com", "Giz&Lousa-2026x", profile(), True)
    auth.reset_with_recovery_code("c@escola.com", codes[0].lower(), "Nova#Senha-77y")
    assert auth.login("c@escola.com", "Nova#Senha-77y")
    with pytest.raises(AuthError):
        auth.reset_with_recovery_code("c@escola.com", codes[0], "Outra#Senha-88z")  # uso único


def test_projects_isolated_per_user(svc):
    auth, db = svc
    u1, _ = auth.register("d@escola.com", "Giz&Lousa-2026x", profile(), True)
    u2, _ = auth.register("e@escola.com", "Giz&Lousa-2026x", profile("39053344705"), True)
    store = ProjectStore(db)
    pid = store.create(u1.id, template_documents()["Apostila de conteúdo"])
    assert store.load(u1.id, pid)["meta"]["title"] == "Apostila de Conteúdo"
    with pytest.raises(Exception):
        store.load(u2.id, pid)
    assert store.list(u2.id) == []


def test_delete_account_cascades(svc):
    auth, db = svc
    u, _ = auth.register("f@escola.com", "Giz&Lousa-2026x", profile(), True)
    ProjectStore(db).create(u.id, new_document())
    auth.delete_account(u.id)
    assert db.query("SELECT COUNT(*) c FROM projects")[0]["c"] == 0
    assert db.query("SELECT COUNT(*) c FROM profiles")[0]["c"] == 0
