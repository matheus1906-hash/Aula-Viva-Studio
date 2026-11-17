"""Página Ferramentas: gerador de QR code e gerador de links."""

from __future__ import annotations

from pathlib import Path

from PySide6.QtCore import QSize, Qt, QTimer, QUrl
from PySide6.QtGui import QDesktopServices, QGuiApplication, QImage, QPixmap
from PySide6.QtWidgets import (
    QComboBox, QFileDialog, QGridLayout, QHBoxLayout, QLabel, QLineEdit, QPlainTextEdit, QPushButton, QSpinBox,
    QStackedWidget, QTabWidget, QVBoxLayout, QWidget,
)

from aulaviva.core import linktools as lt
from aulaviva.core.config import MAX_IMAGE_BYTES
from aulaviva.core.qrtools import LEVELS, render_png, render_svg, wifi_payload
from aulaviva.core.security import SecurityError, safe_filename, validate_url
from aulaviva.ui import theme
from aulaviva.ui.widgets import Button, Field, GlassCard, SmoothScrollArea, Toast, label, line_edit

COLORS = [("Preto", "#111827"), ("Azul", "#1D4ED8"), ("Verde", "#15803D"), ("Roxo", "#6D28D9"), ("Vinho", "#9F1239"), ("Laranja", "#C2410C")]


class Swatch(QPushButton):
    def __init__(self, name: str, color: str):
        super().__init__()
        self.color = color
        self.setCheckable(True)
        self.setFixedSize(34, 34)
        self.setToolTip(name)
        self.setCursor(Qt.CursorShape.PointingHandCursor)

    def paintEvent(self, e):
        from PySide6.QtCore import QRectF
        from PySide6.QtGui import QColor, QPainter, QPen

        p = QPainter(self)
        p.setRenderHint(QPainter.RenderHint.Antialiasing)
        if self.isChecked():
            p.setPen(QPen(QColor(theme.PRIMARY), 2))
            p.setBrush(Qt.BrushStyle.NoBrush)
            p.drawEllipse(QRectF(self.rect()).adjusted(1, 1, -1, -1))
        p.setPen(Qt.PenStyle.NoPen)
        p.setBrush(QColor(self.color))
        p.drawEllipse(QRectF(self.rect()).adjusted(6, 6, -6, -6))


class QRTool(QWidget):
    def __init__(self, shell):
        super().__init__()
        self.shell = shell
        self.logo: bytes | None = None
        self.color = COLORS[0][1]
        root = QHBoxLayout(self)
        root.setContentsMargins(0, 12, 0, 0)
        root.setSpacing(16)
        left = GlassCard(radius=14, padding=18, opacity=0.06)
        lay = left.lay
        lay.addWidget(label("O que o QR code vai abrir?", "h3"))
        self.kind = QComboBox()
        self.kind.addItems(["Link (site, vídeo, formulário...)", "Texto livre", "Rede Wi-Fi da escola", "E-mail"])
        self.kind.setMinimumHeight(40)
        lay.addWidget(self.kind)
        self.stack = QStackedWidget()
        # link
        self.url = line_edit("https://...", 2048)
        self.stack.addWidget(self._page(Field("Endereço", self.url, True)))
        # texto
        self.text = QPlainTextEdit()
        self.text.setPlaceholderText("Ex.: Parabéns! Você encontrou a pista 3 da gincana.")
        self.text.setFixedHeight(90)
        self.stack.addWidget(self._page(Field("Texto", self.text, True)))
        # wifi
        self.ssid, self.wpass = line_edit("Nome da rede", 64), line_edit("Senha da rede", 64)
        self.stack.addWidget(self._page(Field("Nome da rede (SSID)", self.ssid, True), Field("Senha", self.wpass)))
        # email
        self.mail_to, self.mail_subj = line_edit("professor@escola.edu.br", 254), line_edit("Assunto", 200)
        self.stack.addWidget(self._page(Field("Destinatário", self.mail_to, True), Field("Assunto", self.mail_subj)))
        lay.addWidget(self.stack)
        lay.addWidget(label("Aparência", "h3"))
        sw = QHBoxLayout()
        self.swatches = []
        for name, col in COLORS:
            s = Swatch(name, col)
            s.setChecked(col == self.color)
            s.clicked.connect(lambda _=False, c=col: self._set_color(c))
            sw.addWidget(s)
            self.swatches.append(s)
        sw.addStretch()
        lay.addLayout(sw)
        g = QGridLayout()
        self.size = QSpinBox()
        self.size.setRange(200, 3000)
        self.size.setSingleStep(100)
        self.size.setValue(1000)
        self.size.setSuffix(" px")
        self.size.setMinimumHeight(40)
        self.level = QComboBox()
        for k, v in LEVELS.items():
            self.level.addItem(v, k)
        self.level.setCurrentIndex(1)
        self.level.setMinimumHeight(40)
        g.addWidget(Field("Tamanho da imagem", self.size), 0, 0)
        g.addWidget(Field("Correção de erros", self.level), 0, 1)
        lay.addLayout(g)
        logo_row = QHBoxLayout()
        self.logo_btn = Button("Adicionar logo da escola", "secondary", icon_text="🏫", height=38)
        self.logo_btn.clicked.connect(self._pick_logo)
        self.logo_clear = Button("Remover logo", "ghost", height=38)
        self.logo_clear.clicked.connect(self._clear_logo)
        self.logo_clear.hide()
        logo_row.addWidget(self.logo_btn)
        logo_row.addWidget(self.logo_clear)
        logo_row.addStretch()
        lay.addLayout(logo_row)
        lay.addStretch()
        root.addWidget(left, 3)

        right = GlassCard(radius=14, padding=18, opacity=0.06)
        right.lay.addWidget(label("Prévia", "h3"))
        self.preview = QLabel()
        self.preview.setAlignment(Qt.AlignmentFlag.AlignCenter)
        self.preview.setMinimumSize(QSize(280, 280))
        self.preview.setStyleSheet(f"background: {theme.SURFACE_ALT}; border: 1px dashed {theme.BORDER_STRONG}; border-radius: 12px; color: {theme.TEXT_MUTED};")
        right.lay.addWidget(self.preview, 1)
        self.err = label("", "error", wrap=True)
        right.lay.addWidget(self.err)
        btns = QGridLayout()
        self.b_png = Button("Salvar PNG", "primary", icon_text="⤓")
        self.b_svg = Button("Salvar SVG", "secondary")
        self.b_copy = Button("Copiar imagem", "secondary", icon_text="⧉")
        self.b_insert = Button("Inserir em um material", "soft", icon_text="＋")
        self.b_png.clicked.connect(self._save_png)
        self.b_svg.clicked.connect(self._save_svg)
        self.b_copy.clicked.connect(self._copy)
        self.b_insert.clicked.connect(self._insert)
        btns.addWidget(self.b_png, 0, 0)
        btns.addWidget(self.b_svg, 0, 1)
        btns.addWidget(self.b_copy, 1, 0)
        btns.addWidget(self.b_insert, 1, 1)
        right.lay.addLayout(btns)
        right.lay.addWidget(label("Dica: teste o QR code com a câmera do celular antes de imprimir.", "muted", wrap=True))
        root.addWidget(right, 2)

        self._timer = QTimer(self, singleShot=True, interval=250, timeout=self._render)
        for w in (self.url, self.ssid, self.wpass, self.mail_to, self.mail_subj):
            w.textChanged.connect(self._timer.start)
        self.text.textChanged.connect(self._timer.start)
        self.level.currentIndexChanged.connect(self._timer.start)
        self.kind.currentIndexChanged.connect(lambda i: (self.stack.setCurrentIndex(i), self.b_insert.setVisible(i == 0), self._timer.start()))
        self._png: bytes | None = None
        self._render()

    @staticmethod
    def _page(*widgets) -> QWidget:
        w = QWidget()
        lay = QVBoxLayout(w)
        lay.setContentsMargins(0, 0, 0, 0)
        for x in widgets:
            lay.addWidget(x)
        return w

    def set_url(self, url: str):
        self.kind.setCurrentIndex(0)
        self.url.setText(url)

    def _set_color(self, c: str):
        self.color = c
        for s in self.swatches:
            s.setChecked(s.color == c)
        self._timer.start()

    def payload(self) -> str:
        i = self.kind.currentIndex()
        if i == 0:
            return validate_url(self.url.text())
        if i == 1:
            t = self.text.toPlainText().strip()
            if not t:
                raise ValueError("Digite o texto do QR code.")
            return t
        if i == 2:
            if not self.ssid.text().strip():
                raise ValueError("Informe o nome da rede.")
            return wifi_payload(self.ssid.text().strip(), self.wpass.text(), "WPA" if self.wpass.text() else "nopass")
        return lt.email_link(self.mail_to.text(), self.mail_subj.text(), "")

    def _render(self):
        try:
            data = self.payload()
            self._png = render_png(data, 600, self.color, "#FFFFFF", self.level.currentData(), self.logo)
            img = QImage.fromData(self._png)
            self.preview.setPixmap(QPixmap.fromImage(img).scaled(QSize(300, 300), Qt.AspectRatioMode.KeepAspectRatio,
                                                                 Qt.TransformationMode.SmoothTransformation))
            self.err.setText("")
            ok = True
        except (ValueError, SecurityError) as exc:
            self._png = None
            self.preview.setPixmap(QPixmap())
            self.preview.setText("A prévia aparece aqui")
            empty = self.kind.currentIndex() == 0 and not self.url.text().strip()
            self.err.setText("" if empty else str(exc))
            ok = False
        for b in (self.b_png, self.b_svg, self.b_copy, self.b_insert):
            b.setEnabled(ok)

    def _pick_logo(self):
        path, _ = QFileDialog.getOpenFileName(self, "Logo da escola", "", "Imagens (*.png *.jpg *.jpeg)")
        if not path:
            return
        p = Path(path)
        if p.stat().st_size > MAX_IMAGE_BYTES:
            Toast.show_message(self, "Imagem muito grande.", "error")
            return
        self.logo = p.read_bytes()
        self.level.setCurrentIndex(3)
        self.logo_clear.show()
        self._render()

    def _clear_logo(self):
        self.logo = None
        self.logo_clear.hide()
        self._render()

    def _name(self) -> str:
        return safe_filename("qrcode-" + (self.url.text().split("//")[-1][:30] if self.kind.currentIndex() == 0 else "aulaviva"), "qrcode")

    def _save_png(self):
        path, _ = QFileDialog.getSaveFileName(self, "Salvar QR code", self._name() + ".png", "PNG (*.png)")
        if path:
            try:
                Path(path).write_bytes(render_png(self.payload(), self.size.value(), self.color, "#FFFFFF", self.level.currentData(), self.logo))
                Toast.show_message(self, "QR code salvo.", "success")
            except (OSError, ValueError, SecurityError) as exc:
                Toast.show_message(self, f"Não foi possível salvar: {exc}", "error")

    def _save_svg(self):
        path, _ = QFileDialog.getSaveFileName(self, "Salvar QR code (vetor)", self._name() + ".svg", "SVG (*.svg)")
        if path:
            try:
                Path(path).write_text(render_svg(self.payload(), self.color, "#FFFFFF", self.level.currentData()), encoding="utf-8")
                Toast.show_message(self, "QR code salvo (SVG, ideal para gráfica e banners).", "success")
            except (OSError, ValueError, SecurityError) as exc:
                Toast.show_message(self, f"Não foi possível salvar: {exc}", "error")

    def _copy(self):
        if self._png:
            QGuiApplication.clipboard().setImage(QImage.fromData(render_png(self.payload(), self.size.value(), self.color,
                                                                             "#FFFFFF", self.level.currentData(), self.logo)))
            Toast.show_message(self, "Imagem copiada. Cole no Word, slides ou WhatsApp.", "success")

    def _insert(self):
        try:
            url = self.payload()
        except (ValueError, SecurityError):
            return
        from aulaviva.core.projects import new_block

        b = new_block("qrcode")
        b["url"] = url
        self.shell.insert_block_into_project(b)


class LinkTool(QWidget):
    def __init__(self, shell, qr_tool: QRTool, tabs: QTabWidget):
        super().__init__()
        self.shell, self.qr_tool, self.tabs = shell, qr_tool, tabs
        root = QHBoxLayout(self)
        root.setContentsMargins(0, 12, 0, 0)
        root.setSpacing(16)
        left = GlassCard(radius=14, padding=18, opacity=0.06)
        lay = left.lay
        lay.addWidget(label("Que tipo de link você quer criar?", "h3"))
        self.kind = QComboBox()
        for k, v in lt.LINK_TYPES.items():
            self.kind.addItem(v, k)
        self.kind.setMinimumHeight(40)
        lay.addWidget(self.kind)
        self.help = label("", "muted", wrap=True)
        lay.addWidget(self.help)
        self.f1, self.f2 = line_edit("", 2048), line_edit("", 300)
        self.f3 = QPlainTextEdit()
        self.f3.setFixedHeight(80)
        self.mode = QComboBox()
        self.mode.setMinimumHeight(40)
        self.l1, self.l2, self.l3, self.lm = Field("", self.f1), Field("", self.f2), Field("", self.f3), Field("", self.mode)
        for w in (self.l1, self.l2, self.l3, self.lm):
            lay.addWidget(w)
        lay.addStretch()
        root.addWidget(left, 3)
        right = GlassCard(radius=14, padding=18, opacity=0.06)
        right.lay.addWidget(label("Seu link", "h3"))
        self.out = QLineEdit()
        self.out.setReadOnly(True)
        self.out.setMinimumHeight(44)
        self.out.setPlaceholderText("O link gerado aparece aqui")
        right.lay.addWidget(self.out)
        self.err = label("", "error", wrap=True)
        right.lay.addWidget(self.err)
        g = QGridLayout()
        self.b_copy = Button("Copiar link", "primary", icon_text="⧉")
        self.b_open = Button("Testar (abrir)", "secondary", icon_text="↗")
        self.b_qr = Button("Gerar QR code", "secondary", icon_text="▦")
        self.b_ins = Button("Inserir em um material", "soft", icon_text="＋")
        self.b_copy.clicked.connect(lambda: (QGuiApplication.clipboard().setText(self.out.text()), Toast.show_message(self, "Link copiado.", "success")))
        self.b_open.clicked.connect(lambda: QDesktopServices.openUrl(QUrl(self.out.text())))
        self.b_qr.clicked.connect(lambda: (self.qr_tool.set_url(self.out.text()), self.tabs.setCurrentIndex(0)))
        self.b_ins.clicked.connect(self._insert)
        g.addWidget(self.b_copy, 0, 0)
        g.addWidget(self.b_open, 0, 1)
        g.addWidget(self.b_qr, 1, 0)
        g.addWidget(self.b_ins, 1, 1)
        right.lay.addLayout(g)
        right.lay.addWidget(label("Os links são gerados no seu computador, sem serviços de encurtamento, então nada é rastreado.",
                                  "muted", wrap=True))
        right.lay.addStretch()
        root.addWidget(right, 2)
        self._timer = QTimer(self, singleShot=True, interval=200, timeout=self._make)
        for w in (self.f1, self.f2):
            w.textChanged.connect(self._timer.start)
        self.f3.textChanged.connect(self._timer.start)
        self.mode.currentIndexChanged.connect(self._timer.start)
        self.kind.currentIndexChanged.connect(self._setup)
        self._setup()

    def _setup(self):
        k = self.kind.currentData()
        cfg = {
            "clean": ("Cole um link longo para remover rastreadores (utm, fbclid...).", ("Link", "https://..."), None, None, None),
            "whatsapp": ("Abre o WhatsApp com a mensagem pronta. Deixe o telefone vazio para o aluno escolher o contato.",
                         ("Telefone (opcional)", "(11) 98765-4321"), None, ("Mensagem", ""), None),
            "email": ("Cria um link que abre o e-mail já com destinatário, assunto e texto.", ("Destinatário", "professor@escola.edu.br"),
                      ("Assunto", "Dúvida sobre a atividade"), ("Texto", ""), None),
            "youtube": ("Faz o vídeo começar no ponto certo, sem o aluno procurar.", ("Link do vídeo", "https://youtube.com/watch?v=..."),
                        ("Começar em (min:seg)", "2:30"), None, None),
            "drive": ("Transforma o link de compartilhamento do Drive em visualização direta ou download.",
                      ("Link do Google Drive", "https://drive.google.com/file/d/..."), None, None,
                      ("O que o link faz", [("Visualizar o arquivo", "view"), ("Baixar direto", "download")])),
            "gdocs": ("Ótimo para atividades: cada aluno recebe a própria CÓPIA editável, ou baixa em PDF/Word.",
                      ("Link do Docs/Planilhas/Apresentações", "https://docs.google.com/document/d/..."), None, None,
                      ("O que o link faz", [("Fazer uma cópia (recomendado)", "copy"), ("Baixar em PDF", "pdf"),
                                            ("Baixar em Word/Excel/PowerPoint", "docx"), ("Apenas visualizar", "view")])),
            "maps": ("Abre o local no Google Maps (excursões, estudos do meio).", ("Endereço ou local", "Museu do Ipiranga, São Paulo"),
                     None, None, None),
        }[k]
        self.help.setText(cfg[0])
        for fld, edit, spec in ((self.l1, self.f1, cfg[1]), (self.l2, self.f2, cfg[2])):
            fld.setVisible(bool(spec))
            if spec:
                fld.findChild(QLabel).setText(spec[0])
                edit.setPlaceholderText(spec[1])
        self.l3.setVisible(bool(cfg[3]))
        if cfg[3]:
            self.l3.findChild(QLabel).setText(cfg[3][0])
        self.lm.setVisible(bool(cfg[4]))
        if cfg[4]:
            self.lm.findChild(QLabel).setText(cfg[4][0])
            self.mode.blockSignals(True)
            self.mode.clear()
            for text, val in cfg[4][1]:
                self.mode.addItem(text, val)
            self.mode.blockSignals(False)
        self._make()

    def _make(self):
        k, a, b, c, m = self.kind.currentData(), self.f1.text(), self.f2.text(), self.f3.toPlainText(), self.mode.currentData()
        try:
            link = {"clean": lambda: lt.clean_url(a), "whatsapp": lambda: lt.whatsapp_link(a, c),
                    "email": lambda: lt.email_link(a, b, c), "youtube": lambda: lt.youtube_link(a, b),
                    "drive": lambda: lt.drive_link(a, m or "view"), "gdocs": lambda: lt.gdocs_link(a, m or "copy"),
                    "maps": lambda: lt.maps_link(a)}[k]()
            self.out.setText(link)
            self.err.setText("")
            ok = True
        except SecurityError as exc:
            self.out.clear()
            empty = not (a.strip() or c.strip())
            self.err.setText("" if empty else str(exc))
            ok = False
        for btn in (self.b_copy, self.b_open, self.b_qr, self.b_ins):
            btn.setEnabled(ok)
        self.b_qr.setEnabled(ok and len(self.out.text()) < 1000)

    def _insert(self):
        from aulaviva.core.projects import new_block

        b = new_block("link")
        b["url"] = self.out.text()
        b["label"] = {"whatsapp": "Fale comigo no WhatsApp", "email": "Enviar e-mail", "youtube": "Assistir ao vídeo",
                      "drive": "Abrir o arquivo", "gdocs": "Abrir a atividade", "maps": "Ver no mapa"}.get(self.kind.currentData(), "Acessar")
        self.shell.insert_block_into_project(b)


class ToolsPage(QWidget):
    def __init__(self, shell):
        super().__init__()
        lay = QVBoxLayout(self)
        lay.setContentsMargins(6, 6, 16, 0)
        lay.addWidget(label("Ferramentas", "h1"))
        lay.addWidget(label("Crie QR codes e links prontos para usar em aula, nos seus materiais, no quadro ou no WhatsApp da turma.", "dim", wrap=True))
        self.tabs = QTabWidget()
        self.qr = QRTool(shell)
        self.link = LinkTool(shell, self.qr, self.tabs)
        for w, name in ((self.qr, "▦  Gerador de QR code"), (self.link, "🔗  Gerador de links")):
            sc = SmoothScrollArea()
            sc.setWidget(w)
            self.tabs.addTab(sc, name)
        lay.addWidget(self.tabs, 1)
