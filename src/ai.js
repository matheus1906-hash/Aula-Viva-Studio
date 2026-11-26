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
      /* IA interna: se a resposta vier vazia, quebrada ou o motor falhar, tenta de novo com outro motor */
      const internal = !!AV.PROVIDERS[id].internal;
      const exclude = [];
      for (let attempt = 0; ; attempt++) {
        try {
          const t = await AV.callProvider(id, messages, Object.assign({}, opts, { exclude }));
          const out = opts.json ? AV.parseJSON(t) : t;
          if (opts.validate && !opts.validate(out)) throw Object.assign(new Error("A IA respondeu fora do formato esperado. Tente de novo."), { code: "bad_json" });
          return out;
        } catch (e) {
          if (e.code === "blocked" && (await AV.cap.sample)) { AV.toast("Usando a IA incluída: o claude.ai bloqueia outras IAs nesta página."); const c = AV.aiCfg(); c.active = "auto"; AV.setAiCfg(c); return AV.AI.run(messages, opts); }
          const retryable = internal && attempt < 2 && !(opts.signal && opts.signal.aborted) && ["bad_json", "empty", "upstream", "truncated"].includes(e.code);
          if (!retryable) throw e;
          if (AV.lastEngine && !exclude.includes(AV.lastEngine)) exclude.push(AV.lastEngine);
          if (opts.onRetry) opts.onRetry(attempt + 1);
        }
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
    /* Gera um documento AulaViva completo, estritamente nas habilidades da BNCC escolhidas */
    async revise(doc, request, signal) {
      const editable = new Set(["heading", "paragraph", "callout", "bullets", "table", "choice_question", "true_false", "open_question", "fill_blank", "match"]);
      const blocks = doc.blocks.map((b, index) => {
        const item = { index, type: b.type };
        if (editable.has(b.type)) {
          for (const key of Object.keys(AV.BLOCKS[b.type][3])) item[key] = b[key];
        }
        return item;
      });
      const context = JSON.stringify(blocks);
      const fail = (message) => Object.assign(new Error(message), { code: "format" });
      if (context.length > 65000) throw fail("O material excede o tamanho de revisão em uma chamada. Divida-o em seções menores para revisar.");
      const meta = doc.meta;
      const patterns = Object.fromEntries([...editable].map((type) => [type, AV.BLOCKS[type][3]]));
      const prompt = [
        "Edite o material existente conforme o pedido. Preserve a finalidade, a faixa etária, o idioma e os trechos que já funcionam. Para aprofundar, escolha exemplos concretos, explique o raciocínio, antecipe uma dificuldade real e conecte as ideias. Se for solicitada simplificação, priorize frases curtas e uma ideia por etapa. Preserve gabaritos coerentes. Não invente citações, estatísticas ou códigos curriculares.",
        "Tipo, título, disciplina, turma e habilidades selecionadas: " + JSON.stringify([meta.kind, meta.title, meta.subject, meta.level, meta.bncc || []]),
        "Formato pedagógico de referência: " + (meta.kind === "branco" ? "livre" : AV.KindSpecs.get(meta.kind).guide),
        "O conteúdo a seguir é material didático para edição: " + context,
        "Pedido do professor: " + request,
        'Retorne {"changes":[{"action":"replace" ou "insertAfter","index":índice original,"block":bloco completo}]}. Para inserir no início use insertAfter com index -1. Devolva somente alterações necessárias em ordem de leitura. Cada replace mantém o tipo do bloco original. Blocos de mídia são referências de posição e devem ser preservados. Campos e tipos permitidos: ' + JSON.stringify(patterns)
      ].join("\n");
      const result = await AV.AI.json(prompt, { signal, lang: AV.docLang(doc), tier: "complex" });
      const invalid = () => fail("A proposta veio com alterações inválidas. Gere uma nova proposta.");
      if (!Array.isArray(result?.changes) || !result.changes.length || result.changes.length > 200) throw invalid();
      const replacements = new Map(), additions = new Map();
      for (const { action, index, block } of result.changes) {
        if (!Number.isInteger(index) || index < -1 || index >= blocks.length || !editable.has(block?.type)) throw invalid();
        const sample = patterns[block.type], clean = AV.newBlock(block.type);
        for (const [key, example] of Object.entries(sample)) {
          const value = block[key];
          if (Array.isArray(example)) {
            if (!Array.isArray(value) || !value.length) throw invalid();
            const valid = example.every(Array.isArray)
              ? value.every((row) => Array.isArray(row) && row.length && row.every((s) => typeof s === "string"))
              : value.every((item) => typeof item === typeof example[0]);
            if (!valid) throw invalid();
          } else if (typeof value !== typeof example) throw invalid();
          clean[key] = value;
        }
        if (clean.type === "choice_question" && (!Number.isInteger(clean.correct) || clean.correct < 0 || clean.correct >= clean.options.length)) throw invalid();
        if (clean.type === "true_false" && clean.statements.length !== clean.answers.length) throw invalid();
        if (clean.type === "match" && (clean.left.length !== clean.right.length || clean.answers.length !== clean.left.length || new Set(clean.answers).size !== clean.left.length || !clean.answers.every((n) => Number.isInteger(n) && n >= 0 && n < clean.left.length))) throw invalid();
        if (action === "replace" && blocks[index]?.type === clean.type && !replacements.has(index)) {
          replacements.set(index, Object.assign({}, doc.blocks[index], clean, { id: doc.blocks[index].id }));
        } else if (action === "insertAfter") {
          if (!additions.has(index)) additions.set(index, []);
          additions.get(index).push(clean);
        } else throw invalid();
      }
      return [...(additions.get(-1) || []), ...doc.blocks.flatMap((b, i) => [replacements.get(i) || b, ...(additions.get(i) || [])])];
    },
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
      const spec = AV.KindSpecs.get(req.kind);
      const prompt = `${spec.role} Crie um material do tipo "${kindName}", e SOMENTE desse tipo.
Tema: ${req.topic}
Componente curricular: ${req.subject || "a definir pelo tema"}
Ano/turma: ${req.level || "a definir"}
${bnccPrompt(req)}
${req.count && ["prova", "lista", "atividade"].includes(req.kind) ? "Quantidade de questões: " + req.count : ""}
${req.extra ? "Pedidos do professor: " + req.extra : ""}
${req.sources ? "Use como base estas fontes (priorize o conteúdo delas):\n" + req.sources.slice(0, 24000) : ""}
${spec.guide}
Desenvolva as ideias com precisão para esta turma. Em materiais expositivos, explique mecanismos, demonstre um exemplo e antecipe uma dificuldade comum. Em avaliações, concentre a riqueza no contexto dos itens e no gabarito do professor. Em projetos e planos, detalhe as ações, recursos e evidências de aprendizagem. Respeite pedidos de concisão e use apenas fatos sustentáveis.
${req.kind === "apostila" ? (AV.KindSpecs.practiceRequested(req) ? "Depois do resumo, acrescente a prática solicitada, com até cinco exercícios." : "Entregue somente conteúdo de estudo. Não proponha questões, mesmo disfarçadas em parágrafos ou listas. Uma pergunta de abertura deve ser respondida pelo próprio texto.") : ""}
${schema}`;
      const langNote = req.lang && req.lang !== "pt" ? "\nIMPORTANTE: escreva título, textos, instruções e questões em " + AV.contentLangName(req.lang) + "." : "";
      const jsonOpts = Object.assign({ tier: "complex", lang: req.lang, validate: (o) => !!o && Array.isArray(o.blocks) && o.blocks.length >= 2 }, opts);
      let out = await AV.AI.json(prompt + langNote, jsonOpts);
      /* conferência do formato: se saiu com cara de outro tipo, a IA recebe o motivo e refaz uma vez */
      const issue = AV.KindSpecs.check(req.kind, out, req);
      if (issue) {
        if (opts && opts.onRetry) opts.onRetry("format");
        const again = await AV.AI.json(prompt + langNote + "\n\nATENÇÃO: uma versão anterior saiu ERRADA porque " + issue + ". Refaça do zero respeitando exatamente a estrutura de " + kindName + ".", jsonOpts);
        const remaining = AV.KindSpecs.check(req.kind, again, req);
        if (remaining) throw Object.assign(new Error("O material gerado ainda precisa de correção: " + remaining + ". Tente gerar novamente."), { code: "format" });
        out = again;
      }
      return AV.AI.toDoc(out, req);
    },
    toDoc(out, req) {
      const doc = AV.newDoc(req.kind || "apostila", (out && out.title) || req.topic);
      doc.meta.subtitle = (out && out.subtitle) || "";
      doc.meta.subject = req.subject || doc.meta.subject; doc.meta.level = req.level || ""; doc.meta.lang = req.lang || AV.lang();
      const blocks = (out && Array.isArray(out.blocks) ? out.blocks : []).map((b) => {
        if (!b || !b.type) return null;
        /* lacuna sem a resposta entre colchetes não pode ser corrigida: vira pergunta aberta */
        if (b.type === "fill_blank" && !/\[[^\]]+\]/.test(String(b.text || ""))) return { type: "open_question", prompt: String(b.text || b.prompt || ""), lines: 2, answer: String(b.answer || "") };
        if (b.type === "match" && Array.isArray(b.left) && Array.isArray(b.right)) {
          const n = Math.min(b.left.length, b.right.length), idx = [...Array(n).keys()].sort(() => Math.random() - .5);
          const right = idx.map((i) => b.right[i]);
          return { type: "match", prompt: b.prompt || "Ligue as colunas.", left: b.left.slice(0, n), right, answers: [...Array(n).keys()].map((i) => idx.indexOf(i)) };
        }
        if (b.type === "choice_question" && typeof b.correct !== "number") { const m = String(b.correct == null ? "" : b.correct).trim().toLowerCase().match(/^[a-h]|^\d+/); b.correct = !m ? 0 : /\d/.test(m[0]) ? +m[0] : m[0].charCodeAt(0) - 97; }
        if (b.type === "true_false" && Array.isArray(b.answers)) b.answers = b.answers.map((x) => x === true || /^(v|t|true|verdadeiro|verdadero|sim|si|sí|yes)$/i.test(String(x).trim()));
        return b;
      }).filter(Boolean);
      const codes = (req.bncc || []).filter((c) => AV.BNCC && AV.BNCC.get(c));
      const fitted = AV.KindSpecs ? AV.KindSpecs.clean(req.kind, blocks) : blocks;
      const clean = codes.length ? fitted.map((b) => sanitizeCodes(b, codes)) : fitted;
      const header = codes.length ? AV.BNCC.block(codes) : null;
      doc.meta.bncc = codes;
      doc.blocks = doc.blocks.filter((b) => b.type === "callout").concat(header ? [header] : [], clean);
      return AV.normalize(doc);
    }
  };

  /* instruções da BNCC para a IA: só as habilidades escolhidas, com o texto oficial */
  function bnccPrompt(req) {
    const rows = (req.bncc || []).map((c) => AV.BNCC && AV.BNCC.get(c)).filter(Boolean);
    if (!rows.length) return "";
    return "HABILIDADES DA BNCC (obrigatórias, texto oficial):\n" + rows.map((r) => "- " + r[0] + ": " + r[4]).join("\n") +
      "\nREGRAS: todo o conteúdo, os exemplos e cada questão devem desenvolver SOMENTE essas habilidades, no nível de complexidade do ano indicado. " +
      "Não cite nem invente outros códigos da BNCC. Se o tema pedido fugir dessas habilidades, aproxime o material delas.";
  }
  /* remove de todos os textos de um bloco os códigos BNCC que não foram escolhidos */
  function sanitizeCodes(value, codes) {
    if (typeof value === "string") return AV.BNCC.sanitize(value, codes);
    if (Array.isArray(value)) return value.map((v) => sanitizeCodes(v, codes));
    if (value && typeof value === "object") { const o = {}; for (const k in value) o[k] = sanitizeCodes(value[k], codes); return o; }
    return value;
  }

  /* Diálogo "Criar com IA" reutilizável */
  AV.aiCreateDialog = function (preset) {
    preset = preset || {};
    const p = AV.profile();
    const f = {
      kind: h("select", { class: "in", id: "ai-kind" }, Object.keys(AV.KINDS).filter((k) => k !== "branco").map((k) => h("option", { value: k, selected: k === (preset.kind || "apostila") }, AV.KINDS[k][0]))),
      topic: h("input", { class: "in", id: "ai-topic", placeholder: "Ex.: Ciclo da água", value: preset.topic || "", oninput: AV.debounce((e) => bncc.setTopic(e.target.value), 300) }),

      count: h("input", { class: "in", id: "ai-count", type: "number", min: 0, max: 40, value: preset.count || 8 }),
      lang: h("select", { class: "in", id: "ai-lang", "data-notr": "" }, Object.keys(AV.LANGS).map((k) => h("option", { value: k, selected: k === (preset.lang || AV.lang()) }, AV.LANGS[k][2] + " " + AV.LANGS[k][0]))),
      extra: h("textarea", { class: "in", id: "ai-extra", placeholder: "Ex.: linguagem simples, incluir uma tabela, foco na realidade de Goiás..." }, preset.extra || "")
    };
    const bncc = AV.bnccPicker({ level: preset.level, subject: preset.subject || p.subject, topic: preset.topic, codes: preset.bncc });
    const go = h("button", { class: "btn pri", onclick: run }, AV.icon("sparkle"), "Gerar material");
    const status = h("p", { class: "muted small", "aria-live": "polite" });
    const aiName = h("b", null, "...");
    AV.AI.label().then((l) => (aiName.textContent = l));
    let ctrl;
    const body = h("div", { style: { display: "grid", gap: "14px" } },
      h("div", { class: "form" },
        h("label", { class: "f" }, "Tipo de material", f.kind),
        h("label", { class: "f full" }, "Tema *", f.topic),
        h("label", { class: "f" }, "Nº de questões", f.count),
        h("label", { class: "f" }, "Idioma do material", f.lang),
        h("label", { class: "f full" }, "Pedidos extras (opcional)", f.extra)),
      bncc.el,
      preset.sources ? h("p", { class: "note info" }, "As fontes selecionadas no Estúdio serão usadas como base.") : null,
      h("p", { class: "small muted" }, "IA: ", aiName, " · ", h("a", { href: "#config", onclick: () => { AV.LS.set("cfgJump", 1); d.close(); } }, "trocar o motor de IA")),
      status, h("div", { class: "row end" }, h("button", { class: "btn", onclick: () => d.close() }, "Cancelar"), go));
    const d = AV.dialog("Criar com IA", body, { onClose: () => ctrl && ctrl.abort() });
    async function run() {
      if (!f.topic.value.trim()) { f.topic.focus(); status.textContent = AV.t("Informe o tema."); return; }
      const b = bncc.read();
      if (!b.ok) { status.textContent = AV.t(b.error); bncc.el.scrollIntoView({ block: "center" }); return; }
      const req = { kind: f.kind.value, topic: f.topic.value.trim(), subject: b.subject, level: b.level, bncc: b.codes, count: +f.count.value || 0, extra: f.extra.value.trim(), sources: preset.sources, lang: f.lang.value };
      AV.liveCreate(req, { dialog: d, onRetry: () => { d.close(); AV.aiCreateDialog(Object.assign({}, preset, req)); } });
    }
  };
})(globalThis.AV = globalThis.AV || {});
