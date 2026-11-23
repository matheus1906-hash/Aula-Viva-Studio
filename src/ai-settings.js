(function (AV) {
  "use strict";
  const h = AV.h, P = AV.PROVIDERS;
  const GROUPS = [["free", "IAs gratuitas (crie sua chave grátis em 2 minutos)"], ["local", "No seu computador"], ["builtin", "Incluída"], ["paid", "IAs pagas (use a sua própria chave)"]];

  AV.aiSettingsPanel = function () {
    const wrap = h("div", { style: { display: "grid", gap: "16px" } });
    const status = h("span", { class: "chip" }, "...");
    const refreshStatus = () => AV.AI.resolve().then((id) => { status.textContent = id ? "Em uso: " + P[id].name : "Nenhuma IA disponível"; status.className = "chip " + (id ? "pri" : "acc"); });
    const sel = h("select", { class: "in", id: "ai-active", style: { maxWidth: "340px" }, onchange: (e) => { const c = AV.aiCfg(); c.active = e.target.value; AV.setAiCfg(c); refreshStatus(); AV.toast("IA escolhida."); } });
    const fillSel = () => { const c = AV.aiCfg(); sel.textContent = ""; sel.appendChild(h("option", { value: "auto", selected: c.active === "auto" }, "Automático (recomendado)")); Object.keys(P).forEach((id) => sel.appendChild(h("option", { value: id, selected: c.active === id }, P[id].name + (AV.hasKey(id) ? "  ✓" : "")))); };
    const results = h("div", { class: "list" });
    const testAll = h("button", { class: "btn", onclick: async () => {
      results.textContent = ""; AV.busy(testAll, true, "Testando...");
      const ids = Object.keys(P).filter((id) => AV.hasKey(id));
      for (const id of ids) {
        const row = h("div", { class: "item", style: { gridTemplateColumns: "auto minmax(0,1fr)" } }, h("span", { class: "spin", style: { margin: "0 8px" } }), h("div", null, h("b", null, P[id].name), h("span", null, "testando...")));
        results.appendChild(row);
        try { const m = await AV.testProvider(id); row.firstChild.replaceWith(h("span", { class: "chip pri" }, "OK")); row.lastChild.lastChild.textContent = m; }
        catch (e) { row.firstChild.replaceWith(h("span", { class: "chip acc" }, "Falhou")); row.lastChild.lastChild.textContent = (e && e.message) || "erro"; }
      }
      if (!ids.length) results.appendChild(h("div", { class: "empty" }, "Nenhuma IA configurada ainda."));
      AV.busy(testAll, false);
    } }, AV.icon("check"), "Testar todas as IAs salvas");

    const inClaude = !!window.claude;
    wrap.append(...[
      h("div", { class: "row" }, h("label", { class: "f", style: { flex: "1 1 260px" } }, "IA usada pelo app", sel), status),
      inClaude ? h("div", { class: "note info" }, h("div", null, h("b", null, "Dentro do claude.ai a IA incluída já funciona, grátis e sem chave. "), "Por segurança, o claude.ai não deixa a página falar com outras IAs. Para usar Gemini, Groq ou sua IA paga, use a versão para hospedar (abaixo).")) : null,
      h("div", { class: "row" }, testAll, inClaude ? h("button", { class: "btn", onclick: AV.saveStandalone }, AV.icon("download"), "Baixar versão para hospedar") : null),
      results].filter(Boolean));
    if (!inClaude) wrap.append(h("div", { class: "note info" }, "Para usar a IA: escolha uma das gratuitas abaixo, clique em \"Criar chave\" (é grátis), copie e cole a chave no campo. O app salva e escolhe o melhor modelo sozinho."));
    GROUPS.forEach(([tag, title]) => {
      const ids = Object.keys(P).filter((id) => (P[id].builtin ? "builtin" : P[id].tag) === tag);
      if (!ids.length) return;
      wrap.append(h("h3", null, title), h("div", { class: "grid wide" }, ids.map(card)));
    });
    wrap.append(h("p", { class: "muted small" }, "As chaves ficam guardadas só neste navegador: não vão para a sua conta, para outros professores nem para o AulaViva. Nenhuma chave vem embutida no app, porque qualquer pessoa conseguiria copiá-la. Dados pessoais de alunos nunca são enviados às IAs."));
    fillSel(); refreshStatus();
    return wrap;

    function card(id) {
      const p = P[id], c = AV.aiCfg();
      const msg = h("p", { class: "small", "aria-live": "polite", style: { minHeight: "1.2em" } });
      const ok = (t) => { msg.style.color = "var(--ok)"; msg.textContent = t; }, bad = (t) => { msg.style.color = "var(--bad)"; msg.textContent = t; };
      const models = h("select", { class: "in", "aria-label": "Modelo de " + p.name, onchange: (e) => { const k = AV.aiCfg(); k.models[id] = e.target.value; AV.setAiCfg(k); } });
      const fillModels = (list) => { const cur = AV.aiCfg().models[id] || list[0] || ""; models.textContent = ""; [...new Set([cur].concat(list))].filter(Boolean).forEach((m) => models.appendChild(h("option", { value: m, selected: m === cur }, m))); };
      fillModels(p.models || []);
      const save = (v) => { const k = AV.aiCfg(); const key = AV.cleanKey(v); if (key) k.keys[id] = key; else delete k.keys[id]; AV.setAiCfg(k); fillSel(); refreshStatus(); return key; };
      const key = h("input", { class: "in", type: "password", autocomplete: "off", spellcheck: "false", placeholder: p.nokey ? "Não precisa de chave" : "Cole a chave aqui", value: c.keys[id] || "", "aria-label": "Chave de " + p.name, disabled: !!p.nokey,
        onchange: (e) => { if (save(e.target.value)) { ok("Chave salva neste navegador."); discover(); } },
        onpaste: () => setTimeout(() => { if (save(key.value)) { ok("Chave salva neste navegador."); discover(); } }, 30) });
      const eye = h("button", { class: "btn sm icon ghost", type: "button", "aria-label": "Mostrar chave", onclick: () => { key.type = key.type === "password" ? "text" : "password"; } }, AV.icon("eye"));
      async function discover() {
        if (p.builtin) return;
        try { const names = await AV.listModels(id); if (names.length) { const best = AV.pickModel(id, names); const k = AV.aiCfg(); k.models[id] = best; AV.setAiCfg(k); fillModels(names); ok("Chave salva. Modelo escolhido: " + best); } }
        catch (e) { bad(e.message); }
      }
      const extra = [];
      if (p.custom) {
        const base = h("input", { class: "in", placeholder: "https://servidor/v1", value: c.base.custom || "", onchange: (e) => { const k = AV.aiCfg(); k.base.custom = AV.safeUrl(e.target.value) || (/^http:\/\/(localhost|127\.0\.0\.1)/.test(e.target.value) ? e.target.value : ""); AV.setAiCfg(k); fillSel(); } });
        const mdl = h("input", { class: "in", placeholder: "nome-do-modelo", value: c.models.custom || "", onchange: (e) => { const k = AV.aiCfg(); k.models.custom = e.target.value.trim(); AV.setAiCfg(k); } });
        extra.push(h("label", { class: "f" }, "Endereço da API", base), h("label", { class: "f" }, "Modelo", mdl));
      } else if (id === "ollama") {
        const mdl = h("input", { class: "in", value: c.models.ollama || "", placeholder: "qwen2.5:7b", onchange: (e) => { const k = AV.aiCfg(); k.models.ollama = e.target.value.trim(); AV.setAiCfg(k); fillSel(); } });
        extra.push(h("label", { class: "f" }, "Modelo instalado", mdl));
      }
      const tagChip = h("span", { class: "chip " + (p.tag === "paid" ? "" : "pri") }, p.cost);
      return h("article", { class: "card", style: { display: "grid", gap: "10px", alignContent: "start" } },
        h("div", { class: "row" }, AV.providerLogo(id), h("div", { style: { flex: 1, minWidth: 0 } }, h("h3", null, p.name), tagChip)),
        p.note ? h("p", { class: "muted small" }, p.note) : null,
        p.builtin ? null : p.nokey ? null : h("label", { class: "f" }, "Chave da API", h("div", { class: "row", style: { flexWrap: "nowrap" } }, key, eye)),
        extra,
        p.builtin || p.custom || id === "ollama" ? null : h("label", { class: "f" }, "Modelo", models),
        h("div", { class: "row" },
          p.keyUrl ? h("a", { class: "btn sm", href: p.keyUrl, target: "_blank", rel: "noopener noreferrer" }, AV.icon("link"), p.nokey ? "Baixar" : "Criar chave") : null,
          h("button", { class: "btn sm", onclick: async (e) => { const b = e.currentTarget; AV.busy(b, true, "Testando..."); try { ok(await AV.testProvider(id)); } catch (er) { bad(er.message); } AV.busy(b, false); } }, "Testar"),
          !p.builtin && !p.nokey && !p.custom ? h("button", { class: "btn sm", onclick: discover }, "Buscar modelos") : null,
          !p.builtin && !p.nokey && !p.custom ? h("button", { class: "btn sm ghost danger", onclick: () => { key.value = ""; save(""); msg.textContent = "Chave removida."; } }, "Remover") : null,
          h("button", { class: "btn sm pri", onclick: () => { const k = AV.aiCfg(); k.active = id; AV.setAiCfg(k); fillSel(); refreshStatus(); AV.toast(p.name + " será usada."); } }, "Usar esta")),
        msg);
    }
  };

  /* logotipos simples (marcas desenhadas como iniciais coloridas, sem copiar logotipos) */
  const LOGO = { claude: ["#B4532F", "C"], gemini: ["#1967D2", "G"], groq: ["#B9361F", "Gq"], cerebras: ["#B8400F", "Ce"], openrouter: ["#4F46E5", "OR"], mistral: ["#B8400F", "M"], huggingface: ["#A35A00", "HF"], ollama: ["#111827", "Ol"], anthropic: ["#B4532F", "A"], openai: ["#0B7A5F", "AI"], deepseek: ["#3651D4", "DS"], custom: ["#475569", "+"] };
  AV.providerLogo = function (id) {
    const l = LOGO[id] || ["#64748B", "?"];
    return h("span", { "aria-hidden": "true", style: { width: "40px", height: "40px", borderRadius: "12px", background: l[0], color: "#fff", display: "grid", placeItems: "center", font: "900 .95rem var(--f-d)", flex: "none" } }, l[1]);
  };

  /* versão para hospedar (GitHub Pages, site da escola, pendrive) */
  AV.saveStandalone = async function () {
    try {
      const r = await fetch("aulaviva-studio-standalone.html");
      if (!r.ok) throw new Error();
      await AV.saveFile("aulaviva-studio.html", await r.blob());
      AV.dialog("Como usar a versão para hospedar", h("div", { style: { display: "grid", gap: "10px" } },
        h("p", null, "Esse arquivo é o AulaViva completo, com os 30 modelos. Fora do claude.ai ele usa as IAs que você configurar com a sua chave."),
        h("ul", { style: { margin: 0, paddingLeft: "18px" } }, h("li", null, "Abra direto no navegador (dois cliques), ou"), h("li", null, "Publique de graça no GitHub Pages ou no site da escola para os colegas usarem.")),
        h("p", { class: "muted small" }, "Os materiais ficam salvos no navegador de cada professor. Exporte um backup de vez em quando.")));
    } catch (e) { AV.toast("Não foi possível preparar o arquivo agora."); }
  };
})(globalThis.AV = globalThis.AV || {});
