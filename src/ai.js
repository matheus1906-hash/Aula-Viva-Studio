(function (AV) {
  "use strict";
  const h = AV.h;
  const ROLE_BASE = "Você é um assistente pedagógico experiente, alinhado à BNCC e ao currículo das redes públicas brasileiras, e também a boas práticas internacionais de ensino. Use linguagem adequada à faixa etária, conteúdo correto e sem estereótipos.";
  const roleFor = (lang) => ROLE_BASE + " Escreva TODO o conteúdo em " + AV.contentLangName(lang) + ".";

  const FREE_ORDER = ["aulaviva", "anthropic", "openai", "deepseek", "custom"];
  AV.AI = {
    async get() { return AV.cap.sample; },
    /* qual IA usar agora: a escolhida (se configurada) ou a primeira disponível */
    async resolve() {
      const c = AV.aiCfg(), s = await AV.cap.sample;
      if (s) return "claude";                                   /* dentro do claude.ai só a IA incluída funciona */
      const P = AV.PROVIDERS, a = c.active;
      if (a && a !== "auto" && P[a] && AV.hasKey(a)) return a;    /* motor interno escolhido ou IA paga com chave */
      return FREE_ORDER.find((id) => AV.hasKey(id)) || null;
    },
    async available() { return !!(await AV.AI.resolve()); },
    async label() { const id = await AV.AI.resolve(); return id ? AV.PROVIDERS[id].name : "Nenhuma IA configurada"; },
    explain(e) {
      const c = e && e.code;
      if (c === "not_granted") return "A IA não foi autorizada nesta página. Você pode continuar com modelos e o editor.";
      if (c === "rate_limited") return (e.message && e.message.length > 20) ? e.message : "Muitos pedidos seguidos. Aguarde um minuto e tente de novo.";
      if (c === "none") return "A IA não está disponível agora. Verifique a internet e tente de novo.";
      if (e && e.name === "AbortError") return "Geração cancelada.";
      if (e && e.message && c) return e.message;
      return "A IA não respondeu agora (" + (c || (e && e.message) || "erro") + "). Tente de novo.";
    },
    async run(messages, opts) {
      opts = opts || {};
      const id = await AV.AI.resolve();
      if (!id) { const e = new Error("none"); e.code = "none"; throw e; }
      if (id === "claude") {
        const s = await AV.cap.sample;
        const input = messages.length === 1 ? opts.system + "\n\n" + messages[0].content : messages.map((m, i) => i === 0 ? { role: m.role, content: opts.system + "\n\n" + m.content } : m);
        if (opts.json && opts.onText) return AV.parseJSON((await s(input, { onText: opts.onText, signal: opts.signal, modelTier: opts.tier || "default", cache: false })).text);
        if (opts.json) return s.json(input, { signal: opts.signal, modelTier: opts.tier || "default", cache: false });
        return (await s(input, { onText: opts.onText, signal: opts.signal, modelTier: opts.tier || "default", cache: false })).text;
      }
      try {
        const t = await AV.callProvider(id, messages, opts);
        return opts.json ? AV.parseJSON(t) : t;
      } catch (e) {
        if (e.code === "blocked" && (await AV.cap.sample)) { AV.toast("Usando a IA incluída: o claude.ai bloqueia outras IAs nesta página."); const c = AV.aiCfg(); c.active = "auto"; AV.setAiCfg(c); return AV.AI.run(messages, opts); }
        throw e;
      }
    },
    /* Texto livre (com streaming na IA incluída) */
    async text(prompt, opts) {
      opts = opts || {};
      const messages = typeof prompt === "string" ? [{ role: "user", content: prompt }] : prompt.map((m) => ({ role: m.role, content: String(m.content) }));
      return AV.AI.run(messages, Object.assign({}, opts, { system: roleFor(opts.lang) + (opts.system ? "\n" + opts.system : "") }));
    },
    async json(prompt, opts) {
      opts = opts || {};
      return AV.AI.run([{ role: "user", content: prompt + "\n\nResponda SOMENTE com JSON válido, sem comentários e sem texto fora do JSON." }], Object.assign({}, opts, { json: true, system: roleFor(opts.lang) }));
    },
    /* Gera um documento AulaViva completo */
    async document(req, opts) {
      const kindName = (AV.KINDS[req.kind] || AV.KINDS.apostila)[0];
      const schema = `Formato do JSON: {"title": string, "subtitle": string, "blocks": [bloco...]}.
Tipos de bloco permitidos (use só estes campos):
{"type":"heading","text":string,"level":1|2}
{"type":"paragraph","text":string}   (pode usar **negrito** e *itálico*)
{"type":"bullets","items":[string]}
{"type":"callout","style":"dica"|"atencao"|"importante"|"curiosidade"|"definicao","title":string,"text":string}
{"type":"choice_question","prompt":string,"options":[4 strings],"correct":índice}
{"type":"true_false","statements":[strings],"answers":[booleans]}
{"type":"open_question","prompt":string,"lines":número 2-8,"answer":string}
{"type":"fill_blank","prompt":string,"text":"frase com a resposta entre [colchetes]"}
{"type":"match","prompt":string,"left":[strings],"right":[strings na mesma ordem dos pares]}
{"type":"table","rows":[[cabeçalho...],[...]]}
{"type":"link","label":string,"url":"https://...","description":string}   (só sites oficiais e estáveis, ex.: ibge.gov.br, gov.br, phet.colorado.edu)
{"type":"video","title":string,"url":"https://www.youtube.com/results?search_query=termos","info":string}`;
      const guide = {
        apostila: "Apostila com seções (heading), textos explicativos, destaques, uma tabela ou lista quando útil e atividades ao final de cada seção.",
        lista: "Lista de exercícios variados (múltipla escolha, V/F, completar, ligar, abertas), do mais simples ao mais desafiador, com gabarito correto.",
        prova: "Avaliação com instruções (callout atencao), questões numeradas de vários tipos e níveis de dificuldade, gabarito correto.",
        roteiro: "Roteiro de aula com objetivo, etapas (heading por etapa), links e vídeos para os alunos, e uma atividade final.",
        plano: "Plano de aula: identificação, habilidades da BNCC (códigos reais), objetivos, conteúdos, metodologia passo a passo com tempo, recursos, avaliação, adaptações para inclusão e referências.",
        atividade: "Atividade lúdica e prática para imprimir, com instruções claras para o aluno.",
        projeto: "Projeto educacional profissional: apresentação, justificativa, objetivos (geral e específicos), habilidades da BNCC, público-alvo, metodologia em etapas, cronograma em tabela, recursos, produto final, avaliação, referências (ABNT).",
        branco: "Material didático bem organizado."
      }[req.kind] || "Material didático bem organizado.";
      const prompt = `Crie um material do tipo "${kindName}".
Tema: ${req.topic}
Componente curricular: ${req.subject || "a definir pelo tema"}
Ano/turma: ${req.level || "a definir"}
${req.count ? "Quantidade aproximada de questões: " + req.count : ""}
${req.extra ? "Pedidos do professor: " + req.extra : ""}
${req.sources ? "Use como base estas fontes (priorize o conteúdo delas):\n" + req.sources.slice(0, 24000) : ""}
Orientação: ${guide}
${schema}`;
      const out = await AV.AI.json(prompt + (req.lang && req.lang !== "pt" ? "\nIMPORTANTE: escreva título, textos, instruções e questões em " + AV.contentLangName(req.lang) + "." : ""), Object.assign({ tier: "complex", lang: req.lang }, opts));
      return AV.AI.toDoc(out, req);
    },
    toDoc(out, req) {
      const doc = AV.newDoc(req.kind || "apostila", (out && out.title) || req.topic);
      doc.meta.subtitle = (out && out.subtitle) || "";
      doc.meta.subject = req.subject || doc.meta.subject; doc.meta.level = req.level || ""; doc.meta.lang = req.lang || AV.lang();
      const blocks = (out && Array.isArray(out.blocks) ? out.blocks : []).map((b) => {
        if (!b || !b.type) return null;
        if (b.type === "match" && Array.isArray(b.left) && Array.isArray(b.right)) {
          const n = Math.min(b.left.length, b.right.length), idx = [...Array(n).keys()].sort(() => Math.random() - .5);
          const right = idx.map((i) => b.right[i]);
          return { type: "match", prompt: b.prompt || "Ligue as colunas.", left: b.left.slice(0, n), right, answers: [...Array(n).keys()].map((i) => idx.indexOf(i)) };
        }
        if (b.type === "choice_question" && typeof b.correct !== "number") { const m = String(b.correct == null ? "" : b.correct).trim().toLowerCase().match(/^[a-h]|^\d+/); b.correct = !m ? 0 : /\d/.test(m[0]) ? +m[0] : m[0].charCodeAt(0) - 97; }
        if (b.type === "true_false" && Array.isArray(b.answers)) b.answers = b.answers.map((x) => x === true || /^(v|t|true|verdadeiro|verdadero|sim|si|sí|yes)$/i.test(String(x).trim()));
        return b;
      }).filter(Boolean);
      doc.blocks = doc.blocks.filter((b) => b.type === "callout").concat(blocks);
      return AV.normalize(doc);
    }
  };

  /* Diálogo "Criar com IA" reutilizável */
  AV.aiCreateDialog = function (preset) {
    preset = preset || {};
    const p = AV.profile();
    const f = {
      kind: h("select", { class: "in", id: "ai-kind" }, Object.keys(AV.KINDS).filter((k) => k !== "branco").map((k) => h("option", { value: k, selected: k === (preset.kind || "apostila") }, AV.KINDS[k][0]))),
      topic: h("input", { class: "in", id: "ai-topic", placeholder: "Ex.: Ciclo da água", value: preset.topic || "" }),
      subject: h("input", { class: "in", id: "ai-subject", list: "dl-subjects", placeholder: "Ex.: Ciências", value: preset.subject || p.subject || "" }),
      level: h("input", { class: "in", id: "ai-level", list: "dl-levels", placeholder: "Ex.: 5º ano", value: preset.level || "" }),
      count: h("input", { class: "in", id: "ai-count", type: "number", min: 0, max: 40, value: preset.count || 8 }),
      lang: h("select", { class: "in", id: "ai-lang", "data-notr": "" }, Object.keys(AV.LANGS).map((k) => h("option", { value: k, selected: k === (preset.lang || AV.lang()) }, AV.LANGS[k][2] + " " + AV.LANGS[k][0]))),
      extra: h("textarea", { class: "in", id: "ai-extra", placeholder: "Ex.: linguagem simples, incluir uma tabela, foco na realidade de Goiás..." }, preset.extra || "")
    };
    const go = h("button", { class: "btn pri", onclick: run }, AV.icon("sparkle"), "Gerar material");
    const status = h("p", { class: "muted small", "aria-live": "polite" });
    const aiName = h("b", null, "...");
    AV.AI.label().then((l) => (aiName.textContent = l));
    let ctrl;
    const body = h("div", { style: { display: "grid", gap: "14px" } },
      h("div", { class: "form" },
        h("label", { class: "f" }, "Tipo de material", f.kind),
        h("label", { class: "f full" }, "Tema *", f.topic),
        h("label", { class: "f" }, "Componente curricular", f.subject),
        h("label", { class: "f" }, "Ano / turma", f.level),
        h("label", { class: "f" }, "Nº de questões", f.count),
        h("label", { class: "f" }, "Idioma do material", f.lang),
        h("label", { class: "f full" }, "Pedidos extras (opcional)", f.extra)),
      preset.sources ? h("p", { class: "note info" }, "As fontes selecionadas no Estúdio serão usadas como base.") : null,
      h("p", { class: "small muted" }, "IA: ", aiName, " · ", h("a", { href: "#config", onclick: () => { AV.LS.set("cfgJump", 1); d.close(); } }, "trocar o motor de IA")),
      status, h("div", { class: "row end" }, h("button", { class: "btn", onclick: () => d.close() }, "Cancelar"), go));
    const d = AV.dialog("Criar com IA", body, { onClose: () => ctrl && ctrl.abort() });
    async function run() {
      if (!f.topic.value.trim()) { f.topic.focus(); status.textContent = "Informe o tema."; return; }
      const req = { kind: f.kind.value, topic: f.topic.value.trim(), subject: f.subject.value.trim(), level: f.level.value.trim(), count: +f.count.value || 0, extra: f.extra.value.trim(), sources: preset.sources, lang: f.lang.value };
      AV.liveCreate(req, { dialog: d, onRetry: () => { d.close(); AV.aiCreateDialog(Object.assign({}, preset, req)); } });
    }
  };
})(globalThis.AV = globalThis.AV || {});
