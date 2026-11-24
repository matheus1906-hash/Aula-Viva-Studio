(function (AV) {
  "use strict";
  const h = AV.h, V = AV.views;
  const tile = (icon, color, title, text, onclick, href) => h(href ? "a" : "button", { class: "tile", type: href ? null : "button", href: href || null, onclick }, AV.appIcon(icon, color, "ico"), h("h3", null, title), h("p", null, text));
  const head = (t, p, ...right) => h("div", { class: "head" }, h("div", null, h("h1", null, t), p ? h("p", null, p) : null), right.length ? h("div", { class: "row" }, right) : null);
  function hello() { const hr = new Date().getHours(); return hr < 12 ? "Bom dia" : hr < 18 ? "Boa tarde" : "Boa noite"; }
  async function importAny() {
    const [f] = await AV.pickFile(AV.IMPORT_ACCEPT); if (!f) return;
    AV.toast("Lendo " + f.name + "...");
    try {
      const r = await AV.importers.importFile(f);
      if (r.doc) { r.doc.id = AV.uid(); AV.openDoc(r.doc); return; }
      AV.createAndOpen("apostila", r.title || f.name.replace(/\.[^.]+$/, ""), r.blocks);
      if (r.warnings && r.warnings.length) AV.toast(r.warnings[0]);
    } catch (e) { AV.toast((e && e.message) || "Não foi possível ler o arquivo."); }
  }
  AV.importAny = importAny;
  function docItem(d) {
    const k = AV.KINDS[d.meta.kind] || AV.KINDS.branco;
    return h("div", { class: "item" },
      h("span", { class: "badge", style: { background: k[1] }, "aria-hidden": "true" }, k[0].slice(0, 2).toUpperCase()),
      h("a", { href: "#editor", style: { minWidth: 0, textDecoration: "none", color: "inherit" }, onclick: () => AV.LS.set("lastDoc", d.id) }, h("b", null, d.meta.title || "Sem título"), h("span", null, [k[0], d.meta.subject, d.meta.level, "editado em " + AV.fmtDate(d.updated)].filter(Boolean).join(" · "))),
      h("div", { class: "acts" },
        h("button", { class: "btn ghost sm icon", "aria-label": "Exportar " + d.meta.title, title: "Exportar", onclick: () => AV.exportDialog(d) }, AV.icon("download")),
        h("button", { class: "btn ghost sm icon", "aria-label": "WhatsApp", title: "WhatsApp", onclick: () => AV.whatsSheet(d) }, AV.icon("chat")),
        h("button", { class: "btn ghost sm icon", "aria-label": "Duplicar", title: "Duplicar", onclick: () => { const c = AV.clone(d); c.id = AV.uid(); c.meta.title += " (cópia)"; AV.Store.put(c); AV.toast("Cópia criada."); } }, AV.icon("copy")),
        h("button", { class: "btn ghost sm icon danger", "aria-label": "Excluir", title: "Excluir", onclick: async () => { if (await AV.confirm("Excluir material?", "\"" + d.meta.title + "\" será apagado. Isso não pode ser desfeito.", "Excluir")) { AV.Store.remove(d.id); AV.toast("Material excluído."); } } }, AV.icon("trash"))));
  }

  /* ---------- Início ---------- */
  AV.pageHead = (title, desc, icon, grad, ...right) => h("div", { class: "pagehead" }, icon ? AV.appIcon(icon, grad || "blue") : null, h("div", null, h("h1", null, title), desc ? h("p", null, desc) : null), right.length ? h("div", { class: "row" }, right) : null);
  V.inicio = {
    title: "Início",
    render(main) {
      const p = AV.profile();
      const recent = h("div", { class: "list" });
      const nMat = h("b", null, "0");
      const drawRecent = () => { recent.textContent = ""; const all = AV.Store.list(); nMat.textContent = all.length; const l = all.slice(0, 4); if (!l.length) recent.appendChild(h("div", { class: "empty" }, "Você ainda não tem materiais. Comece pela IA, por um modelo ou pela biblioteca.")); l.forEach((d) => recent.appendChild(docItem(d))); };
      drawRecent();
      const q = h("input", { id: "hero-q", type: "search", placeholder: "O que você quer criar? Ex.: atividade sobre frações para o 4º ano", "aria-label": "O que você quer criar?", onkeydown: (e) => { if (e.key === "Enter") go(); } });
      const go = () => AV.aiCreateDialog({ kind: guessKind(q.value), topic: q.value.trim() });
      const guessKind = (t) => { t = t.toLowerCase(); return /plano/.test(t) ? "plano" : /prova|avalia/.test(t) ? "prova" : /lista|exerc/.test(t) ? "lista" : /projeto/.test(t) ? "projeto" : /roteiro/.test(t) ? "roteiro" : /apostila/.test(t) ? "apostila" : "atividade"; };
      const art = document.getElementById("hero-art");
      const nModelos = h("b", null, "70+");
      AV.loadModelos().then((m) => (nModelos.textContent = m.length)).catch(() => {});
      main.appendChild(h("div", { class: "wrap" },
        h("div", { class: "bento" },
        h("section", { class: "hero" },
          h("div", null, h("div", { class: "eyebrow" }, "AulaViva Studio · PT · EN · ES"), h("h1", null, AV.t(hello()) + (p.name ? ", " + p.name.split(" ")[0] : "") + "!"),
            h("p", null, "Crie aulas, atividades, provas, projetos e vídeos animados em minutos, com IA, e exporte para PDF interativo, Word e PowerPoint."),
            h("div", { class: "hero-search" }, q, h("button", { class: "btn pri", onclick: go }, AV.icon("sparkle"), "Criar")),
            h("div", { class: "hero-chips" },
              h("button", { onclick: () => AV.aiCreateDialog({ kind: "plano" }) }, "Plano de aula"),
              h("button", { onclick: () => AV.go("atividades") }, "Atividade para imprimir"),
              h("button", { onclick: () => AV.aiCreateDialog({ kind: "prova" }) }, "Prova"),
              h("button", { onclick: () => AV.go("animacao") }, "Vídeo animado"),
              h("button", { onclick: () => AV.go("acervo") }, "Livros e artigos"))),
          null),
          h("div", { class: "side-cards" },
            h("a", { class: "promo coral", href: "#animacao" }, h("div", { class: "row" }, AV.appIcon("film", "orange"), h("span", { class: "chip", style: { marginLeft: "auto" } }, AV.t("novo"))), h("div", null, h("h3", null, "Vídeos animados"), h("p", null, "Desenhos com personagens, falas, legendas e narração para as crianças.")), h("span", { class: "go" }, "Criar um vídeo →")),
            h("a", { class: "promo sun", href: "#acervo" }, h("div", { class: "row" }, AV.appIcon("shelf", "amber"), h("span", { class: "chip", style: { marginLeft: "auto" } }, AV.t("novo"))), h("div", null, h("h3", null, "Livros reais, grátis"), h("p", null, "Clássicos em domínio público com a capa original, para ler online.")), h("span", { class: "go" }, "Abrir a biblioteca →"))),
        h("div", { class: "stats" },
          h("div", { class: "stat" }, AV.appIcon("folder", "amber"), h("div", null, nMat, h("span", null, "materiais seus"))),
          h("div", { class: "stat" }, AV.appIcon("book", "blue"), h("div", null, nModelos, h("span", null, "modelos prontos"))),
          h("div", { class: "stat" }, AV.appIcon("puzzle", "rose"), h("div", null, h("b", null, String((AV.atividades && AV.atividades.catalog || []).length)), h("span", null, "tipos de atividade"))),
          h("div", { class: "stat" }, AV.appIcon("globe", "teal"), h("div", null, h("b", null, "3"), h("span", null, "idiomas"))))),
        h("div", { class: "sec-t" }, h("div", null, h("small", null, "Criar agora"), h("h2", null, "Comece um material"))),
        h("div", { class: "grid" },
          tile("wand", "pink", "Criar com IA", "Escolha o tipo e o tema: a IA escreve tudo e você ajusta depois.", () => AV.aiCreateDialog()),
          tile("chat", "sky", "Chat livre", "Converse e construa um projeto do zero, do seu jeito.", null, "#chat"),
          tile("studio", "teal", "Estúdio de fontes", "Envie textos e arquivos: resumo, quiz, mapa mental, áudio e projetos.", null, "#estudio"),
          tile("puzzle", "rose", "Atividades prontas", "Caça-palavras, cruzadinha, ligar, contas, sílabas e mais.", null, "#atividades"),
          tile("book", "blue", "Nova apostila", "Capa, sumário, seções, destaques e atividades.", () => AV.createAndOpen("apostila")),
          tile("list", "orange", "Lista de exercícios", "Questões interativas com gabarito automático.", () => AV.createAndOpen("lista")),
          tile("exam", "slate", "Avaliação / Prova", "Cabeçalho do aluno, instruções e versão com gabarito.", () => AV.createAndOpen("prova")),
          tile("route", "green", "Roteiro com QR codes", "Ligue o papel a vídeos, simuladores e formulários.", () => AV.createAndOpen("roteiro")),
          tile("calendar", "violet", "Plano de aula", "Habilidades da BNCC, objetivos, metodologia e avaliação.", () => AV.aiCreateDialog({ kind: "plano" })),
          tile("rocket", "cyan", "Projeto educacional", "Justificativa, objetivos, cronograma e avaliação.", () => AV.aiCreateDialog({ kind: "projeto" })),
          tile("blank", "gray", "Em branco", "Comece do zero e monte do seu jeito.", () => AV.createAndOpen("branco")),
          tile("shelf", "amber", "Biblioteca de conteúdos", "Temas por ano e disciplina, datas comemorativas.", null, "#biblioteca")),
        h("div", { class: "sec-t" }, h("div", null, h("small", null, "Novidades"), h("h2", null, "Mais jeitos de ensinar"))),
        h("div", { class: "news" },
          h("a", { href: "#animacao", style: { background: AV.GRAD.rose } }, AV.appIcon("film", "transparent"), h("h3", null, "Vídeos animados"), h("p", null, "Desenhos com personagens, falas, legendas e narração para as crianças.")),
          h("a", { href: "#acervo", style: { background: AV.GRAD.amber } }, AV.appIcon("shelf", "transparent"), h("h3", null, "Livros e e-books"), h("p", null, "Acervo comentado, busca inteligente, ABNT e bibliotecas digitais.")),
          h("button", { class: "news-btn", onclick: () => AV.aiCreateDialog({ lang: AV.lang() === "pt" ? "en" : AV.lang() }), style: { background: AV.GRAD.teal } }, AV.appIcon("globe", "transparent"), h("h3", null, "Inglês e espanhol"), h("p", null, "Materiais e interface em português, inglês e espanhol."))),
        h("div", { class: "row" },
          h("a", { class: "btn", href: "#ferramentas" }, AV.icon("qr"), "Gerar QR code"),
          h("a", { class: "btn", href: "#ferramentas" }, AV.icon("link"), "Gerar link (WhatsApp, Drive, YouTube...)"),
          h("button", { class: "btn", onclick: importAny }, AV.icon("upload"), "Importar Word, PowerPoint ou PDF"),
          h("button", { class: "btn", onclick: () => AV.createAndOpen("roteiro", "Material com vídeo", [Object.assign(AV.newBlock("heading"), { text: "Assista ao vídeo" }), AV.newBlock("video"), Object.assign(AV.newBlock("open_question"), { prompt: "O que você aprendeu com o vídeo?" })]) }, AV.icon("video"), "Material com vídeo"),
          h("a", { class: "btn", href: "#modelos" }, AV.icon("grid"), "Ver modelos prontos"),
          h("button", { class: "btn wa", onclick: () => AV.whatsSheet(null) }, AV.icon("chat"), "WhatsApp")),
        h("div", { class: "sec-t" }, h("div", null, h("small", null, "Seus materiais"), h("h2", null, "Continuar de onde parou")), h("a", { href: "#materiais" }, "Ver todos")),
        recent,
        AV.teacherHomeWidgets ? AV.teacherHomeWidgets() : null));
      return AV.Store.on(drawRecent);
    }
  };

  /* ---------- Meus materiais ---------- */
  V.materiais = {
    title: "Meus materiais",
    render(main) {
      let q = "", kind = "";
      const list = h("div", { class: "list" });
      const draw = () => {
        list.textContent = "";
        const all = AV.Store.list().filter((d) => (!kind || d.meta.kind === kind) && (!q || (d.meta.title + " " + d.meta.subject + " " + d.meta.level).toLowerCase().includes(q)));
        if (!all.length) list.appendChild(h("div", { class: "empty" }, AV.Store.list().length ? "Nada encontrado com esse filtro." : "Nenhum material ainda."));
        const frag = document.createDocumentFragment(); all.forEach((d) => frag.appendChild(docItem(d))); list.appendChild(frag);
      };
      const chips = h("div", { class: "chips" }, [["", "Todos"]].concat(Object.keys(AV.KINDS).map((k) => [k, AV.KINDS[k][0]])).map(([k, l]) => h("button", { class: "chip", "aria-pressed": k === kind ? "true" : "false", onclick: (e) => { kind = k; chips.querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", b === e.currentTarget)); draw(); } }, l)));
      main.appendChild(h("div", { class: "wrap" },
        AV.pageHead("Meus materiais", "Salvos na sua conta" + (AV.Store.remote ? "" : " e neste navegador") + ". Só você vê.", "folder", "amber",
          h("button", { class: "btn", onclick: importAny }, AV.icon("upload"), "Importar"),
          h("button", { class: "btn pri", onclick: () => AV.aiCreateDialog() }, AV.icon("sparkle"), "Novo com IA")),
        h("input", { class: "in", type: "search", id: "mat-search", placeholder: "Buscar por título, disciplina ou ano", "aria-label": "Buscar materiais", oninput: AV.debounce((e) => { q = e.target.value.toLowerCase().trim(); draw(); }, 150) }),
        chips, list));
      draw();
      return AV.Store.on(draw);
    }
  };

  /* ---------- Modelos ---------- */
  let modelos = null;
  AV.loadModelos = async function () {
    if (modelos) return modelos;
    if (AV.MODELOS_INLINE) { modelos = AV.MODELOS_INLINE; return modelos; }
    const r = await fetch("data/modelos.json"); if (!r.ok) throw new Error("Não foi possível carregar os modelos.");
    modelos = await r.json(); return modelos;
  };
  V.modelos = {
    title: "Modelos",
    render(main) {
      let q = "", kind = "", subj = "", lang = "";
      const grid = h("div", { class: "grid wide" }, h("div", { class: "empty" }, h("span", { class: "spin" }), " Carregando modelos..."));
      const filters = h("div", { class: "row" });
      main.appendChild(h("div", { class: "wrap" }, AV.pageHead("Modelos prontos", "Apostilas, listas, provas, roteiros, atividades e planos de várias disciplinas, em português, inglês e espanhol. Abra, ajuste e exporte.", "book", "blue"),
        h("input", { class: "in", type: "search", id: "mod-search", placeholder: "Buscar modelo", "aria-label": "Buscar modelo", oninput: AV.debounce((e) => { q = e.target.value.toLowerCase(); draw(); }, 150) }), filters, grid));
      let all = [];
      AV.loadModelos().then((m) => {
        all = m;
        const sel = (lbl, opts, set) => h("select", { class: "in", style: { width: "auto" }, "aria-label": lbl, onchange: (e) => { set(e.target.value); draw(); } }, h("option", { value: "" }, lbl), opts.map((o) => h("option", { value: o }, o)));
        filters.append(sel("Todos os tipos", [...new Set(m.map((x) => x.kind))], (v) => (kind = v)), sel("Todas as disciplinas", [...new Set(m.map((x) => x.subject))].sort(), (v) => (subj = v)),
          h("select", { class: "in", style: { width: "auto" }, "aria-label": "Idioma", "data-notr": "", onchange: (e) => { lang = e.target.value; draw(); } }, h("option", { value: "" }, AV.t("Todos os idiomas")), Object.keys(AV.LANGS).map((k) => h("option", { value: k }, AV.LANGS[k][2] + " " + AV.LANGS[k][0]))));
        draw();
      }).catch((e) => { grid.textContent = ""; grid.appendChild(h("div", { class: "empty" }, e.message)); });
      function draw() {
        grid.textContent = "";
        const l = all.filter((x) => (!kind || x.kind === kind) && (!subj || x.subject === subj) && (!lang || String(x.lang || "pt").slice(0, 2) === lang) && (!q || (x.title + x.subject + x.level + x.description).toLowerCase().includes(q)));
        if (!l.length) grid.appendChild(h("div", { class: "empty" }, "Nenhum modelo encontrado."));
        AV.renderChunked(grid, l, (x) => {
          const k = AV.KINDS[AV.kindFrom(x.kind)];
          return (h("article", { class: "tile model-card", style: { cursor: "default" } },
            h("button", { type: "button", class: "model-thumb", "aria-label": "Visualizar modelo: " + x.title, title: "Ampliar prévia de " + x.title, onclick: () => preview(x) },
              h("div", { class: "model-thumb-page", "aria-hidden": "true" }, miniPaper(x)),
              h("span", { class: "model-thumb-caption", "aria-hidden": "true" }, AV.icon("eye"), "Clique para ampliar")),
            h("div", { class: "chips" }, h("span", { class: "chip", style: { background: k[1], color: "#fff", borderColor: "transparent" } }, x.kind), h("span", { class: "chip" }, x.subject), h("span", { class: "chip" }, x.level), x.lang && x.lang !== "pt-BR" && x.lang !== "pt" ? h("span", { class: "lang-badge", "data-notr": "" }, AV.LANGS[String(x.lang).slice(0, 2)] ? AV.LANGS[String(x.lang).slice(0, 2)][2] + " " + String(x.lang).slice(0, 2).toUpperCase() : x.lang) : null),
            h("h3", null, x.title), h("p", null, x.description),
            h("div", { class: "row" }, h("button", { class: "btn sm", onclick: () => preview(x) }, AV.icon("eye"), "Visualizar"), h("button", { class: "btn sm pri", onclick: () => use(x) }, "Usar modelo"))));
        });
      }
      /* Miniatura real e leve: renderiza a capa e uma amostra do próprio documento.
         Evita desenhar todas as páginas, imagens e tabelas dos 70+ modelos na grade. */
      function miniPaper(x) {
        const doc = x.doc || {}, blocks = doc.blocks || [];
        const intro = blocks.slice(0, 8).filter((b) => ["heading", "paragraph", "bullets", "callout", "image", "choice_question", "true_false", "open_question", "fill_blank", "match", "table"].includes(b.type)).slice(0, 4);
        const sample = { meta: doc.meta || { title: x.title }, blocks: intro };
        return AV.renderPaper(sample, "aluno");
      }
      function use(x) { const d = AV.normalize(AV.clone(x.doc)); d.id = AV.uid(); d.meta.kind = AV.kindFrom(x.kind); const p = AV.profile(); d.meta.author = d.meta.author || p.name; d.meta.school = d.meta.school || p.school; AV.openDoc(d); AV.toast("Modelo aberto. Personalize à vontade."); }
      function preview(x) {
        const d = AV.normalize(AV.clone(x.doc)); let v = "aluno";
        const box = h("div", { style: { background: "var(--track)", padding: "12px", borderRadius: "12px" } }, AV.renderPaper(d, v));
        const seg = h("div", { class: "seg" }, ["aluno", "professor"].map((k) => h("button", { type: "button", "aria-pressed": k === v ? "true" : "false", onclick: (e) => { v = k; seg.querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", b === e.currentTarget)); box.textContent = ""; box.appendChild(AV.renderPaper(d, v)); } }, k === "aluno" ? "Aluno" : "Professor")));
        const dl = AV.dialog(x.title, h("div", { style: { display: "grid", gap: "12px" } }, h("div", { class: "row" }, seg, h("span", { class: "spacer" }), h("button", { class: "btn pri", onclick: () => { dl.close(); use(x); } }, "Usar modelo")), box), { large: true });
      }
    }
  };

  /* ---------- Biblioteca de conteúdos ---------- */
  V.biblioteca = {
    title: "Biblioteca",
    render(main) {
      const st = Object.assign({ etapa: "4º ano", disc: "Geografia", tipo: "atividade" }, AV.LS.get("libState", {}));
      const save = () => AV.LS.set("libState", st);
      const out = h("div", { class: "grid wide" });
      const tabs = h("div", { class: "tabs", role: "tablist" });
      const body = h("div", { style: { display: "grid", gap: "16px" } });
      const sections = { temas: "Temas por ano e disciplina", datas: "Datas comemorativas", rapido: "Pedido rápido" };
      let tab = "temas";
      Object.keys(sections).forEach((k) => tabs.appendChild(h("button", { role: "tab", "aria-selected": k === tab ? "true" : "false", onclick: (e) => { tab = k; tabs.querySelectorAll("button").forEach((b) => b.setAttribute("aria-selected", b === e.currentTarget)); draw(); } }, sections[k])));
      main.appendChild(h("div", { class: "wrap" }, AV.pageHead("Biblioteca de conteúdos", "Temas organizados por etapa e componente curricular. Escolha e gere o material pronto, alinhado à BNCC.", "shelf", "orange"), tabs, body));
      const gen = (topic, extra) => {
        const t = AV.LIB.tipos.find((x) => x[0] === st.tipo) || AV.LIB.tipos[0];
        AV.aiCreateDialog({ kind: t[2], topic, subject: st.disc, level: st.etapa, extra: [t[0] === "sequencia" ? "Organize como sequência didática de 4 a 6 aulas, com objetivos e atividades por aula." : "", t[0] === "interpretacao" ? "Inclua um texto original adequado à idade e questões de interpretação (localizar, inferir, opinar)." : "", t[0] === "ludica" ? "Proponha jogo ou atividade lúdica com regras simples, materiais e variações." : "", extra || ""].filter(Boolean).join(" ") });
      };
      function selects() {
        const sel = (lbl, key, opts) => h("label", { class: "f" }, lbl, h("select", { class: "in", "data-key": key, onchange: (e) => { st[key] = e.target.value; save(); draw(); const f = body.querySelector('select[data-key="' + key + '"]'); f && f.focus(); } }, opts.map((o) => Array.isArray(o) ? h("option", { value: o[0], selected: o[0] === st[key] }, o[1]) : h("option", { selected: o === st[key] }, o))));
        return h("div", { class: "form" }, sel("Etapa / ano", "etapa", AV.LIB.etapas), sel("Componente curricular", "disc", Object.keys(AV.LIB.temas)), sel("Tipo de material", "tipo", AV.LIB.tipos.map((t) => [t[0], t[1]])));
      }
      function draw() {
        body.textContent = "";
        if (tab === "temas") {
          const seg = AV.LIB.segmento(st.etapa), temas = (AV.LIB.temas[st.disc] || {})[seg] || [];
          out.textContent = "";
          temas.forEach((t) => out.appendChild(h("article", { class: "tile", style: { cursor: "default" } }, h("h3", null, t), h("p", null, st.disc + " · " + st.etapa),
            h("div", { class: "row" }, h("button", { class: "btn sm pri", onclick: () => gen(t) }, AV.icon("sparkle"), "Gerar"), h("button", { class: "btn sm", onclick: () => { AV.LS.set("studioTopic", t); AV.go("estudio"); } }, "Estudar no Estúdio")))));
          if (!temas.length) out.appendChild(h("div", { class: "empty" }, "Sem temas sugeridos para esta combinação. Use o Pedido rápido."));
          const own = h("input", { class: "in", id: "lib-own", placeholder: "Ou digite outro tema...", value: st.own || "", oninput: (e) => { st.own = e.target.value; } });
          body.append(selects(), out, h("div", { class: "row" }, h("div", { style: { flex: "1 1 260px" } }, own), h("button", { class: "btn pri", onclick: () => own.value.trim() ? gen(own.value.trim()) : own.focus() }, AV.icon("sparkle"), "Gerar com este tema")));
          AV.loadModelos().then((m) => {
            const rel = m.filter((x) => x.subject.includes(st.disc.split(" ")[0]) || st.disc.includes(x.subject.split(" ")[0])).slice(0, 6);
            if (rel.length) body.append(h("h2", null, "Modelos prontos relacionados"), h("div", { class: "grid wide" }, rel.map((x) => h("button", { class: "tile", onclick: () => { const d = AV.normalize(AV.clone(x.doc)); d.id = AV.uid(); d.meta.kind = AV.kindFrom(x.kind); AV.openDoc(d); } }, h("h3", null, x.title), h("p", null, x.kind + " · " + x.level)))));
          }).catch(() => {});
        } else if (tab === "datas") {
          const now = new Date().getMonth() + 1;
          body.append(selects());
          AV.MESES.forEach((mes, i) => {
            const ds = AV.LIB.datas.filter((d) => d[0] === i + 1); if (!ds.length) return;
            body.append(h("h2", null, mes + (i + 1 === now ? " (este mês)" : "")), h("div", { class: "grid wide" }, ds.map((d) => h("article", { class: "tile", style: { cursor: "default" } }, h("span", { class: "chip acc", style: { width: "fit-content" } }, d[1] ? d[1] + "/" + String(d[0]).padStart(2, "0") : "data móvel"), h("h3", null, d[2]), h("p", null, d[3]),
              h("button", { class: "btn sm pri", style: { width: "fit-content" }, onclick: () => gen(d[2] + ": " + d[3]) }, AV.icon("sparkle"), "Gerar material")))));
          });
        } else {
          const ta = h("textarea", { class: "in", id: "lib-quick", rows: 4, placeholder: "Ex.: atividade de interpretação sobre o Cerrado para o 3º ano, com 5 questões e um desenho para colorir descrito", oninput: (e) => { st.quick = e.target.value; } }, st.quick || "");
          body.append(selects(), h("label", { class: "f" }, "Descreva o que você precisa", ta), h("div", { class: "row" }, h("button", { class: "btn pri", onclick: () => ta.value.trim() ? gen(ta.value.trim()) : ta.focus() }, AV.icon("sparkle"), "Gerar"), h("a", { class: "btn", href: "#chat" }, AV.icon("chat"), "Prefiro conversar no chat")));
        }
      }
      draw();
    }
  };

  const ACT_ICON = { wordSearch: ["wordsearch", "rose"], crossword: ["crossword", "violet"], match: ["match", "blue"], fillBlank: ["fill", "sky"], scramble: ["scramble", "orange"], sentenceOrder: ["order", "teal"], mathOps: ["math", "green"], tabuada: ["tabuada", "lime"], syllables: ["syllable", "amber"], alphabetical: ["abc", "pink"], countAndWrite: ["count", "cyan"], trueFalseFromFacts: ["tf", "slate"], quiz: ["quiz", "indigo"] };
  /* ---------- Atividades comuns ---------- */
  V.atividades = {
    title: "Atividades",
    render(main) {
      const cat = (AV.atividades && AV.atividades.catalog) || [];
      const cats = [...new Set(cat.map((c) => c.category))];
      let cur = cat[0], result = null, preset = null;
      const left = h("div", { class: "menu" }), form = h("div", { style: { display: "grid", gap: "12px" } }), pv = h("div", { style: { background: "var(--track)", padding: "12px", borderRadius: "12px" } });
      const into = AV.Store.get(AV.LS.get("insertInto"));
      const presetGallery = h("div", { class: "grid wide" });
      const presetFilter = h("input", { class: "in", type: "search", placeholder: "Buscar entre 50 modelos de atividades..." });
      const presets = AV.ACTIVITY_PRESETS || [];
      const choosePreset = (item) => { const found = cat.find(x => x.id === item.activityId); if (!found) return; cur = found; preset = item.values; drawForm(); document.querySelector(".studio")?.scrollIntoView({ behavior: "smooth" }); };
      const drawPresetGallery = () => { const q = presetFilter.value.toLocaleLowerCase(); presetGallery.textContent = ""; const list = presets.filter(item => (item.name + " " + item.category).toLocaleLowerCase().includes(q)); AV.renderChunked(presetGallery, list, item => h("article", { class: "tile" }, h("span", { class: "chip pri", style: { width: "fit-content" } }, item.category), h("h3", null, item.name), h("p", null, item.description), h("button", { class: "btn sm pri", onclick: () => choosePreset(item) }, "Personalizar atividade"))); };
      presetFilter.addEventListener("input", AV.debounce(drawPresetGallery, 120));
      main.appendChild(h("div", { class: "wrap" }, AV.pageHead("Atividades prontas", "Gere atividades comuns em segundos. Escolha, preencha e confira a prévia.", "puzzle", "rose"),
        into ? h("p", { class: "note info" }, "As atividades serão inseridas em \"" + into.meta.title + "\". ", h("button", { class: "btn sm", onclick: () => { AV.LS.del("insertInto"); AV.go("atividades"); AV.route(); } }, "Criar como novo material")) : null,
        h("div", { class: "studio" }, h("div", { class: "card", style: { padding: "8px" } }, left), h("div", { style: { display: "grid", gap: "14px" } }, h("div", { class: "card" }, form), pv)),
        h("div", { class: "sec-t" }, h("div", null, h("small", null, "Prontos para adaptar"), h("h2", null, "50 modelos de atividades"))), presetFilter, presetGallery));
      drawPresetGallery();
      cats.forEach((c) => { left.appendChild(h("div", { class: "small muted", style: { padding: "8px 10px 2px", fontWeight: 800 } }, c)); cat.filter((x) => x.category === c).forEach((x) => left.appendChild(h("button", { onclick: () => { cur = x; preset = null; drawForm(); } }, AV.appIcon(ACT_ICON[x.id] ? ACT_ICON[x.id][0] : "puzzle", ACT_ICON[x.id] ? ACT_ICON[x.id][1] : "rose"), h("b", null, x.name), h("span", null, x.years || "")))); });
      function toText(v, type) { if (type === "pairs" && Array.isArray(v)) return v.map((p) => p.join(" = ")).join("\n"); if (Array.isArray(v)) return v.join("\n"); return v == null ? "" : v; }
      function drawForm() {
        form.textContent = ""; result = null; pv.textContent = "";
        const vals = {}, inputs = {};
        form.append(h("h2", null, cur.name), h("p", { class: "muted" }, cur.description));
        const grid = h("div", { class: "form", oninput: () => { result = null; }, onchange: () => { result = null; } });
        cur.fields.forEach((f) => {
          const ex = preset && preset[f.key] !== undefined ? preset[f.key] : cur.example && cur.example[f.key] !== undefined ? cur.example[f.key] : f.default;
          let el;
          if (f.type === "textarea" || f.type === "list" || f.type === "pairs") el = h("textarea", { class: "in", rows: 5, placeholder: f.placeholder || "" }, toText(ex, f.type));
          else if (f.type === "select") el = h("select", { class: "in" }, (f.options || []).map((o) => { const v = Array.isArray(o) ? o[0] : (o.value != null ? o.value : o), l = Array.isArray(o) ? o[1] : (o.label || o); return h("option", { value: v, selected: v == ex }, l); }));
          else if (f.type === "checkbox") el = h("input", { type: "checkbox", checked: !!ex });
          else el = h("input", { class: "in", type: f.type === "number" ? "number" : "text", value: ex == null ? "" : ex, placeholder: f.placeholder || "" });
          inputs[f.key] = el;
          grid.appendChild(f.type === "checkbox" ? h("label", { class: "check" }, el, f.label) : h("label", { class: "f" + (f.type === "textarea" || f.type === "list" || f.type === "pairs" ? " full" : "") }, f.label, el));
        });
        const aiTopic = h("input", { class: "in", placeholder: "Tema para a IA preencher (ex.: animais do Cerrado)" });
        const aiBtn = h("button", { class: "btn", onclick: aiFill }, AV.icon("sparkle"), "Preencher com IA");
        form.append(grid, h("div", { class: "row" }, h("div", { style: { flex: "1 1 220px" } }, aiTopic), aiBtn),
          h("div", { class: "row" }, h("button", { class: "btn pri", onclick: gen }, AV.icon("refresh"), "Gerar prévia"), h("button", { class: "btn", onclick: () => finish() }, AV.icon("check"), into ? "Inserir no material" : "Criar material")));
        gen();
        function read() { cur.fields.forEach((f) => { const el = inputs[f.key]; vals[f.key] = f.type === "checkbox" ? el.checked : f.type === "number" ? +el.value : el.value; }); return vals; }
        function gen() {
          try { result = AV.atividades.run(cur.id, read()); } catch (e) { result = []; }
          pv.textContent = "";
          if (!result || !result.length) { pv.appendChild(h("div", { class: "empty" }, "Preencha os campos para gerar a atividade.")); return; }
          const skipped = result.flatMap((b) => b.skipped || []);
          if (skipped.length) pv.appendChild(h("p", { class: "note" }, "Não couberam: " + skipped.join(", ") + ". Aumente a grade ou use menos palavras."));
          pv.appendChild(AV.renderPaper({ meta: Object.assign(AV.newDoc("atividade").meta, { title: AV.t(cur.name), cover: false }), blocks: result }, "aluno"));
        }
        async function aiFill() {
          if (!aiTopic.value.trim()) { aiTopic.focus(); return; }
          AV.busy(aiBtn, true, "Preenchendo...");
          try {
            const spec = cur.fields.filter((f) => ["text", "textarea", "list", "pairs"].includes(f.type)).map((f) => '"' + f.key + '": ' + (f.type === "list" ? "[strings]" : f.type === "pairs" ? "[[esquerda, direita]]" : "string") + " // " + f.label + (f.placeholder ? " ex.: " + String(f.placeholder).replace(/\n/g, " / ") : "")).join("\n");
            const out = await AV.AI.json("Preencha os campos da atividade \"" + cur.name + "\" (" + cur.description + ") sobre o tema: " + aiTopic.value.trim() + ". Público: " + (cur.years || "anos iniciais") + ". Palavras sem espaços para jogos de letras.\nCampos:\n{" + spec + "}", { tier: "quick" });
            cur.fields.forEach((f) => { if (out && out[f.key] != null && inputs[f.key]) inputs[f.key].value = toText(out[f.key], f.type); });
            gen();
          } catch (e) { AV.toast(AV.AI.explain(e)); }
          AV.busy(aiBtn, false);
        }
        function finish() {
          if (!result || !result.length) gen();
          if (!result || !result.length) return;
          const target = AV.Store.get(AV.LS.get("insertInto"));
          if (target) { const d = AV.clone(target); d.blocks.push(...AV.clone(result)); AV.LS.del("insertInto"); AV.openDoc(d); AV.toast("Atividade inserida no final do material."); }
          else AV.createAndOpen("atividade", AV.t(cur.name), AV.clone(result));
        }
      }
      if (cur) drawForm(); else form.appendChild(h("div", { class: "empty" }, "Atividades indisponíveis."));
    }
  };

  /* ---------- Ferramentas: QR code e links ---------- */
  V.ferramentas = {
    title: "QR code e links",
    render(main) {
      const tabs = h("div", { class: "tabs", role: "tablist" }), body = h("div");
      let tab = "qr";
      [["qr", "Gerador de QR code"], ["link", "Gerador de links"]].forEach(([k, l]) => tabs.appendChild(h("button", { role: "tab", "aria-selected": k === tab ? "true" : "false", onclick: (e) => { tab = k; tabs.querySelectorAll("button").forEach((b) => b.setAttribute("aria-selected", b === e.currentTarget)); draw(); } }, l)));
      main.appendChild(h("div", { class: "wrap" }, AV.pageHead("QR code e links", "Leve os alunos do papel para vídeos, formulários e sites.", "route", "green"), tabs, body));
      const draw = () => { body.textContent = ""; body.appendChild(tab === "qr" ? qrTool() : linkTool((u) => { tab = "qr"; tabs.querySelectorAll("button").forEach((b, i) => b.setAttribute("aria-selected", i === 0)); draw(); setUrl(u); })); };
      let setUrl = () => {};
      draw();
      function qrTool() {
        const st = { mode: "url", url: "", ssid: "", pass: "", sec: "WPA", fg: "#111827", bg: "#FFFFFF", logo: null, cap: "" };
        const cv = h("canvas", { width: 600, height: 600, "aria-label": "QR code gerado", role: "img" });
        const err = h("p", { class: "small", style: { color: "var(--bad)" }, "aria-live": "polite" });
        const url = h("input", { class: "in", id: "qr-url", placeholder: "https://... ou texto", oninput: (e) => { st.url = e.target.value; render(); } });
        setUrl = (u) => { url.value = u; st.url = u; render(); };
        const wifi = h("div", { class: "form", hidden: true },
          h("label", { class: "f" }, "Nome da rede (SSID)", h("input", { class: "in", oninput: (e) => { st.ssid = e.target.value; render(); } })),
          h("label", { class: "f" }, "Senha", h("input", { class: "in", oninput: (e) => { st.pass = e.target.value; render(); } })),
          h("label", { class: "f" }, "Segurança", h("select", { class: "in", onchange: (e) => { st.sec = e.target.value; render(); } }, h("option", null, "WPA"), h("option", null, "WEP"), h("option", { value: "nopass" }, "Sem senha"))));
        const mode = h("div", { class: "seg" }, [["url", "Link ou texto"], ["wifi", "Wi-Fi"]].map(([k, l]) => h("button", { type: "button", "aria-pressed": k === st.mode ? "true" : "false", onclick: (e) => { st.mode = k; mode.querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", b === e.currentTarget)); wifi.hidden = k !== "wifi"; url.parentElement.hidden = k === "wifi"; render(); } }, l)));
        const payload = () => st.mode === "wifi" ? "WIFI:T:" + st.sec + ";S:" + st.ssid.replace(/([\\;,:"])/g, "\\$1") + ";P:" + st.pass.replace(/([\\;,:"])/g, "\\$1") + ";;" : st.url.trim();
        function render() {
          const g = cv.getContext("2d"), p = payload(); err.textContent = "";
          if (!p || (st.mode === "wifi" && !st.ssid)) { g.fillStyle = "#F1F5F9"; g.fillRect(0, 0, 600, 600); g.fillStyle = "#64748B"; g.font = "bold 28px sans-serif"; g.textAlign = "center"; g.fillText("A prévia aparece aqui", 300, 310); return; }
          try {
            const mx = AV.qr.matrix(p, st.logo ? "H" : "M"); if (!mx || !mx.length) throw new Error("long");
            AV.drawQR(cv, mx, st.fg, st.bg, 4);
            if (st.logo) { const s = 130; g.fillStyle = st.bg; g.fillRect(300 - s / 2 - 8, 300 - s / 2 - 8, s + 16, s + 16); g.drawImage(st.logo, 300 - s / 2, 300 - s / 2, s, s); }
          } catch (e) { g.fillStyle = "#F1F5F9"; g.fillRect(0, 0, 600, 600); err.textContent = AV.t(st.logo ? "Texto longo demais para um QR code com logo (máx. cerca de 120 caracteres). Remova o logo ou encurte o link." : "Texto longo demais para um QR code (máx. cerca de 210 caracteres). Encurte o link."); }
        }
        const svg = () => {
          const m = AV.qr.matrix(payload(), "M"), n = m.length + 8; let d = "";
          m.forEach((r, y) => r.forEach((v, x) => { if (v) d += "M" + (x + 4) + " " + (y + 4) + "h1v1h-1z"; }));
          return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + n + " " + n + '" shape-rendering="crispEdges"><rect width="100%" height="100%" fill="' + st.bg + '"/><path d="' + d + '" fill="' + st.fg + '"/></svg>';
        };
        const ready = () => { if (!payload() || (st.mode === "wifi" && !st.ssid)) { AV.toast("Informe o link, o texto ou o nome da rede primeiro."); return false; } if (err.textContent) { AV.toast(err.textContent); return false; } return true; };
        const box = h("div", { class: "studio", style: { marginTop: "16px" } },
          h("div", { class: "card", style: { display: "grid", gap: "12px" } }, mode, h("label", { class: "f" }, "Conteúdo", url), wifi,
            h("div", { class: "form" }, h("label", { class: "f" }, "Cor", h("input", { class: "in", type: "color", value: st.fg, oninput: (e) => { st.fg = e.target.value; render(); } })), h("label", { class: "f" }, "Fundo", h("input", { class: "in", type: "color", value: st.bg, oninput: (e) => { st.bg = e.target.value; render(); } }))),
            h("div", { class: "row" }, h("button", { class: "btn sm", onclick: async () => { const [f] = await AV.pickFile("image/*"); if (!f) return; try { const im = new Image(); im.onload = () => { st.logo = im; render(); }; im.src = await AV.readImage(f, 300); } catch (e) { AV.toast(e.message); } } }, AV.icon("image"), "Logo da escola"), h("button", { class: "btn sm ghost", onclick: () => { st.logo = null; render(); } }, "Remover logo")),
            h("label", { class: "f" }, "Legenda (ao inserir no material)", h("input", { class: "in", placeholder: "Aponte a câmera do celular", oninput: (e) => (st.cap = e.target.value) })), err),
          h("div", { style: { display: "grid", gap: "12px" } }, h("div", { class: "qr-out" }, cv),
            h("div", { class: "row" },
              h("button", { class: "btn", onclick: () => ready() && cv.toBlob((b) => AV.saveFile("qrcode.png", b), "image/png") }, AV.icon("download"), "PNG"),
              h("button", { class: "btn", onclick: () => ready() && AV.saveFile("qrcode.svg", svg()) }, AV.icon("download"), "SVG"),
              h("button", { class: "btn", onclick: () => ready() && AV.copy(payload()) }, AV.icon("copy"), "Copiar conteúdo"),
              h("button", { class: "btn pri", onclick: () => { if (!ready()) return; const b = Object.assign(AV.newBlock("qrcode"), { url: payload(), caption: st.cap || "Aponte a câmera do celular" }); pickDoc((d) => { d.blocks.push(b); AV.openDoc(d); }); } }, AV.icon("plus"), "Inserir em um material"))));
        render(); return box;
      }
      function linkTool(toQR) {
        const types = {
          clean: ["Limpar link", "Remove rastreadores (utm, fbclid...).", [["url", "Link"]]],
          whatsapp: ["WhatsApp com mensagem pronta", "Abre a conversa com o texto escrito.", [["phone", "Telefone (opcional, com DDD)"], ["msg", "Mensagem", true]]],
          email: ["E-mail com assunto e texto", "Abre o e-mail já preenchido.", [["to", "Para"], ["subject", "Assunto"], ["body", "Texto", true]]],
          youtube: ["YouTube começando em um minuto", "O vídeo abre no ponto certo.", [["url", "Link do vídeo"], ["t", "Começar em (ex.: 2:30)"]]],
          drive: ["Google Drive: ver ou baixar", "Link de visualização ou download direto.", [["url", "Link do arquivo"], ["mode", "Modo", ["view:Visualizar", "download:Baixar direto"]]]],
          gdocs: ["Google Docs: cópia ou PDF", "Cada aluno recebe uma cópia, ou baixa em PDF.", [["url", "Link do Docs, Planilhas ou Apresentações"], ["mode", "Modo", ["copy:Fazer uma cópia", "pdf:Baixar PDF", "docx:Baixar Office", "preview:Somente visualizar"]]]],
          maps: ["Google Maps", "Local da atividade ou excursão.", [["q", "Endereço ou nome do local"]]]
        };
        let type = "whatsapp";
        const out = h("input", { class: "in", readonly: true, id: "link-out", "aria-label": "Link gerado" }), err = h("p", { class: "small", style: { color: "var(--bad)" }, "aria-live": "polite" });
        const fields = h("div", { class: "form" }), vals = {};
        const pick = h("div", { class: "menu" }, Object.keys(types).map((k) => h("button", { onclick: () => { type = k; drawF(); } }, AV.icon("link"), h("b", null, types[k][0]), h("span", null, types[k][1]))));
        function drawF() {
          fields.textContent = ""; out.value = ""; err.textContent = "";
          fields.appendChild(h("h3", { class: "full" }, types[type][0]));
          types[type][2].forEach(([k, l, x]) => { vals[k] = Array.isArray(x) ? x[0].split(":")[0] : ""; fields.appendChild(h("label", { class: "f" + (x === true ? " full" : "") }, l, Array.isArray(x) ? h("select", { class: "in", onchange: (e) => { vals[k] = e.target.value; make(); } }, x.map((o) => h("option", { value: o.split(":")[0] }, o.split(":")[1]))) : h(x === true ? "textarea" : "input", { class: "in", oninput: (e) => { vals[k] = e.target.value; make(); } }))); });
        }
        function make() {
          err.textContent = ""; out.value = "";
          try { out.value = AV.links[type](vals); } catch (e) { err.textContent = e.message; }
        }
        drawF();
        return h("div", { class: "studio", style: { marginTop: "16px" } }, h("div", { class: "card", style: { padding: "8px" } }, pick),
          h("div", { class: "card", style: { display: "grid", gap: "12px", alignContent: "start" } }, fields, h("label", { class: "f" }, "Link gerado", out), err,
            h("div", { class: "row" }, h("button", { class: "btn", onclick: () => out.value ? AV.copy(out.value) : make() }, AV.icon("copy"), "Copiar"),
              h("button", { class: "btn", onclick: () => out.value && toQR(out.value) }, AV.icon("qr"), "Gerar QR code"),
              h("button", { class: "btn pri", onclick: () => { if (!out.value) return; const b = Object.assign(AV.newBlock("link"), { label: types[type][0], url: out.value }); pickDoc((d) => { d.blocks.push(b); AV.openDoc(d); }); } }, AV.icon("plus"), "Inserir em um material"))));
      }
    }
  };
  /* escolher material de destino */
  function pickDoc(fn) {
    const l = AV.Store.list();
    const d = AV.dialog("Inserir em qual material?", h("div", { class: "menu" },
      h("button", { onclick: () => { d.close(); fn(AV.newDoc("roteiro", "Roteiro com QR codes")); } }, AV.icon("plus"), h("b", null, "Novo material"), h("span", null, "Cria um roteiro novo")),
      h("div", { class: "menu", style: { maxHeight: "50vh", overflowY: "auto" } }, l.map((x) => h("button", { onclick: () => { d.close(); fn(AV.clone(x)); } }, AV.icon("doc"), h("b", null, x.meta.title), h("span", null, AV.fmtDate(x.updated)))))));
  }
  AV.pickDoc = pickDoc;

  /* links (porta do linktools.py) */
  const TRACK = /^(utm_\w+|fbclid|gclid|dclid|msclkid|igshid|mc_eid|mc_cid|si|ref_src|_hsenc|_hsmi|yclid)$/i;
  const need = (u) => { const s = AV.safeUrl(u); if (!s) throw new Error("Link inválido. Use um endereço que comece com https://"); return new URL(s); };
  AV.links = {
    clean: (v) => { const u = need(v.url); [...u.searchParams.keys()].forEach((k) => TRACK.test(k) && u.searchParams.delete(k)); return u.href; },
    whatsapp: (v) => { const d = String(v.phone || "").replace(/\D/g, ""); if (d && ![10, 11].includes(d.length) && (d.length < 12 || d.length > 15)) throw new Error("Telefone inválido. Use DDD + número."); if (!d && !String(v.msg || "").trim()) throw new Error("Informe a mensagem ou o telefone."); return AV.waLink(String(v.msg || "").trim(), d); },
    email: (v) => { const to = String(v.to || "").trim(); if (to && !to.split(",").every((x) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(x.trim()))) throw new Error("E-mail do destinatário inválido."); const q = [["subject", v.subject], ["body", v.body]].filter((x) => x[1] && x[1].trim()).map((x) => x[0] + "=" + encodeURIComponent(x[1].trim())); return "mailto:" + to + (q.length ? "?" + q.join("&") : ""); },
    youtube: (v) => {
      const u = need(v.url), host = u.hostname.toLowerCase(); let id = "";
      if (host.endsWith("youtu.be")) id = u.pathname.split("/")[1] || ""; else if (host.includes("youtube")) { id = u.searchParams.get("v") || ((u.pathname.match(/^\/(?:shorts|embed|live)\/([\w-]{6,})/) || [])[1] || ""); }
      if (!/^[\w-]{6,20}$/.test(id)) throw new Error("Não reconheci um vídeo do YouTube nesse link.");
      let s = 0; const nums = (String(v.t || "").match(/\d+/g) || []).slice(-3).map(Number); nums.forEach((n) => (s = s * 60 + n));
      return "https://www.youtube.com/watch?v=" + id + (s ? "&t=" + s + "s" : "");
    },
    drive: (v) => { const u = need(v.url); const id = (u.pathname.match(/\/d\/([\w-]{10,})/) || [])[1] || u.searchParams.get("id") || ""; if (!/^[\w-]{10,}$/.test(id)) throw new Error("Não reconheci um arquivo do Google Drive nesse link."); return v.mode === "download" ? "https://drive.google.com/uc?export=download&id=" + id : "https://drive.google.com/file/d/" + id + "/view"; },
    gdocs: (v) => {
      const u = need(v.url), m = u.pathname.match(/^\/(document|spreadsheets|presentation|forms)\/d\/([\w-]{10,})/);
      if (!m || !u.hostname.endsWith("docs.google.com")) throw new Error("Use um link do Google Docs, Planilhas, Apresentações ou Formulários.");
      const base = "https://docs.google.com/" + m[1] + "/d/" + m[2];
      if (m[1] === "forms") return base + "/viewform";
      if (v.mode === "copy") return base + "/copy";
      if (v.mode === "pdf") return base + "/export?format=pdf";
      if (v.mode === "docx") return base + "/export?format=" + (m[1] === "spreadsheets" ? "xlsx" : m[1] === "presentation" ? "pptx" : "docx");
      return base + "/preview";
    },
    maps: (v) => { const q = String(v.q || "").trim(); if (q.length < 3) throw new Error("Informe o endereço ou o nome do local."); return "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(q.slice(0, 300)); }
  };

  /* ---------- Configurações ---------- */
  V.config = {
    title: "Configurações",
    render(main) {
      setTimeout(() => { if (AV.LS.get("cfgJump")) { AV.LS.del("cfgJump"); const el = document.getElementById("cfg-ia"); el && el.scrollIntoView({ block: "start" }); } }, 50);
      const p = AV.profile();
      const f = (k, l, ph, type) => h("label", { class: "f" }, l, h("input", { class: "in", id: "cfg-" + k, type: type || "text", value: p[k] || "", placeholder: ph || "", onchange: (e) => { AV.setProfile({ [k]: e.target.value.trim() }); AV.toast("Salvo."); } }));
      const theme = h("div", { class: "seg", role: "group", "aria-label": "Tema" }, [["system", "Automático"], ["light", "Caderno (claro)"], ["dark", "Lousa (escuro)"]].map(([k, l]) => h("button", { type: "button", "aria-pressed": k === p.theme ? "true" : "false", onclick: (e) => { AV.setProfile({ theme: k }); theme.querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", b === e.currentTarget)); } }, l)));
      main.appendChild(h("div", { class: "wrap", style: { maxWidth: "1000px" } }, AV.pageHead("Configurações", "Perfil, idioma, aparência, inteligência artificial e seus dados.", "cap", "slate"),
        h("section", { class: "card", style: { display: "grid", gap: "12px" } }, h("h2", null, "Seu perfil"), h("p", { class: "muted small" }, "Usado na capa e no cabeçalho dos materiais."),
          h("div", { class: "form" }, f("name", "Seu nome", "Profa. Ana Souza"), f("school", "Escola", "E.M. Rio Verde"), f("subject", "Componente principal", "Geografia"), f("phone", "WhatsApp para envio rápido (opcional)", "64 99999-9999", "tel"))),
        h("section", { class: "card", style: { display: "grid", gap: "12px" } }, h("h2", null, "Idioma e aparência"),
          h("div", { class: "seg", role: "group", "aria-label": "Idioma", "data-notr": "" }, Object.keys(AV.LANGS).map((k) => h("button", { type: "button", "aria-pressed": k === AV.lang() ? "true" : "false", onclick: () => AV.setLang(k) }, AV.LANGS[k][2] + " " + AV.LANGS[k][0]))),
          h("p", { class: "muted small" }, "O idioma muda a interface e é o idioma padrão dos novos materiais. Cada material pode ter o seu idioma."), theme),
        h("section", { class: "card", id: "cfg-ia", style: { display: "grid", gap: "12px" } }, h("h2", null, "Inteligência artificial"), AV.aiSettingsPanel()),
        AV.homeWidgetSettings ? AV.homeWidgetSettings() : null,
        AV.securityPanel ? AV.securityPanel() : null,
        h("section", { class: "card", style: { display: "grid", gap: "12px" } }, h("h2", null, "Seus dados (LGPD)"),
          h("p", { class: "muted small" }, "Seus materiais e sua agenda ficam protegidos no cofre local enquanto a migração da conta está em andamento. Atenção: o backup JSON exportado não é criptografado; guarde-o em local seguro."),
          h("div", { class: "row" },
            h("button", { class: "btn", onclick: () => AV.saveFile("aulaviva-backup.json", JSON.stringify({ app: "AulaViva Studio", exported: new Date().toISOString(), profile: AV.profile(), materiais: AV.Store.list(), agenda: AV.LS.get("teacherAgenda", []), horarios: AV.LS.get("teacherSchedule", []), editorABNT: AV.LS.get("abntEditor", {}), preferenciasInicio: AV.LS.get("homeWidgets", {}) })) }, AV.icon("download"), "Exportar todos os dados"),
            h("button", { class: "btn", onclick: async () => { const [fl] = await AV.pickFile(".json"); if (!fl) return; try { const j = JSON.parse(await fl.text()); const arr = Array.isArray(j.materiais) ? j.materiais : [j]; let n = 0, skip = 0; arr.forEach((d) => { if (!d || !Array.isArray(d.blocks) || !d.meta) { skip++; return; } const cur = AV.Store.get(d.id); if (cur && (cur.updated || 0) > (d.updated || 0)) { skip++; return; } AV.Store.put(AV.normalize(d)); n++; }); if (j.profile && typeof j.profile === "object") AV.setProfile(j.profile); if (Array.isArray(j.agenda)) AV.LS.set("teacherAgenda", j.agenda.filter(x => x && typeof x.title === "string" && x.title.length <= 120 && typeof x.id === "string").slice(0, 300)); if (Array.isArray(j.horarios)) AV.LS.set("teacherSchedule", j.horarios.filter(x => x && typeof x.subject === "string" && typeof x.group === "string" && typeof x.id === "string").slice(0, 150)); if (j.editorABNT && typeof j.editorABNT === "object" && !Array.isArray(j.editorABNT)) AV.LS.set("abntEditor", { title: String(j.editorABNT.title || "").slice(0, 180), author: String(j.editorABNT.author || "").slice(0, 180), institution: String(j.editorABNT.institution || "").slice(0, 180), font: j.editorABNT.font === "Arial" ? "Arial" : "Times New Roman", text: String(j.editorABNT.text || "").slice(0, 300000) }); if (j.preferenciasInicio && typeof j.preferenciasInicio === "object") { const o = {}; ["agenda", "schedule", "quote", "quickStudy"].forEach(k => { if (typeof j.preferenciasInicio[k] === "boolean") o[k] = j.preferenciasInicio[k]; }); AV.LS.set("homeWidgets", o); } AV.toast(n + " " + AV.t("materiais restaurados") + (skip ? " · " + skip + " " + AV.t("ignorados (inválidos ou mais antigos)") : "") + "."); } catch (e) { AV.toast("Arquivo de backup inválido."); } } }, AV.icon("upload"), "Restaurar backup"),
            h("button", { class: "btn danger", onclick: async () => { if (await AV.confirm("Apagar todos os dados?", "Todos os materiais, fontes e conversas serão apagados da sua conta e deste navegador.", "Apagar tudo")) { await AV.Store.wipe(); AV.toast("Dados apagados."); } } }, AV.icon("trash"), "Apagar todos os dados"))),
        h("section", { class: "card", style: { display: "grid", gap: "8px" } }, h("h2", null, "Segurança"),
          h("ul", { class: "muted", style: { margin: 0, paddingLeft: "18px" } },
            h("li", null, "Sem anúncios e sem rastreadores."), h("li", null, "Arquivos importados são lidos no seu aparelho; macros são bloqueadas."),
            h("li", null, "Links aceitos só com https, e-mail ou telefone."), h("li", null, "PDF pode ser protegido com senha do professor."))),
        h("p", { class: "muted small" }, "AulaViva Studio Web · versão 1.0")));
    }
  };
})(globalThis.AV = globalThis.AV || {});
