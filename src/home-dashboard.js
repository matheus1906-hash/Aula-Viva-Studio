/* AulaViva Studio — Home 4.0: workspace-first dashboard.
   Overrides the legacy landing page after teacher-tools.js is loaded. */
(function (AV) {
  "use strict";
  const h = AV.h;
  const DEFAULTS = { agenda: true, schedule: true, quote: true, quickStudy: true };
  const weekNames = ["domingo", "segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado"];
  const dailyQuotes = [
    "Uma aula marcante começa com uma boa pergunta.",
    "Planejar hoje é abrir possibilidades para amanhã.",
    "Ensinar também é aprender a escutar.",
    "Uma ideia bem explicada pode mudar uma trajetória.",
    "Cada atividade é uma oportunidade de despertar curiosidade.",
    "Revisar o que escrevemos também é aprender.",
    "Conhecimento cresce quando é compartilhado.",
    "A curiosidade é um ótimo ponto de partida.",
    "Um ambiente acolhedor favorece novas descobertas.",
    "Aprender é construir relações entre ideias.",
    "O avanço de uma turma acontece em muitos ritmos.",
    "Uma pergunta simples pode criar uma grande conversa.",
    "Criatividade e organização podem caminhar juntas.",
    "Boas aulas combinam planejamento e flexibilidade."
  ];
  const read = (key, fallback) => AV.LS.get(key, fallback);
  const save = (key, value) => AV.LS.set(key, value);
  const preferences = () => Object.assign({}, DEFAULTS, read("homeWidgets", {}));
  const button = (label, cb, className) => h("button", { type: "button", class: className || "btn sm", onclick: cb }, label);
  const link = (url, label, className) => h("a", { href: url, class: className || "btn sm" }, label);
  const section = (title, subtitle, body, action) =>
    h("section", { class: "home-panel" },
      h("div", { class: "home-panel-head" }, h("div", null, h("h2", null, title), subtitle && h("p", null, subtitle)), action || null),
      body);
  const localDate = d => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  const todayKey = () => localDate(new Date());
  const dateLabel = d => d.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });
  const quote = () => {
    const key = todayKey();
    let n = 0; for (const c of key) n = ((n * 31) + c.charCodeAt(0)) >>> 0;
    return dailyQuotes[n % dailyQuotes.length];
  };
  const shortcuts = [
    { label: "Criar com IA", detail: "Crie qualquer material a partir de uma ideia", icon: "wand", kind: "violet", art: "ai", run: () => AV.aiCreateDialog() },
    { label: "Chat livre", detail: "Converse com a IA, sem modelos fixos", icon: "chat", kind: "blue", art: "chat", href: "#chat" },
    { label: "Vídeos animados", detail: "Personagens e histórias para suas aulas", icon: "film", kind: "coral", art: "video", href: "#animacao" },
    { label: "Atividades", detail: "Jogos, exercícios e desafios", icon: "puzzle", kind: "orange", art: "activities", href: "#atividades" },
    { label: "Modelos prontos", detail: "Materiais com prévia e personalização", icon: "grid", kind: "blue", art: "models", href: "#modelos" },
    { label: "Nova apostila", detail: "Capítulos, atividades e conteúdos", icon: "book", kind: "teal", art: "book", run: () => AV.createAndOpen("apostila") },
    { label: "Avaliações e provas", detail: "Questões, cabeçalho e gabarito", icon: "exam", kind: "pink", art: "exam", run: () => AV.createAndOpen("prova") },
    { label: "Lista de exercícios", detail: "Prepare questões e atividades", icon: "list", kind: "orange", art: "exercises", run: () => AV.createAndOpen("lista") },
    { label: "Estúdio de fontes", detail: "Transforme arquivos em materiais", icon: "studio", kind: "violet", art: "sources", href: "#estudio" },
    { label: "Editor ABNT", detail: "Textos e trabalhos acadêmicos", icon: "doc", kind: "teal", art: "abnt", href: "#abnt" },
    { label: "Ambiente de estudos", detail: "Dicas de escrita e revisão", icon: "book", kind: "pink", art: "study", href: "#estudos" },
    { label: "Biblioteca", detail: "Livros, artigos e conteúdos", icon: "shelf", kind: "blue", art: "library", href: "#acervo" }
  ];
  function card(item) {
    const props = item.href ? { href: item.href } : { type: "button", onclick: item.run };
    const art = AV.HOME_CARD_ART;
    const badge = art && art.badges[item.art];
    return h(item.href ? "a" : "button",
      Object.assign({ class: "home-action home-action-" + item.kind + " home-action-illustrated", "data-card-art": item.art }, props),
      h("span", { class: "home-action-art" },
        art ? art.create(item.art) : AV.appIcon(item.icon, item.kind === "coral" ? "rose" : item.kind)),
      h("span", { class: "home-action-badge" }, badge || "Explorar"),
      h("span", { class: "home-action-copy" },
        h("strong", null, item.label),
        h("small", null, item.detail)),
      h("span", { class: "home-action-cta", "aria-hidden": "true" }, "Explorar", " ↗"));
  }
  function agendaPanel() {
    const list = h("div", { class: "home-task-list" });
    const input = h("input", { class: "in", maxlength: 120, placeholder: "Adicionar lembrete rápido...", "aria-label": "Novo lembrete" });
    const add = () => {
      const title = input.value.trim();
      if (!title) { input.focus(); return; }
      const records = read("teacherAgenda", []);
      if (!Array.isArray(records) || records.length >= 300) { AV.toast("Não foi possível salvar o lembrete. Confira o limite da agenda."); return; }
      const ok = save("teacherAgenda", records.concat({ id: AV.uid(), title, detail: "", date: todayKey(), done: false }));
      if (ok === false) { AV.toast("Espaço de armazenamento insuficiente."); return; }
      input.value = "";
      draw();
    };
    const draw = () => {
      list.textContent = "";
      const records = read("teacherAgenda", []);
      const all = Array.isArray(records) ? records.slice() : [];
      const pending = all.filter(x => x && !x.done).sort((a, b) => String(a.date || "9999").localeCompare(String(b.date || "9999")));
      if (!pending.length) list.append(h("div", { class: "home-empty" }, "Tudo organizado por aqui! Adicione seu próximo lembrete."));
      pending.slice(0, 4).forEach(item => {
        const complete = button("Concluir", () => {
          save("teacherAgenda", read("teacherAgenda", []).map(x => x.id === item.id ? Object.assign({}, x, { done: true }) : x));
          draw();
        }, "home-done");
        list.append(h("div", { class: "home-task" }, h("span", { class: "home-task-dot", "aria-hidden": "true" }), h("span", { class: "home-task-copy" }, h("strong", null, item.title), h("small", null, item.date ? new Date(item.date + "T12:00:00").toLocaleDateString("pt-BR") : "Sem data")), complete));
      });
    };
    input.addEventListener("keydown", ev => { if (ev.key === "Enter") add(); });
    draw();
    return section("Minha agenda", "Lembretes e tarefas importantes",
      h("div", { class: "home-panel-body" }, h("div", { class: "home-quick-add" }, input, button("Adicionar", add, "btn sm pri")), list),
      link("#agenda", "Ver agenda", "home-panel-link"));
  }
  function timetablePanel() {
    const body = h("div", { class: "home-class-list" });
    const day = new Date().getDay();
    const rows = read("teacherSchedule", []);
    const all = Array.isArray(rows) ? rows : [];
    const todays = all.filter(x => x && Number(x.day) === day).sort((a, b) => String(a.start || "").localeCompare(String(b.start || "")));
    if (!todays.length) {
      body.append(h("div", { class: "home-empty" },
        all.length ? "Nenhuma aula registrada para hoje." : "Monte sua grade para visualizar as aulas do dia.",
        link("#horarios", "Organizar horários", "btn sm")));
    } else {
      todays.slice(0, 5).forEach(c => body.append(
        h("div", { class: "home-class-row" },
          h("span", { class: "home-class-time" }, c.start || "—"),
          h("span", { class: "home-class-copy" }, h("strong", null, c.subject || "Aula"), h("small", null, [c.group, c.room].filter(Boolean).join(" · "))))));
    }
    return section("Aulas de hoje", weekNames[day] + " · sua programação", body, link("#horarios", "Ver grade", "home-panel-link"));
  }
  function recentPanel() {
    const body = h("div", { class: "home-recent-list" });
    const refresh = () => {
      body.textContent = "";
      const docs = AV.Store.list().slice(0, 3);
      if (!docs.length) body.append(h("p", { class: "home-empty" }, "Você ainda não criou materiais. Comece pelo primeiro modelo ou pela IA."));
      docs.forEach(doc => body.append(
        h("button", { type: "button", class: "home-recent-row", onclick: () => { AV.LS.set("lastDoc", doc.id); AV.go("editor"); } },
          AV.appIcon("doc", "blue"),
          h("span", null, h("strong", null, doc.meta && doc.meta.title || "Material sem título"), h("small", null, doc.meta && doc.meta.subject || "Abrir no editor")),
          h("span", { "aria-hidden": "true" }, "↗"))));
    };
    refresh();
    return { element: section("Continuar de onde parou", "Seus últimos materiais", body, link("#materiais", "Ver todos", "home-panel-link")), refresh };
  }
  function quotePanel() {
    return h("section", { class: "home-quote-panel" },
      h("span", { class: "home-quote-mark", "aria-hidden": "true" }, "“"),
      h("div", null, h("span", { class: "home-quote-kicker" }, "INSPIRE SUA PRÓXIMA AULA"),
        h("p", null, quote()), h("small", null, "Uma nova mensagem a cada dia")));
  }
  AV.views.inicio = {
    title: "Início",
    render(main) {
      const profile = AV.profile();
      const name = String(profile.name || "").trim().split(/\s+/)[0];
      const p = preferences();
      const now = new Date();
      const container = h("div", { class: "wrap home-dashboard" });
      // Preserve the original teacher-requested hero: exact structure, labels, colors
      // and shortcuts of the previous landing page, with the new dashboard beneath.
      const greeting = () => {
        const hour = now.getHours();
        return hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";
      };
      const guessKind = (text) => {
        const t = String(text || "").toLowerCase();
        return /plano/.test(t) ? "plano" : /prova|avalia/.test(t) ? "prova"
          : /lista|exerc/.test(t) ? "lista" : /projeto/.test(t) ? "projeto"
          : /roteiro/.test(t) ? "roteiro" : /apostila/.test(t) ? "apostila" : "atividade";
      };
      const heroInput = h("input", {
        id: "hero-q", type: "search",
        placeholder: "O que você quer criar? Ex.: atividade sobre frações para o 4º ano",
        "aria-label": "O que você quer criar?",
        onkeydown: e => { if (e.key === "Enter") submitHero(); }
      });
      const submitHero = () => AV.aiCreateDialog({ kind: guessKind(heroInput.value), topic: heroInput.value.trim() });
      const hero = h("section", { class: "hero home-preserved-hero" },
        h("div", null,
          h("div", { class: "eyebrow" }, "AulaViva Studio · PT · EN · ES"),
          h("h1", null, greeting() + (name ? ", " + name : "") + "!"),
          h("p", null, "Crie aulas, atividades, provas, projetos e vídeos animados em minutos, com IA, e exporte para PDF interativo, Word e PowerPoint."),
          h("div", { class: "hero-search" },
            heroInput, h("button", { type: "button", class: "btn pri", onclick: submitHero }, AV.icon("sparkle"), "Criar")),
          h("div", { class: "hero-chips" },
            h("button", { type: "button", onclick: () => AV.aiCreateDialog({ kind: "plano" }) }, "Plano de aula"),
            h("button", { type: "button", onclick: () => AV.go("atividades") }, "Atividade para imprimir"),
            h("button", { type: "button", onclick: () => AV.aiCreateDialog({ kind: "prova" }) }, "Prova"),
            h("button", { type: "button", onclick: () => AV.go("animacao") }, "Vídeo animado"),
            h("button", { type: "button", onclick: () => AV.go("acervo") }, "Livros e artigos"))));
      const header = h("div", { class: "home-topline" },
        h("span", { class: "home-top-label" }, "MEU ESPAÇO DOCENTE"),
        h("span", { class: "home-date" }, dateLabel(now)));
      const heroArea = h("div", { class: "home-hero-area" }, hero);
      if (p.quote) heroArea.append(quotePanel());
      const grid = h("div", { class: "home-main-grid" });
      const large = h("div", { class: "home-main-column" });
      const side = h("div", { class: "home-side-column" });
      large.append(
        h("div", { class: "home-section-heading" }, h("div", null, h("span", null, "FERRAMENTAS"), h("h2", null, "Crie do seu jeito"))),
        h("div", { class: "home-action-grid" }, shortcuts.map(card)));
      if (p.agenda) side.append(agendaPanel());
      side.append(h("section", { class: "home-plan-card" },
        h("div", { class: "home-plan-icon" }, AV.appIcon("calendar", "violet")),
        h("div", { class: "home-plan-copy" }, h("strong", null, "Plano de aula"), h("p", null, "Objetivos, habilidades e atividades em poucos passos.")),
        button("Criar plano", () => AV.aiCreateDialog({ kind: "plano" }), "btn sm pri")));
      if (p.schedule) side.append(timetablePanel());
      if (p.quickStudy) side.append(
        h("section", { class: "home-study-strip" },
          h("div", null, h("strong", null, "Quer escrever melhor?"), h("p", null, "Explore técnicas de redação, revisão e modelos acadêmicos.")),
          h("div", { class: "home-study-links" }, link("#estudos", "Dicas de estudo", "btn sm"), link("#abnt", "Editor ABNT", "btn sm"))));
      grid.append(large);
      if (side.children.length) grid.append(side);
      const recent = recentPanel();
      const preferencesPanel = h("section", { class: "home-panel home-preferences" },
        h("div", { class: "home-panel-head" }, h("div", null, h("h2", null, "Sua tela, suas escolhas"), h("p", null, "Mostre apenas o que você precisa."))),
        h("p", null, "Você pode esconder agenda, horários, mensagens e atalhos de estudo sem perder seus registros."),
        link("#config", "Personalizar tela inicial", "btn sm"));
      const recentArea = h("div", { class: "home-recent-bottom" },
        h("div", { class: "home-section-heading" }, h("div", null, h("span", null, "SEUS MATERIAIS"), h("h2", null, "Retome suas criações quando quiser"))),
        recent.element);
      container.append(heroArea, header, grid, preferencesPanel, recentArea);
      main.append(container);
      return AV.Store.on(recent.refresh);
    }
  };
})(globalThis.AV = globalThis.AV || {});
