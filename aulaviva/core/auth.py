"""Serviço de contas: cadastro, login, bloqueio por tentativas, perfil, LGPD."""

from __future__ import annotations

import json
import time
from dataclasses import asdict, dataclass, field
from datetime import date

from aulaviva.core.database import Database
from aulaviva.core.security import (
    BR_STATES,
    clean_text,
    format_cpf,
    generate_recovery_codes,
    hash_password,
    is_valid_birth_date,
    is_valid_cpf,
    is_valid_email,
    is_valid_full_name,
    is_valid_phone_br,
    normalize_email,
    normalize_recovery_code,
    only_digits,
    password_needs_rehash,
    password_problems,
    verify_password,
)

MAX_FAILED_BEFORE_LOCK = 5
BASE_LOCK_SECONDS = 60
MAX_LOCK_SECONDS = 30 * 60
GENERIC_LOGIN_ERROR = "E-mail ou senha incorretos. Se você criou a conta com Google, Microsoft ou gov.br, use o botão correspondente."

SCHOOL_NETWORKS = ["Pública municipal", "Pública estadual", "Pública federal", "Privada", "Filantrópica/Comunitária"]
ROLES = ["Professor(a)", "Coordenador(a) pedagógico(a)", "Diretor(a)", "Professor(a) universitário(a)", "Tutor(a)/Monitor(a)", "Outro"]
EDUCATION_LEVELS = [
    "Educação Infantil", "Ensino Fundamental I", "Ensino Fundamental II", "Ensino Médio",
    "Ensino Técnico", "EJA", "Ensino Superior", "Cursos livres",
]


class AuthError(Exception):
    pass


@dataclass
class Profile:
    full_name: str = ""
    social_name: str = ""
    cpf: str = ""
    birth_date: str = ""  # ISO yyyy-mm-dd
    phone: str = ""
    institution: str = ""
    school_network: str = ""
    role: str = ""
    education_levels: list[str] = field(default_factory=list)
    subjects: str = ""
    city: str = ""
    state: str = ""
    registration: str = ""  # matrícula funcional (opcional)

    def validate(self) -> dict[str, str]:
        """Retorna {campo: mensagem} para cada campo inválido."""
        errors: dict[str, str] = {}
        if not is_valid_full_name(self.full_name):
            errors["full_name"] = "Informe nome e sobrenome (apenas letras)."
        if not is_valid_cpf(self.cpf):
            errors["cpf"] = "CPF inválido."
        try:
            if not is_valid_birth_date(date.fromisoformat(self.birth_date)):
                errors["birth_date"] = "É necessário ter entre 18 e 100 anos."
        except ValueError:
            errors["birth_date"] = "Data de nascimento inválida."
        if not is_valid_phone_br(self.phone):
            errors["phone"] = "Telefone inválido. Use DDD + número."
        if len(clean_text(self.institution, 160, False)) < 3:
            errors["institution"] = "Informe a instituição de ensino."
        if self.school_network not in SCHOOL_NETWORKS:
            errors["school_network"] = "Selecione a rede de ensino."
        if self.role not in ROLES:
            errors["role"] = "Selecione sua função."
        if not self.education_levels or any(lv not in EDUCATION_LEVELS for lv in self.education_levels):
            errors["education_levels"] = "Selecione ao menos um nível de ensino."
        if len(clean_text(self.subjects, 300, False)) < 2:
            errors["subjects"] = "Informe a(s) disciplina(s) que leciona."
        if len(clean_text(self.city, 100, False)) < 2:
            errors["city"] = "Informe a cidade."
        if self.state not in BR_STATES:
            errors["state"] = "Selecione a UF."
        return errors

    def cleaned(self) -> "Profile":
        return Profile(
            full_name=clean_text(self.full_name, 120, False),
            social_name=clean_text(self.social_name, 120, False),
            cpf=only_digits(self.cpf),
            birth_date=self.birth_date,
            phone=only_digits(self.phone),
            institution=clean_text(self.institution, 160, False),
            school_network=self.school_network,
            role=self.role,
            education_levels=list(self.education_levels),
            subjects=clean_text(self.subjects, 300, False),
            city=clean_text(self.city, 100, False),
            state=self.state,
            registration=clean_text(self.registration, 40, False),
        )

    @property
    def display_name(self) -> str:
        return self.social_name or self.full_name


@dataclass
class User:
    id: int
    email: str
    auth_provider: str
    profile_complete: bool
    profile: Profile | None = None

    @property
    def first_name(self) -> str:
        if self.profile and self.profile.display_name:
            return self.profile.display_name.split(" ")[0]
        return self.email.split("@")[0]


class AuthService:
    def __init__(self, db: Database):
        self.db = db
        self.c = db.crypto

    # -- helpers -----------------------------------------------------------
    def _email_idx(self, email: str) -> str:
        return self.c.blind_index(normalize_email(email), "email")

    def _load_user(self, user_id: int) -> User:
        row = self.db.query_one("SELECT * FROM users WHERE id=?", (user_id,))
        if not row:
            raise AuthError("Conta não encontrada.")
        user = User(
            id=row["id"],
            email=self.c.decrypt(row["email_enc"], "users.email") or "",
            auth_provider=row["auth_provider"],
            profile_complete=bool(row["profile_complete"]),
        )
        user.profile = self.get_profile(user_id)
        return user

    # -- cadastro ----------------------------------------------------------
    def register(self, email: str, password: str, profile: Profile, accepted_terms: bool) -> tuple[User, list[str]]:
        email = normalize_email(email)
        if not is_valid_email(email):
            raise AuthError("E-mail inválido.")
        if not accepted_terms:
            raise AuthError("É necessário aceitar os termos de uso e a política de privacidade.")
        problems = password_problems(password, [email, profile.full_name])
        if problems:
            raise AuthError(" ".join(problems))
        errors = profile.validate()
        if errors:
            raise AuthError(next(iter(errors.values())))
        profile = profile.cleaned()
        now = time.time()
        codes = generate_recovery_codes()
        try:
            with self.db.transaction() as cur:
                if cur.execute("SELECT 1 FROM users WHERE email_idx=?", (self._email_idx(email),)).fetchone():
                    raise AuthError("Já existe uma conta com este e-mail.")
                if cur.execute("SELECT 1 FROM profiles WHERE cpf_idx=?", (self.c.blind_index(profile.cpf, "cpf"),)).fetchone():
                    raise AuthError("Já existe uma conta com este CPF.")
                cur.execute(
                    "INSERT INTO users(email_idx,email_enc,password_hash,auth_provider,profile_complete,terms_accepted_at,created_at,updated_at)"
                    " VALUES (?,?,?,?,?,?,?,?)",
                    (self._email_idx(email), self.c.encrypt(email, "users.email"), hash_password(password), "local", 1, now, now, now),
                )
                uid = cur.lastrowid
                self._write_profile(cur, uid, profile)
                for code in codes:
                    cur.execute("INSERT INTO recovery_codes(user_id, code_hash) VALUES (?,?)", (uid, hash_password(normalize_recovery_code(code))))
        except AuthError:
            raise
        self.db.audit("account_created", uid, {"provider": "local"})
        return self._load_user(uid), codes

    def _write_profile(self, cur, uid: int, p: Profile) -> None:
        enc = self.c.encrypt
        cur.execute(
            """INSERT INTO profiles(user_id, full_name_enc, social_name_enc, cpf_idx, cpf_enc, birth_date_enc, phone_enc,
                   institution_enc, school_network, role, education_levels, subjects_enc, city_enc, state, registration_enc, updated_at)
               VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
               ON CONFLICT(user_id) DO UPDATE SET
                   full_name_enc=excluded.full_name_enc, social_name_enc=excluded.social_name_enc,
                   cpf_idx=excluded.cpf_idx, cpf_enc=excluded.cpf_enc, birth_date_enc=excluded.birth_date_enc,
                   phone_enc=excluded.phone_enc, institution_enc=excluded.institution_enc,
                   school_network=excluded.school_network, role=excluded.role,
                   education_levels=excluded.education_levels, subjects_enc=excluded.subjects_enc,
                   city_enc=excluded.city_enc, state=excluded.state, registration_enc=excluded.registration_enc,
                   updated_at=excluded.updated_at""",
            (
                uid, enc(p.full_name, "profiles.full_name"), enc(p.social_name or None, "profiles.social_name"),
                self.c.blind_index(p.cpf, "cpf"), enc(p.cpf, "profiles.cpf"), enc(p.birth_date, "profiles.birth_date"),
                enc(p.phone, "profiles.phone"), enc(p.institution, "profiles.institution"), p.school_network, p.role,
                json.dumps(p.education_levels, ensure_ascii=False), enc(p.subjects, "profiles.subjects"),
                enc(p.city, "profiles.city"), p.state, enc(p.registration or None, "profiles.registration"), time.time(),
            ),
        )

    def get_profile(self, uid: int) -> Profile | None:
        r = self.db.query_one("SELECT * FROM profiles WHERE user_id=?", (uid,))
        if not r:
            return None
        d = self.c.decrypt
        return Profile(
            full_name=d(r["full_name_enc"], "profiles.full_name") or "",
            social_name=d(r["social_name_enc"], "profiles.social_name") or "",
            cpf=d(r["cpf_enc"], "profiles.cpf") or "",
            birth_date=d(r["birth_date_enc"], "profiles.birth_date") or "",
            phone=d(r["phone_enc"], "profiles.phone") or "",
            institution=d(r["institution_enc"], "profiles.institution") or "",
            school_network=r["school_network"],
            role=r["role"],
            education_levels=json.loads(r["education_levels"] or "[]"),
            subjects=d(r["subjects_enc"], "profiles.subjects") or "",
            city=d(r["city_enc"], "profiles.city") or "",
            state=r["state"],
            registration=d(r["registration_enc"], "profiles.registration") or "",
        )

    def save_profile(self, uid: int, profile: Profile) -> User:
        errors = profile.validate()
        if errors:
            raise AuthError(next(iter(errors.values())))
        profile = profile.cleaned()
        with self.db.transaction() as cur:
            other = cur.execute("SELECT user_id FROM profiles WHERE cpf_idx=?", (self.c.blind_index(profile.cpf, "cpf"),)).fetchone()
            if other and other[0] != uid:
                raise AuthError("Este CPF já está vinculado a outra conta.")
            self._write_profile(cur, uid, profile)
            cur.execute("UPDATE users SET profile_complete=1, terms_accepted_at=COALESCE(terms_accepted_at, ?), updated_at=? WHERE id=?", (time.time(), time.time(), uid))
        self.db.audit("profile_updated", uid)
        return self._load_user(uid)

    # -- login -------------------------------------------------------------
    def login(self, email: str, password: str) -> User:
        email = normalize_email(email)
        row = self.db.query_one("SELECT * FROM users WHERE email_idx=?", (self._email_idx(email),)) if is_valid_email(email) else None
        now = time.time()
        if row and row["locked_until"] > now:
            wait = int(row["locked_until"] - now) + 1
            raise AuthError(f"Muitas tentativas. Tente novamente em {wait // 60}min {wait % 60:02d}s.")
        ok = verify_password(row["password_hash"] if row else None, password)
        if not row or not ok or not row["is_active"]:
            if row:
                attempts = row["failed_attempts"] + 1
                locked_until = 0.0
                if attempts >= MAX_FAILED_BEFORE_LOCK:
                    secs = min(BASE_LOCK_SECONDS * 2 ** (attempts - MAX_FAILED_BEFORE_LOCK), MAX_LOCK_SECONDS)
                    locked_until = now + secs
                with self.db.transaction() as cur:
                    cur.execute("UPDATE users SET failed_attempts=?, locked_until=? WHERE id=?", (attempts, locked_until, row["id"]))
                self.db.audit("login_failed", row["id"], {"attempts": attempts})
            raise AuthError(GENERIC_LOGIN_ERROR)
        with self.db.transaction() as cur:
            new_hash = hash_password(password) if password_needs_rehash(row["password_hash"]) else row["password_hash"]
            cur.execute("UPDATE users SET failed_attempts=0, locked_until=0, last_login_at=?, password_hash=? WHERE id=?", (now, new_hash, row["id"]))
        self.db.audit("login_success", row["id"], {"provider": "local"})
        return self._load_user(row["id"])

    def verify_current_password(self, uid: int, password: str) -> bool:
        row = self.db.query_one("SELECT password_hash FROM users WHERE id=?", (uid,))
        return bool(row) and verify_password(row["password_hash"], password)

    def login_oauth(self, provider: str, subject: str, email: str, email_verified: bool, cpf_hint: str | None = None) -> User:
        """Entra (ou cria conta) a partir de um provedor externo já validado."""
        sub_idx = self.c.blind_index(subject, f"oauth:{provider}")
        row = self.db.query_one("SELECT user_id FROM oauth_identities WHERE provider=? AND subject_idx=?", (provider, sub_idx))
        now = time.time()
        if row:
            uid = row["user_id"]
        else:
            email = normalize_email(email)
            if not email_verified or not is_valid_email(email):
                raise AuthError("O provedor não confirmou um e-mail válido para esta conta.")
            existing = self.db.query_one("SELECT id FROM users WHERE email_idx=?", (self._email_idx(email),))
            if existing:
                # Não vinculamos automaticamente para evitar sequestro de conta.
                raise AuthError("Já existe uma conta local com este e-mail. Entre com sua senha e vincule o provedor nas Configurações.")
            with self.db.transaction() as cur:
                cur.execute(
                    "INSERT INTO users(email_idx,email_enc,password_hash,auth_provider,profile_complete,created_at,updated_at) VALUES (?,?,?,?,?,?,?)",
                    (self._email_idx(email), self.c.encrypt(email, "users.email"), None, provider, 0, now, now),
                )
                uid = cur.lastrowid
                cur.execute("INSERT INTO oauth_identities(user_id,provider,subject_idx,created_at) VALUES (?,?,?,?)", (uid, provider, sub_idx, now))
            self.db.audit("account_created", uid, {"provider": provider})
        with self.db.transaction() as cur:
            cur.execute("UPDATE users SET last_login_at=? WHERE id=?", (now, uid))
        self.db.audit("login_success", uid, {"provider": provider})
        user = self._load_user(uid)
        if cpf_hint and not user.profile:
            user.profile = Profile(cpf=format_cpf(cpf_hint))
        return user

    def link_oauth(self, uid: int, provider: str, subject: str) -> None:
        sub_idx = self.c.blind_index(subject, f"oauth:{provider}")
        with self.db.transaction() as cur:
            other = cur.execute("SELECT user_id FROM oauth_identities WHERE provider=? AND subject_idx=?", (provider, sub_idx)).fetchone()
            if other and other[0] != uid:
                raise AuthError("Esta conta externa já está vinculada a outro usuário.")
            if not other:
                cur.execute("INSERT INTO oauth_identities(user_id,provider,subject_idx,created_at) VALUES (?,?,?,?)", (uid, provider, sub_idx, time.time()))
        self.db.audit("oauth_linked", uid, {"provider": provider})

    # -- senha -------------------------------------------------------------
    def change_password(self, uid: int, current: str | None, new: str) -> None:
        user = self._load_user(uid)
        row = self.db.query_one("SELECT password_hash FROM users WHERE id=?", (uid,))
        if row["password_hash"] and not verify_password(row["password_hash"], current or ""):
            raise AuthError("Senha atual incorreta.")
        problems = password_problems(new, [user.email, user.profile.full_name if user.profile else ""])
        if problems:
            raise AuthError(" ".join(problems))
        with self.db.transaction() as cur:
            cur.execute("UPDATE users SET password_hash=?, updated_at=? WHERE id=?", (hash_password(new), time.time(), uid))
        self.db.audit("password_changed", uid)

    def reset_with_recovery_code(self, email: str, code: str, new_password: str) -> None:
        row = self.db.query_one("SELECT id, locked_until, failed_attempts FROM users WHERE email_idx=?", (self._email_idx(email),))
        now = time.time()
        if row and row["locked_until"] > now:
            raise AuthError("Muitas tentativas. Aguarde alguns minutos.")
        norm = normalize_recovery_code(code)
        match_id = None
        if row:
            for rc in self.db.query("SELECT id, code_hash FROM recovery_codes WHERE user_id=? AND used_at IS NULL", (row["id"],)):
                if verify_password(rc["code_hash"], norm):
                    match_id = rc["id"]
                    break
        else:
            verify_password(None, norm)
        if not row or match_id is None:
            if row:
                attempts = row["failed_attempts"] + 1
                lock = now + BASE_LOCK_SECONDS * 5 if attempts >= MAX_FAILED_BEFORE_LOCK else 0
                with self.db.transaction() as cur:
                    cur.execute("UPDATE users SET failed_attempts=?, locked_until=? WHERE id=?", (attempts, lock, row["id"]))
            raise AuthError("E-mail ou código de recuperação inválido.")
        user = self._load_user(row["id"])
        problems = password_problems(new_password, [user.email, user.profile.full_name if user.profile else ""])
        if problems:
            raise AuthError(" ".join(problems))
        with self.db.transaction() as cur:
            cur.execute("UPDATE recovery_codes SET used_at=? WHERE id=?", (now, match_id))
            cur.execute("UPDATE users SET password_hash=?, failed_attempts=0, locked_until=0, updated_at=? WHERE id=?", (hash_password(new_password), now, row["id"]))
        self.db.audit("password_reset_recovery_code", row["id"])

    def regenerate_recovery_codes(self, uid: int) -> list[str]:
        codes = generate_recovery_codes()
        with self.db.transaction() as cur:
            cur.execute("DELETE FROM recovery_codes WHERE user_id=?", (uid,))
            for code in codes:
                cur.execute("INSERT INTO recovery_codes(user_id, code_hash) VALUES (?,?)", (uid, hash_password(normalize_recovery_code(code))))
        self.db.audit("recovery_codes_regenerated", uid)
        return codes

    # -- LGPD --------------------------------------------------------------
    def export_my_data(self, uid: int) -> dict:
        """Portabilidade (LGPD art. 18, V): exporta os dados do titular."""
        from aulaviva.core.projects import ProjectStore

        user = self._load_user(uid)
        projects = ProjectStore(self.db).list(uid)
        events = self.db.query("SELECT event, ts FROM audit_log WHERE user_id=? ORDER BY ts DESC LIMIT 500", (uid,))
        self.db.audit("data_exported", uid)
        return {
            "conta": {"email": user.email, "provedor": user.auth_provider},
            "perfil": asdict(user.profile) if user.profile else None,
            "projetos": [{"titulo": p.title, "atualizado_em": p.updated_at} for p in projects],
            "eventos_de_seguranca": [{"evento": e["event"], "quando": e["ts"]} for e in events],
        }

    def delete_account(self, uid: int) -> None:
        """Eliminação (LGPD art. 18, VI): apaga a conta e todos os projetos."""
        with self.db.transaction() as cur:
            cur.execute("DELETE FROM users WHERE id=?", (uid,))
            cur.execute("UPDATE audit_log SET user_id=NULL WHERE user_id=?", (uid,))
        self.db.audit("account_deleted", None)
        try:
            self.db.query("VACUUM")
        except Exception:
            pass

    def recent_security_events(self, uid: int, limit: int = 15) -> list[tuple[str, float]]:
        rows = self.db.query("SELECT event, ts FROM audit_log WHERE user_id=? ORDER BY ts DESC LIMIT ?", (uid, limit))
        return [(r["event"], r["ts"]) for r in rows]

