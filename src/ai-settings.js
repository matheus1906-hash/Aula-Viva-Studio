(function (AV) {
  "use strict";
  const h = AV.h, P = AV.PROVIDERS;
  /* Ajustes de IA: o professor só escolhe o motor. As IAs gratuitas são internas (sem chave).
     Quem quiser pode usar uma IA paga com a própria chave, numa seção opcional. */
  const ENGINES = ["aulaviva", "groq", "mistral", "openrouter", "ollama"];
  const PAID = ["anthropic", "openai", "deepseek", "custom"];
  const EICON = { aulaviva: "sparkle", groq: "send", mistral: "doc", openrouter: "grid", ollama: "mind" };

  AV.aiSettingsPanel = function () {
    const wrap = h("div", { style: { display: "grid", gap: "16px" } });
    const status = h("span", { class: "chip" }, "...");
    const inClaude = !!window.claude;
    const refreshStatus = () => AV.AI.resolve().then((id) => { status.textContent = id ? AV.t("Em uso") + ": " + (P[id].short ? "AulaViva IA · " + AV.t(P[id].short) : P[id].name) : AV.t("IA indisponível"); status.className = "chip " + (id ? "pri" : "acc"); });
    const choose = (id) => { const c = AV.aiCfg(); c.active = id === "aulaviva" ? "auto" : id; AV.setAiCfg(c); draw(); refreshStatus(); AV.toast(AV.t("Motor de IA escolhido.")); };
    const current = () => { const a = AV.aiCfg().active; return !a || a === "auto" ? "aulaviva" : a; };
    const engines = h("div", { class: "eng-grid", role: "radiogroup", "aria-label": AV.t("Motor de IA") });
    const testMsg = h("p", { class: "small", "aria-live": "polite", style: { minHeight: "1.2em", margin: 0 } });
    const testBtn = h("button", { class: "btn", onclick: async () => {
      AV.busy(testBtn, true, "Testando...");
      try { const id = await AV.AI.resolve(); if (!id) throw new Error(AV.t("IA indisponível")); testMsg.style.color = "var(--ok)"; testMsg.textContent = await AV.testProvider(id); }
      catch (e) { testMsg.style.color = "var(--bad)"; testMsg.textContent = (e && e.message) || "erro"; }
      AV.busy(testBtn, false);
    } }, AV.icon("check"), "Testar a IA");
    function draw() {
      engines.textContent = "";
      const cur = current();
      ENGINES.forEach((id) => {
        const p = P[id], on = cur === id;
        engines.appendChild(h("button", { type: "button", class: "eng" + (on ? " on" : ""), role: "radio", "aria-checked": on ? "true" : "false", disabled: inClaude, onclick: () => choose(id) },
          h("span", { class: "eng-ic" }, AV.icon(EICON[id])),
          h("span", { class: "eng-t" }, h("b", null, AV.t(p.short)), id === "aulaviva" ? h("em", null, AV.t("Recomendado")) : null),
          h("span", { class: "eng-d" }, AV.t(p.desc)),
          p.engineName ? h("small", { "data-notr": "" }, p.engineName) : h("small", null, AV.t("Groq, Mistral, OpenRouter e Ollama")),
          h("span", { class: "eng-dot", "aria-hidden": "true" })));
      });
      const paidOn = PAID.includes(cur);
      paidNote.hidden = !paidOn;
      if (paidOn) paidNote.textContent = AV.t("Você está usando uma IA paga com a sua chave:") + " " + P[cur].name + ". " + AV.t("Escolha um motor acima para voltar à IA gratuita incluída.");
    }
    const paidNote = h("p", { class: "note", hidden: true });
    wrap.append(...[
      h("div", { class: "row" }, h("p", { class: "muted small", style: { margin: 0, flex: "1 1 260px" } }, inClaude ? AV.t("Dentro do claude.ai o app usa a IA incluída do Claude, grátis e sem chave.") : AV.t("A IA já vem incluída e é grátis: não precisa criar conta nem colar chave. Escolha o motor que preferir.")), status),
      engines, paidNote,
      h("div", { class: "row" }, testBtn, inClaude ? h("button", { class: "btn", onclick: AV.saveStandalone }, AV.icon("download"), "Baixar versão para hospedar") : null),
      testMsg].filter(Boolean));
    if (!inClaude) {
      const paid = h("details", { class: "paid-ai" }, h("summary", null, AV.t("Usar uma IA paga com a sua própria chave (opcional)")),
        h("p", { class: "muted small" }, AV.t("Só para quem já assina uma IA paga. A chave fica guardada apenas neste aparelho, criptografada na sua conta.")),
        h("div", { class: "grid wide" }, PAID.map(card)));
      if (PAID.includes(current())) paid.open = true;
      wrap.append(paid);
    }
    wrap.append(h("p", { class: "muted small" }, AV.t("Dados pessoais de alunos nunca são enviados às IAs.")));
    draw(); refreshStatus();
    return wrap;

    function card(id) {
      const p = P[id], c = AV.aiCfg();
      const msg = h("p", { class: "small", "aria-live": "polite", style: { minHeight: "1.2em" } });
      const ok = (t) => { msg.style.color = "var(--ok)"; msg.textContent = t; }, bad = (t) => { msg.style.color = "var(--bad)"; msg.textContent = t; };
      const models = h("select", { class: "in", "aria-label": "Modelo de " + p.name, onchange: (e) => { const k = AV.aiCfg(); k.models[id] = e.target.value; AV.setAiCfg(k); } });
      const fillModels = (list) => { const cur = AV.aiCfg().models[id] || list[0] || ""; models.textContent = ""; [...new Set([cur].concat(list))].filter(Boolean).forEach((m) => models.appendChild(h("option", { value: m, selected: m === cur }, m))); };
      fillModels(p.models || []);
      const save = (v) => { const k = AV.aiCfg(); const key = AV.cleanKey(v); if (key) k.keys[id] = key; else delete k.keys[id]; AV.setAiCfg(k); refreshStatus(); return key; };
      const key = h("input", { class: "in", type: "password", autocomplete: "off", spellcheck: "false", placeholder: "Cole a chave aqui", value: c.keys[id] || "", "aria-label": "Chave de " + p.name,
        onchange: (e) => { if (save(e.target.value)) { ok("Chave salva neste aparelho."); discover(); } },
        onpaste: () => setTimeout(() => { if (save(key.value)) { ok("Chave salva neste aparelho."); discover(); } }, 30) });
      const eye = h("button", { class: "btn sm icon ghost", type: "button", "aria-label": "Mostrar chave", onclick: () => { key.type = key.type === "password" ? "text" : "password"; } }, AV.icon("eye"));
      async function discover() {
        try { const names = await AV.listModels(id); if (names.length) { const best = AV.pickModel(id, names); const k = AV.aiCfg(); k.models[id] = best; AV.setAiCfg(k); fillModels(names); ok("Chave salva. Modelo escolhido: " + best); } }
        catch (e) { bad(e.message); }
      }
      const extra = [];
      if (p.custom) {
        const base = h("input", { class: "in", placeholder: "https://servidor/v1", value: c.base.custom || "", onchange: (e) => { const k = AV.aiCfg(); k.base.custom = AV.safeUrl(e.target.value) || (/^http:\/\/(localhost|127\.0\.0\.1)/.test(e.target.value) ? e.target.value : ""); AV.setAiCfg(k); } });
        const mdl = h("input", { class: "in", placeholder: "nome-do-modelo", value: c.models.custom || "", onchange: (e) => { const k = AV.aiCfg(); k.models.custom = e.target.value.trim(); AV.setAiCfg(k); } });
        extra.push(h("label", { class: "f" }, "Endereço da API", base), h("label", { class: "f" }, "Modelo", mdl));
      }
      return h("article", { class: "card", style: { display: "grid", gap: "10px", alignContent: "start" } },
        h("div", { class: "row" }, AV.providerLogo(id), h("div", { style: { flex: 1, minWidth: 0 } }, h("h3", null, p.name), h("span", { class: "chip" }, p.cost))),
        p.note ? h("p", { class: "muted small" }, p.note) : null,
        p.custom ? null : h("label", { class: "f" }, "Chave da API", h("div", { class: "row", style: { flexWrap: "nowrap" } }, key, eye)),
        extra,
        p.custom ? null : h("label", { class: "f" }, "Modelo", models),
        h("div", { class: "row" },
          p.keyUrl ? h("a", { class: "btn sm", href: p.keyUrl, target: "_blank", rel: "noopener noreferrer" }, AV.icon("link"), "Onde pegar a chave") : null,
          h("button", { class: "btn sm", onclick: async (e) => { const b = e.currentTarget; AV.busy(b, true, "Testando..."); try { ok(await AV.testProvider(id)); } catch (er) { bad(er.message); } AV.busy(b, false); } }, "Testar"),
          !p.custom ? h("button", { class: "btn sm ghost danger", onclick: () => { key.value = ""; save(""); msg.textContent = "Chave removida."; } }, "Remover") : null,
          h("button", { class: "btn sm pri", onclick: () => { if (!AV.hasKey(id)) { bad(p.custom ? "Informe o endereço da API." : "Cole a chave primeiro."); return; } choose(id); } }, "Usar esta")),
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
        h("p", null, "Esse arquivo é o AulaViva completo, com todos os modelos. Fora do claude.ai ele usa a IA gratuita incluída do AulaViva (precisa de internet)."),
        h("ul", { style: { margin: 0, paddingLeft: "18px" } }, h("li", null, "Abra direto no navegador (dois cliques), ou"), h("li", null, "Publique de graça no GitHub Pages ou no site da escola para os colegas usarem.")),
        h("p", { class: "muted small" }, "Os materiais ficam salvos no navegador de cada professor. Exporte um backup de vez em quando.")));
    } catch (e) { AV.toast("Não foi possível preparar o arquivo agora."); }
  };
})(globalThis.AV = globalThis.AV || {});
