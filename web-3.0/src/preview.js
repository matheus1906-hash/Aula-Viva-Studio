(function (AV) {
  "use strict";
  const h = AV.h;
  /* Prévia rápida em HTML (não depende das bibliotecas de exportação) */
  AV.renderPaper = function (doc, version) {
    const prof = version === "professor", m = doc.meta, L = AV.L(doc);
    const paper = h("div", { class: "paper", lang: AV.LABELS[AV.docLang(doc)] ? ({ pt: "pt-BR", en: "en", es: "es" })[AV.docLang(doc)] : "pt-BR" }); paper.style.setProperty("--th", AV.THEMES[m.theme] || "#2F6FED");
    if (m.cover) paper.appendChild(h("div", { class: "pv-cover" }, h("small", null, [m.subject, m.level].filter(Boolean).join(" · ")), h("b", null, m.title || "Sem título"), m.subtitle ? h("div", null, m.subtitle) : null, h("small", null, [m.school, m.author].filter(Boolean).join(" · "))));
    else paper.appendChild(h("h4", null, m.title || "Sem título"));
    if (prof) paper.appendChild(h("span", { class: "chip", style: { background: "#E7F6EC", color: "#15803D", width: "fit-content" } }, L.teacher));
    if (m.student_fields && !prof) paper.appendChild(h("div", { class: "pv-fields" }, h("span", null, L.name), h("span", null, L.class), h("span", null, L.date)));
    let n = 0;
    for (const b of doc.blocks) {
      const el = block(b); if (el) paper.appendChild(el);
    }
    return paper;
    function q(title, ...kids) { n++; return h("div", { class: "pv-q" }, h("b", null, n + ". ", AV.md(title || "")), kids); }
    function block(b) {
      switch (b.type) {
        case "heading": return h(b.level === 2 ? "h5" : "h4", null, b.text);
        case "paragraph": return h("p", null, AV.md(b.text));
        case "bullets": return h("ul", { style: { margin: 0, paddingLeft: "18px" } }, (b.items || []).filter(Boolean).map((i) => h("li", null, AV.md(i))));
        case "callout": { const c = AV.CALLOUTS[b.style] || AV.CALLOUTS.dica; const e = h("div", { class: "pv-call" }, h("b", null, b.title || c[0]), AV.md(b.text)); e.style.setProperty("--c", c[1]); return e; }
        case "image": return b.data ? h("figure", { style: { margin: 0, textAlign: "center" } }, h("img", { src: b.data, alt: b.caption || "Imagem", loading: "lazy", style: { width: (b.width || 80) + "%" } }), b.caption ? h("figcaption", { style: { fontSize: ".85em", color: "#64748B" } }, b.caption) : null) : null;
        case "qrcode": return h("div", { class: "pv-qr" }, qrCanvas(b.url, 72), h("div", null, h("b", null, b.caption || "QR code"), h("div", { class: "pv-link" }, b.url || "(sem link)")));
        case "link": case "word": return h("div", null, h("span", { class: "pv-link" }, "↗ " + (b.label || "Link")), b.description ? h("div", { style: { fontSize: ".85em", color: "#64748B" } }, b.description) : null);
        case "video": return h("div", { class: "pv-qr" }, qrCanvas(b.url, 60), h("div", null, h("b", null, "▶ " + (b.title || "Vídeo")), h("div", { style: { fontSize: ".85em", color: "#64748B" } }, b.info || b.url)));
        case "choice_question": return q(b.prompt, (b.options || []).map((o, i) => h("div", { class: "pv-opt" + (prof && i === b.correct ? " ok" : "") }, h("i"), "abcdefgh"[i] + ") ", AV.md(o))));
        case "true_false": return q(L.tf, (b.statements || []).map((s, i) => h("div", { class: "pv-opt" }, h("b", { class: prof ? "ok" : "" }, "( " + (prof ? (b.answers[i] ? L.T : L.F) : "  ") + " )"), " ", AV.md(s))));
        case "open_question": return q(b.prompt, prof && b.answer ? h("div", { class: "ok" }, L.answer + b.answer) : h("div", { class: "lines" }, Array.from({ length: Math.min(12, b.lines || 3) }, () => h("i"))));
        case "fill_blank": return q(b.prompt, h("p", null, prof ? (b.text || "").replace(/\[([^\]]*)\]/g, "«$1»") : (b.text || "").replace(/\[[^\]]*\]/g, "________")));
        case "match": return q(b.prompt, h("table", null, (b.left || []).map((l, i) => h("tr", null, h("td", null, "(" + (i + 1) + ") " + l), h("td", null, "( " + (prof ? (b.answers || []).indexOf(i) + 1 || "" : " ") + " ) " + ((b.right || [])[i] || ""))))));
        case "table": return h("table", null, (b.rows || []).map((r, ri) => h("tr", null, r.map((c) => h(ri ? "td" : "th", null, c)))));
        case "word_search": {
          const sol = new Set(); if (prof) (b.solution || []).forEach((s) => s.cells.forEach((c) => sol.add(c[0] + "," + c[1])));
          return q(b.title || "Caça-palavras", h("table", { class: "grid-t" }, (b.grid || []).map((r, ri) => h("tr", null, r.map((c, ci) => h("td", { class: sol.has(ri + "," + ci) ? "sol" : "" }, c))))), h("p", null, L.words + (b.words || []).join(", ")));
        }
        case "crossword": return q(b.title || "Cruzadinha", h("table", { class: "grid-t" }, (b.grid || []).map((r) => h("tr", null, r.map((c) => c ? h("td", { style: { position: "relative" } }, c.number ? h("sup", null, c.number) : null, prof ? c.letter : "") : h("td", { class: "blk0" }))))),
          h("p", null, h("b", null, L.across), ((b.clues || {}).across || []).map((c) => c.n + ". " + c.clue).join("  ")), h("p", null, h("b", null, L.down), ((b.clues || {}).down || []).map((c) => c.n + ". " + c.clue).join("  ")));
        case "divider": return h("hr", { style: { border: 0, borderTop: "1px solid #CBD5E1", width: "100%" } });
        case "page_break": return h("div", { class: "pv-pb" }, L.pb);
      }
      return null;
    }
  };
  function qrCanvas(url, px) {
    const c = h("canvas", { width: px, height: px, "aria-hidden": "true", style: { flex: "none", background: "#fff" } });
    if (url && AV.qr && AV.qr.matrix) { try { drawQR(c, AV.qr.matrix(url), "#111827", "#ffffff", 1); } catch (e) {} }
    else { const g = c.getContext("2d"); g.strokeStyle = "#CBD5E1"; g.strokeRect(1, 1, px - 2, px - 2); }
    return c;
  }
  function drawQR(canvas, m, fg, bg, quiet) {
    const n = m.length, q = quiet == null ? 4 : quiet, s = canvas.width / (n + q * 2), g = canvas.getContext("2d");
    g.fillStyle = bg; g.fillRect(0, 0, canvas.width, canvas.height); g.fillStyle = fg;
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (m[r][c]) g.fillRect(Math.floor((c + q) * s), Math.floor((r + q) * s), Math.ceil(s), Math.ceil(s));
  }
  AV.drawQR = drawQR;

  /* Exportar: escolhe formato e versão */
  AV.exportDialog = function (doc) {
    const fmts = (AV.exporters && AV.exporters.formats) || [{ id: "json", label: "Projeto AulaViva", ext: "json" }];
    const desc = { pdf: "Questões respondíveis, links e QR codes clicáveis", docx: "Abre no Word e no Google Docs para editar", pptx: "Slides para projetar na sala", html: "Página para abrir em qualquer navegador", md: "Texto organizado (Markdown)", txt: "Texto simples", json: "Projeto para abrir de novo no AulaViva" };
    let version = "aluno";
    const seg = h("div", { class: "seg", role: "group", "aria-label": "Versão" },
      ["aluno", "professor", "ambas"].map((v) => h("button", { type: "button", "aria-pressed": v === version ? "true" : "false", onclick: (e) => { version = v; seg.querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", x === e.currentTarget)); } }, v === "aluno" ? "Aluno" : v === "professor" ? "Professor (gabarito)" : "As duas")));
    const status = h("p", { class: "muted small", "aria-live": "polite" });
    const menu = h("div", { class: "menu cols" }, fmts.map((f) => h("button", { onclick: (e) => run(f, e.currentTarget) }, AV.fileBadge(f.ext, { pdf: "#DC2626", docx: "#2563EB", pptx: "#EA580C", html: "#0F9F6E", md: "#475569", txt: "#64748B", json: "#7C3AED" }[f.id] || "#64748B"), h("b", null, /\(\./.test(f.label) ? f.label : f.label + " (." + f.ext + ")"), h("span", null, desc[f.id] || ""))));
    const d = AV.dialog("Exportar material", h("div", { style: { display: "grid", gap: "14px" } }, h("div", { class: "row" }, h("b", null, "Versão:"), seg), menu, status,
      h("div", { class: "row" }, h("button", { class: "btn wa", onclick: () => { d.close(); AV.whatsSheet(doc); } }, AV.icon("chat"), "Enviar pelo WhatsApp"))), { large: true });
    async function run(f, btn) {
      if (!AV.exporters) { status.textContent = "Exportação indisponível."; return; }
      const vs = f.id === "json" ? ["aluno"] : version === "ambas" ? ["aluno", "professor"] : [version];
      AV.busy(btn, true, "Preparando...");
      try {
        for (const v of vs) {
          status.textContent = "Gerando " + f.label + (vs.length > 1 ? " (" + v + ")" : "") + "...";
          const r = await AV.exporters.export(doc, f.id, { version: v });
          await AV.saveFile(r.filename, r.blob);
        }
        status.textContent = "Pronto.";
      } catch (e) { status.textContent = "Não foi possível exportar: " + ((e && e.message) || e); }
      AV.busy(btn, false);
    }
  };
})(globalThis.AV = globalThis.AV || {});
