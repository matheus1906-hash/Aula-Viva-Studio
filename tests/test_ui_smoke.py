"""Teste de fumaça da interface (sem tela): percorre o fluxo principal."""
import os

import pytest

os.environ.setdefault("QT_QPA_PLATFORM", "offscreen")
pytest.importorskip("PySide6.QtWidgets")


def _wait(ms):
    from PySide6.QtCore import QEventLoop, QTimer

    loop = QEventLoop()
    QTimer.singleShot(ms, loop.quit)
    loop.exec()


def test_full_flow(tmp_path, monkeypatch):
    import secrets

    from PySide6.QtWidgets import QApplication

    app = QApplication.instance() or QApplication([])
    from aulaviva.core.config import Preferences
    from aulaviva.core.database import Database
    from aulaviva.core.security import Crypto
    from aulaviva.ui.main_window import MainWindow
    from aulaviva.ui.widgets import Motion

    Motion.enabled = False
    db = Database(tmp_path / "ui.db", Crypto(secrets.token_bytes(32)))
    prefs = Preferences()
    monkeypatch.setattr(Preferences, "save", lambda self: None)
    w = MainWindow(db, prefs)
    w.show()
    w.stack.currentWidget().finished.emit()          # pula boas-vindas
    assert w.stack.currentWidget() is w.login
    w.show_register()
    reg = w.stack.currentWidget()
    reg.email.setText("prof@escola.com"); reg.email2.setText("prof@escola.com")
    reg.pw.setText("Giz&Lousa-2026x"); reg.pw2.setText("Giz&Lousa-2026x")
    reg._next()
    f = reg.form
    f.full_name.setText("Ana Souza")
    # campos livres: digitação crua e formatação ao sair do campo
    f.cpf.setText("529.982.247-25"); f.cpf.editingFinished.emit()
    f.phone.setText("11 98765 4321"); f.phone.editingFinished.emit()
    f.birth.setText("10041985"); f.birth.editingFinished.emit()
    assert f.cpf.text() == "529.982.247-25" and f.phone.text() == "(11) 98765-4321" and f.birth.text() == "10/04/1985"
    reg._next()
    f.institution.setText("E.E. Machado"); f.network.setCurrentIndex(1); f.role.setCurrentIndex(1)
    f.levels.set_selected(["Ensino Médio"]); f.subjects.setText("Biologia"); f.city.setText("Campinas")
    f.state.setCurrentIndex(f.state.findText("SP"))
    reg._next()
    reg.accept.setChecked(True); reg.lgpd.setChecked(True)
    got = []
    reg.registered.connect(lambda u, c: got.append((u, c)))
    reg._next()
    for _ in range(60):
        if got:
            break
        _wait(100)
    assert got and len(got[0][1]) == 8
    w.on_login(got[0][0])
    assert w.shell is not None
    w.shell.new_from_template("Lista de exercícios")
    ed = w.editor
    ed.add_block("qrcode")
    assert ed.cards[ed.sel].form is not None          # bloco novo abre já em edição
    ed.doc["blocks"][ed.sel]["url"] = "https://example.com"
    ed.save()
    assert w.store.load(w.user.id, ed.pid)["blocks"][ed.sel]["url"] == "https://example.com"
    n = len(ed.doc["blocks"])
    ed.duplicate(); ed.move(-1); ed.delete_block()
    assert len(ed.doc["blocks"]) == n
    ed.undo()
    # importar conteúdo de um arquivo para dentro do material (processo auxiliar)
    md = tmp_path / "anotacoes.md"
    md.write_text("# Revisão\nTexto base.\n\n1) Quanto é 2+2?\na) 3\n*b) 4\n", encoding="utf-8")
    from PySide6.QtWidgets import QFileDialog
    monkeypatch.setattr(QFileDialog, "getOpenFileName", staticmethod(lambda *a, **k: (str(md), "")))
    before = len(ed.doc["blocks"])
    ed.insert_from_file()
    for _ in range(150):
        if len(ed.doc["blocks"]) > before:
            break
        _wait(100)
    assert len(ed.doc["blocks"]) == before + 3
    from aulaviva.core.quicklist import EXAMPLE, parse_questions
    ed.doc["blocks"].extend(parse_questions(EXAMPLE)); ed._rebuild_cards(-1)
    assert len(ed.cards) == len(ed.doc["blocks"])
    # telas novas: modelos (com visualização), ferramentas e IA abrem e fecham sem travar
    from aulaviva.ui.templates_page import open_preview
    from aulaviva.ui.widgets import Modal
    w.close_editor()
    w.shell.navigate("templates")
    m = open_preview(w.shell, "sistema-solar", w.shell.new_from_sample)
    _wait(1500)
    m.close_modal()
    _wait(300)
    w.shell.navigate("tools")
    w.shell.pages["tools"].qr.url.setText("https://example.com")
    w.shell.pages["tools"].qr._render()
    assert w.shell.pages["tools"].qr._png
    w.shell.navigate("settings", tab=2)
    w.shell.pages["settings"]._select_provider("groq")
    w.shell.new_material("lista", ai_mode=True)
    for x in w.findChildren(Modal):
        x.close_modal()
    _wait(300)
    # cancelar a geração por IA: o resultado que chegar depois é descartado e nada muda
    from aulaviva.ui.editor import ai_busy_modal
    busy = ai_busy_modal(w.shell)
    got_result = []
    cb = busy.guard(lambda r: got_result.append(r))
    busy.cancel()
    cb("resultado tardio")
    assert busy.cancelled and got_result == []
    n_projects = len(w.store.list(w.user.id))
    from aulaviva.ui import editor as ed_mod
    orig = ed_mod.AIBusy.__init__

    def auto_cancel(self, host):
        orig(self, host)
        self.cancel()          # professor muda de ideia assim que a geração começa
    monkeypatch.setattr(ed_mod.AIBusy, "__init__", auto_cancel)
    from aulaviva.ui.quick_create import open_new_material  # noqa: F401
    w.shell.new_material("apostila", ai_mode=True)
    m = [x for x in w.findChildren(Modal) if x.isVisible()][-1]
    from PySide6.QtWidgets import QLineEdit as _LE
    m.findChildren(_LE)[0].setText("Fotossíntese")
    m.findChildren(_LE)[2].setText("7º ano")
    [b for b in m.findChildren(type(w.login.btn)) if "Gerar" in b.text()][0].click()
    _wait(1500)
    assert len(w.store.list(w.user.id)) == n_projects   # nenhum material criado após cancelar
    monkeypatch.setattr(ed_mod.AIBusy, "__init__", orig)
    # troca de tema na hora, mantendo a sessão
    w.apply_theme("dark")
    assert w.user is not None and w.shell is not None
    w.apply_theme("light")
    # regressão: listas suspensas dentro de janelas não podem herdar fundo transparente (ficavam pretas no Windows)
    from PySide6.QtGui import QPalette
    from PySide6.QtWidgets import QComboBox
    from aulaviva.ui import theme as th
    w.shell.new_material("apostila", ai_mode=True)
    combos = [c for m in w.findChildren(Modal) for c in m.findChildren(QComboBox)]
    from aulaviva.ui.editor import open_ai_generate
    w.shell.new_from_sample("sistema-solar")
    open_ai_generate(w.editor, w.shell.get_assistant, lambda d, mode: None)
    combos += [c for m in w.findChildren(Modal) for c in m.findChildren(QComboBox)]
    assert combos
    for c in combos:
        base = c.view().palette().color(QPalette.ColorRole.Base)
        assert base.alpha() == 255 and base.name().lower() == th.SURFACE.lower(), base.name()
    for x in w.findChildren(Modal):
        x.close_modal()
    _wait(300)
    w.close_editor()
    w.do_logout("teste")
    assert w.user is None and w.stack.currentWidget() is w.login
    db.close()
