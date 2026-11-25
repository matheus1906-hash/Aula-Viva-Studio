(function (AV) {
  "use strict";
  /**
   * Seletor de ano/turma, componente e habilidades da BNCC (obrigatório na criação com IA).
   * AV.bnccPicker({ level, subject, topic, codes }) -> { el, read(), setTopic(t) }
   * read() devolve { ok, error, level, subject, etapa, ano, sigla, codes }.
   */
  const h = AV.h;
  const MAX = 4;
  const LEVELS = [
    ["EI-1", "Educação Infantil · Bebês (0 a 1a6m)"], ["EI-2", "Educação Infantil · Crianças bem pequenas (1a7m a 3a11m)"], ["EI-3", "Educação Infantil · Crianças pequenas (4 a 5 anos)"],
    ...[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => ["EF-" + n, n + "º ano do Ensino Fundamental"]),
    ...[1, 2, 3].map((n) => ["EM-" + n, n + "ª série do Ensino Médio"])
  ];
  const levelKey = (level) => { const i = AV.BNCC.levelInfo(level); return i.etapa ? i.etapa + "-" + (i.ano || (i.etapa === "EI" ? 3 : 1)) : ""; };
  AV.BNCC_LEVELS = LEVELS;

  AV.bnccPicker = function (preset) {
    preset = preset || {};
    let topic = preset.topic || "";
    let chosen = new Set(preset.codes || []);
    const levelSel = h("select", { class: "in", id: "bncc-level", required: true, "aria-required": "true" },
      h("option", { value: "" }, AV.t("Escolha o ano / turma")), LEVELS.map(([v, l]) => h("option", { value: v }, AV.t(l))));
    levelSel.value = levelKey(preset.level);
    const compSel = h("select", { class: "in", id: "bncc-comp", required: true, "aria-required": "true" });
    const search = h("input", { class: "in", type: "search", placeholder: AV.t("Buscar habilidade pelo código ou por palavra"), "aria-label": AV.t("Buscar habilidade") });
    const list = h("div", { class: "bncc-list", role: "group", "aria-label": AV.t("Habilidades da BNCC") });
    const counter = h("span", { class: "small muted", "aria-live": "polite" });
    const note = h("p", { class: "small muted bncc-note" });
    const el = h("div", { class: "bncc-pick" },
      h("div", { class: "form" }, h("label", { class: "f" }, AV.t("Ano / turma *"), levelSel), h("label", { class: "f" }, AV.t("Componente / campo de experiência *"), compSel)),
      h("div", { class: "bncc-head" }, h("b", null, AV.t("Habilidades da BNCC *")), counter), search, list, note);

    const parts = () => { const [etapa, ano] = (levelSel.value || "-").split("-"); return { etapa, ano: +ano || 0 }; };
    function fillComponents() {
      const { etapa } = parts();
      const prev = compSel.value || AV.BNCC.siglaFor(preset.subject, etapa);
      compSel.textContent = "";
      if (!etapa) { compSel.appendChild(h("option", { value: "" }, AV.t("Escolha primeiro o ano"))); return; }
      compSel.appendChild(h("option", { value: "*" }, AV.t(etapa === "EI" ? "Todos os campos de experiência" : "Interdisciplinar (todos os componentes)")));
      AV.BNCC.components(etapa).forEach(([sig, name]) => compSel.appendChild(h("option", { value: sig }, name)));
      compSel.value = [...compSel.options].some((o) => o.value === prev) ? prev : (etapa === "EI" ? "*" : "");
      if (!compSel.value) compSel.insertBefore(h("option", { value: "", selected: true }, AV.t("Escolha o componente")), compSel.firstChild);
    }
    function available() {
      const { etapa, ano } = parts();
      if (!etapa || !compSel.value) return [];
      return AV.BNCC.filter({ etapa, ano: etapa === "EM" ? 0 : ano, sigla: compSel.value === "*" ? "" : compSel.value });
    }
    function draw(autoSuggest) {
      const all = available();
      const { etapa } = parts();
      list.textContent = "";
      note.textContent = "";
      if (!etapa || !compSel.value) { list.appendChild(h("p", { class: "muted small" }, AV.t("Escolha o ano e o componente para ver as habilidades oficiais."))); update(); return; }
      if (!all.length) {
        note.textContent = AV.t("A BNCC não prevê habilidades deste componente neste ano (por exemplo, Língua Inglesa começa no 6º ano). Escolha outro componente ou ano.");
        update(); return;
      }
      chosen = new Set([...chosen].filter((c) => all.some((r) => r[0] === c)));
      const suggested = AV.BNCC.suggest(topic, all, 3);
      if (autoSuggest && !chosen.size) suggested.slice(0, 2).forEach((r) => chosen.add(r[0]));
      const q = search.value.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
      const match = (r) => !q || (r[0] + " " + r[4] + " " + r[5]).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").includes(q);
      const sugg = new Set(suggested.map((r) => r[0]));
      const ordered = all.filter(match).sort((a, b) => (chosen.has(b[0]) - chosen.has(a[0])) || (sugg.has(b[0]) - sugg.has(a[0])) || a[0].localeCompare(b[0]));
      ordered.slice(0, 120).forEach((r) => {
        const box = h("input", { type: "checkbox", checked: chosen.has(r[0]), onchange: (e) => {
          if (e.target.checked && chosen.size >= MAX) { e.target.checked = false; AV.toast(AV.t("Escolha no máximo 4 habilidades por material.")); return; }
          e.target.checked ? chosen.add(r[0]) : chosen.delete(r[0]); update();
        } });
        list.appendChild(h("label", { class: "bncc-item" + (chosen.has(r[0]) ? " on" : "") }, box,
          h("span", null, h("b", { "data-notr": "" }, r[0]), sugg.has(r[0]) ? h("em", null, AV.t("Sugerida")) : null, h("span", { "data-notr": "" }, r[4]), r[5] ? h("small", { "data-notr": "" }, r[5]) : null)));
      });
      if (!ordered.length) list.appendChild(h("p", { class: "muted small" }, AV.t("Nenhuma habilidade encontrada com essa busca.")));
      update();
    }
    function update() {
      counter.textContent = chosen.size + " / " + MAX + " " + AV.t("escolhidas");
      list.querySelectorAll(".bncc-item").forEach((l) => l.classList.toggle("on", l.querySelector("input").checked));
    }
    levelSel.addEventListener("change", () => { fillComponents(); chosen.clear(); draw(true); });
    compSel.addEventListener("change", () => { chosen.clear(); draw(true); });
    search.addEventListener("input", AV.debounce ? AV.debounce(() => draw(false), 150) : () => draw(false));

    AV.BNCC.load().then(() => { fillComponents(); draw(!chosen.size); }).catch(() => { list.textContent = AV.t("Não foi possível carregar a BNCC. Verifique a internet."); });

    return {
      el,
      setTopic(t) { topic = t || ""; if (AV.BNCC.ready()) draw(!chosen.size); },
      read() {
        const { etapa, ano } = parts();
        const label = (LEVELS.find(([v]) => v === levelSel.value) || [, ""])[1];
        const sigla = compSel.value;
        const subject = sigla === "*" ? (etapa === "EI" ? "Campos de experiência" : "Interdisciplinar") : AV.BNCC.componentName(etapa, sigla);
        const codes = [...chosen];
        const error = !etapa ? "Escolha o ano / turma." : !sigla ? "Escolha o componente curricular." : !codes.length ? "Escolha pelo menos uma habilidade da BNCC." : "";
        return { ok: !error, error, level: label, subject, etapa, ano, sigla, codes };
      }
    };
  };

  /** preenche o formulário a partir de um código (link "Criar atividade para EF05MA03" das páginas da BNCC) */
  AV.bnccPreset = function (code) {
    const r = AV.BNCC.get(code);
    if (!r) return null;
    const [cod, etapa, sigla, anos] = r;
    const level = etapa === "EI" ? "Educação Infantil " + (anos[0] === 1 ? "bebês" : anos[0] === 2 ? "crianças bem pequenas" : "crianças pequenas") : etapa === "EM" ? "1ª série do Ensino Médio" : anos[0] + "º ano do Ensino Fundamental";
    return { bncc: [cod], level, subject: AV.BNCC.componentName(etapa, sigla), topic: "" };
  };

  /** escolhe sozinho as habilidades para um pedido escrito (card da tela inicial); null se faltar ano ou componente */
  AV.bnccAuto = async function (req) {
    await AV.BNCC.load();
    const info = AV.BNCC.levelInfo(req.level);
    const sigla = AV.BNCC.siglaFor(req.subject, info.etapa) || (info.etapa === "EI" ? "" : null);
    if (!info.etapa || sigla === null) return null;
    const list = AV.BNCC.filter({ etapa: info.etapa, ano: info.etapa === "EM" ? 0 : info.ano, sigla });
    const best = AV.BNCC.suggest(req.topic, list, 2);
    if (!best.length) return null;
    return { codes: best.map((r) => r[0]), subject: sigla ? AV.BNCC.componentName(info.etapa, sigla) : "Campos de experiência" };
  };
})(globalThis.AV = globalThis.AV || {});
