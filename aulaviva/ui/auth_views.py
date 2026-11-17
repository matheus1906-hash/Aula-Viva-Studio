"""Login, cadastro em etapas, conclusão de perfil (login social) e recuperação."""

from __future__ import annotations

from datetime import date

from PySide6.QtCore import QRegularExpression, Qt, QTimer, Signal
from PySide6.QtGui import QGuiApplication, QRegularExpressionValidator
from PySide6.QtWidgets import (
    QComboBox, QFileDialog, QGridLayout, QHBoxLayout, QLabel, QPlainTextEdit, QProgressBar,
    QVBoxLayout, QWidget,
)

from aulaviva import APP_NAME
from aulaviva.core import oauth
from aulaviva.core.auth import EDUCATION_LEVELS, ROLES, SCHOOL_NETWORKS, AuthError, AuthService, Profile, User
from aulaviva.core.config import Preferences
from aulaviva.core.security import (
    BR_STATES, format_cpf, format_phone_br, is_valid_cpf, is_valid_email, is_valid_phone_br, only_digits, parse_birth_date,
    password_problems,
)
from aulaviva.ui import theme
from aulaviva.ui.effects import logo_pixmap
from aulaviva.ui.widgets import (
    AnimatedStack, Button, ChipGroup, Field, GlassCard, LinkButton, Modal, PasswordInput, ProviderButton,
    SmoothScrollArea, Spinner, StrengthMeter, Toast, checkbox, fade_in, hline, label, line_edit,
)
from aulaviva.ui.workers import run_async

TERMS = f"""TERMOS DE USO E POLÍTICA DE PRIVACIDADE - {APP_NAME}

1. Finalidade. O {APP_NAME} é uma ferramenta para professores e profissionais da educação criarem materiais didáticos.

2. Dados coletados. Coletamos apenas os dados necessários para identificar o(a) docente e personalizar o material: nome, CPF, data de nascimento, telefone, e-mail, instituição, rede, função, níveis de ensino, disciplinas, cidade/UF e, opcionalmente, matrícula funcional (LGPD, art. 7º, V e IX).

3. Armazenamento e segurança. Os dados ficam armazenados localmente neste computador, criptografados com AES-256-GCM. Senhas nunca são armazenadas: guardamos apenas um resumo irreversível (Argon2id). A sessão é bloqueada automaticamente após inatividade.

4. Inteligência artificial. Quando você usa o assistente, apenas o tema e os textos do material são enviados ao provedor de IA configurado. Seus dados pessoais e de alunos NÃO são enviados. Não inclua dados pessoais de estudantes nos pedidos à IA.

5. Seus direitos (LGPD, art. 18). Você pode, a qualquer momento, em Configurações: consultar e corrigir seus dados, exportá-los (portabilidade) e excluir sua conta e todos os projetos (eliminação).

6. Responsabilidade pelo conteúdo. O(a) professor(a) é responsável por revisar o material gerado, inclusive o produzido pela IA, e por respeitar direitos autorais de imagens, textos e links incluídos.

7. Uso exclusivo para educação. A conta é pessoal e intransferível, destinada a profissionais da educação.
"""


def _busy(btn: Button, busy: bool, text: str):
    btn.setEnabled(not busy)
    btn.setText("Aguarde..." if busy else text)


class HeroPanel(QWidget):
    """Lado esquerdo do login: chamada + vitrine animada com amostras reais do programa."""

    def __init__(self):
        super().__init__()
        from aulaviva.ui.art import ArtIcon
        from aulaviva.ui.promo import PromoScene

        lay = QVBoxLayout(self)
        lay.setContentsMargins(10, 0, 30, 0)
        top = QHBoxLayout()
        logo = QLabel()
        logo.setPixmap(logo_pixmap(46))
        top.addWidget(logo)
        name = label(APP_NAME, "h2")
        top.addWidget(name)
        top.addStretch()
        lay.addLayout(top)
        lay.addSpacing(10)
        t = label("Materiais que seus alunos vão querer abrir.", "h1", wrap=True)
        t.setStyleSheet(f"font-family: '{theme.HEADING_FAMILY}'; font-size: 34px; font-weight: 800;")
        lay.addWidget(t)
        sub = label("Apostilas, listas e provas em PDF interativo, com QR codes, vídeos e respostas no próprio arquivo. "
                    "A IA faz o rascunho, você dá o toque final.", "dim", wrap=True)
        sub.setStyleSheet("font-size: 16px;")
        lay.addWidget(sub)
        self.scene = PromoScene("full")
        lay.addWidget(self.scene, 1)
        chips = QHBoxLayout()
        for icon, txt in (("qrcode", "QR codes e links"), ("open_question", "Respostas no PDF"), ("image", "Modelos prontos")):
            c = QHBoxLayout()
            c.setSpacing(6)
            c.addWidget(ArtIcon(icon, 26, "line"))
            c.addWidget(label(txt, "dim"))
            chips.addLayout(c)
            chips.addSpacing(10)
        chips.addStretch()
        lay.addLayout(chips)


GOOGLE_STEPS = (
    "1. No Google Cloud, abra 'Google Auth Platform' (ou 'Tela de permissão OAuth') e clique em 'Começar'. Preencha nome do app "
    "(AulaViva Studio), e-mail de suporte, público 'Externo' e e-mail de contato.\n"
    "2. Em 'Clientes', crie um 'ID do cliente OAuth' do tipo 'App para computador' e copie o ID e a chave secreta.\n"
    "3. Em 'Público': enquanto estiver em 'Teste', adicione em 'Usuários de teste' os e-mails que vão entrar; para liberar "
    "para todos, clique em 'Publicar app' (não precisa de verificação, pois usamos só nome e e-mail).\n"
    "Não é preciso ativar nenhuma API."
)


def open_google_setup(host: QWidget, on_saved=None) -> Modal:
    """Configura o login com Google colando o ID e a chave do cliente (salvos só neste computador)."""
    from PySide6.QtCore import QUrl
    from PySide6.QtGui import QDesktopServices

    m = Modal(host, 640)
    m.body.addWidget(label("Configurar login com Google", "h2"))
    m.body.addWidget(label(GOOGLE_STEPS, "dim", wrap=True))
    links = QHBoxLayout()
    for text, url in (("Abrir Google Auth Platform", "https://console.cloud.google.com/auth/overview"),
                      ("Abrir clientes OAuth", "https://console.cloud.google.com/auth/clients")):
        b = Button(text, "soft", icon_text="↗", height=36)
        b.clicked.connect(lambda _=False, u=url: QDesktopServices.openUrl(QUrl(u)))
        links.addWidget(b)
    links.addStretch()
    m.body.addLayout(links)
    cid = line_edit("000000000000-xxxx.apps.googleusercontent.com", 200)
    secret = PasswordInput("GOCSPX-...")
    f_id, f_sec = Field("ID do cliente", cid, True), Field("Chave secreta do cliente", secret, True)
    m.body.addWidget(f_id)
    m.body.addWidget(f_sec)
    m.body.addWidget(label("Ficam salvos apenas neste computador, na pasta de configuração do seu usuário. "
                           "Em apps de computador o Google não considera essa chave confidencial; a segurança do login vem do "
                           "PKCE e da verificação do token.", "muted", wrap=True))
    status = label("", "dim", wrap=True)
    m.body.addWidget(status)
    row = QHBoxLayout()
    row.addStretch()
    cancel = Button("Cancelar", "ghost")
    save = Button("Testar e salvar", "primary", icon_text="✓")
    cancel.clicked.connect(m.close_modal)
    row.addWidget(cancel)
    row.addWidget(save)
    m.body.addLayout(row)

    def go():
        try:
            oauth.validate_credentials("google", cid.text(), secret.text())
        except oauth.OAuthError as exc:
            f_id.set_error(str(exc) if "ID" in str(exc) else None)
            f_sec.set_error(None if "ID" in str(exc) else str(exc))
            return
        f_id.set_error(None)
        f_sec.set_error(None)
        save.setEnabled(False)
        status.setText("Conferindo com o Google...")
        a, b = cid.text(), secret.text()

        def ok(msg):
            oauth.save_credentials("google", a, b)
            m.close_modal()
            Toast.show_message(host, f"{msg} Login com Google ativado neste computador.", "success", 5000)
            if on_saved:
                on_saved()

        def fail(exc):
            save.setEnabled(True)
            status.setText("✗ " + (str(exc) if isinstance(exc, oauth.OAuthError) else "Não foi possível conferir."))

        run_async(lambda: oauth.check_credentials("google", a, b), ok, fail)

    save.clicked.connect(go)
    m.open()
    return m


def oauth_waiting_modal(host: QWidget, provider: str, cancel_event) -> Modal:
    m = Modal(host, 520, dismissable=False)
    m.body.addWidget(label("Continue no navegador", "h2"))
    m.body.addWidget(label(f"Abrimos a página de login do {oauth.PROVIDERS[provider].label}. Escolha sua conta e autorize; "
                           "depois volte para cá.", "dim", wrap=True))
    m.body.addWidget(Spinner(), 0, Qt.AlignmentFlag.AlignHCenter)
    if provider == "google":
        m.body.addWidget(label("Se aparecer \"Acesso bloqueado\" ou \"Erro 403: access_denied\": o app ainda está em modo de teste "
                               "no Google Cloud. Adicione seu e-mail em 'Usuários de teste' ou publique o app. Se aparecer "
                               "\"O Google não verificou este app\", clique em 'Avançado' e continue.", "muted", wrap=True))
    cb = Button("Cancelar", "secondary")
    cb.clicked.connect(lambda: (cancel_event.set(), m.close_modal()))
    m.body.addWidget(cb)
    m.open()
    return m


class LoginView(QWidget):
    logged_in = Signal(object)          # User
    wants_register = Signal()
    wants_recovery = Signal()

    def __init__(self, auth: AuthService, prefs: Preferences):
        super().__init__()
        self.auth, self.prefs = auth, prefs
        root = QHBoxLayout(self)
        root.setContentsMargins(60, 40, 60, 40)
        self.hero = HeroPanel()
        root.addWidget(self.hero, 5)
        card = GlassCard(radius=24, padding=34, opacity=0.08)
        card.setFixedWidth(430)
        c = card.lay
        c.setSpacing(14)
        c.addWidget(label("Entrar", "h2"))
        c.addWidget(label("Acesse sua conta de professor(a).", "dim"))
        self.notice = label("", "badge", wrap=True)
        self.notice.setVisible(False)
        c.addWidget(self.notice)
        self.email = line_edit("seu.email@escola.edu.br", 254)
        self.email.setInputMethodHints(Qt.InputMethodHint.ImhEmailCharactersOnly)
        self.f_email = Field("E-mail", self.email)
        c.addWidget(self.f_email)
        self.password = PasswordInput("Sua senha")
        self.f_pw = Field("Senha", self.password)
        c.addWidget(self.f_pw)
        row = QHBoxLayout()
        self.remember = checkbox("Lembrar meu e-mail", prefs.remember_email)
        row.addWidget(self.remember)
        row.addStretch()
        forgot = LinkButton("Esqueci minha senha")
        forgot.clicked.connect(self.wants_recovery)
        row.addWidget(forgot)
        c.addLayout(row)
        self.btn = Button("Entrar", "primary", height=46)
        self.btn.clicked.connect(self._login)
        c.addWidget(self.btn)
        sep = QHBoxLayout()
        sep.addWidget(hline(), 1)
        sep.addWidget(label("ou continue com", "muted"))
        sep.addWidget(hline(), 1)
        c.addLayout(sep)
        for key, text in (("google", "Continuar com o Google"), ("microsoft", "Continuar com a Microsoft"), ("govbr", "Entrar com gov.br")):
            b = ProviderButton(key, text)
            b.clicked.connect(lambda _=False, k=key: self._oauth(k))
            c.addWidget(b)
        bottom = QHBoxLayout()
        bottom.addStretch()
        bottom.addWidget(label("Novo por aqui?", "dim"))
        reg = LinkButton("Criar conta de professor(a)")
        reg.clicked.connect(self.wants_register)
        bottom.addWidget(reg)
        bottom.addStretch()
        c.addLayout(bottom)
        root.addWidget(card, 0, Qt.AlignmentFlag.AlignVCenter)
        self.password.returnPressed.connect(self._login)
        self.email.returnPressed.connect(self.password.setFocus)
        if prefs.remember_email and prefs.last_email_hint:
            self.email.setText(prefs.last_email_hint)

    def showEvent(self, e):
        super().showEvent(e)
        self.hero.setVisible(self.width() > 980)
        (self.password if self.email.text() else self.email).setFocus()

    def resizeEvent(self, e):
        self.hero.setVisible(self.width() > 980)
        super().resizeEvent(e)

    def show_notice(self, text: str):
        self.notice.setText(text)
        self.notice.setVisible(bool(text))

    def _login(self):
        email, pw = self.email.text().strip(), self.password.text()
        self.f_email.set_error(None if is_valid_email(email) else "Informe um e-mail válido.")
        self.f_pw.set_error(None if pw else "Informe sua senha.")
        if not is_valid_email(email) or not pw:
            return
        _busy(self.btn, True, "Entrar")

        def ok(user: User):
            _busy(self.btn, False, "Entrar")
            self.password.clear()
            self.prefs.remember_email = self.remember.isChecked()
            self.prefs.last_email_hint = email if self.remember.isChecked() else ""
            self.prefs.save()
            self.show_notice("")
            self.logged_in.emit(user)

        def fail(exc):
            _busy(self.btn, False, "Entrar")
            self.password.clear()
            self.f_pw.set_error(str(exc) if isinstance(exc, AuthError) else "Não foi possível entrar.")

        run_async(lambda: self.auth.login(email, pw), ok, fail)

    def _oauth(self, provider: str):
        if not oauth.is_configured(provider) and provider == "google":
            open_google_setup(self, lambda: self._oauth("google"))
            return
        if not oauth.is_configured(provider):
            m = Modal(self, 500)
            m.body.addWidget(label(f"Login com {oauth.PROVIDERS[provider].label}", "h2"))
            m.body.addWidget(label(
                "Este tipo de login precisa ser habilitado pelo responsável técnico (TI da escola ou rede), "
                "registrando o aplicativo no provedor e informando o identificador (client_id) no arquivo "
                "de configuração. Instruções em docs/OAUTH.md.\n\nEnquanto isso, você pode criar sua conta com e-mail e senha.",
                "dim", wrap=True))
            b = Button("Entendi", "primary")
            b.clicked.connect(m.close_modal)
            m.body.addWidget(b)
            m.open()
            return
        import threading

        cancel = threading.Event()
        m = oauth_waiting_modal(self, provider, cancel)

        def work():
            res = oauth.sign_in(provider, cancel_event=cancel)
            return self.auth.login_oauth(res.provider, res.subject, res.email, res.email_verified, res.cpf)

        def ok(user):
            if m.isVisible():
                m.close_modal()
            self.logged_in.emit(user)

        def fail(exc):
            if m.isVisible():
                m.close_modal()
            if not cancel.is_set():
                Toast.show_message(self, str(exc) if isinstance(exc, (AuthError, oauth.OAuthError)) else "Falha no login externo.", "error", 6000)

        run_async(work, ok, fail)


# ---------------------------------------------------------------------------
class ProfileForm(QWidget):
    """Campos de dados pessoais e profissionais (reutilizado nas Configurações)."""

    def __init__(self, sections: tuple[str, ...] = ("personal", "professional")):
        super().__init__()
        lay = QVBoxLayout(self)
        lay.setContentsMargins(0, 0, 0, 0)
        lay.setSpacing(12)
        self.personal = QWidget()
        g = QGridLayout(self.personal)
        g.setContentsMargins(0, 0, 0, 0)
        g.setHorizontalSpacing(14)
        g.setVerticalSpacing(10)
        self.full_name = line_edit("Nome completo conforme documento", 120)
        self.social_name = line_edit("Opcional", 120)
        # Campos livres: o professor digita do jeito que preferir; formatamos ao sair do campo
        self.cpf = line_edit("Somente números ou 000.000.000-00", 18)
        self.cpf.setValidator(QRegularExpressionValidator(QRegularExpression(r"[0-9.\-\s]{0,18}")))
        self.cpf.setInputMethodHints(Qt.InputMethodHint.ImhDigitsOnly)
        self.birth = line_edit("dd/mm/aaaa", 12)
        self.birth.setValidator(QRegularExpressionValidator(QRegularExpression(r"[0-9/.\-\s]{0,12}")))
        self.birth.setInputMethodHints(Qt.InputMethodHint.ImhDigitsOnly)
        self.phone = line_edit("(00) 00000-0000", 20)
        self.phone.setValidator(QRegularExpressionValidator(QRegularExpression(r"[0-9()+.\-\s]{0,20}")))
        self.phone.setInputMethodHints(Qt.InputMethodHint.ImhDialableCharactersOnly)
        self.fields = {
            "full_name": Field("Nome completo", self.full_name, True),
            "social_name": Field("Nome social", self.social_name, hint="Como prefere ser chamado(a)."),
            "cpf": Field("CPF", self.cpf, True),
            "birth_date": Field("Data de nascimento", self.birth, True),
            "phone": Field("Celular (com DDD)", self.phone, True),
        }
        self.cpf.editingFinished.connect(self._fmt_cpf)
        self.phone.editingFinished.connect(self._fmt_phone)
        self.birth.editingFinished.connect(self._fmt_birth)
        g.addWidget(self.fields["full_name"], 0, 0, 1, 2)
        g.addWidget(self.fields["social_name"], 1, 0, 1, 2)
        g.addWidget(self.fields["cpf"], 2, 0)
        g.addWidget(self.fields["birth_date"], 2, 1)
        g.addWidget(self.fields["phone"], 3, 0)

        self.professional = QWidget()
        g2 = QGridLayout(self.professional)
        g2.setContentsMargins(0, 0, 0, 0)
        g2.setHorizontalSpacing(14)
        g2.setVerticalSpacing(10)
        self.institution = line_edit("Ex.: E.E. Machado de Assis", 160)
        self.network = QComboBox()
        self.network.addItems(["Selecione..."] + SCHOOL_NETWORKS)
        self.role = QComboBox()
        self.role.addItems(["Selecione..."] + ROLES)
        self.levels = ChipGroup(EDUCATION_LEVELS, 4)
        self.subjects = line_edit("Ex.: Matemática, Física", 300)
        self.city = line_edit("Cidade", 100)
        self.state = QComboBox()
        self.state.addItems(["UF"] + BR_STATES)
        self.registration = line_edit("Opcional", 40)
        for cb in (self.network, self.role, self.state):
            cb.setMinimumHeight(40)
        self.fields.update({
            "institution": Field("Instituição de ensino", self.institution, True),
            "school_network": Field("Rede de ensino", self.network, True),
            "role": Field("Função", self.role, True),
            "education_levels": Field("Níveis de ensino em que atua", self.levels, True),
            "subjects": Field("Disciplina(s)", self.subjects, True),
            "city": Field("Cidade", self.city, True),
            "state": Field("UF", self.state, True),
            "registration": Field("Matrícula funcional", self.registration),
        })
        g2.addWidget(self.fields["institution"], 0, 0, 1, 2)
        g2.addWidget(self.fields["school_network"], 1, 0)
        g2.addWidget(self.fields["role"], 1, 1)
        g2.addWidget(self.fields["education_levels"], 2, 0, 1, 2)
        g2.addWidget(self.fields["subjects"], 3, 0, 1, 2)
        g2.addWidget(self.fields["city"], 4, 0)
        g2.addWidget(self.fields["state"], 4, 1)
        g2.addWidget(self.fields["registration"], 5, 0)
        if "personal" in sections:
            lay.addWidget(self.personal)
        if "professional" in sections:
            lay.addWidget(self.professional)

    # formatação ao sair do campo (sem mexer no cursor enquanto a pessoa digita)
    def _fmt_cpf(self):
        if len(only_digits(self.cpf.text())) == 11:
            self.cpf.setText(format_cpf(self.cpf.text()))
            self.fields["cpf"].set_error(None if is_valid_cpf(self.cpf.text()) else "CPF inválido. Confira os números.")

    def _fmt_phone(self):
        if self.phone.text().strip():
            self.phone.setText(format_phone_br(self.phone.text()))
            self.fields["phone"].set_error(None if is_valid_phone_br(self.phone.text()) else "Telefone inválido. Use DDD + número.")

    def _fmt_birth(self):
        if not self.birth.text().strip():
            return
        d = parse_birth_date(self.birth.text())
        if d:
            self.birth.setText(d.strftime("%d/%m/%Y"))
        self.fields["birth_date"].set_error(None if d else "Data inválida. Use dia/mês/ano, ex.: 10/04/1985.")

    def profile(self) -> Profile:
        d = parse_birth_date(self.birth.text())
        return Profile(
            full_name=self.full_name.text(), social_name=self.social_name.text(), cpf=self.cpf.text(),
            birth_date=d.isoformat() if d else "", phone=self.phone.text(),
            institution=self.institution.text(), school_network=self.network.currentText(), role=self.role.currentText(),
            education_levels=self.levels.selected(), subjects=self.subjects.text(), city=self.city.text(),
            state=self.state.currentText(), registration=self.registration.text(),
        )

    def set_profile(self, p: Profile | None):
        if not p:
            return
        self.full_name.setText(p.full_name)
        self.social_name.setText(p.social_name)
        self.cpf.setText(format_cpf(p.cpf) if p.cpf else "")
        if p.birth_date:
            try:
                self.birth.setText(date.fromisoformat(p.birth_date).strftime("%d/%m/%Y"))
            except ValueError:
                pass
        self.phone.setText(format_phone_br(p.phone) if p.phone else "")
        self.institution.setText(p.institution)
        for cb, val in ((self.network, p.school_network), (self.role, p.role), (self.state, p.state)):
            i = cb.findText(val)
            if i >= 0:
                cb.setCurrentIndex(i)
        self.levels.set_selected(p.education_levels)
        self.subjects.setText(p.subjects)
        self.city.setText(p.city)
        self.registration.setText(p.registration)

    def validate(self, keys: set[str] | None = None) -> bool:
        errors = self.profile().validate()
        ok = True
        for k, f in self.fields.items():
            if keys is not None and k not in keys:
                continue
            f.set_error(errors.get(k))
            ok = ok and k not in errors
        return ok


PERSONAL_KEYS = {"full_name", "social_name", "cpf", "birth_date", "phone"}
PRO_KEYS = {"institution", "school_network", "role", "education_levels", "subjects", "city", "state", "registration"}


class RegisterView(QWidget):
    """Cadastro em 4 etapas. Em modo 'complete', pula a etapa de acesso (login social)."""

    registered = Signal(object, list)   # User, códigos de recuperação
    completed = Signal(object)          # User (perfil concluído)
    cancelled = Signal()

    STEPS = ["Acesso", "Dados pessoais", "Dados profissionais", "Termos e privacidade"]

    def __init__(self, auth: AuthService, complete_user: User | None = None):
        super().__init__()
        self.auth, self.user = auth, complete_user
        self.steps = list(range(1, 4)) if complete_user else list(range(4))
        root = QVBoxLayout(self)
        root.setContentsMargins(40, 26, 40, 26)
        card = GlassCard(radius=24, padding=32, opacity=0.08)
        card.setMaximumWidth(780)
        card.setMaximumHeight(820)
        head = QHBoxLayout()
        logo = QLabel()
        logo.setPixmap(logo_pixmap(36))
        head.addWidget(logo)
        title = "Complete seu cadastro" if complete_user else "Criar conta de professor(a)"
        head.addWidget(label(title, "h2"))
        head.addStretch()
        back = Button("Sair" if complete_user else "Voltar ao login", "ghost", height=34)
        back.clicked.connect(self.cancelled)
        head.addWidget(back)
        card.lay.addLayout(head)
        self.step_label = label("", "dim")
        card.lay.addWidget(self.step_label)
        self.progress = QProgressBar()
        self.progress.setTextVisible(False)
        self.progress.setFixedHeight(6)
        self.progress.setRange(0, 1000)
        card.lay.addWidget(self.progress)
        from PySide6.QtCore import QPropertyAnimation

        self._panim = QPropertyAnimation(self.progress, b"value", self)
        self._panim.setDuration(350)
        self.stack = AnimatedStack()
        card.lay.addWidget(self.stack, 1)

        # Etapa 0 - acesso
        p0 = QWidget()
        l0 = QVBoxLayout(p0)
        l0.setContentsMargins(0, 8, 0, 0)
        self.email = line_edit("seu.email@escola.edu.br", 254)
        self.email2 = line_edit("Repita o e-mail", 254)
        self.pw = PasswordInput("Crie uma senha forte")
        self.pw2 = PasswordInput("Repita a senha")
        self.meter = StrengthMeter()
        self.f_email, self.f_email2 = Field("E-mail", self.email, True), Field("Confirmar e-mail", self.email2, True)
        self.f_pw, self.f_pw2 = Field("Senha", self.pw, True), Field("Confirmar senha", self.pw2, True)
        for w in (self.f_email, self.f_email2, self.f_pw, self.meter):
            l0.addWidget(w)
        self.rules = label("", "muted", wrap=True)
        l0.addWidget(self.rules)
        l0.addWidget(self.f_pw2)
        l0.addStretch()
        self.pw.textChanged.connect(self._pw_changed)
        self._pw_changed("")

        # Etapas 1 e 2 - perfil
        self.form = ProfileForm()
        p1, p2 = SmoothScrollArea(), SmoothScrollArea()
        p1.setWidget(self._wrap(self.form.personal, "Esses dados identificam você como docente e aparecem nos seus materiais."))
        p2.setWidget(self._wrap(self.form.professional, "Usamos esses dados para personalizar capas e sugestões da IA."))
        if complete_user and complete_user.profile:
            self.form.set_profile(complete_user.profile)

        # Etapa 3 - termos
        p3 = QWidget()
        l3 = QVBoxLayout(p3)
        l3.setContentsMargins(0, 8, 0, 0)
        terms = QPlainTextEdit(TERMS)
        terms.setReadOnly(True)
        terms.setMinimumHeight(220)
        l3.addWidget(terms, 1)
        self.accept = checkbox("Li e aceito os Termos de Uso e a Política de Privacidade *")
        self.lgpd = checkbox("Autorizo o tratamento dos meus dados pessoais para as finalidades descritas (LGPD) *")
        self.terms_err = label("", "error")
        for w in (self.accept, self.lgpd, self.terms_err):
            l3.addWidget(w)

        self.pages = [p0, p1, p2, p3]
        for pg in self.pages:
            self.stack.addWidget(pg)
        nav = QHBoxLayout()
        self.prev = Button("Voltar", "secondary")
        self.next = Button("Continuar  →", "primary")
        self.next.setMinimumWidth(170)
        self.prev.clicked.connect(lambda: self.go(self.step_pos - 1))
        self.next.clicked.connect(self._next)
        nav.addStretch()
        nav.addWidget(self.prev)
        nav.addWidget(self.next)
        card.lay.addLayout(nav)
        row = QHBoxLayout()
        row.addStretch()
        row.addWidget(card, 10)
        row.addStretch()
        root.addStretch()
        root.addLayout(row, 100)
        root.addStretch()
        self.step_pos = 0
        self.go(0, animate=False)

    @staticmethod
    def _wrap(w: QWidget, intro: str) -> QWidget:
        box = QWidget()
        lay = QVBoxLayout(box)
        lay.setContentsMargins(0, 8, 10, 8)
        lay.addWidget(label(intro, "muted", wrap=True))
        lay.addWidget(w)
        lay.addStretch()
        return box

    def _pw_changed(self, text: str):
        self.meter.set_password(text)
        problems = password_problems(text, [self.email.text()])
        self.rules.setText("Requisitos: " + " ".join(problems) if problems else "✓ Senha atende a todos os requisitos.")
        self.rules.setStyleSheet(f"color: {theme.SUCCESS if not problems else theme.TEXT_MUTED}; font-size: 12px;")

    def go(self, pos: int, animate: bool = True):
        pos = max(0, min(pos, len(self.steps) - 1))
        direction = 1 if pos >= self.step_pos else -1
        self.step_pos = pos
        step = self.steps[pos]
        page = self.pages[step]
        self.stack.slide_to(page, direction) if animate else self.stack.setCurrentWidget(page)
        self.step_label.setText(f"Etapa {pos + 1} de {len(self.steps)}: {self.STEPS[step]}")
        self._panim.stop()
        self._panim.setStartValue(self.progress.value())
        self._panim.setEndValue(int(1000 * (pos + 1) / len(self.steps)))
        self._panim.start()
        self.prev.setVisible(pos > 0)
        last = pos == len(self.steps) - 1
        self.next.setText(("Concluir cadastro  ✓" if self.user else "Criar minha conta  ✓") if last else "Continuar  →")

    def _validate_step(self, step: int) -> bool:
        if step == 0:
            email, email2 = self.email.text().strip().lower(), self.email2.text().strip().lower()
            ok = True
            self.f_email.set_error(None if is_valid_email(email) else "E-mail inválido.")
            ok &= is_valid_email(email)
            self.f_email2.set_error(None if email == email2 else "Os e-mails não coincidem.")
            ok &= email == email2
            problems = password_problems(self.pw.text(), [email, self.form.full_name.text()])
            self.f_pw.set_error(problems[0] if problems else None)
            ok &= not problems
            self.f_pw2.set_error(None if self.pw.text() == self.pw2.text() else "As senhas não coincidem.")
            ok &= self.pw.text() == self.pw2.text()
            return bool(ok)
        if step == 1:
            return self.form.validate(PERSONAL_KEYS)
        if step == 2:
            return self.form.validate(PRO_KEYS)
        ok = self.accept.isChecked() and self.lgpd.isChecked()
        self.terms_err.setText("" if ok else "É necessário aceitar os termos e autorizar o tratamento de dados.")
        return ok

    def _next(self):
        step = self.steps[self.step_pos]
        if not self._validate_step(step):
            return
        if self.step_pos < len(self.steps) - 1:
            self.go(self.step_pos + 1)
            return
        profile = self.form.profile()
        text = self.next.text()
        _busy(self.next, True, text)
        if self.user:
            uid = self.user.id
            run_async(lambda: self.auth.save_profile(uid, profile),
                      lambda u: (_busy(self.next, False, text), self.completed.emit(u)),
                      lambda e: (_busy(self.next, False, text), Toast.show_message(self, str(e), "error", 5000)))
        else:
            email, pw = self.email.text(), self.pw.text()
            run_async(lambda: self.auth.register(email, pw, profile, True),
                      lambda r: (_busy(self.next, False, text), self.pw.clear(), self.pw2.clear(), self.registered.emit(r[0], r[1])),
                      lambda e: (_busy(self.next, False, text), Toast.show_message(self, str(e) if isinstance(e, AuthError) else "Não foi possível criar a conta.", "error", 6000)))


def show_recovery_codes(host: QWidget, codes: list[str], on_done=None) -> Modal:
    m = Modal(host, 560, dismissable=False)
    m.body.addWidget(label("Guarde seus códigos de recuperação", "h2"))
    m.body.addWidget(label("Como seus dados ficam apenas neste computador, estes códigos são a ÚNICA forma de "
                           "redefinir a senha se você esquecê-la. Cada código funciona uma vez. Guarde-os em local seguro "
                           "(impresso ou em um gerenciador de senhas).", "dim", wrap=True))
    grid = QGridLayout()
    for i, code in enumerate(codes):
        lb = QLabel(code)
        lb.setTextInteractionFlags(Qt.TextInteractionFlag.TextSelectableByMouse)
        lb.setStyleSheet("font-family: 'DejaVu Sans Mono', 'Consolas', monospace; font-size: 16px; font-weight: 700;"
                         f"background: {theme.SURFACE_ALT}; border: 1px dashed {theme.BORDER_STRONG}; border-radius: 8px; padding: 8px 12px; letter-spacing: 1px;")
        lb.setAlignment(Qt.AlignmentFlag.AlignCenter)
        grid.addWidget(lb, i // 2, i % 2)
    m.body.addLayout(grid)
    row = QHBoxLayout()
    copy = Button("Copiar", "secondary")
    save = Button("Salvar em arquivo", "secondary")

    def do_copy():
        cb = QGuiApplication.clipboard()
        cb.setText("\n".join(codes))
        Toast.show_message(host, "Copiado. A área de transferência será limpa em 60 segundos.", "info")
        QTimer.singleShot(60_000, lambda: cb.clear() if cb.text() == "\n".join(codes) else None)

    def do_save():
        path, _ = QFileDialog.getSaveFileName(host, "Salvar códigos", "codigos-recuperacao-aulaviva.txt", "Texto (*.txt)")
        if path:
            with open(path, "w", encoding="utf-8") as fh:
                fh.write(f"{APP_NAME} - códigos de recuperação (uso único)\n\n" + "\n".join(codes) + "\n")
            Toast.show_message(host, "Códigos salvos.", "success")

    copy.clicked.connect(do_copy)
    save.clicked.connect(do_save)
    row.addWidget(copy)
    row.addWidget(save)
    m.body.addLayout(row)
    ack = checkbox("Guardei meus códigos em local seguro")
    m.body.addWidget(ack)
    done = Button("Continuar", "primary")
    done.setEnabled(False)
    ack.toggled.connect(done.setEnabled)
    done.clicked.connect(lambda: (m.close_modal(), on_done and on_done()))
    m.body.addWidget(done)
    m.open()
    return m


class RecoveryView(QWidget):
    done = Signal()

    def __init__(self, auth: AuthService):
        super().__init__()
        self.auth = auth
        root = QVBoxLayout(self)
        root.addStretch()
        card = GlassCard(radius=24, padding=34, opacity=0.08)
        card.setFixedWidth(460)
        c = card.lay
        c.addWidget(label("Redefinir senha", "h2"))
        c.addWidget(label("Use um dos códigos de recuperação que você guardou ao criar a conta.", "dim", wrap=True))
        self.email = line_edit("seu.email@escola.edu.br", 254)
        self.code = line_edit("XXXXX-XXXXX", 11)
        self.code.setValidator(QRegularExpressionValidator(QRegularExpression(r"[A-Za-z0-9-]{0,11}")))
        self.pw = PasswordInput("Nova senha")
        self.pw2 = PasswordInput("Repita a nova senha")
        self.meter = StrengthMeter()
        self.pw.textChanged.connect(self.meter.set_password)
        self.f = [Field("E-mail", self.email, True), Field("Código de recuperação", self.code, True),
                  Field("Nova senha", self.pw, True), Field("Confirmar nova senha", self.pw2, True)]
        for w in (self.f[0], self.f[1], self.f[2], self.meter, self.f[3]):
            c.addWidget(w)
        self.btn = Button("Redefinir senha", "primary", height=46)
        self.btn.clicked.connect(self._submit)
        c.addWidget(self.btn)
        back = LinkButton("← Voltar ao login")
        back.clicked.connect(self.done)
        c.addWidget(back, 0, Qt.AlignmentFlag.AlignHCenter)
        row = QHBoxLayout()
        row.addStretch()
        row.addWidget(card)
        row.addStretch()
        root.addLayout(row)
        root.addStretch()

    def _submit(self):
        if self.pw.text() != self.pw2.text():
            self.f[3].set_error("As senhas não coincidem.")
            return
        self.f[3].set_error(None)
        email, code, pw = self.email.text(), self.code.text(), self.pw.text()
        _busy(self.btn, True, "Redefinir senha")

        def ok(_):
            _busy(self.btn, False, "Redefinir senha")
            for w in (self.code, self.pw, self.pw2):
                w.clear()
            Toast.show_message(self, "Senha redefinida! Entre com a nova senha.", "success")
            self.done.emit()

        def fail(e):
            _busy(self.btn, False, "Redefinir senha")
            self.f[1].set_error(str(e) if isinstance(e, AuthError) else "Não foi possível redefinir.")

        run_async(lambda: self.auth.reset_with_recovery_code(email, code, pw), ok, fail)


__all__ = ["LoginView", "RegisterView", "RecoveryView", "ProfileForm", "show_recovery_codes", "fade_in"]
