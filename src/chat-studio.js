(function (AV) {
  "use strict";
  const h = AV.h, V = AV.views;
  const ROLE = "Você é o assistente do AulaViva Studio, especialista em educação básica brasileira (BNCC, DC-GO, metodologias ativas, avaliação, inclusão). Ajude o professor a planejar e criar projetos e materiais do zero. Faça no máximo uma ou duas perguntas por vez quando faltar informação; quando tiver o suficiente, entregue o conteúdo completo e organizado com títulos (#), listas (-) e **negrito**. Responda no idioma em que o professor escrever.";
  function textToDoc(text, kind, title) {
    const r = AV.importers && AV.importers.textToBlocks ? AV.importers.textToBlocks(String(text).replace(/^#+\s*/gm, ""), { title }) : { blocks: [{ type: "paragraph", text }] };
    AV.createAndOpen(kind || "apostila", title || r.title || "Material", r.blocks);
  }

  /* ---------- Chat livre ---------- */
  V.chat = {
    title: "Chat livre",
    render(main) {
      let msgs = AV.LS.get("chat", []); let ctrl = null;
      const box = h("div", { class: "msgs", "aria-live": "polite" });
      const ta = h("textarea", { class: "in", id: "chat-in", rows: 2, placeholder: "Ex.: Quero criar um projeto sobre o Cerrado para o 4º ano, com 6 aulas e uma feira de ciências no final", onkeydown: (e) => { if (e.key === "Enter" && !e.shiftKey && innerWidth > 860) { e.preventDefault(); send(); } } });
      const sendBtn = h("button", { class: "btn pri", onclick: send, "aria-label": "Enviar" }, AV.icon("send"));
      const mic = h("button", { class: "btn icon", hidden: true, "aria-label": "Ditar", title: "Ditar", onclick: dictate }, AV.icon("mic"));
      const ideas = ["Monte um projeto interdisciplinar sobre água para o 5º ano", "Crie uma sequência didática de 6 aulas sobre frações", "Preciso de uma avaliação diagnóstica de leitura para o 2º ano", "Sugira uma aula prática sobre migrações em Rio Verde", "Adapte uma atividade de matemática para aluno com TEA"];
      main.appendChild(h("div", { class: "wrap", style: { maxWidth: "900px" } },
        h("div", { class: "head" }, h("div", null, h("h1", null, "Chat livre"), h("p", null, "Converse para criar um projeto do zero. Quando gostar do resultado, transforme em material.")),
          h("div", { class: "row" }, h("button", { class: "btn", onclick: toDoc }, AV.icon("doc"), "Transformar em material"), h("button", { class: "btn ghost", onclick: async () => { if (msgs.length && !(await AV.confirm("Nova conversa?", "A conversa atual será apagada.", "Começar de novo"))) return; if (ctrl) ctrl.abort(); msgs = []; AV.LS.set("chat", msgs); draw(); } }, AV.icon("trash"), "Nova conversa"))),
        h("div", { class: "chat" }, box, h("div", { class: "composer" }, ta, h("div", { class: "row" }, mic, sendBtn)))));
      AV.cap.dictation.then((d) => { if (d) mic.hidden = false; });
      draw();
      function draw() {
        box.textContent = "";
        if (!msgs.length) box.appendChild(h("div", { style: { display: "grid", gap: "10px" } }, h("p", { class: "muted" }, "Sugestões para começar:"), h("div", { class: "chips" }, ideas.map((i) => h("button", { class: "chip", onclick: () => { ta.value = i; send(); } }, i)))));
        msgs.forEach((m, i) => box.appendChild(bubble(m, i)));
        box.scrollTop = box.scrollHeight;
      }
      function bubble(m, i) {
        if (m.role === "user") return h("div", { class: "msg u" }, m.content);
        const el = h("div", { class: "msg a" }, AV.richText(m.content));
        if (m.content && i === msgs.length - 1 && !ctrl || m.content && i < msgs.length - 1) el.appendChild(h("div", { class: "acts" },
          h("button", { class: "btn sm", onclick: () => AV.copy(m.content) }, AV.icon("copy"), "Copiar"),
          h("button", { class: "btn sm", onclick: () => textToDoc(m.content, "apostila", firstLine(m.content)) }, AV.icon("doc"), "Virar material"),
          h("button", { class: "btn sm wa", onclick: () => AV.openWhatsApp(m.content.replace(/^#+\s*/gm, "*").slice(0, 3000)) }, AV.icon("chat"), "WhatsApp")));
        return el;
      }
      function firstLine(t) { return (String(t).split("\n").find((l) => l.trim()) || "Material").replace(/^#+\s*|\*\*/g, "").slice(0, 80); }
      async function send() {
        const t = ta.value.trim(); if (!t || ctrl) return;
        msgs.push({ role: "user", content: t }); ta.value = ""; msgs.push({ role: "assistant", content: "" }); draw();
        const live = box.lastChild; live.textContent = "Pensando...";
        const mine = msgs, my = (ctrl = new AbortController()); sendBtn.disabled = true;
        try {
          const hist = msgs.slice(0, -1).slice(-16).map((m, i) => ({ role: m.role, content: i === 0 && m.role === "user" ? ROLE + "\n\n" + m.content : m.content }));
          if (hist[0] && hist[0].role !== "user") hist.shift();
          if (hist[0] && !hist[0].content.startsWith(ROLE)) hist[0] = { role: "user", content: ROLE + "\n\n" + hist[0].content };
          let last = 0;
          const out = await AV.AI.text(hist, { signal: my.signal, onText: (u) => { const now = performance.now(); if (now - last > 120) { last = now; live.textContent = u.text; box.scrollTop = box.scrollHeight; } } });
          if (mine[mine.length - 1]) mine[mine.length - 1].content = out;
        } catch (e) { if (e && e.name === "AbortError") { mine.pop(); } else if (mine[mine.length - 1]) mine[mine.length - 1].content = AV.AI.explain(e); }
        finally { if (ctrl === my) ctrl = null; sendBtn.disabled = false; }
        if (mine === msgs && box.isConnected) { AV.LS.set("chat", msgs.slice(-40)); draw(); ta.focus(); }
      }
      async function toDoc() {
        if (!msgs.length) { AV.toast("Converse primeiro para ter conteúdo."); return; }
        const conv = msgs.map((m) => (m.role === "user" ? "PROFESSOR: " : "ASSISTENTE: ") + m.content).join("\n\n").slice(-30000);
        AV.liveCreate({ kind: "projeto", topic: "o projeto/material construído nesta conversa", extra: "Transforme fielmente o resultado final da conversa em material (escolha o tipo adequado no título). Conversa:\n" + conv });
      }
      let dictOn = false, dictBound = false;
      async function dictate() {
        const d = await AV.cap.dictation; if (!d) return;
        if (dictOn) { dictOn = false; mic.setAttribute("aria-pressed", "false"); try { await d.stop(); } catch (e) {} return; }
        if (!dictBound) { dictBound = true; d.onFinal(({ text }) => { ta.value += (ta.value ? " " : "") + text; }); }
        dictOn = true; mic.setAttribute("aria-pressed", "true");
        d.start().catch(() => { dictOn = false; mic.setAttribute("aria-pressed", "false"); });
        AV.toast("Fale agora. Toque de novo para parar.");
      }
      return () => { if (ctrl) ctrl.abort(); if (dictOn) AV.cap.dictation.then((d) => d && d.stop()); };
    }
  };

  /* ---------- Estúdio de fontes ---------- */
  const OUTS = [
    ["resumo", "Resumo", "Pontos principais com citações das fontes", "text"],
    ["guia", "Guia de estudo", "Conceitos-chave, perguntas e respostas para revisar", "text"],
    ["faq", "Perguntas frequentes", "As dúvidas mais comuns, respondidas", "text"],
    ["linha", "Linha do tempo", "Fatos em ordem cronológica", "text"],
    ["glossario", "Glossário", "Termos difíceis explicados com palavras simples", "text"],
    ["mapa", "Mapa mental", "Ideias organizadas em ramos", "mind"],
    ["quiz", "Quiz interativo", "Teste rápido com correção na hora", "quiz"],
    ["cards", "Flashcards", "Cartões para memorizar: toque para virar", "cards"],
    ["audio", "Resumo em áudio", "Dois apresentadores conversam sobre as fontes", "audio"],
    ["plano", "Plano de aula", "Com habilidades da BNCC, metodologia e avaliação", "doc"],
    ["sequencia", "Sequência didática", "De 4 a 6 aulas, passo a passo", "doc"],
    ["projeto", "Projeto educacional", "Estrutura profissional: justificativa, objetivos, cronograma, avaliação, referências", "doc"],
    ["material", "Apostila ou lista", "Material completo para os alunos", "create"]
  ];
  const OUT_ICON = { resumo: ["summary", "amber"], guia: ["cap", "indigo"], faq: ["faq", "sky"], linha: ["timeline", "teal"], glossario: ["glossary", "violet"], mapa: ["mind", "pink"], quiz: ["quiz", "green"], cards: ["cards", "orange"], audio: ["headphones", "red"], plano: ["calendar", "violet"], sequencia: ["steps", "cyan"], projeto: ["rocket", "blue"], material: ["book", "slate"] };
  V.estudio = {
    title: "Estúdio de fontes",
    render(main) {
      let sources = AV.LS.get("sources", []);
      const saveSrc = () => { if (!AV.LS.set("sources", sources)) AV.toast("Fontes grandes demais para guardar neste navegador; elas valem até fechar a página."); };
      const srcList = h("div", { style: { display: "grid", gap: "8px" } });
      const outBox = h("div", { style: { display: "grid", gap: "12px" } });
      const ask = h("input", { class: "in", id: "st-ask", placeholder: "Pergunte algo sobre as fontes...", onkeydown: (e) => { if (e.key === "Enter") askSources(); } });
      const level = h("input", { class: "in", id: "st-level", list: "dl-levels", placeholder: "Ano / turma (opcional)" });
      const topic = AV.LS.get("studioTopic"); if (topic) AV.LS.del("studioTopic");
      main.appendChild(h("div", { class: "wrap" },
        h("div", { class: "head" }, h("div", null, h("h1", null, "Estúdio de fontes"), h("p", null, "Reúna textos, arquivos e materiais. O assistente responde só com base nas fontes e cria resumos, quizzes, mapas mentais, áudio e projetos."))),
        h("div", { class: "studio" },
          h("div", { class: "card", style: { display: "grid", gap: "12px" } }, h("h2", null, "Fontes"),
            h("div", { class: "row" }, h("button", { class: "btn sm", onclick: addFile }, AV.icon("upload"), "Arquivo"), h("button", { class: "btn sm", onclick: addText }, AV.icon("doc"), "Colar texto"), h("button", { class: "btn sm", onclick: addMaterial }, AV.icon("folder"), "Meus materiais")),
            h("button", { class: "btn sm", onclick: addTopic }, AV.icon("sparkle"), "Pesquisar um tema com a IA"),
            srcList, h("p", { class: "muted small" }, "Arquivos aceitos: Word, PowerPoint, PDF, ODT, TXT, RTF e legendas de vídeo (.srt/.vtt).")),
          h("div", { style: { display: "grid", gap: "14px", alignContent: "start" } },
            h("div", { class: "card", style: { display: "grid", gap: "10px" } }, h("h2", null, "Perguntar às fontes"), h("div", { class: "composer" }, ask, h("button", { class: "btn pri", onclick: askSources, "aria-label": "Perguntar" }, AV.icon("send")))),
            outBox,
            h("div", { class: "card", style: { display: "grid", gap: "10px" } }, h("div", { class: "row" }, h("h2", null, "Criar a partir das fontes"), h("span", { class: "spacer" }), h("div", { style: { width: "200px" } }, level)),
              h("div", { class: "menu cols" }, OUTS.map((o) => h("button", { onclick: (e) => make(o, e.currentTarget) }, AV.appIcon(OUT_ICON[o[0]][0], OUT_ICON[o[0]][1]), h("b", null, o[1]), h("span", null, o[2]))))),
            outBox))));
      drawSrc();
      if (topic) researchTopic(topic);
      return () => { AV.cap.tts.then((t) => { if (t) t.stop().catch(() => {}); }); };
      function drawSrc() {
        srcList.textContent = "";
        if (!sources.length) srcList.appendChild(h("div", { class: "empty" }, "Nenhuma fonte ainda. Adicione um arquivo, cole um texto ou use um material seu."));
        sources.forEach((s, i) => srcList.appendChild(h("div", { class: "src" },
          h("input", { type: "checkbox", checked: s.on !== false, "aria-label": "Usar " + s.title, onchange: (e) => { s.on = e.target.checked; saveSrc(); } }),
          h("div", { style: { minWidth: 0 } }, h("b", null, "[" + (i + 1) + "] " + s.title), h("span", null, s.text.length.toLocaleString("pt-BR") + " caracteres")),
          h("button", { class: "btn ghost sm icon", "aria-label": "Remover fonte", onclick: () => { sources.splice(i, 1); saveSrc(); drawSrc(); } }, AV.icon("x")))));
      }
      function addSource(title, text) {
        sources = AV.LS.get("sources", sources);
        text = String(text || "").trim(); if (!text) { AV.toast("A fonte está vazia."); return; }
        const total = sources.reduce((a, s) => a + s.text.length, 0);
        if (total + text.length > 400000) { AV.toast("Limite de fontes atingido. Remova alguma antes."); return; }
        sources.push({ id: AV.uid(), title: title.slice(0, 80), text: text.slice(0, 200000), on: true }); saveSrc(); drawSrc();
      }
      async function addFile() {
        const fs = await AV.pickFile(".docx,.odt,.pptx,.pdf,.txt,.md,.rtf,.srt,.vtt", true);
        for (const f of fs) { try { AV.toast("Lendo " + f.name + "..."); const r = await AV.importers.importFile(f); addSource(f.name, r.text || (r.doc ? AV.docText(r.doc) : "")); } catch (e) { AV.toast(f.name + ": " + ((e && e.message) || "erro")); } }
      }
      function addText() {
        const t = h("input", { class: "in", placeholder: "Título da fonte" }), ta = h("textarea", { class: "in", rows: 10, placeholder: "Cole aqui um texto, artigo, trecho de livro ou transcrição de vídeo." });
        const d = AV.dialog("Colar texto", h("div", { style: { display: "grid", gap: "10px" } }, t, ta, h("div", { class: "row end" }, h("button", { class: "btn pri", onclick: () => { addSource(t.value.trim() || "Texto colado", ta.value); d.close(); } }, "Adicionar fonte"))), { large: true });
      }
      function addMaterial() {
        const l = AV.Store.list(); if (!l.length) { AV.toast("Você ainda não tem materiais."); return; }
        const d = AV.dialog("Usar um material como fonte", h("div", { class: "menu" }, l.map((x) => h("button", { onclick: () => { addSource(x.meta.title, AV.docText(x)); d.close(); } }, AV.icon("doc"), h("b", null, x.meta.title), h("span", null, AV.fmtDate(x.updated))))));
      }
      function addTopic() {
        const t = h("input", { class: "in", placeholder: "Ex.: Ciclo da água" });
        const d = AV.dialog("Pesquisar um tema", h("div", { style: { display: "grid", gap: "10px" } }, h("p", { class: "muted small" }, "A IA escreve um texto-base de referência sobre o tema, que vira uma fonte. Confira as informações antes de usar."), t, h("div", { class: "row end" }, h("button", { class: "btn pri", onclick: () => { if (t.value.trim()) { d.close(); researchTopic(t.value.trim()); } } }, "Criar texto-base"))));
      }
      async function researchTopic(t) {
        const card = h("div", { class: "card" }, h("span", { class: "spin" }), " Escrevendo texto-base sobre " + t + "..."); outBox.prepend(card);
        try { const txt = await AV.AI.text("Escreva um texto-base didático e correto (800 a 1200 palavras) sobre: " + t + ". Inclua conceitos, exemplos do Brasil, dados confiáveis (cite a instituição) e curiosidades. Use títulos com #."); addSource("Texto-base: " + t, txt); card.remove(); AV.toast("Fonte criada."); }
        catch (e) { card.textContent = AV.AI.explain(e); }
      }
      function corpus() {
        const on = sources.map((s, i) => [s, i]).filter(([s]) => s.on !== false);
        if (!on.length) return "";
        let budget = 60000 / on.length;
        return on.map(([s, i]) => "[Fonte " + (i + 1) + ": " + s.title + "]\n" + s.text.slice(0, budget)).join("\n\n");
      }
      function card(title, kids, text, kind) {
        const c = h("section", { class: "card", style: { display: "grid", gap: "10px" } }, h("div", { class: "row" }, h("h2", null, title), h("span", { class: "spacer" }),
          text ? h("button", { class: "btn sm", onclick: () => AV.copy(text) }, AV.icon("copy"), "Copiar") : null,
          text ? h("button", { class: "btn sm", onclick: () => textToDoc(text, kind || "apostila", title) }, AV.icon("doc"), "Salvar como material") : null,
          text ? h("button", { class: "btn sm wa icon", "aria-label": "WhatsApp", onclick: () => AV.openWhatsApp(("*" + title + "*\n\n" + text).slice(0, 3000)) }, AV.icon("chat")) : null,
          h("button", { class: "btn ghost sm icon", "aria-label": "Fechar", onclick: () => c.remove() }, AV.icon("x"))), kids);
        outBox.prepend(c); c.scrollIntoView({ block: "nearest", behavior: "smooth" }); return c;
      }
      async function askSources() {
        const q = ask.value.trim(), cp = corpus(); if (!q) return; if (!cp) { AV.toast("Adicione e marque ao menos uma fonte."); return; }
        ask.value = ""; const body = h("div", { class: "out" }, "Lendo as fontes..."); const c = card(q, body);
        try {
          let last = 0;
          const out = await AV.AI.text("Responda à pergunta usando SOMENTE as fontes abaixo. Cite as fontes no formato [Fonte n] após cada informação. Se a resposta não estiver nas fontes, diga isso claramente.\n\nPergunta: " + q + "\n\n" + cp, { onText: (u) => { const n = performance.now(); if (n - last > 150) { last = n; body.textContent = u.text; } } });
          c.replaceWith(card(q, AV.richText(out), out));
        } catch (e) { body.textContent = AV.AI.explain(e); }
      }
      async function make(o, btn) {
        const cp = corpus(); if (!cp) { AV.toast("Adicione e marque ao menos uma fonte."); return; }
        const lv = level.value.trim(), who = lv ? " para alunos do " + lv : "";
        if (o[3] === "create") { AV.aiCreateDialog({ kind: "apostila", topic: sources.filter((s) => s.on !== false).map((s) => s.title).join(", "), level: lv, sources: cp }); return; }
        if (o[3] === "doc") {
          AV.busy(btn, true, "Gerando...");
          AV.busy(btn, false);
          AV.liveCreate({ kind: o[0] === "projeto" ? "projeto" : "plano", topic: "o conteúdo das fontes", level: lv, sources: cp, extra: o[0] === "sequencia" ? "Organize como sequência didática de 4 a 6 aulas de 50 minutos, cada aula com objetivo, etapas, recursos e avaliação." : o[0] === "projeto" ? "Projeto educacional profissional, pronto para apresentar à coordenação ou compor um produto educacional de mestrado." : "" });
          return;
        }
        AV.busy(btn, true, "Gerando...");
        try {
          if (o[3] === "text") {
            const ask = { resumo: "um resumo estruturado com os pontos principais", guia: "um guia de estudo com conceitos-chave, 8 perguntas para revisão com respostas e dicas de estudo", faq: "8 a 10 perguntas frequentes com respostas claras", linha: "uma linha do tempo com datas e acontecimentos em ordem cronológica (formato: - data: fato)", glossario: "um glossário com os termos importantes em ordem alfabética" }[o[0]];
            const out = await AV.AI.text("Com base SOMENTE nas fontes, crie " + ask + who + ". Use títulos com # e cite [Fonte n].\n\n" + cp);
            card(o[1], AV.richText(out), out);
          } else if (o[3] === "quiz") {
            const j = await AV.AI.json("Com base nas fontes, crie um quiz" + who + " com 8 questões. Formato: {\"questions\":[{\"prompt\":\"\",\"options\":[\"\",\"\",\"\",\"\"],\"correct\":0,\"explanation\":\"\"}]}\n\n" + cp);
            quiz(j.questions || []);
          } else if (o[3] === "cards") {
            const j = await AV.AI.json("Com base nas fontes, crie 12 flashcards" + who + ". Formato: {\"cards\":[{\"front\":\"pergunta ou termo\",\"back\":\"resposta curta\"}]}\n\n" + cp, { tier: "quick" });
            cards(j.cards || []);
          } else if (o[3] === "mind") {
            const j = await AV.AI.json("Com base nas fontes, crie um mapa mental. Formato: {\"center\":\"tema\",\"branches\":[{\"label\":\"\",\"children\":[\"\",\"\"]}]} com 4 a 7 ramos e até 4 filhos curtos cada.\n\n" + cp, { tier: "quick" });
            mind(j);
          } else if (o[3] === "audio") {
            const j = await AV.AI.json("Escreva o roteiro de um resumo em áudio, como um podcast curto (3 a 4 minutos), em que dois apresentadores, Ana e Léo, conversam de forma leve e didática" + who + " sobre as fontes. Formato: {\"title\":\"\",\"lines\":[{\"speaker\":\"Ana\"|\"Léo\",\"text\":\"\"}]} com 14 a 22 falas curtas.\n\n" + cp);
            audio(j);
          }
        } catch (e) { AV.toast(AV.AI.explain(e)); }
        AV.busy(btn, false);
      }
      function quiz(qs) {
        qs = (Array.isArray(qs) ? qs : []).filter((q) => q && Array.isArray(q.options) && q.options.length > 1 && Number.isInteger(+q.correct) && +q.correct >= 0 && +q.correct < q.options.length).map((q) => Object.assign({}, q, { correct: +q.correct }));
        if (!qs.length) { AV.toast("A IA não montou o quiz direito. Tente de novo."); return; }
        let score = 0, answered = 0; const sc = h("b", { "aria-live": "polite" }, "");
        const list = h("div", { style: { display: "grid", gap: "14px" } }, qs.map((q, i) => {
          const fb = h("p", { class: "small" });
          const opts = h("div", { style: { display: "grid", gap: "6px" } }, (q.options || []).map((o, j) => h("button", { class: "btn", style: { justifyContent: "flex-start", whiteSpace: "normal", textAlign: "left" }, onclick: () => {
            if (opts.dataset.done) return; opts.dataset.done = 1; answered++;
            const ok = j === q.correct; if (ok) score++;
            opts.children[q.correct].style.borderColor = "var(--ok)"; opts.children[q.correct].style.background = "var(--ok-soft)";
            if (!ok) { opts.children[j].style.borderColor = "var(--bad)"; opts.children[j].style.background = "var(--bad-soft)"; }
            fb.textContent = (ok ? "Certo! " : "Não foi dessa vez. ") + (q.explanation || ""); sc.textContent = score + " de " + answered + " certas";
          } }, "abcd"[j] + ") " + o)));
          return h("div", { style: { display: "grid", gap: "6px" } }, h("b", null, (i + 1) + ". " + q.prompt), opts, fb);
        }));
        const toBlocks = () => qs.map((q) => ({ type: "choice_question", prompt: q.prompt, options: q.options, correct: q.correct }));
        const c = card("Quiz interativo", [sc, list, h("div", { class: "row" }, h("button", { class: "btn", onclick: () => AV.createAndOpen("lista", "Quiz", toBlocks()) }, AV.icon("doc"), "Salvar como lista de exercícios"))]);
        return c;
      }
      function cards(cs) {
        cs = (Array.isArray(cs) ? cs : []).filter((c) => c && c.front && c.back);
        if (!cs.length) { AV.toast("A IA não montou os cartões. Tente de novo."); return; }
        let i = 0;
        const fl = h("div", { class: "flash", role: "button", tabindex: 0, "aria-label": "Virar cartão", "aria-live": "polite", onclick: () => { fl.classList.toggle("on"); label(); }, onkeydown: (e) => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); fl.classList.toggle("on"); label(); } } }, h("div", { class: "flash-in" }, h("div", { class: "flash-f" }), h("div", { class: "flash-b" })));
        const pos = h("span", { class: "muted" });
        const label = () => fl.setAttribute("aria-label", AV.t("Cartão") + " " + (i + 1) + ": " + (fl.classList.contains("on") ? cs[i].back : cs[i].front) + ". " + AV.t("Toque para virar."));
        const show = () => { fl.classList.remove("on"); fl.querySelector(".flash-f").textContent = cs[i] ? cs[i].front : ""; fl.querySelector(".flash-b").textContent = cs[i] ? cs[i].back : ""; pos.textContent = (i + 1) + " / " + cs.length; label(); };
        show();
        card("Flashcards", [fl, h("div", { class: "row" }, h("button", { class: "btn", onclick: () => { i = (i - 1 + cs.length) % cs.length; show(); } }, "Anterior"), pos, h("button", { class: "btn", onclick: () => { i = (i + 1) % cs.length; show(); } }, "Próximo"), h("span", { class: "spacer" }),
          h("button", { class: "btn", onclick: () => AV.createAndOpen("atividade", "Flashcards", [{ type: "table", rows: [["Frente", "Verso"]].concat(cs.map((c) => [c.front, c.back])) }]) }, AV.icon("doc"), "Salvar para imprimir"))]);
      }
      function mind(j) {
        const br = (Array.isArray(j && j.branches) ? j.branches : []).filter((b) => b && b.label).map((b) => Object.assign({}, b, { children: Array.isArray(b.children) ? b.children : [] })).slice(0, 8), NSs = "http://www.w3.org/2000/svg";
        const rows = br.reduce((a, b) => a + Math.max(1, (b.children || []).length), 0), H = Math.max(220, rows * 30 + 40), W = 760;
        const svg = document.createElementNS(NSs, "svg"); svg.setAttribute("viewBox", "0 0 " + W + " " + H); svg.setAttribute("width", W); svg.setAttribute("role", "img"); svg.setAttribute("aria-label", "Mapa mental: " + (j.center || ""));
        const el = (t, a) => { const e = document.createElementNS(NSs, t); for (const k in a) e.setAttribute(k, a[k]); svg.appendChild(e); return e; };
        const txt = (x, y, s, anchor) => { const e = el("text", { x, y, "text-anchor": anchor || "start", "dominant-baseline": "middle" }); e.textContent = String(s).slice(0, 42); return e; };
        const colors = ["#2563EB", "#EA7A1F", "#0F9F6E", "#7C3AED", "#DB2777", "#0E7490", "#B45309", "#334155"];
        let y = 20; const cy = H / 2;
        br.forEach((b, bi) => {
          const kids = (b.children || []).slice(0, 5), n = Math.max(1, kids.length), by = y + n * 15;
          el("path", { d: "M150 " + cy + " C 200 " + cy + ", 200 " + by + ", 250 " + by, stroke: colors[bi % 8], fill: "none", "stroke-width": 2.5 });
          el("rect", { x: 250, y: by - 13, width: 190, height: 26, rx: 13, fill: colors[bi % 8] }); const t = txt(345, by, b.label, "middle"); t.setAttribute("style", "fill:#fff");
          kids.forEach((k, ki) => { const ky = y + 15 + ki * 30; el("path", { d: "M440 " + by + " C 470 " + by + ", 470 " + ky + ", 500 " + ky, stroke: colors[bi % 8], fill: "none", "stroke-width": 1.5 }); txt(506, ky, k); });
          y += n * 30;
        });
        el("rect", { x: 10, y: cy - 22, width: 140, height: 44, rx: 22, fill: "#111827" }); const c = txt(80, cy, j.center || "Tema", "middle"); c.setAttribute("style", "fill:#fff;font-weight:800");
        const outline = "# " + (j.center || "") + "\n" + br.map((b) => "- " + b.label + "\n" + (b.children || []).map((k) => "  - " + k).join("\n")).join("\n");
        card("Mapa mental", h("div", { class: "mind" }, svg), outline);
      }
      async function audio(j) {
        const lines = (Array.isArray(j && j.lines) ? j.lines : []).filter((l) => l && l.text);
        const tr = h("div", { class: "out", style: { maxHeight: "260px", overflow: "auto" } }, lines.map((l) => h("p", null, h("b", null, l.speaker + ": "), l.text)));
        const play = h("button", { class: "btn pri" }, AV.icon("audio"), "Ouvir");
        const stop = h("button", { class: "btn", hidden: true }, "Parar");
        const t = await AV.cap.tts;
        if (!t) play.replaceWith(h("p", { class: "note" }, "O áudio não está disponível neste navegador. O roteiro está abaixo para ler ou gravar com a turma."));
        else {
          play.onclick = () => { stop.hidden = false; play.disabled = true; t.speak(lines.map((l, i) => ({ text: l.text.slice(0, 1900), voice: /l[eé]o/i.test(l.speaker) ? "rounded" : "airy", language: "pt-BR", id: "l" + i }))).catch(() => {}).finally(() => { stop.hidden = true; play.disabled = false; }); };
          stop.onclick = () => t.stop();
          t.onLine && t.onLine(({ id }) => { const k = +String(id || "").slice(1); [...tr.children].forEach((p, i) => (p.style.background = i === k ? "var(--pri-soft)" : "")); });
        }
        card(j.title || "Resumo em áudio", [h("div", { class: "row" }, play, stop), tr], lines.map((l) => l.speaker + ": " + l.text).join("\n"));
      }
    }
  };
})(globalThis.AV = globalThis.AV || {});
