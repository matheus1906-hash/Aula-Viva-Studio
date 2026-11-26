(function (AV) {
  "use strict";
  const h = AV.h;

  /* Lê o JSON que a IA ainda está escrevendo e devolve o que já está completo:
     título, subtítulo e cada bloco do array "blocks" assim que o objeto fecha. */
  AV.liveParse = function (text) {
    const out = { title: "", subtitle: "", blocks: [] };
    const str = (k) => { const m = new RegExp('"' + k + '"\\s*:\\s*"((?:[^"\\\\]|\\\\.)*)"').exec(text); if (!m) return ""; try { return JSON.parse('"' + m[1] + '"'); } catch (e) { return m[1]; } };
    out.title = str("title"); out.subtitle = str("subtitle");
    const k = text.indexOf('"blocks"'); if (k < 0) return out;
    let i = text.indexOf("[", k); if (i < 0) return out;
    let depth = 0, start = -1, inStr = false, esc = false;
    for (i = i + 1; i < text.length; i++) {
      const c = text[i];
      if (inStr) { if (esc) esc = false; else if (c === "\\") esc = true; else if (c === '"') inStr = false; continue; }
      if (c === '"') { inStr = true; continue; }
      if (c === "{") { if (depth === 0) start = i; depth++; }
      else if (c === "}") { depth--; if (depth === 0 && start >= 0) { try { out.blocks.push(JSON.parse(text.slice(start, i + 1))); } catch (e) {} start = -1; } }
      else if (c === "]" && depth === 0) break;
    }
    return out;
  };

  const QTYPES = new Set(["choice_question", "true_false", "open_question", "fill_blank", "match"]);
  const STAGES = [["plan", "Planejando"], ["write", "Escrevendo o conteúdo"], ["build", "Montando o material"], ["done", "Pronto"]];

  /* Criação ao vivo: mostra etapas, contadores, a folha se montando e o texto da IA.
     host: dialog existente (AV.dialog) para reaproveitar; senão abre um novo. */
  AV.liveCreate = function (req, opts) {
    opts = opts || {};
    return new Promise((resolve) => {
      const ctrl = new AbortController();
      const kindLabel = ((AV.KINDS[req.kind] || [])[0] || "").toLowerCase();
      let raw = "", lastRender = 0, renderTimer = null, shown = 0, finished = false, failed = false;
      const t0 = Date.now();
      const stageBox = h("ol", { class: "live-steps", "aria-label": "Etapas" }, STAGES.map(([k, l]) => h("li", { "data-k": k }, h("span", { class: "dot", "aria-hidden": "true" }), AV.t(l))));
      const stat = (label) => { const b = h("b", null, "0"); return [b, h("div", { class: "live-stat" }, b, h("span", null, AV.t(label)))]; };
      const [nBlocks, sBlocks] = stat("blocos"), [nQs, sQs] = stat("questões"), [nWords, sWords] = stat("palavras"), [nTime, sTime] = stat("segundos");
      const titleEl = h("h3", { class: "live-title", "data-notr": "" }, AV.t("Aguardando a IA começar..."));
      const statusEl = h("p", { class: "muted small", "aria-live": "polite" }, AV.t("A IA está lendo o seu pedido e planejando o material."));
      const paperBox = h("div", { class: "live-paper", "aria-live": "off" }, h("div", { class: "live-empty" }, h("span", { class: "spin" }), " " + AV.t("A folha aparece aqui assim que o primeiro bloco ficar pronto.")));
      const rawPre = h("pre", { class: "live-raw", "data-notr": "" });
      const rawBox = h("details", { class: "live-raw-box" }, h("summary", null, AV.t("Ver o texto que a IA está escrevendo")), rawPre);
      const cancelBtn = h("button", { class: "btn", onclick: () => { ctrl.abort(); } }, AV.icon("x"), "Cancelar");
      const openBtn = h("button", { class: "btn pri", hidden: true }, AV.icon("doc"), "Abrir no editor");
      const retryBtn = h("button", { class: "btn", hidden: true }, AV.icon("refresh"), "Tentar de novo");
      const view = h("div", { class: "live" },
        h("div", { class: "live-side" }, stageBox, h("div", { class: "live-stats" }, sBlocks, sQs, sWords, sTime), titleEl, statusEl, rawBox,
          h("div", { class: "row" }, cancelBtn, retryBtn, openBtn)),
        paperBox);
      const d = opts.dialog || AV.dialog(AV.t("Criando com IA"), h("div"), { large: true });
      const body = d.el.lastChild; body.textContent = ""; body.appendChild(view); d.el.classList.add("lg");
      const timer = setInterval(() => { nTime.textContent = Math.round((Date.now() - t0) / 1000); if (!d.el.isConnected) { clearInterval(timer); if (!finished) ctrl.abort(); } }, 250);
      const setStage = (k) => { let past = true; stageBox.querySelectorAll("li").forEach((li) => { const cur = li.dataset.k === k; li.classList.toggle("on", cur); li.classList.toggle("ok", past && !cur); if (cur) past = false; }); };
      setStage("plan");

      const render = () => {
        renderTimer = null; lastRender = Date.now();
        if (failed) return;
        const part = AV.liveParse(raw);
        if (part.title) titleEl.textContent = part.title;
        const words = raw.replace(/"[a-z_]+"\s*:/g, " ").replace(/[{}\[\]",:]/g, " ").split(/\s+/).filter((w) => w.length > 1 && !/^(true|false|null|\d+)$/.test(w)).length;
        nWords.textContent = words; nBlocks.textContent = part.blocks.length; nQs.textContent = part.blocks.filter((b) => QTYPES.has(b && b.type)).length;
        if (!part.blocks.length && !part.title) return;
        const doc = AV.AI.toDoc({ title: part.title || req.topic, subtitle: part.subtitle, blocks: part.blocks }, req);
        doc.meta.cover = false;
        const paper = AV.renderPaper(doc, "aluno");
        const kids = [...paper.children];
        kids.slice(Math.max(0, kids.length - Math.max(0, part.blocks.length - shown))).forEach((k) => k.classList.add("live-new"));
        shown = part.blocks.length;
        const nearBottom = paperBox.scrollTop + paperBox.clientHeight >= paperBox.scrollHeight - 80;
        paperBox.textContent = ""; paperBox.appendChild(paper);
        if (nearBottom) paperBox.scrollTop = paperBox.scrollHeight;
        statusEl.textContent = part.blocks.length ? AV.t("Escrevendo o bloco") + " " + (part.blocks.length + 1) + "…" : AV.t("Escrevendo o título e a introdução…");
      };
      const onText = (u) => {
        if (failed) return;
        raw = u.text;
        if (raw.length && stageBox.querySelector("li.on").dataset.k === "plan") setStage("write");
        rawPre.textContent = raw.length > 6000 ? "…" + raw.slice(-6000) : raw;
        if (rawBox.open) rawPre.scrollTop = rawPre.scrollHeight;
        if (!renderTimer) renderTimer = setTimeout(render, Math.max(0, 220 - (Date.now() - lastRender)));
      };

      const onRetry = (why) => {
        raw = ""; shown = 0; setStage("write");
        statusEl.textContent = why === "format" ? AV.t("Conferindo o formato: refazendo para ficar exatamente como") + " " + kindLabel + "…" : AV.t("A resposta veio incompleta. Tentando de novo com outro motor de IA…");
      };
      AV.AI.document(req, { signal: ctrl.signal, onText, onRetry }).then((doc) => {
        finished = true; clearTimeout(renderTimer); raw = raw || ""; render();
        setStage("build"); statusEl.textContent = AV.t("Organizando e conferindo o material…");
        setTimeout(() => {
          setStage("done"); clearInterval(timer);
          const qs = doc.blocks.filter((b) => QTYPES.has(b.type)).length;
          nBlocks.textContent = doc.blocks.length; nQs.textContent = qs;
          titleEl.textContent = doc.meta.title;
          paperBox.textContent = ""; paperBox.appendChild(AV.renderPaper(doc, "aluno"));
          statusEl.textContent = AV.t("Pronto! Revise na folha ao lado e abra no editor para ajustar.");
          cancelBtn.hidden = true; openBtn.hidden = false; openBtn.focus();
          openBtn.onclick = () => { d.close(); AV.openDoc(doc); AV.toast("Material criado. Revise e ajuste o que quiser."); resolve(doc); };
        }, 450);
      }).catch((e) => {
        finished = true; failed = true; clearInterval(timer); clearTimeout(renderTimer);
        stageBox.querySelectorAll("li").forEach((li) => li.classList.remove("on"));
        statusEl.textContent = AV.AI.explain(e);
        cancelBtn.hidden = true;
        if (opts.onRetry) { retryBtn.hidden = false; retryBtn.onclick = () => opts.onRetry(); }
        resolve(null);
      });
    });
  };
})(globalThis.AV = globalThis.AV || {});
