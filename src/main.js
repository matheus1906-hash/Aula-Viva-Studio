(function (AV) {
  "use strict";
  const h = AV.h;
  async function boot() {
    AV.applyTheme();
    if (AV.Auth) { AV.startI18n && AV.startI18n(); try { await AV.Auth.gate(); } catch (e) { return; } AV.applyTheme(); }
    document.getElementById("fab-wa").addEventListener("click", () => {
      const cur = (location.hash === "#editor") ? AV.Store.get(AV.LS.get("lastDoc")) : null;
      AV.whatsSheet(cur);
    });
    document.getElementById("bn-plus").addEventListener("click", () => {
      const d = AV.dialog("Criar", h("div", { class: "menu" },
        h("button", { onclick: () => { d.close(); AV.aiCreateDialog(); } }, AV.appIcon("wand", "pink"), h("b", null, "Criar com IA"), h("span", null, "Apostila, lista, prova, plano, projeto...")),
        h("button", { onclick: () => { d.close(); AV.go("chat"); } }, AV.appIcon("chat", "sky"), h("b", null, "Chat livre"), h("span", null, "Projeto do zero, conversando")),
        h("button", { onclick: () => { d.close(); AV.go("atividades"); } }, AV.appIcon("puzzle", "rose"), h("b", null, "Atividade pronta"), h("span", null, "Caça-palavras, cruzadinha, contas...")),
        h("button", { onclick: () => { d.close(); AV.go("modelos"); } }, AV.appIcon("folder", "amber"), h("b", null, "A partir de um modelo"), h("span", null, "30 modelos prontos")),
        h("button", { onclick: () => { d.close(); AV.importAny(); } }, AV.appIcon("studio", "teal"), h("b", null, "Importar arquivo"), h("span", null, "Word, PowerPoint, PDF...")),
        Object.keys(AV.KINDS).filter((k) => ["apostila", "lista", "prova", "roteiro", "branco"].includes(k)).map((k) => h("button", { onclick: () => { d.close(); AV.createAndOpen(k); } }, AV.appIcon({ apostila: "book", lista: "list", prova: "exam", roteiro: "route", branco: "blank" }[k], { apostila: "blue", lista: "orange", prova: "slate", roteiro: "green", branco: "gray" }[k]), h("b", null, AV.KINDS[k][0]), h("span", null, "Começar no editor")))));
    });
    document.getElementById("bn-more").addEventListener("click", () => {
      const items = [["animacao", "film", "rose", "Vídeos animados"], ["acervo", "shelf", "amber", "Livros e e-books"], ["modelos", "folder", "amber", "Modelos prontos"], ["biblioteca", "shelf", "orange", "Biblioteca de conteúdos"], ["atividades", "puzzle", "rose", "Atividades prontas"], ["estudio", "studio", "teal", "Estúdio de fontes"], ["ferramentas", "route", "green", "QR code e links"], ["agenda", "calendar", "violet", "Agenda e lembretes"], ["horarios", "calendar", "blue", "Horários de aula"], ["estudos", "book", "teal", "Ambiente de estudos"], ["abnt", "doc", "blue", "Editor ABNT"], ["config", "cap", "slate", "Configurações e IAs"]];
      const d = AV.dialog("Mais", h("div", { class: "menu" },
        h("button", { onclick: () => { d.close(); AV.toggleTheme(); } }, AV.appIcon("blank", "indigo"), h("b", null, AV.isDark() ? "Tema claro (caderno)" : "Tema escuro (lousa)"), h("span", null, "Trocar a aparência")),
        h("div", { class: "lang-sel", "data-notr": "" }, Object.keys(AV.LANGS).map((k) => h("button", { type: "button", "aria-pressed": k === AV.lang() ? "true" : "false", onclick: () => { d.close(); AV.setLang(k); syncLang(); } }, AV.LANGS[k][2] + " " + AV.LANGS[k][0]))),
        items.map(([k, i, g, l]) => h("button", { onclick: () => { d.close(); AV.go(k); } }, AV.appIcon(i, g), h("b", null, l), h("span", null, "")))));
    });
    document.querySelectorAll("[data-theme-btn]").forEach((b) => b.addEventListener("click", AV.toggleTheme));
    const ls = document.getElementById("lang-sel");
    const syncLang = () => ls && ls.querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", b.dataset.lang === AV.lang() ? "true" : "false"));
    if (ls) ls.addEventListener("click", (e) => { const b = e.target.closest("button"); if (b) { AV.setLang(b.dataset.lang); syncLang(); } });
    syncLang(); AV.startI18n();
    AV.syncThemeBtns();
    /* busca rápida: telas, ações e materiais */
    const openCmd = () => {
      const acts = [
        ["Criar com IA", "wand", "pink", () => AV.aiCreateDialog()], ["Chat livre", "chat", "sky", () => AV.go("chat")], ["Vídeo animado", "film", "orange", () => AV.go("animacao")],
        ["Livros e e-books", "shelf", "amber", () => AV.go("acervo")], ["Atividades prontas", "puzzle", "rose", () => AV.go("atividades")], ["Modelos prontos", "folder", "amber", () => AV.go("modelos")],
        ["Plano de aula", "calendar", "violet", () => AV.aiCreateDialog({ kind: "plano" })], ["Avaliação / Prova", "exam", "slate", () => AV.createAndOpen("prova")], ["Nova apostila", "book", "blue", () => AV.createAndOpen("apostila")],
        ["Lista de exercícios", "list", "orange", () => AV.createAndOpen("lista")], ["Projeto educacional", "rocket", "cyan", () => AV.aiCreateDialog({ kind: "projeto" })], ["Estúdio de fontes", "studio", "teal", () => AV.go("estudio")],
        ["Biblioteca de conteúdos", "shelf", "orange", () => AV.go("biblioteca")], ["QR code e links", "route", "green", () => AV.go("ferramentas")], ["Meus materiais", "folder", "amber", () => AV.go("materiais")],
        ["Agenda e lembretes", "calendar", "violet", () => AV.go("agenda")], ["Horários de aula", "calendar", "blue", () => AV.go("horarios")], ["Ambiente de estudos", "book", "teal", () => AV.go("estudos")], ["Editor ABNT", "doc", "blue", () => AV.go("abnt")], ["Configurações", "cap", "slate", () => AV.go("config")], ["Importar arquivo", "studio", "teal", () => AV.importAny()], ["WhatsApp", "chat", "green", () => AV.whatsSheet(null)]
      ].map(([l, i, c, f]) => ({ label: AV.t(l), icon: i, color: c, run: f, kind: AV.t("Ação") }));
      const docs = AV.Store.list().map((d) => ({ label: d.meta.title, icon: "book", color: "blue", kind: AV.t("Material"), run: () => { AV.LS.set("lastDoc", d.id); AV.go("editor"); } }));
      const q = h("input", { class: "in", id: "cmd-q", placeholder: "O que você procura ou quer criar?", "aria-label": "Buscar" });
      const list = h("div", { class: "cmd-list", role: "listbox" });
      let sel = 0, cur = [];
      const draw = () => {
        const t = q.value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
        const all = acts.concat(docs);
        cur = (t ? all.filter((x) => x.label.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").includes(t)) : all).slice(0, 12);
        if (t && !cur.length) cur = [{ label: AV.t("Criar com IA:") + " " + q.value.trim(), icon: "wand", color: "pink", kind: "IA", run: () => AV.aiCreateDialog({ topic: q.value.trim() }) }];
        sel = Math.min(sel, cur.length - 1); list.textContent = "";
        cur.forEach((x, i) => list.appendChild(h("button", { type: "button", role: "option", "aria-selected": i === sel ? "true" : "false", onclick: () => go(x) }, AV.appIcon(x.icon, x.color), h("span", { "data-notr": "" }, x.label), h("small", null, x.kind))));
      };
      const go = (x) => { d.close(); setTimeout(x.run, 10); };
      q.addEventListener("input", () => { sel = 0; draw(); });
      q.addEventListener("keydown", (e) => { if (e.key === "ArrowDown") { e.preventDefault(); sel = Math.min(cur.length - 1, sel + 1); draw(); } else if (e.key === "ArrowUp") { e.preventDefault(); sel = Math.max(0, sel - 1); draw(); } else if (e.key === "Enter" && cur[sel]) { e.preventDefault(); go(cur[sel]); } });
      const d = AV.dialog("Buscar ou criar", h("div", { style: { display: "grid", gap: "12px" } }, q, list));
      draw();
    };
    AV.openCmd = openCmd;
    const cmdBtn = document.getElementById("cmdk"); if (cmdBtn) cmdBtn.addEventListener("click", openCmd);
    document.addEventListener("keydown", (e) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); openCmd(); } });
    addEventListener("hashchange", AV.route);
    const ready = AV.Store.init();   /* a parte local carrega antes da primeira tela */
    AV.route();
    ready.then(() => {
      const f = document.getElementById("side-foot");
      if (f && AV.Store.remote) f.lastChild.textContent = "Materiais salvos na sua conta, só você vê.";
      else if (f) f.lastChild.textContent = "Materiais salvos neste navegador.";
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
})(globalThis.AV = globalThis.AV || {});
